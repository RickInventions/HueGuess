import { Server, Socket } from 'socket.io';
import {
  roomManager,
  GRACE_PERIOD_MS,
  DISCONNECT_WARNING_MS,
  RESULTS_DURATION_MS,
  COUNTDOWN_SECONDS,
} from './roomManager.js';
import {
  CreateRoomInput,
  JoinRoomInput,
  SubmitColorInput,
  RoomConfig,
  RoomMode,
  RoomVisualMode,
  Room,
  SocketUser,
  GameEndReason,
  ChatReplyTo,
} from './types.js';
import { Difficulty } from '../types/game.types.js';
import { HSLColor } from '../types/game.types.js';
import { FriendService } from '../services/friend.service.js';
import { notifyUser } from './presence.js';

// ── Timers ──────────────────────────────────────────────────────────────────
// Every scheduled transition is tracked so it can be cancelled when the room's
// state changes underneath it (player leaves, un-readies, host ends session…).

interface RoomTimers {
  countdown?: NodeJS.Timeout;
  memorization?: NodeJS.Timeout;
  reconstruction?: NodeJS.Timeout;
  postRound?: NodeJS.Timeout;
}

const roomTimers: Map<string, RoomTimers> = new Map();
/** `${roomCode}:${userId}` -> grace-period timers for a dropped player. */
const graceTimers: Map<string, { warning: NodeJS.Timeout; removal: NodeJS.Timeout }> = new Map();

/** Submissions arriving this late after the deadline are still honoured. */
const SUBMIT_GRACE_MS = 750;
const MAX_CHAT_LENGTH = 200;

/** Room capacity bounds. Keep in sync with the frontend room setup control. */
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;

/**
 * How long a `typing` signal stands before the client should drop it. The client
 * refreshes while the person keeps typing, so this only has to outlast the gap
 * between two keystrokes.
 */
const TYPING_TTL_MS = 4_000;

/**
 * How long before the same person can be invited again by the same sender.
 *
 * Enforced here as well as on the client so a second tab, a refresh or a hand-
 * rolled emit can't sit on one person. The `allow(socket, 'invite', …)` bucket
 * caps total invite volume; this caps volume aimed at a single player.
 */
const INVITE_COOLDOWN_MS = 60_000;

/** `${senderUserId}:${targetUserId}` -> epoch ms at which the pair frees up. */
const inviteCooldowns: Map<string, number> = new Map();

function inviteCooldownRemaining(senderId: string, targetId: string): number {
  const now = Date.now();
  // Swept opportunistically rather than on a timer: the map only grows when
  // someone invites, so the invite path is exactly where it should be pruned.
  for (const [key, expiresAt] of inviteCooldowns) {
    if (expiresAt <= now) inviteCooldowns.delete(key);
  }
  return Math.max(0, (inviteCooldowns.get(`${senderId}:${targetId}`) ?? 0) - now);
}

function startInviteCooldown(senderId: string, targetId: string): void {
  inviteCooldowns.set(`${senderId}:${targetId}`, Date.now() + INVITE_COOLDOWN_MS);
}

function getTimers(roomCode: string): RoomTimers {
  let timers = roomTimers.get(roomCode);
  if (!timers) {
    timers = {};
    roomTimers.set(roomCode, timers);
  }
  return timers;
}

function clearTimer(roomCode: string, key: keyof RoomTimers): void {
  const timers = roomTimers.get(roomCode);
  if (!timers?.[key]) return;
  clearTimeout(timers[key] as NodeJS.Timeout);
  clearInterval(timers[key] as NodeJS.Timeout);
  delete timers[key];
}

function clearRoomTimers(roomCode: string): void {
  const timers = roomTimers.get(roomCode);
  if (!timers) return;
  (Object.keys(timers) as (keyof RoomTimers)[]).forEach(key => clearTimer(roomCode, key));
  roomTimers.delete(roomCode);
}

function clearGraceTimers(key: string): void {
  const timers = graceTimers.get(key);
  if (!timers) return;
  clearTimeout(timers.warning);
  clearTimeout(timers.removal);
  graceTimers.delete(key);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function emitError(socket: Socket, message: string, code = 'ERROR'): void {
  socket.emit('error', { message, code });
}

function players(room: Room | null) {
  return roomManager.serializePlayers(room);
}

function roomPayload(room: Room) {
  return {
    players: players(room),
    hostSocketId: roomManager.getHostSocketId(room),
    phase: room.phase,
    currentRound: room.currentRound,
    totalRounds: room.totalRounds,
  };
}

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'extreme'];
const ROOM_MODES: RoomMode[] = ['challenge', 'duel'];
const VISUAL_MODES: RoomVisualMode[] = ['normal', 'inverted', 'blind_target', 'blind_sliders'];

/** Elimination cadence bounds. Keep in sync with the frontend room setup control. */
const MIN_ELIM_EVERY = 1;
const MAX_ELIM_EVERY = 5;

