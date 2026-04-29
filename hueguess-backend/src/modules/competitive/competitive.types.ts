export interface CompetitiveGameResult {
  id: string;
  userId: string;
  original: { h: number; s: number; l: number };
  user: { h: number; s: number; l: number };
  accuracy: number;
  accuracyFormatted: string;
  ratingChange: number;
  newRating: number;
  rankTier: RankTier;
}

export type RankTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  rating: number;
  avgAccuracy: number;
  gamesPlayed: number;
  rankTier: RankTier;
}

export interface CompetitiveStats {
  userId: string;
  username: string;
  rating: number;
  avgAccuracy: number;
  gamesPlayed: number;
  bestScore: number;
  rankTier: RankTier;
  rank: number;
}

export type LeaderboardPeriod = 'daily' | 'weekly' | 'all-time';