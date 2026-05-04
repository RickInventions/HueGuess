import { query } from '../config/db.js';
import type { ColorHSL, RoundResponse, SubmitRequest, SubmitResponse } from '../types/index.js';

interface DifficultyConfig {
  memorizationSeconds: number;
  multiplier: number;
  negThreshold: number; // Below this accuracy = negative score
}

const DIFFICULTY_CONFIGS: Record<string, DifficultyConfig> = {
  easy: { memorizationSeconds: 4, multiplier: 1.5, negThreshold: 60 },
  medium: { memorizationSeconds: 3, multiplier: 1.0, negThreshold: 70 },
  hard: { memorizationSeconds: 1, multiplier: 3.0, negThreshold: 88 },
};

export class GameService {
  static generateColor(difficulty: 'easy' | 'medium' | 'hard' | 'casual' = 'medium'): ColorHSL {
    let h: number, s: number, l: number;

    if (difficulty === 'casual' || difficulty === 'easy') {
      h = Math.floor(Math.random() * 360);           // 0–359
      s = Math.floor(60 + Math.random() * 41);       // 60–100
      l = Math.floor(40 + Math.random() * 31);       // 40–70
    } else if (difficulty === 'medium') {
      h = Math.floor(Math.random() * 360);           // 0–359
      s = Math.floor(50 + Math.random() * 51);       // 50–100
      l = Math.floor(35 + Math.random() * 36);       // 35–70
    } else { // hard
      h = Math.floor(Math.random() * 360);           // 0–359
      s = Math.floor(30 + Math.random() * 61);       // 30–90
      l = Math.floor(30 + Math.random() * 41);       // 30–70
    }

    return { h, s, l };
  }

 static async createRound(
    userId: string | null,
    difficulty: 'easy' | 'medium' | 'hard' | 'casual' = 'medium'
  ): Promise<RoundResponse> {
    const config = difficulty === 'casual' 
      ? { memorizationSeconds: 3, multiplier: 1.0, negThreshold: 0 }
      : DIFFICULTY_CONFIGS[difficulty];
    
    const color = GameService.generateColor(difficulty as 'easy' | 'medium' | 'hard');
    
    const result = await query(
      `INSERT INTO game_rounds (
        user_id, mode, difficulty, original_h, original_s, original_l, 
        memorization_seconds, round_created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) 
      RETURNING id, round_created_at`,
      [
        userId,
        difficulty === 'casual' ? 'casual' : 'competitive',
        difficulty === 'casual' ? null : difficulty,
        color.h,
        color.s,
        color.l,
        config.memorizationSeconds,
      ]
    );

    const row = result.rows[0];

    return {
      roundId: row.id,
      color,                                          // { h: 92, s: 91, l: 62 }
      memorizationSeconds: config.memorizationSeconds,
      difficulty: difficulty === 'casual' ? undefined : difficulty,
      generatedAt: row.round_created_at.toISOString(),
    };
  }

  static async submitRound(
    roundId: string,
    userColor: ColorHSL,
    userId: string | null = null
  ): Promise<SubmitResponse> {
    // Fetch round
    const roundResult = await query(
      'SELECT * FROM game_rounds WHERE id = $1',
      [roundId]
    );

    if (roundResult.rows.length === 0) {
      throw new Error('Round not found');
    }

    const round = roundResult.rows[0];

    // Anti-cheat: verify ownership for competitive
    if (round.mode === 'competitive' && round.user_id !== userId) {
      throw new Error('Unauthorized: round belongs to another user');
    }

    // Anti-cheat: timing validation
    const now = new Date();
    const roundCreated = new Date(round.round_created_at);
    const elapsedMs = now.getTime() - roundCreated.getTime();
    const elapsedSeconds = elapsedMs / 1000;
    
    const minSubmissionTime = round.memorization_seconds; // Must wait at least memorization time
    const maxSubmissionTime = round.memorization_seconds + 30; // 30s grace period
    
    if (elapsedSeconds < minSubmissionTime - 0.5) { // 500ms buffer
      throw new Error('Submission too fast');
    }
    
    if (elapsedSeconds > maxSubmissionTime) {
      throw new Error('Round expired');
    }

    // Calculate accuracy
    const accuracy = GameService.calculateAccuracy(
      { h: round.original_h, s: round.original_s, l: round.original_l },
      userColor
    );

    // Calculate score with difficulty multiplier
    let score = accuracy;
    if (round.difficulty) {
      const config = DIFFICULTY_CONFIGS[round.difficulty];
      if (config) {
        score = accuracy * config.multiplier;
        // Negative rule
        if (accuracy < config.negThreshold) {
          score = -Math.abs(score); // Force negative
        }
      }
    }

    // Update round record
    await query(
      `UPDATE game_rounds 
       SET user_h = $1, user_s = $2, user_l = $3, accuracy = $4, submitted_at = NOW()
       WHERE id = $5`,
      [userColor.h, userColor.s, userColor.l, accuracy, roundId]
    );

    return {
      accuracy: Math.round(accuracy * 1000) / 1000, // 3 decimal places
      originalColor: { h: round.original_h, s: round.original_s, l: round.original_l },
      userColor,
      score: Math.round(score * 1000) / 1000,
    };
  }

  static calculateAccuracy(original: ColorHSL, user: ColorHSL): number {
    // Normalize hue difference (circular)
    const hueDiff = Math.min(
      Math.abs(original.h - user.h),
      360 - Math.abs(original.h - user.h)
    ) / 180;

    const satDiff = Math.abs(original.s - user.s) / 100;
    const lightDiff = Math.abs(original.l - user.l) / 100;

    const distance = Math.sqrt(
      hueDiff * hueDiff + satDiff * satDiff + lightDiff * lightDiff
    );

    const accuracy = Math.max(0, Math.min(100, (1 - distance) * 100));
    
    return Math.round(accuracy * 1000) / 1000;
  }
}