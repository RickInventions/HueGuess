export type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme';
export type GameMode = 'casual' | 'competitive' | 'challenge';

export interface DifficultyConfig {
  multiplier: number;
  negThreshold: number; // below this = negative score
  saturationRange: [number, number];
  lightnessRange: [number, number];
  colorTimeSeconds: number; // CT - memorization time
  roundTimeSeconds: number; // RT - submission time
}

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

export interface HSLColor {
  h: number;
  s: number;
  l: number;
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

export interface SubmitGuessInput {
  mode: GameMode;
  difficulty: Difficulty;
  originalH: number;
  originalS: number;
  originalL: number;
  userH: number;
  userS: number;
  userL: number;
  memorizationSeconds: number;
  isReload?: boolean;
}