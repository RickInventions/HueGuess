export interface User {
  id: string;
  username: string;
  email: string;
  is_verified: boolean;
  created_at: Date;
}

export interface GameRound {
  id: string;
  user_id: string | null;
  mode: 'casual' | 'competitive';
  difficulty: 'easy' | 'medium' | 'hard' | null;
  original_h: number;
  original_s: number;
  original_l: number;
  user_h: number | null;
  user_s: number | null;
  user_l: number | null;
  accuracy: number | null;
  memorization_seconds: number;
  round_created_at: Date;
  submitted_at: Date | null;
  is_valid: boolean;
}

export interface ColorHSL {
  h: number;
  s: number;
  l: number;
}

export interface RoundResponse {
  roundId: string;
  color: ColorHSL;
  memorizationSeconds: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  generatedAt: string;
}

export interface SubmitRequest {
  roundId: string;
  userColor: ColorHSL;
}

export interface SubmitResponse {
  accuracy: number;
  originalColor: ColorHSL;
  userColor: ColorHSL;
  score: number;
}

export interface AuthPayload {
  userId: string;
  username: string;
}