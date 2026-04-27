export interface HSLColor {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

export interface RoundState {
  id: string;
  originalColor: HSLColor;
  mode: GameMode;
  difficulty: Difficulty;
  memorizationTime: number;
  createdAt: number;
}

export type GameMode = 'casual' | 'competitive' | 'challenge';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface RoundResult {
  roundId: string;
  original: HSLColor;
  user: HSLColor;
  accuracy: number;        // e.g., 99.355
  accuracyFormatted: string; // e.g., "99.355%"
  distance: number;
  deltaH: number;
  deltaS: number;
  deltaL: number;
}

export interface StartRoundRequest {
  mode?: GameMode;
  difficulty?: Difficulty;
}

export interface SubmitColorRequest {
  roundId: string;
  h: number;
  s: number;
  l: number;
}