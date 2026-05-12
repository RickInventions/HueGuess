import pool from '../config/db.js';
import { 
  Difficulty, 
  GameMode, 
  DIFFICULTY_CONFIGS, 
  SubmitGuessInput,
  RoundResult 
} from '../types/game.types.js';
import { 
  calculateAccuracy, 
  HSLColor, 
  validateHSL,
  generateRandomColor 
} from '../utils/hsl.utils.js';

export class GameService {
  
  // Generate a random color based on difficulty
  static generateColorForDifficulty(difficulty: Difficulty): HSLColor {
    const config = DIFFICULTY_CONFIGS[difficulty];
    return generateRandomColor(config.saturationRange, config.lightnessRange);
  }
  
  // Get difficulty configuration
  static getDifficultyConfig(difficulty: Difficulty) {
    return DIFFICULTY_CONFIGS[difficulty];
  }
  
  // Calculate score from accuracy and difficulty
  static calculateScore(accuracy: number, difficulty: Difficulty): number {
    const config = DIFFICULTY_CONFIGS[difficulty];
    let score = accuracy * config.multiplier;
    
    if (accuracy < config.negThreshold) {
      score = -Math.abs(score);
    }
    
    return Math.round(score);
  }
  
  // Process a guess submission
  static processGuess(
    original: HSLColor,
    user: HSLColor,
    difficulty: Difficulty
  ): RoundResult {
    const accuracy = calculateAccuracy(original, user);
    const score = this.calculateScore(accuracy, difficulty);
    const config = DIFFICULTY_CONFIGS[difficulty];
    
    return {
      accuracy,
      score,
      isNegative: accuracy < config.negThreshold,
      originalColor: original,
      userColor: user,
      multiplier: config.multiplier,
      negThreshold: config.negThreshold,
    };
  }
  
  // Save round to database (for competitive/challenge modes)
  static async saveRound(input: {
    userId: string;
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
  }): Promise<string> {
    const {
      userId,
      mode,
      difficulty,
      originalH,
      originalS,
      originalL,
      userH,
      userS,
      userL,
      memorizationSeconds,
      isReload = false,
    } = input;
    
    // Calculate accuracy if user submitted values
    let accuracy: number | null = null;
    if (userH !== undefined && userS !== undefined && userL !== undefined) {
      const original: HSLColor = { h: originalH, s: originalS, l: originalL };
      const user: HSLColor = { h: userH, s: userS, l: userL };
      accuracy = calculateAccuracy(original, user);
    } else if (isReload) {
      accuracy = 0;
    }
    
    const result = await pool.query(
      `INSERT INTO game_rounds (
        user_id, mode, difficulty, original_h, original_s, original_l,
        user_h, user_s, user_l, accuracy, memorization_seconds,
        round_created_at, submitted_at, is_reload
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id`,
      [
        userId,
        mode,
        difficulty,
        originalH,
        originalS,
        originalL,
        userH || null,
        userS || null,
        userL || null,
        accuracy,
        memorizationSeconds,
        new Date(),
        isReload ? null : new Date(),
        isReload,
      ]
    );
    
    return result.rows[0].id;
  }
  
  // Register reload penalty (0% auto-submit)
  static async registerReloadPenalty(
    userId: string,
    mode: GameMode,
    difficulty: Difficulty,
    originalColor: HSLColor,
    memorizationSeconds: number
  ): Promise<string> {
    return await this.saveRound({
      userId,
      mode,
      difficulty,
      originalH: originalColor.h,
      originalS: originalColor.s,
      originalL: originalColor.l,
      userH: 0,
      userS: 0,
      userL: 0,
      memorizationSeconds,
      isReload: true,
    });
  }
  
  // Get recent rounds for a user (for history)
  static async getUserRecentRounds(userId: string, limit: number = 10) {
    const result = await pool.query(
      `SELECT id, mode, difficulty, accuracy, memorization_seconds, 
              submitted_at, created_at, is_reload
       FROM game_rounds
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    
    return result.rows;
  }
}