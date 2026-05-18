// Game types
export type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme';
export type GameMode = 'casual' | 'competitive' | 'challenge';

export interface HSLColor {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

export interface DifficultyConfig {
  multiplier: number;
  negThreshold: number;
  saturationRange: [number, number];
  lightnessRange: [number, number];
  colorTimeSeconds: number;
  roundTimeSeconds: number;
}

export interface RoundResult {
  accuracy: number;
  isNegative: boolean;
  originalColor: HSLColor;
  userColor: HSLColor;
  multiplier: number;
  negThreshold: number;
  difficulty: Difficulty;
}

export interface GameRoundResponse {
  success: boolean;
  color: HSLColor;
  config: {
    multiplier: number;
    negThreshold: number;
    colorTimeSeconds: number;
    roundTimeSeconds: number;
  };
}

export interface SubmitGuessResponse {
  success: boolean;
  roundId: string | null;
  result: RoundResult;
  huePoints?: {
    oldRating: number;
    newRating: number;
    change: number;
    streak: number;
    rankTier: string;
  };
  newlyUnlocked?: Achievement[];
}

// Auth types
export interface User {
  id: string;
  username: string;
  email: string;
  is_verified: boolean;
  created_at: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface RegisterResponse {
  user: User;
  token: string;
}

// Achievement types
export interface Achievement {
  key: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  requirement_type: string;
  requirement_value: number;
  requirement_metadata: any;
}

export interface UserAchievements {
  unlocked: Achievement[];
  locked: (Achievement & { progress_current: number; progress_target: number })[];
  stats: {
    total: number;
    byCategory: Record<string, number>;
    totalPossible: number;
  };
  recent: Achievement[];
}

// Stats types
export interface CompetitiveStats {
  rating: number;
  rank_tier: string;
  games_played: number;
  total_accuracy: number;
  avg_accuracy: number;
  best_score: number;
  current_streak: number;
  best_streak: number;
  last_game_at: string;
  rankProgress: {
    currentTier: string;
    nextTier: string;
    progress: number;
    needed: number;
  };
  gamesByDifficulty: Array<{ difficulty: string; count: number }>;
  recentGames: Array<{
    id: string;
    difficulty: string;
    accuracy: number;
    memorization_seconds: number;
    created_at: string;
    is_reload: boolean;
  }>;
  ratingHistory: Array<{ date: string; rating: number }>;
}

// Leaderboard types
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  rating: number;
  rankTier: string;
  gamesPlayed: number;
  avgAccuracy: number;
  bestStreak: number;
  periodStats?: {
    gamesThisWeek?: number;
    weeklyAvgAccuracy?: number;
    gamesToday?: number;
    dailyAvgAccuracy?: number;
  };
}

export interface AwardEmblem {
  category: string;
  icon: string;
  rank: number;
  username: string;
  value: number;
}

// Daily challenge types
export interface DailyChallenge {
  id: string;
  date: string;
  color: HSLColor;
  difficulty: Difficulty;
}

export interface DailySubmissionResult {
  accuracy: number;
  isNewRecord: boolean;
  previousBest?: number;
  rank: number;
  totalParticipants: number;
}