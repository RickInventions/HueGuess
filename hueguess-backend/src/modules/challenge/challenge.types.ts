import type { HSLColor } from '../game/game.types.js';

export interface Room {
  id: string;
  code: string;
  hostId: string;
  settings: RoomSettings;
  players: Map<string, Player>;
  status: RoomStatus;
  rounds: RoundRecord[];
  currentRound: number;
  createdAt: number;
}

export interface RoomSettings {
  roundDuration: number;    // 10-45 seconds, default 25
  colorDuration: number;    // 1-10 seconds, default 5
  maxPlayers: number;       // Always 4 (from env)
}

export interface Player {
  userId: string;
  username: string;
  socketId: string;
  status: PlayerStatus;
  joinedAt: number;
}

export type PlayerStatus = 'joined' | 'ready' | 'playing' | 'submitted' | 'finished';

export type RoomStatus = 'waiting' | 'countdown' | 'playing' | 'round_end' | 'finished';

export interface RoundRecord {
  roundNumber: number;
  originalColor: HSLColor;
  submissions: Map<string, RoundSubmission>;
  startTime: number;
  endTime?: number;
}

export interface RoundSubmission {
  userId: string;
  username: string;
  color: HSLColor;
  accuracy: number;
  accuracyFormatted: string;
  submittedAt: number;
  timeTaken: number;
}

export interface RoundResult {
  roundNumber: number;
  originalColor: HSLColor;
  submissions: RoundSubmission[];
  rankings: RoundRanking[];
  leaderboard: LeaderboardEntry[];
}

export interface RoundRanking {
  rank: number;
  userId: string;
  username: string;
  accuracy: number;
  accuracyFormatted: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avgAccuracy: number;
  avgAccuracyFormatted: string;
  roundsPlayed: number;
  totalAccuracy: number;
}

// Socket Events
export interface ServerToClientEvents {
  room_created: (data: { code: string; settings: RoomSettings }) => void;
  player_joined: (data: { player: Player; players: Player[] }) => void;
  player_left: (data: { userId: string; players: Player[] }) => void;
  player_ready: (data: { userId: string; readyCount: number; totalPlayers: number }) => void;
  player_unready: (data: { userId: string; readyCount: number; totalPlayers: number }) => void;
  game_countdown: (data: { count: number }) => void;
  round_started: (data: { roundNumber: number; color: HSLColor; colorDuration: number; roundDuration: number }) => void;
  round_ended: (data: { results: RoundResult }) => void;
  room_closed: (data: { reason: string }) => void;
  host_changed: (data: { newHostId: string }) => void;
  error: (data: { message: string }) => void;
room_joined: (data: { 
  code: string; 
  hostId: string; 
  settings: RoomSettings; 
  players: Player[]; 
  status: RoomStatus;
  currentRound: number;
}) => void;
room_reset: (data: { 
  reason: string; 
  settings: RoomSettings; 
  hostId: string; 
  players: Player[];
  roomCode: string;
}) => void;
play_again_update: (data: { 
  userId: string; 
  username: string; 
  playAgainCount: number; 
  totalPlayers: number; 
}) => void;
player_submitted: (data: { 
  userId: string; 
  username: string; 
  submittedAt: number; 
}) => void;
}

export interface ClientToServerEvents {
  create_room: (data: { roundDuration: number; colorDuration: number }) => void;
  join_room: (data: { code: string }) => void;
  leave_room: () => void;
  player_ready: () => void;
  player_unready: () => void;
  submit_color: (data: { roundNumber: number; h: number; s: number; l: number; timeTaken: number }) => void;
  play_again: () => void;
  end_room: () => void;
}