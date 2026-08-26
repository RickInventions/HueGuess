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
  Room,
  SocketUser,
  GameEndReason,
} from './types.js';
import { Difficulty } from '../types/game.types.js';
import { HSLColor } from '../types/game.types.js';

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

  if (!Number.isFinite(roundTimeSeconds) || roundTimeSeconds < 10 || roundTimeSeconds > 40) {
    throw new Error('Round time must be between 10 and 40 seconds');
  }
  if (!Number.isFinite(colorTimeSeconds) || colorTimeSeconds < 0.5 || colorTimeSeconds > 7) {
    throw new Error('Color time must be between 0.5 and 7 seconds');
  }
  if (!DIFFICULTIES.includes(difficulty)) {
    throw new Error('Invalid difficulty');
  }
  if (!Number.isFinite(maxPlayers) || maxPlayers < 2 || maxPlayers > 4) {
    throw new Error('Max players must be between 2 and 4');
  }
  if (specificRounds !== null && (!Number.isFinite(specificRounds) || specificRounds < 1 || specificRounds > 50)) {
    throw new Error('Specific rounds must be between 1 and 50');
  }

  return { roundTimeSeconds, colorTimeSeconds, difficulty, specificRounds, maxPlayers };
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
    io.to(roomCode).emit('all_ready_countdown', { countdown: 0, totalCountdown: COUNTDOWN_SECONDS });
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

  const { room, color } = result;

  io.to(roomCode).emit('round_started', {
    round: room.currentRound,
    totalRounds: room.totalRounds,
    color,
    colorDuration: room.config.colorTimeSeconds,
    roundDuration: room.config.roundTimeSeconds,
    phaseEndsAt: room.phaseEndsAt,
    serverTime: Date.now(),
    players: players(room),
  });

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
    isFinalRound: !!endReason,
    nextRoundAt: endReason ? null : Date.now() + RESULTS_DURATION_MS,
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

  getTimers(roomCode).postRound = setTimeout(() => {
    clearTimer(roomCode, 'postRound');
    const next = roomManager.advanceToNextRound(roomCode);
    if (!next) return;

    io.to(roomCode).emit('round_interval', {
      message: `Round ${next.currentRound} — ready up!`,
      nextRound: next.currentRound,
      totalRounds: next.totalRounds,
      players: players(next),
      phase: next.phase,
    });

    // Anyone who readied while results were on screen keeps that flag.
    if (roomManager.areAllPlayersReady(next)) {
      startCountdown(io, roomCode, 'next');
    }
  }, RESULTS_DURATION_MS);
}

const END_MESSAGES: Record<GameEndReason, string> = {
  rounds_complete: 'All rounds complete!',
  not_enough_players: 'Game ended — not enough players',
  host_ended: 'Host ended the session',
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

  const connected = roomManager.getConnectedCount(room);
  const inRound = room.phase === 'memorization' || room.phase === 'reconstruction';

  if (inRound) {
    if (connected < 2) {
      endRound(io, roomCode); // scores the partial round, then ends the game
      return;
    }
    if (room.phase === 'reconstruction' && roomManager.allConnectedSubmitted(room)) {
      endRound(io, roomCode);
    }
    return;
  }

  if (room.phase === 'results' && connected < 2) {
    finishGame(io, roomCode, 'not_enough_players');
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

    // During 'results' the flag is stored and honoured when the interval elapses,
    // which keeps round numbering deterministic.
    if (room.phase === 'waiting' && roomManager.areAllPlayersReady(room)) {
      startCountdown(io, room.code, room.currentRound === 0 ? 'new' : 'next');
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

  // ── Chat ──────────────────────────────────────────────────────────────────
  on<{ message?: unknown }>('send_message', data => {
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

    const payload = {
      socketId: socket.id,
      userId: player.userId,
      username: player.username,
      message,
      timestamp: new Date().toISOString(),
    };

    roomManager.addChatMessage(room, payload);
    io.to(room.code).emit('new_message', payload);
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
