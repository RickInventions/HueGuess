import type { HSLColor, Difficulty } from './index';

export type PlayerStatus = 'waiting' | 'ready' | 'playing' | 'disconnected';
export type GamePhase = 'waiting' | 'countdown' | 'memorization' | 'reconstruction' | 'results' | 'ended';
export type GameEndReason = 'rounds_complete' | 'not_enough_players' | 'host_ended';

export interface Player {
  socketId: string;
  userId: string;
  username: string;
  isHost: boolean;
  status: PlayerStatus;
  totalAccuracy: number;
  roundsPlayed: number;
  currentAccuracy?: number;
}

export interface RoomConfig {
  roundTimeSeconds: number;      // RT - reconstruction time (10-40)
  colorTimeSeconds: number;      // CT - memorization time (0.5-7)
  difficulty: Difficulty;
  specificRounds: number | null; // null = unlimited
  maxPlayers: number;            // 2-4
}

export interface Room {
  code: string;
  config: RoomConfig;
  players: Player[];
  phase: GamePhase;
  currentRound: number;
  totalRounds: number | null;
  hostSocketId: string | null;
}

export interface RoundResult {
  socketId: string;
  userId: string;
  username: string;
  accuracy: number;
  userColor: HSLColor;
  isTimeout: boolean;
  /** Running average across the rounds played so far. */
  cumulativeAverage?: number;
}

export interface LeaderboardEntry {
  socketId: string;
  userId: string;
  username: string;
  averageAccuracy: number;
  roundsPlayed: number;
  totalAccuracy: number;
  /** Set locally from `play_again_update`, not sent by the server. */
  playedAgain?: boolean;
}

export interface ChatMessage {
  username: string;
  message: string;
  timestamp: string;
  userId?: string;
  socketId?: string;
}

/** Full room state, sent on join and on every reconnect. */
export interface RoomSnapshot {
  code: string;
  config: RoomConfig;
  players: Player[];
  hostSocketId: string | null;
  phase: GamePhase;
  currentRound: number;
  totalRounds: number | null;
  color: HSLColor | null;
  /** The round's answer — only present while results are showing. */
  targetColor: HSLColor | null;
  phaseEndsAt: number | null;
  serverTime: number;
  colorDuration: number;
  roundDuration: number;
  results: RoundResult[];
  leaderboard: LeaderboardEntry[];
  chat: ChatMessage[];
  yourSocketId: string;
  hasSubmitted: boolean;
  submittedCount: number;
  totalPlayers: number;
  playAgainVotes: number;
  playAgainNeeded: number;
}

// ── Outgoing payloads ───────────────────────────────────────────────────────
// Identity comes from the JWT on the server; username is sent only so a recent
// rename is reflected without reissuing the token.

export interface CreateRoomPayload {
  username?: string;
  config: RoomConfig;
}

export interface JoinRoomPayload {
  code: string;
  username?: string;
}

export interface SubmitColorPayload {
  color: HSLColor;
}

export interface SocketErrorPayload {
  message: string;
  code?: string;
}
