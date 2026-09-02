import type { Achievement, Difficulty, HSLColor } from './index'

/**
 * The two modes that sit outside the ladder — Inverted and Blind — with Blind
 * split into its two variants.
 *
 * The wire values match the server's `ExtraMode` union and the CHECK constraint
 * on `mode_rounds.mode`, so they are not renameable without a migration.
 */
export type ExtraMode = 'inverted' | 'blind_target' | 'blind_sliders'

export const EXTRA_MODES: ExtraMode[] = ['inverted', 'blind_target', 'blind_sliders']

export const EXTRA_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'extreme']

/**
 * What a board can be filtered to. `all` is the default: still one row per
 * player, but their best round at any difficulty, with the row saying which.
 */
export type BoardDifficulty = Difficulty | 'all'

export const BOARD_DIFFICULTIES: BoardDifficulty[] = ['all', ...EXTRA_DIFFICULTIES]

/** Short capitalised labels, since the wire values are lowercase. */
export const DIFFICULTY_LABELS: Record<BoardDifficulty, string> = {
  all: 'All',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  extreme: 'Extreme',
}

/** Difficulty chips on the board. Extreme reads as the warning it is. */
export const DIFFICULTY_CHIPS: Record<Difficulty, string> = {
  easy: 'bg-success/10 text-success',
  medium: 'bg-primary/10 text-primary',
  hard: 'bg-accent/10 text-accent',
  extreme: 'bg-deep/10 text-deep',
}

/**
 * One place that names each mode, because the play page, the home cards, the
 * leaderboard picker and the result screen all need the same words for it.
 */
export const EXTRA_MODE_META: Record<
  ExtraMode,
  { name: string; short: string; family: string; blurb: string }
> = {
  inverted: {
    name: 'Inverted',
    short: 'Inverted',
    family: 'Inverted',
    blurb: 'The colour — and the whole page — is shown flipped. Rebuild the original.',
  },
  blind_target: {
    name: 'Blind · No target',
    short: 'No target',
    family: 'Blind',
    blurb: 'The colour is never shown. Set one and find out how close you landed.',
  },
  blind_sliders: {
    name: 'Blind · Grey sliders',
    short: 'Grey sliders',
    family: 'Blind',
    blurb: 'Memorize the colour, then rebuild it with no colour on the sliders at all.',
  },
}

/** True for the variants that show something during a memorization phase. */
export const hasMemorization = (mode: ExtraMode): boolean => mode !== 'blind_target'

export interface ExtraRoundResponse {
  success: boolean
  mode: ExtraMode
  difficulty: Difficulty
  /** Signed by the server and carries the target. Posted back on submit. */
  token: string
  /** What you are allowed to see — null in the no-target variant. */
  color: HSLColor | null
  config: {
    colorTimeSeconds: number
    roundTimeSeconds: number
    negThreshold: number
  }
}

export interface ExtraRoundResult {
  mode: ExtraMode
  difficulty: Difficulty
  accuracy: number
  originalColor: HSLColor
  userColor: HSLColor
  previousBest: number | null
  personalBest: number
  isPersonalBest: boolean
  /** Position of your personal best on this board, out of `totalPlayers`. */
  rank: number
  totalPlayers: number
  /** Inverted and Blind award no HuePoints, but they do have achievements. */
  newlyUnlocked?: Achievement[]
}

export interface ExtraBoardEntry {
  rank: number
  userId: string
  username: string
  bestAccuracy: number
  attempts: number
  achievedAt: string
  /** Which difficulty this player's best round was played at. */
  difficulty: Difficulty
}

export interface ExtraBoard {
  entries: ExtraBoardEntry[]
  total: number
  limit: number
  offset: number
  mode: ExtraMode
  difficulty: BoardDifficulty
}

/**
 * Flip a colour across the wheel with its lightness inverted.
 *
 * Mirrors `complement()` on the server and is its own inverse, which is the
 * whole trick of Inverted mode: the same operation that produced what you were
 * shown is the one that gets you back to the answer.
 */
export function complement(color: HSLColor): HSLColor {
  return { h: (color.h + 180) % 360, s: color.s, l: 100 - color.l }
}
