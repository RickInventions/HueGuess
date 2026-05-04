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

export interface CompetitiveStats {
  user_id: string;
  rating: number;
  rank_tier: RankTier;
  games_played: number;
  games_won: number;
  total_accuracy: number;
  avg_accuracy: number;
  best_score: number;
  current_streak: number;
  best_streak: number;
  last_game_at: Date | null;
}

export type RankTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

export interface RatingChange {
  ratingBefore: number;
  ratingAfter: number;
  ratingChange: number;
  newTier: RankTier;
  tierChanged: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  rating: number;
  rankTier: RankTier;
  gamesPlayed: number;
  avgAccuracy: number;
  bestScore: number;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  period: 'daily' | 'weekly' | 'all-time';
  timestamp: string;
}

export interface DifficultyGate {
  allowed: boolean;
  unlockedDifficulties: string[];
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LeaderboardFilters {
  period: 'daily' | 'weekly' | 'all-time';
  page?: number;
  limit?: number;
  rankTier?: RankTier;
  search?: string;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface PlayerRankResponse {
  rank: number;
  totalPlayers: number;
  percentile: number;
  nextTierProgress: {
    currentTier: RankTier;
    nextTier: RankTier | null;
    ratingNeeded: number;
    progressPercent: number;
  };
}

export interface GlobalStats {
  totalPlayers: number;
  totalGames: number;
  averageAccuracy: number;
  distributionByTier: Record<RankTier, number>;
}