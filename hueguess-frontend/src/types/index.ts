// ─── User ───────────────────────────────
export interface User {
  id: string
  username: string
  email: string
  is_verified: boolean
  created_at: string
}

// ─── Auth ───────────────────────────────
export interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  username: string
  email: string
  password: string
}

// ─── Game ───────────────────────────────
export interface ColorHSL {
  h: number
  s: number
  l: number
}

export interface RoundResponse {
  roundId: string
  color: ColorHSL
  memorizationSeconds: number
  difficulty?: 'easy' | 'medium' | 'hard'
  generatedAt: string
}

export interface SubmitResponse {
  accuracy: number
  originalColor: ColorHSL
  userColor: ColorHSL
  score: number
  ratingChange?: {
    ratingBefore: number
    ratingAfter: number
    ratingChange: number
    newTier: string
    tierChanged: boolean
  }
}

export type Difficulty = 'easy' | 'medium' | 'hard'
export type GameMode = 'casual' | 'competitive'

// ─── Stats ──────────────────────────────
export interface PlayerStats {
  rating: number
  rankTier: string
  gamesPlayed: number
  gamesWon: number
  avgAccuracy: number
  bestScore: number
  currentStreak: number
  bestStreak: number
  lastGameAt: string | null
}

export interface RatingHistoryEntry {
  ratingBefore: number
  ratingAfter: number
  ratingChange: number
  accuracy: number
  difficulty: string
  createdAt: string
}

// ─── Leaderboard ────────────────────────
export interface LeaderboardEntry {
  rank: number
  username: string
  rating: number
  rankTier: string
  gamesPlayed: number
  avgAccuracy: number
  bestScore: number
}

export interface PlayerRank {
  rank: number
  totalPlayers: number
  percentile: number
  nextTierProgress: {
    currentTier: string
    nextTier: string | null
    ratingNeeded: number
    progressPercent: number
  }
}

// ─── API ────────────────────────────────
export interface ApiError {
  error: string
  message?: string
}