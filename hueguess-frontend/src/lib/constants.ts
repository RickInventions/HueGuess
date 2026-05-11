const BACKEND_URL = import.meta.env.PROD 
  ? 'https://hueguess.onrender.com'
  : ''

export const API_BASE = `${BACKEND_URL}/api`

export const RANK_TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'] as const
export type RankTier = (typeof RANK_TIERS)[number]

export const TIER_COLORS: Record<RankTier, string> = {
  Bronze: '#CD7F32',
  Silver: '#A8A9AD',
  Gold: '#FFD700',
  Platinum: '#5E60FF',
  Diamond: '#1FC98E',
}

export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

export const SUBMISSION_WINDOW = 30