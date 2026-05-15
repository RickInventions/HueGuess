import { HSLColor, Difficulty } from '../types/game.types.js';

export type PlayerStatus = 'waiting' | 'ready' | 'playing' | 'disconnected';
export type GamePhase = 'waiting' | 'countdown' | 'memorization' | 'reconstruction' | 'results' | 'ended';

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

export interface RoomConfig {
  roundTimeSeconds: number;    // RT - reconstruction time
  colorTimeSeconds: number;    // CT - memorization time
  difficulty: Difficulty;
  specificRounds: number | null; // null = unlimited
  maxPlayers: number;
}

export interface Room {
  code: string;
  config: RoomConfig;
  players: Map<string, Player>;
  phase: GamePhase;
  currentRound: number;
  totalRounds: number | null;
  currentColor?: HSLColor;
  roundStartTime?: Date;
  roundEndTime?: Date;
  roundResults: Map<string, RoundResult>;
  playAgainVotes: Set<string>;
  createdAt: Date;
}

export interface RoundResult {
  accuracy: number;
  userColor: HSLColor;
  submittedAt: Date;
  isTimeout: boolean;
}

export interface CreateRoomInput {
  username: string;
  userId: string;
  config: RoomConfig;
}

export interface JoinRoomInput {
  code: string;
  username: string;
  userId: string;
}

export interface SubmitColorInput {
  roomCode: string;
  userId: string;
  color: HSLColor;
}