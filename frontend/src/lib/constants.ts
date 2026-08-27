import type { DifficultyConfig, Difficulty } from '../types';

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  easy: {
    multiplier: 1.0,
    negThreshold: 65,
    saturationRange: [50, 100],
    lightnessRange: [40, 70],
    colorTimeSeconds: 6,
    roundTimeSeconds: 35,
  },
  medium: {
    multiplier: 1.5,
    negThreshold: 75,
    saturationRange: [30, 100],
    lightnessRange: [25, 80],
    colorTimeSeconds: 4,
    roundTimeSeconds: 30,
  },
  hard: {
    multiplier: 2.0,
    negThreshold: 80,
    saturationRange: [15, 100],
    lightnessRange: [15, 90],
    colorTimeSeconds: 2,
    roundTimeSeconds: 15,
  },
  extreme: {
    multiplier: 4.0,
    negThreshold: 85,
    saturationRange: [5, 100],
    lightnessRange: [5, 95],
    colorTimeSeconds: 0.5,
    roundTimeSeconds: 15,
  },
};

// The rank ladder lives in ./ranks.ts. Re-exported here so the older import
// sites keep working — note that `getRankTier` now returns a full division
// label ("Gold II"), so index the palettes with rankColor()/rankIcon() rather
// than the label itself.
export {
  RANK_LADDER,
  STARTING_RATING,
  RANK_ICONS,
  RANK_COLORS,
  getRankDivision,
  getRankTier,
  getRankTierName,
  getRankProgress,
  rankColor,
  rankIcon,
} from './ranks';
export type { RankTierBand, RankDivision } from './ranks';
