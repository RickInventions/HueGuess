/**
 * The competitive rank ladder.
 *
 * Mirrored verbatim from `api/src/utils/rank.utils.ts` — the two packages share
 * no build, so if you change a band there, change it here too. The server is the
 * authority on what a rating *is*; this file exists so the UI can label and chart
 * a rating without a round trip.
 *
 * Divisions count DOWN as you climb: Bronze III is the entry rank, Bronze I is
 * the top of Bronze, and the ladder peaks at Legendary I.
 */

export interface RankTierBand {
  tier: string
  /** Inclusive lower bound. */
  min: number
  /** Inclusive upper bound. The last band is treated as unbounded above. */
  max: number
  divisions: number
}

export const RANK_LADDER: readonly RankTierBand[] = [
  { tier: 'Bronze', min: 0, max: 999, divisions: 3 },
  { tier: 'Silver', min: 1_000, max: 2_499, divisions: 3 },
  { tier: 'Gold', min: 2_500, max: 5_999, divisions: 4 },
  { tier: 'Platinum', min: 6_000, max: 12_999, divisions: 5 },
  { tier: 'Diamond', min: 13_000, max: 24_999, divisions: 5 },
  { tier: 'Legendary', min: 25_000, max: 100_000, divisions: 10 },
] as const

/** Rating every new account starts on. */
export const STARTING_RATING = 100

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

export interface RankDivision {
  tier: string
  /** 1 is the top of the tier, `divisions` is the bottom. */
  division: number
  /** e.g. "Gold II". */
  label: string
  /** Inclusive rating bounds of this division. */
  floor: number
  ceiling: number
  /** True for Legendary I — nothing above it. */
  isMax: boolean
}

/**
 * Bounds of one division, derived the same way every time so lookup and display
 * can never disagree. Integer math throughout: a band width of 333.33 would
 * otherwise put the boundary in a different place depending on which side asked.
 */
function divisionBounds(band: RankTierBand, index: number): { floor: number; ceiling: number } {
  const span = band.max - band.min + 1
  return {
    floor: band.min + Math.floor((span * index) / band.divisions),
    ceiling: band.min + Math.floor((span * (index + 1)) / band.divisions) - 1,
  }
}

function bandFor(rating: number): RankTierBand {
  for (const band of RANK_LADDER) {
    if (rating <= band.max) return band
  }
  // Above the top of the ladder — stays at the highest band.
  return RANK_LADDER[RANK_LADDER.length - 1]
}

/** Full division for a rating, e.g. 4300 → Gold II. */
export function getRankDivision(rating: number): RankDivision {
  const safe = Number.isFinite(rating) ? Math.max(0, Math.floor(rating)) : 0
  const band = bandFor(safe)
  const isTopBand = band === RANK_LADDER[RANK_LADDER.length - 1]

  for (let index = 0; index < band.divisions; index++) {
    const { floor, ceiling } = divisionBounds(band, index)
    const last = index === band.divisions - 1
    // The very top division absorbs anything above the ladder's ceiling.
    if (safe <= ceiling || (last && isTopBand)) {
      const division = band.divisions - index
      return {
        tier: band.tier,
        division,
        label: `${band.tier} ${ROMAN[division - 1]}`,
        floor,
        ceiling,
        isMax: last && isTopBand,
      }
    }
  }

  // Unreachable: bandFor guarantees the rating sits inside one of the divisions.
  const bounds = divisionBounds(band, band.divisions - 1)
  return { tier: band.tier, division: 1, label: `${band.tier} ${ROMAN[0]}`, ...bounds, isMax: isTopBand }
}

/** Display label as stored on the account, e.g. "Gold II". */
export function getRankTier(rating: number): string {
  return getRankDivision(rating).label
}

/** Tier name without the division, e.g. "Gold" — for colours and icons. */
export function getRankTierName(rating: number): string {
  return getRankDivision(rating).tier
}

/** The division directly above `current`, or null at the top of the ladder. */
function nextDivision(current: RankDivision): RankDivision | null {
  if (current.isMax) return null
  return getRankDivision(current.ceiling + 1)
}

export function getRankProgress(rating: number) {
  const safe = Number.isFinite(rating) ? Math.max(0, Math.floor(rating)) : 0
  const current = getRankDivision(safe)
  const next = nextDivision(current)

  const span = current.ceiling - current.floor + 1
  const progress = current.isMax ? 100 : ((safe - current.floor) / span) * 100

  return {
    tier: current.tier,
    division: current.division,
    label: current.label,
    floor: current.floor,
    ceiling: current.ceiling,
    isMax: current.isMax,
    // `currentTier` / `nextTier` / `progress` / `needed` keep the shape the
    // profile screen already consumes; 'Max' is its sentinel for "no next rank".
    currentTier: current.label,
    nextTier: next ? next.label : 'Max',
    progress: Math.min(100, Math.max(0, progress)),
    needed: next ? Math.max(0, next.floor - safe) : 0,
  }
}

export const RANK_COLORS: Record<string, string> = {
  bronze: '#CD7F32',
  silver: '#A8A9AD',
  gold: '#D4A017',
  platinum: '#3FBFBF',
  diamond: '#5E60FF',
  legendary: '#FF7A59',
}

export const RANK_ICONS: Record<string, string> = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  platinum: '💎',
  diamond: '👑',
  legendary: '🔥',
}

/**
 * Colour for a stored rank label. Takes the whole label ("Gold II") because
 * that's what the API returns — keying the palette on it directly would miss.
 */
export function rankColor(label?: string | null): string {
  if (!label) return RANK_COLORS.bronze
  const tier = label.split(' ')[0].toLowerCase()
  return RANK_COLORS[tier] ?? RANK_COLORS.bronze
}

/** Icon for a stored rank label, e.g. "Platinum IV" → 💎. */
export function rankIcon(label?: string | null): string {
  if (!label) return RANK_ICONS.bronze
  const tier = label.split(' ')[0].toLowerCase()
  return RANK_ICONS[tier] ?? RANK_ICONS.bronze
}
