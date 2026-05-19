import { DifficultyConfig, Difficulty } from '../types';

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

export const RANK_THRESHOLDS = {
  bronze: 0,
  silver: 300,
  gold: 700,
  platinum: 1400,
  diamond: 2500,
};

export const RANK_ICONS = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  platinum: '💠',
  diamond: '💎',
};

export const getRankTier = (rating: number): string => {
  if (rating < 300) return 'Bronze';
  if (rating < 700) return 'Silver';
  if (rating < 1400) return 'Gold';
  if (rating < 2500) return 'Platinum';
  return 'Diamond';
};

export const RANK_COLORS = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
  diamond: '#B9F2FF',
}

export const getRankProgress = (rating: number) => {
  let currentThreshold = 0;
  let nextThreshold = 300;
  let currentTier = 'Bronze';
  let nextTier = 'Silver';
  
  if (rating < 300) {
    currentThreshold = 0;
    nextThreshold = 300;
    currentTier = 'Bronze';
    nextTier = 'Silver';
  } else if (rating < 700) {
    currentThreshold = 300;
    nextThreshold = 700;
    currentTier = 'Silver';
    nextTier = 'Gold';
  } else if (rating < 1400) {
    currentThreshold = 700;
    nextThreshold = 1400;
    currentTier = 'Gold';
    nextTier = 'Platinum';
  } else if (rating < 2500) {
    currentThreshold = 1400;
    nextThreshold = 2500;
    currentTier = 'Platinum';
    nextTier = 'Diamond';
  } else {
    currentThreshold = 2500;
    nextThreshold = 2500;
    currentTier = 'Diamond';
    nextTier = 'Max';
  }
  
  const progress = nextThreshold > currentThreshold 
    ? ((rating - currentThreshold) / (nextThreshold - currentThreshold)) * 100
    : 100;
  
  return {
    currentTier,
    nextTier,
    progress: Math.min(100, Math.max(0, progress)),
    needed: nextThreshold - rating,
    currentThreshold,
    nextThreshold,
  };
};