/** Validate + normalise a client-supplied room config. Throws with a readable message. */
function parseConfig(input: Partial<RoomConfig> | undefined): RoomConfig {
  const raw = input ?? {};

  const roundTimeSeconds = Math.round(Number(raw.roundTimeSeconds ?? 20));
  const colorTimeSeconds = Math.round(Number(raw.colorTimeSeconds ?? 3) * 2) / 2; // 0.5s steps
  const difficulty = (raw.difficulty ?? 'medium') as Difficulty;
  const maxPlayers = Math.round(Number(raw.maxPlayers ?? 4));
  const specificRounds =
    raw.specificRounds === null || raw.specificRounds === undefined
      ? null
      : Math.round(Number(raw.specificRounds));

  // Newer settings default rather than reject, so a client running older code
  // can still open a room instead of failing validation on a field it never sent.
  const mode = (raw.mode ?? 'challenge') as RoomMode;
  const sliderShuffle = raw.sliderShuffle === true;
  /**
   * Elimination is a percentage-mode rule.
   *
   * Point mode scores in whole points, so for the first rounds most of the room
   * is tied on the same number and the player knocked out would be picked by the
   * tiebreak rather than by the score everyone can see — the standing on screen
   * would not be the standing it eliminated on. Forced off here as well as hidden
   * in the form, so a stale or hand-rolled client can't set both.
   */
  const elimination = raw.elimination === true && mode !== 'duel';
  const elimEveryRounds = Math.round(Number(raw.elimEveryRounds ?? 2));
  const visualMode = (raw.visualMode ?? 'normal') as RoomVisualMode;

  if (!Number.isFinite(roundTimeSeconds) || roundTimeSeconds < 10 || roundTimeSeconds > 40) {
    throw new Error('Round time must be between 10 and 40 seconds');
  }
  if (!Number.isFinite(colorTimeSeconds) || colorTimeSeconds < 0.5 || colorTimeSeconds > 7) {
    throw new Error('Color time must be between 0.5 and 7 seconds');
  }
  if (!DIFFICULTIES.includes(difficulty)) {
    throw new Error('Invalid difficulty');
  }
  if (!ROOM_MODES.includes(mode)) {
    throw new Error('Invalid game mode');
  }
  if (!VISUAL_MODES.includes(visualMode)) {
    throw new Error('Invalid colour mode');
  }
  if (!Number.isFinite(maxPlayers) || maxPlayers < MIN_PLAYERS || maxPlayers > MAX_PLAYERS) {
    throw new Error(`Max players must be between ${MIN_PLAYERS} and ${MAX_PLAYERS}`);
  }
  if (specificRounds !== null && (!Number.isFinite(specificRounds) || specificRounds < 1 || specificRounds > 50)) {
    throw new Error('Specific rounds must be between 1 and 50');
  }
  if (
    !Number.isFinite(elimEveryRounds) ||
    elimEveryRounds < MIN_ELIM_EVERY ||
    elimEveryRounds > MAX_ELIM_EVERY
  ) {
    throw new Error(`Eliminate every N rounds must be between ${MIN_ELIM_EVERY} and ${MAX_ELIM_EVERY}`);
  }

  return {
    roundTimeSeconds,
    colorTimeSeconds,
    difficulty,
    // Elimination derives the round count from how many people are playing, so a
    // fixed count can't coexist with it.
    specificRounds: elimination ? null : specificRounds,
    maxPlayers,
    mode,
    sliderShuffle,
    elimination,
    elimEveryRounds,
    visualMode,
  };
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

/**
 * Identity always comes from the verified JWT; only the display name may be
 * refreshed by the client (a username change doesn't reissue the token).
 */
function resolveIdentity(socket: Socket, claimed?: string): SocketUser {
  const user = socket.data.user as SocketUser;
  const username = typeof claimed === 'string' && USERNAME_RE.test(claimed.trim()) ? claimed.trim() : user.username;
  return { ...user, username };
}

/** Simple per-socket token bucket, used to keep chat and actions from being spammed. */
function allow(socket: Socket, bucket: string, limit: number, windowMs: number): boolean {
  const buckets: Record<string, number[]> = (socket.data.buckets ??= {});
  const now = Date.now();
  const hits = (buckets[bucket] ??= []).filter(t => now - t < windowMs);
  buckets[bucket] = hits;
  if (hits.length >= limit) return false;
  hits.push(now);
  return true;
}

// ── Round lifecycle ─────────────────────────────────────────────────────────

function cancelCountdown(io: Server, roomCode: string, reason: string): void {
  const timers = roomTimers.get(roomCode);
  if (!timers?.countdown) return;
  clearTimer(roomCode, 'countdown');
  io.to(roomCode).emit('countdown_cancelled', { reason });
}

function startCountdown(io: Server, roomCode: string, kind: 'new' | 'next'): void {
  const room = roomManager.getRoom(roomCode);
  if (!room || room.phase !== 'waiting') return;
  if (!roomManager.areAllPlayersReady(room)) return;
  if (roomTimers.get(roomCode)?.countdown) return; // already counting down

  let remaining = COUNTDOWN_SECONDS;
  io.to(roomCode).emit('all_ready_countdown', { countdown: remaining, totalCountdown: COUNTDOWN_SECONDS });

  const interval = setInterval(() => {
    const current = roomManager.getRoom(roomCode);

    // Re-validate every tick: a leave, un-ready or drop must abort the start.
    if (!current || current.phase !== 'waiting' || !roomManager.areAllPlayersReady(current)) {
      clearTimer(roomCode, 'countdown');
      if (current) {
        io.to(roomCode).emit('countdown_cancelled', { reason: 'Players are no longer ready' });
      }
      return;
    }

    remaining--;
    if (remaining > 0) {
      io.to(roomCode).emit('all_ready_countdown', { countdown: remaining, totalCountdown: COUNTDOWN_SECONDS });
      return;
    }

    clearTimer(roomCode, 'countdown');
    // Deliberately no `countdown: 0` tick. The client maps 0 to "no countdown",
    // and it arrives as its own packet just before `round_started` — leaving one
    // render where the lobby's ready-up UI, settings and player list come back
    // before the whole page swaps to the memorization screen. That read as the
    // entire screen flashing at the end of 3-2-1. `round_started` clears the
    // countdown itself, so staying silent here loses nothing.
    beginRound(io, roomCode, kind);
  }, 1000);

  getTimers(roomCode).countdown = interval;
}

function beginRound(io: Server, roomCode: string, kind: 'new' | 'next'): void {
  if (kind === 'new' && !roomManager.startNewGame(roomCode)) {
    io.to(roomCode).emit('error', { message: 'Could not start the game', code: 'START_FAILED' });
    return;
  }

  const result = roomManager.startRound(roomCode);
  if (!result) {
    io.to(roomCode).emit('error', { message: 'Could not start the round', code: 'ROUND_FAILED' });
    return;
  }

  const { room } = result;

  io.to(roomCode).emit('round_started', {
    round: room.currentRound,
    totalRounds: room.totalRounds,
    // What the players may see, which is the complement in Inverted and nothing
    // at all in Blind's no-target variant. `color` from startRound is the answer
    // and stays on the server.
    color: roomManager.visibleColor(room),
    // A no-target round opens straight on the sliders. Sent explicitly so the
    // client never renders a memorization screen it is about to replace.
    phase: room.phase,
    // Where the sliders should start (slider shuffle). Sent this early so the
    // client can seat them during memorization, before they're on screen.
    startColor: room.startColor ?? null,
    colorDuration: room.config.colorTimeSeconds,
    roundDuration: room.config.roundTimeSeconds,
    phaseEndsAt: room.phaseEndsAt,
    serverTime: Date.now(),
    players: players(room),
  });

  // Already reconstructing: there is no reveal to end, so the round's own clock
  // is the next thing to schedule.
  if (room.phase === 'reconstruction') {
    // Say it twice. `round_started` carries the phase, but a client running an
    // older bundle ignores that field and assumes every round opens on
    // memorization — and since a no-target round never reaches
    // `beginReconstruction`, the transition it is waiting for would never come.
    // It sat on an empty memorization screen for the whole round with no sliders
    // and no preview. Harmless to a current client: same phase, same deadline,
    // same start colour.
    io.to(roomCode).emit('reconstruction_started', {
      round: room.currentRound,
      roundDuration: room.config.roundTimeSeconds,
      startColor: room.startColor ?? null,
      phaseEndsAt: room.phaseEndsAt,
      serverTime: Date.now(),
    });

    clearTimer(roomCode, 'reconstruction');
    getTimers(roomCode).reconstruction = setTimeout(
      () => endRound(io, roomCode),
      room.config.roundTimeSeconds * 1000 + SUBMIT_GRACE_MS
    );
    return;
  }

  clearTimer(roomCode, 'memorization');
  getTimers(roomCode).memorization = setTimeout(
    () => beginReconstruction(io, roomCode),
    room.config.colorTimeSeconds * 1000
  );
}

function beginReconstruction(io: Server, roomCode: string): void {
  clearTimer(roomCode, 'memorization');

  const room = roomManager.startReconstruction(roomCode);
  if (!room) return;

  io.to(roomCode).emit('reconstruction_started', {
    round: room.currentRound,
    roundDuration: room.config.roundTimeSeconds,
    // Repeated from round_started so a client that joined mid-memorization still
    // seats its sliders correctly.
    startColor: room.startColor ?? null,
    phaseEndsAt: room.phaseEndsAt,
    serverTime: Date.now(),
  });

  clearTimer(roomCode, 'reconstruction');
  getTimers(roomCode).reconstruction = setTimeout(
    () => endRound(io, roomCode),
    room.config.roundTimeSeconds * 1000 + SUBMIT_GRACE_MS
  );
}

function endRound(io: Server, roomCode: string): void {
  clearTimer(roomCode, 'memorization');
  clearTimer(roomCode, 'reconstruction');

  // Returns null unless a round is genuinely in progress, so a late submit or a
  // player drop can never score the same round twice.
  const room = roomManager.endRound(roomCode);
  if (!room) return;

  const results = roomManager.getRoundResults(room);
  const leaderboard = roomManager.getRoomLeaderboard(room);
  const endReason = roomManager.getEndReason(room);

  io.to(roomCode).emit('round_ended', {
    round: room.currentRound,
    totalRounds: room.totalRounds,
    // Players need to see what they were aiming at; kept on the room so it
    // survives a reconnect mid-results too.
    targetColor: room.lastColor ?? null,
    results,
    leaderboard,
    players: players(room),
    // Elimination mode: who just went out, so the results screen can announce it.
    lastEliminated: room.lastEliminated ?? null,
    isFinalRound: !!endReason,
    serverTime: Date.now(),
  });

  clearTimer(roomCode, 'postRound');

  if (endReason) {
    // Let the last round's scores sit on screen before the game-over view,
    // instead of overwriting them in the same tick.
    getTimers(roomCode).postRound = setTimeout(() => {
      clearTimer(roomCode, 'postRound');
      finishGame(io, roomCode, endReason);
    }, RESULTS_DURATION_MS);
    return;
  }

  // Nothing is scheduled here on purpose: the next round begins only once every
  // connected player has readied up on the results screen.
}

/**
 * Leave the results screen for the next round, but only once everyone still in
 * the room is ready. Safe to call on any room-state change — it no-ops unless
 * the room is sitting in results with a full set of ready players.
 */
function advanceIfAllReady(io: Server, roomCode: string): void {
  const room = roomManager.getRoom(roomCode);
  if (!room || room.phase !== 'results') return;
  if (!roomManager.areAllPlayersReady(room)) return;

  const next = roomManager.advanceToNextRound(roomCode);
  if (!next) return;

  io.to(roomCode).emit('round_interval', {
    message: `Round ${next.currentRound} starting…`,
    nextRound: next.currentRound,
    totalRounds: next.totalRounds,
    players: players(next),
    phase: next.phase,
  });

  // advanceToNextRound keeps the ready flags, so the countdown starts immediately.
  startCountdown(io, roomCode, 'next');
}

const END_MESSAGES: Record<GameEndReason, string> = {
  rounds_complete: 'All rounds complete!',
  not_enough_players: 'Game ended — not enough players',
  host_ended: 'Host ended the session',
  last_player_standing: 'Last player standing!',
};

function finishGame(io: Server, roomCode: string, reason: GameEndReason): void {
  clearRoomTimers(roomCode);

  const room = roomManager.endGame(roomCode);
  if (!room) return;

  io.to(roomCode).emit('game_ended', {
    finalLeaderboard: roomManager.getRoomLeaderboard(room),
    reason,
    message: END_MESSAGES[reason],
    rounds: room.currentRound,
    players: players(room),
  });
}

/**
 * Re-evaluate a room after its player set changes: close a round everyone has
 * answered, stop a game that can no longer be played, or start one that is ready.
 */
function reactToRoomChange(io: Server, roomCode: string): void {
  const room = roomManager.getRoom(roomCode);
  if (!room) {
    clearRoomTimers(roomCode);
    return;
  }

  // Active, not connected: an eliminated spectator can't ready up or submit, so
  // counting them would leave the room waiting on input that cannot arrive.
  const active = roomManager.getActiveCount(room);
  const inRound = room.phase === 'memorization' || room.phase === 'reconstruction';

  if (inRound) {
    if (active < 2) {
      endRound(io, roomCode); // scores the partial round, then ends the game
      return;
    }
    if (room.phase === 'reconstruction' && roomManager.allConnectedSubmitted(room)) {
      endRound(io, roomCode);
      return;
    }
    // Membership just changed, so the "x of y submitted" figures moved without
    // anyone submitting. Without this the clients keep showing the old counts —
    // still waiting on a player who has already left.
    const { submitted, total } = roomManager.getSubmissionProgress(room);
    io.to(roomCode).emit('submit_progress', { submittedCount: submitted, totalPlayers: total });
    return;
  }

  if (room.phase === 'results') {
    if (active < 2) {
      // getEndReason distinguishes "everyone else was eliminated" from "everyone
      // else left"; the fallback only ever applies with elimination off.
      finishGame(io, roomCode, roomManager.getEndReason(room) ?? 'not_enough_players');
      return;
    }
    // Whoever just left may have been the last player anyone was waiting on.
    advanceIfAllReady(io, roomCode);
    return;
  }

  if (room.phase === 'waiting' && roomManager.areAllPlayersReady(room)) {
    startCountdown(io, roomCode, room.currentRound === 0 ? 'new' : 'next');
  }
}

function scheduleGracePeriod(io: Server, roomCode: string, userId: string): void {
  const key = `${roomCode}:${userId}`;
  clearGraceTimers(key);

  const warning = setTimeout(() => {
    const room = roomManager.getRoom(roomCode);
    const player = room ? roomManager.getPlayerByUserId(room, userId) : null;
    if (!room || !player || player.status !== 'disconnected') return;

    io.to(roomCode).emit('disconnect_warning', {
      socketId: player.socketId,
      userId: player.userId,
      username: player.username,
      secondsLeft: Math.round((GRACE_PERIOD_MS - DISCONNECT_WARNING_MS) / 1000),
    });
  }, DISCONNECT_WARNING_MS);

  const removal = setTimeout(() => {
    graceTimers.delete(key);

    const room = roomManager.getRoom(roomCode);
    const player = room ? roomManager.getPlayerByUserId(room, userId) : null;
    if (!room || !player || player.status !== 'disconnected') return;

    const { newHostSocketId, roomDeleted } = roomManager.removePlayer(player.socketId);
    if (roomDeleted) {
      clearRoomTimers(roomCode);
      return;
    }

    const updated = roomManager.getRoom(roomCode);
    io.to(roomCode).emit('player_removed', {
      socketId: player.socketId,
      userId: player.userId,
      username: player.username,
      reason: 'disconnected',
      players: players(updated),
      hostSocketId: roomManager.getHostSocketId(updated),
    });

    if (newHostSocketId && updated) {
      io.to(roomCode).emit('host_changed', {
        newHostSocketId,
        newHostUsername: updated.players.get(newHostSocketId)?.username,
      });
    }

    reactToRoomChange(io, roomCode);
  }, GRACE_PERIOD_MS);

  graceTimers.set(key, { warning, removal });
}

// ── Handlers ────────────────────────────────────────────────────────────────

export function setupSocketHandlers(io: Server, socket: Socket) {
  const user = socket.data.user as SocketUser;

  /** Wrap a handler so a thrown error surfaces as an `error` event instead of killing the socket. */
  const on = <T>(event: string, handler: (data: T) => void) => {
    socket.on(event, (data: T) => {
      try {
        handler(data);
      } catch (error) {
        console.error(`[socket:${event}]`, error);
        emitError(socket, (error as Error).message || 'Something went wrong', 'HANDLER_ERROR');
      }
    });
  };

  /** Detach this socket from whatever room it is in (used before create/join elsewhere). */
  const detachFromCurrentRoom = (announce: boolean) => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) return;

    const roomCode = room.code;
    const player = room.players.get(socket.id);
    const hadCountdown = !!roomTimers.get(roomCode)?.countdown;

    clearGraceTimers(`${roomCode}:${user.userId}`);
    const { newHostSocketId, roomDeleted } = roomManager.removePlayer(socket.id);
    socket.leave(roomCode);

    if (roomDeleted) {
      clearRoomTimers(roomCode);
      return;
    }

    const updated = roomManager.getRoom(roomCode);
    if (announce && updated) {
      if (newHostSocketId) {
        io.to(roomCode).emit('host_changed', {
          newHostSocketId,
          newHostUsername: updated.players.get(newHostSocketId)?.username,
        });
      }
      io.to(roomCode).emit('player_left', {
        socketId: socket.id,
        userId: player?.userId,
        username: player?.username,
        players: players(updated),
        hostSocketId: roomManager.getHostSocketId(updated),
      });
      if (hadCountdown) {
        cancelCountdown(io, roomCode, `${player?.username ?? 'A player'} left the room`);
      }
    }

    reactToRoomChange(io, roomCode);
  };

  // ── Create ────────────────────────────────────────────────────────────────
  on<CreateRoomInput>('create_room', data => {
    if (!user.isVerified) {
      emitError(socket, 'Verify your email to play Challenge mode', 'NOT_VERIFIED');
      return;
    }
    if (!allow(socket, 'create', 5, 10_000)) {
      emitError(socket, 'Slow down a moment before creating another room', 'RATE_LIMITED');
      return;
    }

    let config: RoomConfig;
    try {
      config = parseConfig(data?.config);
    } catch (error) {
      emitError(socket, (error as Error).message, 'INVALID_CONFIG');
      return;
    }

    detachFromCurrentRoom(true);

    const identity = resolveIdentity(socket, data?.username);
    const room = roomManager.createRoom(socket.id, identity.userId, identity.username, config);
    socket.join(room.code);

    socket.emit('room_created', {
      code: room.code,
      config: room.config,
      ...roomPayload(room),
    });
  });

  // ── Join ──────────────────────────────────────────────────────────────────
  on<JoinRoomInput>('join_room', data => {
    if (!user.isVerified) {
      emitError(socket, 'Verify your email to play Challenge mode', 'NOT_VERIFIED');
      return;
    }
    if (!allow(socket, 'join', 10, 10_000)) {
      emitError(socket, 'Too many join attempts, try again shortly', 'RATE_LIMITED');
      return;
    }

    const code = typeof data?.code === 'string' ? data.code.trim().toUpperCase() : '';
    if (!/^[A-Z0-9]{4,10}$/.test(code)) {
      emitError(socket, 'Enter a valid room code', 'INVALID_CODE');
      return;
    }

    const target = roomManager.getRoom(code);
    if (!target) {
      emitError(socket, 'Room not found', 'ROOM_NOT_FOUND');
      return;
    }

    // Already in a different room? Leave it cleanly first.
    const existing = roomManager.getRoomBySocketId(socket.id);
    if (existing && existing.code !== code) detachFromCurrentRoom(true);

    const identity = resolveIdentity(socket, data?.username);

    let room: Room;
    let isTakeover: boolean;
    try {
      const joined = roomManager.joinRoom(code, socket.id, identity.userId, identity.username);
      room = joined.room;
      isTakeover = joined.isTakeover;
    } catch (error) {
      emitError(socket, (error as Error).message, 'JOIN_FAILED');
      return;
    }

    socket.join(code);
    clearGraceTimers(`${code}:${identity.userId}`);

    socket.emit('room_joined', {
      code: room.code,
      config: room.config,
      status: room.phase,
      ...roomPayload(room),
    });
    // Full snapshot so a mid-game takeover lands in the right phase.
    socket.emit('room_state', roomManager.getRoomSnapshot(room, socket.id));

    socket.to(code).emit(isTakeover ? 'player_reconnected' : 'player_joined', {
      socketId: socket.id,
      userId: identity.userId,
      username: identity.username,
      players: players(room),
      hostSocketId: roomManager.getHostSocketId(room),
    });

    reactToRoomChange(io, code);
  });

  // ── Rejoin after a dropped connection / page reload ───────────────────────
  on<{ code?: string }>('rejoin_room', data => {
    const code = typeof data?.code === 'string' ? data.code.trim().toUpperCase() : '';
    const identity = resolveIdentity(socket);

    const room = code ? roomManager.rejoinRoom(code, socket.id, identity.userId, identity.username) : null;

    if (!room) {
      // Maybe they were tracked in a different room (e.g. stale code on the client).
      const fallback = roomManager.getRoomByUserId(identity.userId);
      if (!fallback || !roomManager.rejoinRoom(fallback.code, socket.id, identity.userId, identity.username)) {
        socket.emit('rejoin_failed', { code, message: 'That room is no longer available' });
        return;
      }
      socket.join(fallback.code);
      clearGraceTimers(`${fallback.code}:${identity.userId}`);
      socket.emit('room_state', roomManager.getRoomSnapshot(fallback, socket.id));
      socket.to(fallback.code).emit('player_reconnected', {
        socketId: socket.id,
        userId: identity.userId,
        username: identity.username,
        players: players(fallback),
        hostSocketId: roomManager.getHostSocketId(fallback),
      });
      reactToRoomChange(io, fallback.code);
      return;
    }

    socket.join(room.code);
    clearGraceTimers(`${room.code}:${identity.userId}`);

    socket.emit('room_state', roomManager.getRoomSnapshot(room, socket.id));
    socket.to(room.code).emit('player_reconnected', {
      socketId: socket.id,
      userId: identity.userId,
      username: identity.username,
      players: players(room),
      hostSocketId: roomManager.getHostSocketId(room),
    });

    reactToRoomChange(io, room.code);
  });

  // ── Explicit resync (tab refocus, transport upgrade, manual retry) ────────
  on<void>('request_state', () => {
    // Snapshots aren't free; drop the excess silently rather than answering a flood.
    if (!allow(socket, 'resync', 12, 10_000)) return;
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) {
      socket.emit('room_unavailable', { message: 'You are not in a room' });
      return;
    }
    socket.emit('room_state', roomManager.getRoomSnapshot(room, socket.id));
  });

  // ── Clock sync so client timers match the server ──────────────────────────
  socket.on('time_sync', (clientTime: number, ack?: (payload: unknown) => void) => {
    if (!allow(socket, 'time', 30, 10_000)) return;
    const payload = { serverTime: Date.now(), clientTime };
    if (typeof ack === 'function') ack(payload);
    else socket.emit('time_sync', payload);
  });

  // ── Leave ─────────────────────────────────────────────────────────────────
  on<void>('leave_room', () => {
    detachFromCurrentRoom(true);
    socket.emit('left_room', { success: true });
  });

  // ── Ready / unready ───────────────────────────────────────────────────────
  on<void>('player_ready', () => {
    // Toggling ready is a broadcast to the whole room — cap the churn.
    if (!allow(socket, 'ready', 20, 10_000)) return;
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) {
      emitError(socket, 'You are not in a room', 'NOT_IN_ROOM');
      return;
    }
    if (room.phase === 'ended') {
      emitError(socket, 'Game has ended — use Play Again to start a new game', 'GAME_ENDED');
      return;
    }
    if (room.phase !== 'waiting' && room.phase !== 'results') {
      emitError(socket, 'Cannot ready during an active round', 'WRONG_PHASE');
      return;
    }
    if (!roomManager.setPlayerReady(socket.id, true)) return;

    io.to(room.code).emit('player_ready_update', {
      socketId: socket.id,
      userId: user.userId,
      username: room.players.get(socket.id)?.username,
      players: players(room),
    });

    // During 'results' a full set of ready players is what starts the next
    // round — there is no timer racing it.
    if (room.phase === 'waiting' && roomManager.areAllPlayersReady(room)) {
      startCountdown(io, room.code, room.currentRound === 0 ? 'new' : 'next');
    } else if (room.phase === 'results') {
      advanceIfAllReady(io, room.code);
    }
  });

  on<void>('player_unready', () => {
    if (!allow(socket, 'ready', 20, 10_000)) return;
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) return;
    if (room.phase !== 'waiting' && room.phase !== 'results') return;
    if (!roomManager.setPlayerReady(socket.id, false)) return;

    io.to(room.code).emit('player_unready_update', {
      socketId: socket.id,
      userId: user.userId,
      username: room.players.get(socket.id)?.username,
      players: players(room),
    });

    cancelCountdown(io, room.code, `${room.players.get(socket.id)?.username ?? 'A player'} is not ready`);
  });

  // ── Submit a guess ────────────────────────────────────────────────────────
  on<SubmitColorInput>('submit_color', data => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) {
      emitError(socket, 'You are not in a room', 'NOT_IN_ROOM');
      return;
    }
    if (room.phase !== 'reconstruction') {
      // Late arrival after the round closed — acknowledge instead of erroring so
      // the client can settle its UI without a scary toast.
      socket.emit('submit_ack', { accepted: false, reason: 'ROUND_CLOSED', round: room.currentRound });
      return;
    }
    if (roomManager.hasSubmitted(room, socket.id)) {
      socket.emit('submit_ack', { accepted: false, reason: 'ALREADY_SUBMITTED', round: room.currentRound });
      return;
    }

    const updated = roomManager.submitGuess(socket.id, data?.color as HSLColor);
    if (!updated) {
      emitError(socket, 'That guess could not be accepted', 'INVALID_GUESS');
      return;
    }

    const { submitted, total } = roomManager.getSubmissionProgress(updated);

    socket.emit('submit_ack', { accepted: true, round: updated.currentRound });
    io.to(room.code).emit('player_submitted', {
      socketId: socket.id,
      userId: user.userId,
      username: updated.players.get(socket.id)?.username,
      submittedCount: submitted,
      totalPlayers: total,
    });

    if (roomManager.allConnectedSubmitted(updated)) {
      endRound(io, room.code);
    }
  });

  // ── Play again ────────────────────────────────────────────────────────────
  on<void>('play_again', () => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) {
      emitError(socket, 'You are not in a room', 'NOT_IN_ROOM');
      return;
    }
    if (room.phase !== 'ended') {
      emitError(socket, 'The game is still running', 'WRONG_PHASE');
      return;
    }

    const vote = roomManager.votePlayAgain(room.code, socket.id);
    if (!vote) return;

    io.to(room.code).emit('play_again_update', {
      socketId: socket.id,
      userId: user.userId,
      username: room.players.get(socket.id)?.username,
      votes: vote.votes,
      totalNeeded: vote.totalNeeded,
    });

    if (vote.allVoted) {
      clearRoomTimers(room.code);
      const reset = roomManager.resetRoom(room.code);
      io.to(room.code).emit('play_again_complete', {});
      io.to(room.code).emit('room_reset', {
        players: players(reset),
        status: 'waiting',
        config: reset?.config,
        hostSocketId: roomManager.getHostSocketId(reset),
      });
    }
  });

  // ── Host edits the room settings from the lobby ────────────────────────────
  on<{ config?: Partial<RoomConfig> }>('update_room_config', data => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) {
      emitError(socket, 'You are not in a room', 'NOT_IN_ROOM');
      return;
    }
    if (!room.players.get(socket.id)?.isHost) {
      emitError(socket, 'Only the host can change the room settings', 'NOT_HOST');
      return;
    }
    if (!allow(socket, 'config', 15, 10_000)) {
      emitError(socket, 'Slow down before changing the settings again', 'RATE_LIMITED');
      return;
    }

    let config: RoomConfig;
    try {
      config = parseConfig(data?.config);
    } catch (error) {
      emitError(socket, (error as Error).message, 'INVALID_CONFIG');
      return;
    }

    let updated: Room;
    try {
      updated = roomManager.updateConfig(room.code, config);
    } catch (error) {
      emitError(socket, (error as Error).message, 'CONFIG_LOCKED');
      return;
    }

    const changedBy = updated.players.get(socket.id)?.username;

    // A running countdown means everyone had readied up for the *old* settings.
    // Cancel it and clear readiness rather than letting the host swap the
    // difficulty out from under a start that is already a second in.
    if (roomTimers.get(updated.code)?.countdown) {
      cancelCountdown(io, updated.code, `${changedBy ?? 'The host'} changed the room settings`);
      roomManager.clearReadyStates(updated);
    }

    io.to(updated.code).emit('room_config_updated', {
      config: updated.config,
      totalRounds: updated.totalRounds,
      players: players(updated),
      changedBy,
      changedBySocketId: socket.id,
    });
  });

  // ── Host ends the session ─────────────────────────────────────────────────
  on<void>('end_room', () => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) {
      emitError(socket, 'You are not in a room', 'NOT_IN_ROOM');
      return;
    }
    if (!room.players.get(socket.id)?.isHost) {
      emitError(socket, 'Only the host can end the session', 'NOT_HOST');
      return;
    }

    clearRoomTimers(room.code);
    const reset = roomManager.resetRoom(room.code);

    io.to(room.code).emit('session_ended', {
      message: 'Host ended the session',
      players: players(reset),
      status: 'waiting',
      config: reset?.config,
      hostSocketId: roomManager.getHostSocketId(reset),
    });
  });

  // ── Host removes a player ─────────────────────────────────────────────────
  // Lobby and final-results only. Ejecting someone mid-round would mean unwinding
  // their submission and the elimination order; the client hides the button there
  // and this rejects it anyway.
  on<{ socketId?: unknown }>('kick_player', data => {
    const targetSocketId = typeof data?.socketId === 'string' ? data.socketId : '';
    if (!targetSocketId || targetSocketId === socket.id) return;

    if (!allow(socket, 'kick', 10, 30_000)) {
      emitError(socket, 'Slow down', 'RATE_LIMITED');
      return;
    }

    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) {
      emitError(socket, 'You are not in a room', 'NOT_IN_ROOM');
      return;
    }
    if (!room.players.get(socket.id)?.isHost) {
      emitError(socket, 'Only the host can remove players', 'NOT_HOST');
      return;
    }
    if (room.phase !== 'waiting' && room.phase !== 'ended') {
      emitError(socket, 'You can only remove players between games', 'GAME_IN_PROGRESS');
      return;
    }

    const target = room.players.get(targetSocketId);
    if (!target) {
      emitError(socket, 'That player is not in this room', 'PLAYER_NOT_FOUND');
      return;
    }

    const roomCode = room.code;
    const hadCountdown = !!roomTimers.get(roomCode)?.countdown;

    // Their grace timers would otherwise fire against a player who is gone.
    clearGraceTimers(`${roomCode}:${target.userId}`);

    const { newHostSocketId, roomDeleted } = roomManager.removePlayer(targetSocketId);
    if (roomDeleted) {
      clearRoomTimers(roomCode);
      return;
    }

    const updated = roomManager.getRoom(roomCode);

    // Emitted to the room while the target is still a member of it — that
    // broadcast is how they find out, and their client self-detects the userId.
    io.to(roomCode).emit('player_removed', {
      socketId: targetSocketId,
      userId: target.userId,
      username: target.username,
      reason: 'kicked',
      players: players(updated),
      hostSocketId: roomManager.getHostSocketId(updated),
    });

    io.sockets.sockets.get(targetSocketId)?.leave(roomCode);

    if (newHostSocketId && updated) {
      io.to(roomCode).emit('host_changed', {
        newHostSocketId,
        newHostUsername: updated.players.get(newHostSocketId)?.username,
      });
    }

    if (hadCountdown) cancelCountdown(io, roomCode, `${target.username} was removed`);
    reactToRoomChange(io, roomCode);
  });

  // ── Reactions on a round's results ────────────────────────────────────────
  // One emoji per player per result: sending a different one replaces it, sending
  // the same one clears it. Spectators may react, and so may you on your own row.
  on<{ targetUserId?: unknown; emoji?: unknown }>('react_to_result', data => {
    const targetUserId = typeof data?.targetUserId === 'string' ? data.targetUserId : '';
    const emoji = typeof data?.emoji === 'string' ? data.emoji : '';
    if (!targetUserId || !emoji) return;

    if (!allow(socket, 'reaction', 20, 10_000)) return;

    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) return;
    if (room.phase !== 'results' && room.phase !== 'ended') return;

    const me = room.players.get(socket.id);
    if (!me) return;
    if (!roomManager.getPlayerByUserId(room, targetUserId)) return;

    // Rejects anything outside the six-emoji allow-list, so an arbitrary string
    // never reaches the room state and from there every other client.
    if (!roomManager.toggleReaction(room, targetUserId, me.userId, emoji)) return;

    // The whole map, not a delta: it is a few bytes at this player count, and a
    // wholesale replace is idempotent, so a dropped event self-heals on the next.
    io.to(room.code).emit('reactions_update', { reactions: roomManager.serializeReactions(room) });
  });

  // ── Chat ──────────────────────────────────────────────────────────────────
  on<{ message?: unknown; replyTo?: unknown }>('send_message', data => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const raw = typeof data?.message === 'string' ? data.message : '';
    const message = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_CHAT_LENGTH);
    if (!message) return;

    if (!allow(socket, 'chat', 5, 5_000)) {
      emitError(socket, 'You are sending messages too quickly', 'RATE_LIMITED');
      return;
    }

    // The quote is re-sanitised here rather than trusted: it arrives from the
    // sender's client, so without this a reply would be a way to put arbitrary
    // text in someone else's name in front of the whole room.
    let replyTo: ChatReplyTo | undefined;
    const candidate = data?.replyTo as { username?: unknown; message?: unknown } | undefined;
    if (candidate && typeof candidate.username === 'string' && typeof candidate.message === 'string') {
      const quotedName = candidate.username.replace(/\s+/g, ' ').trim().slice(0, 30);
      const quotedText = candidate.message.replace(/\s+/g, ' ').trim().slice(0, MAX_CHAT_LENGTH);
      if (quotedName && quotedText) replyTo = { username: quotedName, message: quotedText };
    }

    const payload = {
      socketId: socket.id,
      userId: player.userId,
      username: player.username,
      message,
      timestamp: new Date().toISOString(),
      ...(replyTo ? { replyTo } : {}),
    };

    roomManager.addChatMessage(room, payload);
    io.to(room.code).emit('new_message', payload);

    // A sent message ends the typing state immediately — waiting for the TTL
    // would leave "X is typing…" hanging under the message they just sent.
    socket.to(room.code).emit('user_typing', {
      socketId: socket.id,
      userId: player.userId,
      username: player.username,
      isTyping: false,
    });
  });

  // ── Typing indicator ──────────────────────────────────────────────────────
  // Fire-and-forget: broadcast to everyone else in the room and let their clients
  // expire it. Deliberately not stored on the room — nothing needs to survive a
  // reconnect, and a stale flag would be worse than a missing one.
  on<{ isTyping?: unknown }>('typing', data => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    // Generous limit: the client already throttles to one signal per few seconds,
    // so this only catches a client that is misbehaving.
    if (!allow(socket, 'typing', 12, 5_000)) return;

    socket.to(room.code).emit('user_typing', {
      socketId: socket.id,
      userId: player.userId,
      username: player.username,
      isTyping: data?.isTyping !== false,
      expiresAt: Date.now() + TYPING_TTL_MS,
    });
  });

  // ── Room invites ──────────────────────────────────────────────────────────
  // Sent through the socket rather than REST because it is only ever meaningful
  // while the sender is sitting in a room, and only to someone online.
  on<{ userId?: unknown }>('invite_to_room', data => {
    const targetId = typeof data?.userId === 'string' ? data.userId : '';
    if (!targetId) return;

    const me = socket.data.user as SocketUser;
    if (targetId === me.userId) return;

    if (!allow(socket, 'invite', 6, 30_000)) {
      emitError(socket, 'You are sending invites too quickly', 'RATE_LIMITED');
      return;
    }

    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) {
      emitError(socket, 'You are not in a room', 'NOT_IN_ROOM');
      return;
    }

    const player = room.players.get(socket.id);
    if (!player) return;

    if (room.players.size >= room.config.maxPlayers) {
      emitError(socket, 'Room is full', 'ROOM_FULL');
      return;
    }

    // Already here — no point pinging them.
    for (const existing of room.players.values()) {
      if (existing.userId === targetId) {
        emitError(socket, `${existing.username} is already in this room`, 'ALREADY_IN_ROOM');
        return;
      }
    }

    // Mid-game elsewhere: an invite they can't act on is just a popup over their
    // sliders. Same predicate the friends list uses for its "In a game" badge, so
    // the badge and this rejection can never disagree.
    const targetRoom = roomManager.getRoomByUserId(targetId);
    if (targetRoom && targetRoom.phase !== 'waiting' && targetRoom.phase !== 'ended') {
      emitError(socket, 'They are in the middle of a game', 'TARGET_BUSY');
      return;
    }

    if (inviteCooldownRemaining(me.userId, targetId) > 0) {
      emitError(socket, 'You just invited them — give it a moment', 'INVITE_COOLDOWN');
      return;
    }

    // Friends only, checked server-side: the client hides the button for
    // non-friends, but the event itself must not be a way to spam strangers.
    void FriendService.areFriends(me.userId, targetId)
      .then(friends => {
        if (!friends) {
          emitError(socket, 'You can only invite friends', 'NOT_FRIENDS');
          return;
        }

        const delivered = notifyUser(targetId, 'room_invite', {
          code: room.code,
          fromUserId: me.userId,
          fromUsername: player.username,
          difficulty: room.config.difficulty,
          playerCount: room.players.size,
          maxPlayers: room.config.maxPlayers,
          inProgress: room.phase !== 'waiting' && room.phase !== 'ended',
          sentAt: Date.now(),
        });

        // Only a delivered invite starts the clock. A failed one shouldn't lock
        // the sender out of retrying once the target comes online.
        if (delivered) startInviteCooldown(me.userId, targetId);

        socket.emit('invite_sent', {
          userId: targetId,
          delivered,
          cooldownMs: delivered ? INVITE_COOLDOWN_MS : 0,
        });
      })
      .catch(error => {
        console.error('Invite check failed:', error);
        emitError(socket, 'Could not send invite', 'INVITE_FAILED');
      });
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', reason => {
    const { room, player } = roomManager.markDisconnected(socket.id);
    if (!room || !player) return;

    const roomCode = room.code;
    console.log(`🔌 ${player.username} dropped from ${roomCode} (${reason})`);

    io.to(roomCode).emit('player_disconnected', {
      socketId: socket.id,
      userId: player.userId,
      username: player.username,
      graceSeconds: Math.round(GRACE_PERIOD_MS / 1000),
      players: players(room),
    });

    if (roomTimers.get(roomCode)?.countdown) {
      cancelCountdown(io, roomCode, `${player.username} disconnected`);
    }

    scheduleGracePeriod(io, roomCode, player.userId);
    reactToRoomChange(io, roomCode);
  });
}
