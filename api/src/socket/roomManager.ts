import {
  Room,
  Player,
  PlayerDTO,
  RoomConfig,
  RoundResultDTO,
  LeaderboardEntryDTO,
  ChatMessage,
  GameEndReason,
  ReactionMapDTO,
  REACTION_EMOJIS,
} from './types.js';
import { HSLColor, DIFFICULTY_CONFIGS } from '../types/game.types.js';
import { generateRandomColor, calculateAccuracy, validateHSL } from '../utils/hsl.utils.js';
import { VoiceService } from '../services/voice.service.js';

/** Unambiguous charset — no 0/O or 1/I, so codes can be read out loud. */
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 8;
const MAX_CHAT_HISTORY = 50;

export const GRACE_PERIOD_MS = 30_000;
export const DISCONNECT_WARNING_MS = 20_000;
/** Only used to hold the final round's scores on screen before the game-over view. */
export const RESULTS_DURATION_MS = 6_000;
export const COUNTDOWN_SECONDS = 3;

class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerToRoom: Map<string, string> = new Map(); // socketId -> roomCode
  private userToRoom: Map<string, string> = new Map();   // userId   -> roomCode

  // ── Codes ─────────────────────────────────────────────────────────────────

  /** Always CODE_LENGTH chars and never collides with a live room. */
  private generateRoomCode(): string {
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = '';
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('Could not allocate a room code, please try again');
  }

  // ── Serialisation ─────────────────────────────────────────────────────────

  /** Wire shape for a player. userId is required by the client to identify itself. */
  private toPlayerDTO(player: Player): PlayerDTO {
    return {
      socketId: player.socketId,
      userId: player.userId,
      username: player.username,
      isHost: player.isHost,
      status: player.status,
      totalAccuracy: Math.round(player.totalAccuracy * 1000) / 1000,
      roundsPlayed: player.roundsPlayed,
      points: player.points,
      eliminated: player.eliminated,
      currentAccuracy: player.currentAccuracy,
    };
  }

  serializePlayers(room: Room | null): PlayerDTO[] {
    if (!room) return [];
    return Array.from(room.players.values()).map(p => this.toPlayerDTO(p));
  }

  getHostSocketId(room: Room | null): string | null {
    if (!room) return null;
    for (const player of room.players.values()) {
      if (player.isHost) return player.socketId;
    }
    return null;
  }

  // ── Lookups ───────────────────────────────────────────────────────────────

  getRoom(code: string): Room | null {
    if (!code || typeof code !== 'string') return null;
    return this.rooms.get(code.toUpperCase()) || null;
  }

  getRoomBySocketId(socketId: string): Room | null {
    const roomCode = this.playerToRoom.get(socketId);
    return roomCode ? this.rooms.get(roomCode) || null : null;
  }

  getRoomByUserId(userId: string): Room | null {
    const roomCode = this.userToRoom.get(userId);
    return roomCode ? this.rooms.get(roomCode) || null : null;
  }

  getPlayerBySocketId(socketId: string): Player | null {
    const room = this.getRoomBySocketId(socketId);
    return room?.players.get(socketId) || null;
  }

  getPlayerByUserId(room: Room, userId: string): Player | null {
    for (const player of room.players.values()) {
      if (player.userId === userId) return player;
    }
    return null;
  }

  /** Players actively connected — disconnected players are ghosts and must not gate progress. */
  getConnectedPlayers(room: Room): Player[] {
    return Array.from(room.players.values()).filter(p => p.status !== 'disconnected');
  }

  getConnectedCount(room: Room): number {
    return this.getConnectedPlayers(room).length;
  }

  /**
   * Players still in the running: connected AND not eliminated.
   *
   * This — not getConnectedPlayers — is what gates rounds. An eliminated
   * spectator can never ready up or submit, so counting them would freeze the
   * room waiting for input that cannot arrive.
   */
  getActivePlayers(room: Room): Player[] {
    return Array.from(room.players.values()).filter(p => p.status !== 'disconnected' && !p.eliminated);
  }

  getActiveCount(room: Room): number {
    return this.getActivePlayers(room).length;
  }

  // ── Room lifecycle ────────────────────────────────────────────────────────

  createRoom(hostSocketId: string, hostUserId: string, hostUsername: string, config: RoomConfig): Room {
    const code = this.generateRoomCode();

    const host: Player = {
      socketId: hostSocketId,
      userId: hostUserId,
      username: hostUsername,
      status: 'waiting',
      isHost: true,
      totalAccuracy: 0,
      roundsPlayed: 0,
      points: 0,
      eliminated: false,
    };

    const room: Room = {
      code,
      config,
      players: new Map([[hostSocketId, host]]),
      phase: 'waiting',
      currentRound: 0,
      totalRounds: config.specificRounds,
      roundResults: new Map(),
      playAgainVotes: new Set(),
      reactions: new Map(),
      chat: [],
      createdAt: new Date(),
    };

    this.rooms.set(code, room);
    this.playerToRoom.set(hostSocketId, code);
    this.userToRoom.set(hostUserId, code);

    return room;
  }

  /**
   * Join a waiting room. Throws with a human-readable reason when the room can't be joined.
   * A player already in the room (same account, new tab/refresh) takes over their old slot
   * instead of creating a duplicate entry.
   */
  joinRoom(code: string, socketId: string, userId: string, username: string): { room: Room; isTakeover: boolean } {
    const room = this.getRoom(code);
    if (!room) throw new Error('Room not found');

    const existing = this.getPlayerByUserId(room, userId);
    if (existing) {
      // Same account rejoining — hand the slot to the new socket.
      this.rebindPlayerSocket(room, existing, socketId, username);
      return { room, isTakeover: true };
    }

    if (room.players.size >= room.config.maxPlayers) {
      throw new Error('Room is full');
    }
    if (room.phase !== 'waiting' || room.currentRound > 0) {
      throw new Error('Game already in progress');
    }

    const player: Player = {
      socketId,
      userId,
      username,
      status: 'waiting',
      isHost: false,
      totalAccuracy: 0,
      roundsPlayed: 0,
      points: 0,
      eliminated: false,
    };

    room.players.set(socketId, player);
    this.playerToRoom.set(socketId, code);
    this.userToRoom.set(userId, code);

    return { room, isTakeover: false };
  }

  /**
   * Reconnect an existing player (possibly mid-game) onto a fresh socket.
   * Returns null when the player has no seat in that room any more.
   */
  rejoinRoom(code: string, socketId: string, userId: string, username: string): Room | null {
    const room = this.getRoom(code);
    if (!room) return null;

    const player = this.getPlayerByUserId(room, userId);
    if (!player) return null;

    this.rebindPlayerSocket(room, player, socketId, username);
    return room;
  }

  /** Move a player entry onto a new socket id, preserving their stats and host flag. */
  private rebindPlayerSocket(room: Room, player: Player, newSocketId: string, username?: string): void {
    const oldSocketId = player.socketId;
    if (oldSocketId === newSocketId) {
      player.status = this.statusForPhase(room);
      player.disconnectedAt = undefined;
      return;
    }

    // Carry over a guess already submitted this round so the player isn't double-scored.
    const submitted = room.roundResults.get(oldSocketId);
    if (submitted) {
      room.roundResults.delete(oldSocketId);
      room.roundResults.set(newSocketId, submitted);
    }
    if (room.playAgainVotes.delete(oldSocketId)) {
      room.playAgainVotes.add(newSocketId);
    }

    room.players.delete(oldSocketId);
    this.playerToRoom.delete(oldSocketId);

    player.socketId = newSocketId;
    if (username) player.username = username;
    player.status = this.statusForPhase(room);
    player.disconnectedAt = undefined;

    room.players.set(newSocketId, player);
    this.playerToRoom.set(newSocketId, room.code);
    this.userToRoom.set(player.userId, room.code);
  }

  private statusForPhase(room: Room): Player['status'] {
    if (room.phase === 'memorization' || room.phase === 'reconstruction') return 'playing';
    return 'waiting';
  }

  /**
   * Remove a player for good. Returns the room code, whether the room is now empty,
   * and the new host if the departing player was hosting.
   */
  removePlayer(socketId: string): {
    roomCode: string | null;
    room: Room | null;
    player: Player | null;
    newHostSocketId: string | null;
    roomDeleted: boolean;
  } {
    const roomCode = this.playerToRoom.get(socketId);
    if (!roomCode) {
      return { roomCode: null, room: null, player: null, newHostSocketId: null, roomDeleted: false };
    }

    const room = this.rooms.get(roomCode);
    if (!room) {
      this.playerToRoom.delete(socketId);
      return { roomCode, room: null, player: null, newHostSocketId: null, roomDeleted: true };
    }

    const player = room.players.get(socketId) || null;
    const wasHost = player?.isHost || false;

    room.players.delete(socketId);
    room.roundResults.delete(socketId);
    room.playAgainVotes.delete(socketId);
    if (player) {
      // Reactions are keyed by userId, so they outlive the socket and have to be
      // swept explicitly — both the ones on their result and the ones they left.
      room.reactions.delete(player.userId);
      for (const reactors of room.reactions.values()) reactors.delete(player.userId);
    }
    this.playerToRoom.delete(socketId);
    if (player && this.userToRoom.get(player.userId) === roomCode) {
      this.userToRoom.delete(player.userId);
    }

    if (room.players.size === 0) {
      this.rooms.delete(roomCode);
      // The room map was the only record that this room's voice notes exist, so
      // they have to go with it or they are billable storage nothing can reach.
      void VoiceService.deleteRoom(roomCode);
      return { roomCode, room: null, player, newHostSocketId: null, roomDeleted: true };
    }

    let newHostSocketId: string | null = null;
    if (wasHost) {
      // Prefer a connected player as the new host.
      const candidate = this.getConnectedPlayers(room)[0] || room.players.values().next().value;
      if (candidate) {
        candidate.isHost = true;
        newHostSocketId = candidate.socketId;
      }
    }

    return { roomCode, room, player, newHostSocketId, roomDeleted: false };
  }

  /** Mark a socket as dropped without freeing the seat (grace period). */
  markDisconnected(socketId: string): { room: Room | null; player: Player | null } {
    const room = this.getRoomBySocketId(socketId);
    if (!room) return { room: null, player: null };

    const player = room.players.get(socketId);
    if (!player) return { room: null, player: null };

    player.status = 'disconnected';
    player.disconnectedAt = new Date();

    return { room, player };
  }

  deleteRoom(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    for (const player of room.players.values()) {
      this.playerToRoom.delete(player.socketId);
      if (this.userToRoom.get(player.userId) === code) {
        this.userToRoom.delete(player.userId);
      }
    }
    this.rooms.delete(code);
    void VoiceService.deleteRoom(code);
  }

  /**
   * Rewrite a room's settings from the lobby, so a host who set something wrong
   * can fix it in place instead of closing the room and making everyone rejoin.
   *
   * Throws with a human-readable reason (like joinRoom) — the caller relays the
   * message straight back to the host.
   */
  updateConfig(roomCode: string, config: RoomConfig): Room {
    const room = this.getRoom(roomCode);
    if (!room) throw new Error('Room not found');

    // Only before the first round: mid-game these values are the rules that
    // already-scored rounds were played under, and totalRounds would move the
    // finish line underneath them.
    if (room.phase !== 'waiting' || room.currentRound !== 0) {
      throw new Error('Settings can only be changed in the lobby, before the game starts');
    }
    // A settings change must never be the thing that removes somebody.
    if (config.maxPlayers < room.players.size) {
      throw new Error(`Max players can't be below the ${room.players.size} already in the room`);
    }

    room.config = config;
    room.totalRounds = config.specificRounds; // derived from the config everywhere else too
    return room;
  }

  // ── Ready state ───────────────────────────────────────────────────────────

  /** Drop everyone back to "not ready" — used when what they readied up for changes. */
  clearReadyStates(room: Room): void {
    for (const player of room.players.values()) {
      if (player.status === 'ready') player.status = 'waiting';
    }
  }

  setPlayerReady(socketId: string, isReady: boolean): Room | null {
    const room = this.getRoomBySocketId(socketId);
    if (!room) return null;
    if (room.phase === 'ended') return null;

    const player = room.players.get(socketId);
    if (!player || player.status === 'disconnected') return null;
    // Spectators have nothing to ready up for, and letting them would mean the
    // room waits on someone who has no sliders.
    if (player.eliminated) return null;

    player.status = isReady ? 'ready' : 'waiting';
    return room;
  }

  /** All players still in the running are ready, and enough of them to play. */
  areAllPlayersReady(room: Room): boolean {
    const active = this.getActivePlayers(room);
    if (active.length < 2) return false;
    return active.every(p => p.status === 'ready');
  }

  // ── Round lifecycle ───────────────────────────────────────────────────────

  /** First round of a fresh game: wipe stats. */
  startNewGame(roomCode: string): Room | null {
    const room = this.getRoom(roomCode);
    if (!room) return null;
    if (!this.areAllPlayersReady(room)) return null;
    if (room.currentRound !== 0) return null;

    room.phase = 'waiting';
    room.currentRound = 1;
    room.totalRounds = this.deriveTotalRounds(room);
    room.roundResults.clear();
    room.playAgainVotes.clear();
    room.reactions.clear();

    for (const player of room.players.values()) {
      player.status = player.status === 'disconnected' ? 'disconnected' : 'playing';
      player.totalAccuracy = 0;
      player.roundsPlayed = 0;
      player.currentAccuracy = undefined;
      player.points = 0;
      player.eliminated = false;
    }

    return room;
  }

  /**
   * How many rounds this game runs for.
   *
   * In elimination the host doesn't choose: the count is whatever it takes to
   * knock everyone but one player out, so it's fixed at kickoff from the players
   * actually present. Someone leaving mid-game doesn't shorten it — the
   * last-player-standing check ends it early instead.
   */
  private deriveTotalRounds(room: Room): number | null {
    if (!room.config.elimination) return room.config.specificRounds;
    const every = Math.max(1, room.config.elimEveryRounds);
    return Math.max(1, (Math.max(2, this.getActiveCount(room)) - 1) * every);
  }

  /** Begin the memorization phase of the current round. Stats are preserved. */
  startRound(roomCode: string): { room: Room; color: HSLColor } | null {
    const room = this.getRoom(roomCode);
    if (!room) return null;
    if (room.phase !== 'waiting' && room.phase !== 'results') return null;
    if (this.getActiveCount(room) < 2) return null;

    const config = DIFFICULTY_CONFIGS[room.config.difficulty];
    const color = generateRandomColor(config.saturationRange, config.lightnessRange);

    room.phase = 'memorization';
    room.currentColor = color;
    room.lastColor = color;
    room.startColor = room.config.sliderShuffle ? this.generateStartColor(color) : undefined;
    room.roundStartTime = new Date();
    room.phaseEndsAt = Date.now() + room.config.colorTimeSeconds * 1000;
    room.roundResults.clear();
    // Reactions belong to the round they were left on.
    room.reactions.clear();
    room.lastEliminated = undefined;

    for (const player of room.players.values()) {
      if (player.status !== 'disconnected' && !player.eliminated) player.status = 'playing';
      player.currentAccuracy = undefined;
    }

    return { room, color };
  }

  /**
   * A random slider starting position for slider shuffle.
   *
   * Rejects anything that lands near the target: a free start worth 80% would
   * make the round a formality rather than a harder version of the same puzzle.
   */
  private generateStartColor(target: HSLColor): HSLColor {
    const MAX_FREE_ACCURACY = 55;
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate: HSLColor = {
        h: Math.floor(Math.random() * 361),
        s: Math.floor(Math.random() * 101),
        l: Math.floor(Math.random() * 101),
      };
      if (calculateAccuracy(target, candidate) <= MAX_FREE_ACCURACY) return candidate;
    }
    // Ten misses is vanishingly unlikely; the opposite hue is a guaranteed miss.
    return {
      h: (target.h + 180) % 360,
      s: Math.abs(100 - target.s),
      l: Math.abs(100 - target.l),
    };
  }

  startReconstruction(roomCode: string): Room | null {
    const room = this.getRoom(roomCode);
    if (!room) return null;
    if (room.phase !== 'memorization') return null;

    room.phase = 'reconstruction';
    room.phaseEndsAt = Date.now() + room.config.roundTimeSeconds * 1000;

    return room;
  }

  /**
   * Record a guess for the socket that sent it. Returns null when the guess can't be
   * accepted (wrong phase, unknown player, already submitted, malformed colour).
   */
  submitGuess(socketId: string, color: HSLColor, isTimeout = false): Room | null {
    const room = this.getRoomBySocketId(socketId);
    if (!room) return null;
    if (room.phase !== 'reconstruction') return null;

    const player = room.players.get(socketId);
    if (!player) return null;
    if (player.eliminated) return null;
    if (room.roundResults.has(socketId)) return null;

    const safeColor: HSLColor = {
      h: Math.round(Math.min(360, Math.max(0, Number(color?.h) || 0))),
      s: Math.round(Math.min(100, Math.max(0, Number(color?.s) || 0))),
      l: Math.round(Math.min(100, Math.max(0, Number(color?.l) || 0))),
    };
    if (!validateHSL(safeColor)) return null;

    const accuracy = isTimeout || !room.currentColor ? 0 : calculateAccuracy(room.currentColor, safeColor);

    room.roundResults.set(socketId, {
      accuracy,
      userColor: safeColor,
      submittedAt: new Date(),
      isTimeout,
    });

    return room;
  }

  hasSubmitted(room: Room, socketId: string): boolean {
    return room.roundResults.has(socketId);
  }

  /** How many of the players we're still waiting on have answered. */
  getSubmissionProgress(room: Room): { submitted: number; total: number } {
    const active = this.getActivePlayers(room);
    const submitted = active.filter(p => room.roundResults.has(p.socketId)).length;
    return { submitted, total: active.length };
  }

  /** Every player still in the running has answered — the round can close early. */
  allConnectedSubmitted(room: Room): boolean {
    const { submitted, total } = this.getSubmissionProgress(room);
    return total > 0 && submitted >= total;
  }

  /** Close the round: fill in 0% for non-submitters, accumulate stats, move to results. */
  endRound(roomCode: string): Room | null {
    const room = this.getRoom(roomCode);
    if (!room) return null;
    // Only a live round can be ended — guards against a late submit re-ending it.
    if (room.phase !== 'memorization' && room.phase !== 'reconstruction') return null;

    // Spectators are skipped throughout: no timeout row, no stats, no scoring.
    // Giving them a 0% row would put them in the results list every round.
    const contenders = Array.from(room.players.values()).filter(p => !p.eliminated);

    for (const player of contenders) {
      if (!room.roundResults.has(player.socketId)) {
        room.roundResults.set(player.socketId, {
          accuracy: 0,
          userColor: { h: 0, s: 0, l: 0 },
          submittedAt: new Date(),
          isTimeout: true,
        });
      }
    }

    for (const player of contenders) {
      const result = room.roundResults.get(player.socketId)!;
      player.totalAccuracy += result.accuracy;
      player.roundsPlayed++;
      player.currentAccuracy = result.accuracy;
    }

    if (room.config.mode === 'duel') this.awardDuelPoints(room);
    room.lastEliminated = room.config.elimination ? this.applyElimination(room) : undefined;

    room.phase = 'results';
    // No deadline: results stay on screen until every connected player readies
    // up for the next round, so there is nothing to count down to.
    room.phaseEndsAt = undefined;
    room.currentColor = undefined;

    // Back to 'waiting' so the results screen's ready indicator starts clean —
    // nobody carries a 'ready' flag out of the round they just played.
    for (const player of room.players.values()) {
      if (player.status !== 'disconnected') player.status = 'waiting';
    }

    return room;
  }

  /**
   * Duel scoring: a point to whoever was closest this round.
   *
   * Two rules, both deliberate. Everyone tied for the lead scores, so a genuine
   * tie rewards both players instead of picking arbitrarily. And a best score of
   * zero pays nothing — otherwise a round nobody answered would hand the whole
   * room a free point.
   */
  private awardDuelPoints(room: Room): void {
    const active = this.getActivePlayers(room);
    if (active.length === 0) return;

    // Compare on the rounded value the client is shown, so two results that
    // display as identical actually count as a tie.
    const score = (player: Player) => Math.round((player.currentAccuracy ?? 0) * 1000);
    const best = Math.max(...active.map(score));
    if (best <= 0) return;

    for (const player of active) {
      if (score(player) === best) player.points++;
    }
  }

  /**
   * Elimination: every `elimEveryRounds` rounds, the weakest player drops out.
   *
   * Exactly one player per cycle, never a tie that empties the room — a tie on
   * the round is broken by the lower running average, then by join order.
   */
  private applyElimination(room: Room): { userId: string; username: string } | undefined {
    const every = Math.max(1, room.config.elimEveryRounds);
    if (room.currentRound % every !== 0) return undefined;

    const active = this.getActivePlayers(room);
    // Below two there is nothing left to decide.
    if (active.length < 2) return undefined;

    const average = (p: Player) => (p.roundsPlayed > 0 ? p.totalAccuracy / p.roundsPlayed : 0);
    const weakest = active.reduce((lowest, player) => {
      const byRound = (player.currentAccuracy ?? 0) - (lowest.currentAccuracy ?? 0);
      if (byRound !== 0) return byRound < 0 ? player : lowest;
      return average(player) < average(lowest) ? player : lowest;
    });

    weakest.eliminated = true;
    weakest.status = 'waiting';
    return { userId: weakest.userId, username: weakest.username };
  }

  getRoundResults(room: Room): RoundResultDTO[] {
    const results: RoundResultDTO[] = [];
    for (const [socketId, result] of room.roundResults) {
      const player = room.players.get(socketId);
      if (!player) continue;
      const cumulativeAvg = player.roundsPlayed > 0 ? player.totalAccuracy / player.roundsPlayed : 0;
      results.push({
        socketId,
        userId: player.userId,
        username: player.username,
        accuracy: Math.round(result.accuracy * 1000) / 1000,
        userColor: result.userColor,
        isTimeout: result.isTimeout,
        cumulativeAverage: Math.round(cumulativeAvg * 1000) / 1000,
      });
    }
    results.sort((a, b) => b.accuracy - a.accuracy);
    return results;
  }

  getRoomLeaderboard(room: Room): LeaderboardEntryDTO[] {
    const leaderboard: LeaderboardEntryDTO[] = [];
    for (const [socketId, player] of room.players) {
      leaderboard.push({
        socketId,
        userId: player.userId,
        username: player.username,
        averageAccuracy:
          player.roundsPlayed > 0
            ? Math.round((player.totalAccuracy / player.roundsPlayed) * 1000) / 1000
            : 0,
        roundsPlayed: player.roundsPlayed,
        totalAccuracy: Math.round(player.totalAccuracy * 1000) / 1000,
        points: player.points,
        eliminated: player.eliminated,
      });
    }

    if (room.config.mode === 'duel') {
      // Points decide a duel; average accuracy only breaks ties between equal
      // point totals.
      leaderboard.sort((a, b) => b.points - a.points || b.averageAccuracy - a.averageAccuracy);
    } else {
      leaderboard.sort((a, b) => b.averageAccuracy - a.averageAccuracy);
    }
    return leaderboard;
  }

  /** Why the game should stop, or null to keep playing. */
  getEndReason(room: Room): GameEndReason | null {
    // Checked before the player-count rule: with three of four knocked out the
    // room is still full of connected people, but the game is over and won.
    if (room.config.elimination && room.currentRound > 0 && this.getActiveCount(room) < 2) {
      return 'last_player_standing';
    }
    if (this.getConnectedCount(room) < 2) return 'not_enough_players';
    if (room.totalRounds !== null && room.currentRound >= room.totalRounds) return 'rounds_complete';
    return null;
  }

  /** Move the room into the post-game state. */
  endGame(roomCode: string): Room | null {
    const room = this.getRoom(roomCode);
    if (!room) return null;

    room.phase = 'ended';
    room.phaseEndsAt = undefined;
    room.currentColor = undefined;
    room.playAgainVotes.clear();

    for (const player of room.players.values()) {
      if (player.status !== 'disconnected') player.status = 'waiting';
    }

    return room;
  }

  /**
   * Step the round counter and return to 'waiting'.
   * Ready flags set while results were showing are kept, so nobody has to click twice.
   */
  advanceToNextRound(roomCode: string): Room | null {
    const room = this.getRoom(roomCode);
    if (!room) return null;
    if (room.phase !== 'results') return null;

    room.currentRound++;
    room.phase = 'waiting';
    room.phaseEndsAt = undefined;
    room.roundResults.clear();
    room.playAgainVotes.clear();

    for (const player of room.players.values()) {
      if (player.status === 'disconnected') continue;
      if (player.status !== 'ready') player.status = 'waiting';
    }

    return room;
  }

  // ── Play again / session ──────────────────────────────────────────────────

  votePlayAgain(roomCode: string, socketId: string): { room: Room; votes: number; totalNeeded: number; allVoted: boolean } | null {
    const room = this.getRoom(roomCode);
    if (!room) return null;
    if (!room.players.has(socketId)) return null;

    room.playAgainVotes.add(socketId);

    // Only connected players' votes count toward the total.
    const connected = this.getConnectedPlayers(room);
    const votes = connected.filter(p => room.playAgainVotes.has(p.socketId)).length;
    const totalNeeded = connected.length;

    return { room, votes, totalNeeded, allVoted: totalNeeded > 0 && votes >= totalNeeded };
  }

  /** Full reset back to the lobby, stats cleared. Used by play-again and end-session. */
  resetRoom(roomCode: string): Room | null {
    const room = this.getRoom(roomCode);
    if (!room) return null;

    room.phase = 'waiting';
    room.currentRound = 0;
    room.totalRounds = room.config.specificRounds;
    room.currentColor = undefined;
    room.lastColor = undefined;
    room.startColor = undefined;
    room.lastEliminated = undefined;
    room.phaseEndsAt = undefined;
    room.roundResults.clear();
    room.playAgainVotes.clear();
    room.reactions.clear();

    for (const player of room.players.values()) {
      if (player.status !== 'disconnected') player.status = 'waiting';
      player.totalAccuracy = 0;
      player.roundsPlayed = 0;
      player.currentAccuracy = undefined;
      player.points = 0;
      player.eliminated = false;
    }

    return room;
  }

  // ── Reactions ─────────────────────────────────────────────────────────────

  /**
   * Set, replace or clear one player's reaction on another's result.
   *
   * One reaction each: a second pick replaces the first, and picking the same
   * emoji again clears it. Returns false when the emoji isn't one of ours.
   */
  toggleReaction(room: Room, targetUserId: string, reactorUserId: string, emoji: string): boolean {
    if (!(REACTION_EMOJIS as readonly string[]).includes(emoji)) return false;

    const existing = room.reactions.get(targetUserId);
    if (existing?.get(reactorUserId) === emoji) {
      existing.delete(reactorUserId);
      if (existing.size === 0) room.reactions.delete(targetUserId);
      return true;
    }

    if (existing) existing.set(reactorUserId, emoji);
    else room.reactions.set(targetUserId, new Map([[reactorUserId, emoji]]));
    return true;
  }

  /** Invert the store into emoji → reactors, which is what a row renders from. */
  serializeReactions(room: Room): ReactionMapDTO {
    const out: ReactionMapDTO = {};
    for (const [targetUserId, reactors] of room.reactions) {
      const byEmoji: Record<string, string[]> = {};
      for (const [reactorUserId, emoji] of reactors) {
        (byEmoji[emoji] ??= []).push(reactorUserId);
      }
      out[targetUserId] = byEmoji;
    }
    return out;
  }

  // ── Chat ──────────────────────────────────────────────────────────────────

  addChatMessage(room: Room, message: ChatMessage): void {
    room.chat.push(message);
    if (room.chat.length > MAX_CHAT_HISTORY) {
      room.chat.splice(0, room.chat.length - MAX_CHAT_HISTORY);
    }
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────

  /**
   * Everything a client needs to render the room from scratch — used on join,
   * reconnect and explicit resync. The live colour is only included while it is
   * legitimately visible (memorization phase).
   */
  getRoomSnapshot(room: Room, forSocketId: string) {
    const progress = this.getSubmissionProgress(room);
    const connected = this.getConnectedPlayers(room);

    return {
      code: room.code,
      config: room.config,
      players: this.serializePlayers(room),
      hostSocketId: this.getHostSocketId(room),
      phase: room.phase,
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
      color: room.phase === 'memorization' ? room.currentColor ?? null : null,
      // The answer, revealed only once the round is over.
      targetColor: room.phase === 'results' || room.phase === 'ended' ? room.lastColor ?? null : null,
      // Where the sliders start. Sent through memorization too, so the reconstruction
      // screen has it the moment it renders rather than a frame later.
      startColor:
        room.phase === 'memorization' || room.phase === 'reconstruction' ? room.startColor ?? null : null,
      phaseEndsAt: room.phaseEndsAt ?? null,
      serverTime: Date.now(),
      colorDuration: room.config.colorTimeSeconds,
      roundDuration: room.config.roundTimeSeconds,
      results: room.phase === 'results' || room.phase === 'ended' ? this.getRoundResults(room) : [],
      leaderboard: room.currentRound > 0 ? this.getRoomLeaderboard(room) : [],
      reactions: this.serializeReactions(room),
      lastEliminated:
        room.phase === 'results' || room.phase === 'ended' ? room.lastEliminated ?? null : null,
      chat: room.chat.slice(-MAX_CHAT_HISTORY),
      yourSocketId: forSocketId,
      hasSubmitted: room.roundResults.has(forSocketId),
      submittedCount: progress.submitted,
      totalPlayers: progress.total,
      playAgainVotes: connected.filter(p => room.playAgainVotes.has(p.socketId)).length,
      playAgainNeeded: connected.length,
    };
  }

  /** Diagnostics for /health. */
  getStats() {
    return {
      rooms: this.rooms.size,
      players: this.playerToRoom.size,
    };
  }
}

export const roomManager = new RoomManager();
