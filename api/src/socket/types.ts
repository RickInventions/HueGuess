import { HSLColor, Difficulty } from '../types/game.types.js';

export type PlayerStatus = 'waiting' | 'ready' | 'playing' | 'disconnected';
export type GamePhase = 'waiting' | 'countdown' | 'memorization' | 'reconstruction' | 'results' | 'ended';

/** Reason a game ended — surfaced to the client so it can explain itself. */
export type GameEndReason = 'rounds_complete' | 'not_enough_players' | 'host_ended';

export interface Player {
  socketId: string;
  userId: string;
  username: string;
  status: PlayerStatus;
  isHost: boolean;
  currentAccuracy?: number;
  totalAccuracy: number;
  roundsPlayed: number;
  disconnectedAt?: Date;
}

/** Player shape sent over the wire (must stay in sync with frontend types/multiplayer.ts). */
export interface PlayerDTO {
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
  roundTimeSeconds: number;    // RT - reconstruction time
  colorTimeSeconds: number;    // CT - memorization time
  difficulty: Difficulty;
  specificRounds: number | null; // null = unlimited
  maxPlayers: number;
}

export interface ChatMessage {
  username: string;
  message: string;
  timestamp: string;
  userId?: string;
  socketId?: string;
}

export interface Room {
  code: string;
  config: RoomConfig;
  players: Map<string, Player>;
  phase: GamePhase;
  currentRound: number;
  totalRounds: number | null;
  currentColor?: HSLColor;
  /** The colour of the round just played — kept so results survive a reconnect. */
  lastColor?: HSLColor;
  roundStartTime?: Date;
  /** Epoch ms at which the current phase ends — clients derive their timers from this. */
  phaseEndsAt?: number;
  roundResults: Map<string, RoundResult>;
  playAgainVotes: Set<string>;
  /** Last N chat messages, replayed to players who join or reconnect. */
  chat: ChatMessage[];
  createdAt: Date;
}

export interface RoundResult {
  accuracy: number;
  userColor: HSLColor;
  submittedAt: Date;
  isTimeout: boolean;
}

export interface RoundResultDTO {
  socketId: string;
  userId: string;
  username: string;
  accuracy: number;
  userColor: HSLColor;
  isTimeout: boolean;
  cumulativeAverage: number;
}

export interface LeaderboardEntryDTO {
  socketId: string;
  userId: string;
  username: string;
  averageAccuracy: number;
  roundsPlayed: number;
  totalAccuracy: number;
}

/** Identity resolved from the JWT during the socket handshake. */
export interface SocketUser {
  userId: string;
  username: string;
  isVerified: boolean;
}

export interface CreateRoomInput {
  username?: string;
  userId?: string;
  config: Partial<RoomConfig>;
}

export interface JoinRoomInput {
  code: string;
  username?: string;
  userId?: string;
}

export interface SubmitColorInput {
  roomCode?: string;
  userId?: string;
  color: HSLColor;
}
