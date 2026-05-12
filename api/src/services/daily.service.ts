import pool from '../config/db.js';
import { HSLColor, DIFFICULTY_CONFIGS } from '../types/game.types.js';
import { generateRandomColor, calculateAccuracy } from '../utils/hsl.utils.js';

export class DailyChallengeService {
  
  // Get or create today's challenge
  static async getTodayChallenge(): Promise<{
    id: string;
    date: string;
    color: HSLColor;
    difficulty: string;
  }> {
    const today = new Date().toISOString().split('T')[0];
    
    // Check if challenge exists for today
    let result = await pool.query(
      `SELECT id, challenge_date, color_h, color_s, color_l, difficulty
       FROM daily_challenges
       WHERE challenge_date = $1`,
      [today]
    );
    
    if (result.rows.length === 0) {
      // Generate new challenge for today
      const difficulties: Array<{ diff: string; weight: number }> = [
        { diff: 'easy', weight: 1 },
        { diff: 'medium', weight: 3 },
        { diff: 'hard', weight: 3 },
        { diff: 'extreme', weight: 2 },
      ];
      
      const totalWeight = difficulties.reduce((sum, d) => sum + d.weight, 0);
      let random = Math.random() * totalWeight;
      let selectedDifficulty = 'medium';
      
      for (const d of difficulties) {
        if (random < d.weight) {
          selectedDifficulty = d.diff;
          break;
        }
        random -= d.weight;
      }
      
      const config = DIFFICULTY_CONFIGS[selectedDifficulty as keyof typeof DIFFICULTY_CONFIGS];
      const color = generateRandomColor(config.saturationRange, config.lightnessRange);
      
      const insertResult = await pool.query(
        `INSERT INTO daily_challenges (challenge_date, color_h, color_s, color_l, difficulty)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, challenge_date, color_h, color_s, color_l, difficulty`,
        [today, color.h, color.s, color.l, selectedDifficulty]
      );
      
      result = insertResult;
    }
    
    const challenge = result.rows[0];
    return {
      id: challenge.id,
      date: challenge.challenge_date,
      color: {
        h: challenge.color_h,
        s: challenge.color_s,
        l: challenge.color_l,
      },
      difficulty: challenge.difficulty,
    };
  }
  
  // Submit daily challenge guess (ONCE PER USER)
  static async submitGuess(
    userId: string,
    challengeId: string,
    userColor: HSLColor,
    timeTakenMs: number
  ): Promise<{
    accuracy: number;
    rank?: number;
    totalParticipants: number;
  }> {
    // Check if user already submitted for this challenge
    const existingSubmission = await pool.query(
      `SELECT accuracy, user_h, user_s, user_l, time_taken_ms, submitted_at
       FROM daily_submissions
       WHERE user_id = $1 AND challenge_id = $2`,
      [userId, challengeId]
    );
    
    if (existingSubmission.rows.length > 0) {
      throw new Error('You have already completed today\'s challenge. Come back tomorrow for a new one!');
    }
    
    // Get challenge details
    const challengeResult = await pool.query(
      `SELECT color_h, color_s, color_l
       FROM daily_challenges
       WHERE id = $1`,
      [challengeId]
    );
    
    if (challengeResult.rows.length === 0) {
      throw new Error('Challenge not found');
    }
    
    const challenge = challengeResult.rows[0];
    const originalColor = {
      h: challenge.color_h,
      s: challenge.color_s,
      l: challenge.color_l,
    };
    
    const accuracy = calculateAccuracy(originalColor, userColor);
    
    // Insert submission (only once)
    await pool.query(
      `INSERT INTO daily_submissions (user_id, challenge_id, accuracy, user_h, user_s, user_l, time_taken_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, challengeId, accuracy, userColor.h, userColor.s, userColor.l, timeTakenMs]
    );
    
    // Get leaderboard position
    const rankResult = await pool.query(
      `SELECT COUNT(*) + 1 as rank
       FROM daily_submissions
       WHERE challenge_id = $1 AND accuracy > $2`,
      [challengeId, accuracy]
    );
    
    const totalResult = await pool.query(
      `SELECT COUNT(*) as total
       FROM daily_submissions
       WHERE challenge_id = $1`,
      [challengeId]
    );
    
    return {
      accuracy,
      rank: parseInt(rankResult.rows[0].rank),
      totalParticipants: parseInt(totalResult.rows[0].total),
    };
  }
  
  // Get daily challenge leaderboard
  static async getDailyLeaderboard(challengeId: string, limit: number = 50) {
    const result = await pool.query(
      `SELECT ds.user_id, u.username, ds.accuracy, ds.time_taken_ms, ds.submitted_at,
              ROW_NUMBER() OVER (ORDER BY ds.accuracy DESC, ds.time_taken_ms ASC) as rank
       FROM daily_submissions ds
       JOIN users u ON ds.user_id = u.id
       WHERE ds.challenge_id = $1
       ORDER BY ds.accuracy DESC, ds.time_taken_ms ASC
       LIMIT $2`,
      [challengeId, limit]
    );
    
    return result.rows;
  }
  
  // Get global average accuracy for today's challenge
  static async getGlobalAverage(challengeId: string): Promise<number> {
    const result = await pool.query(
      `SELECT COALESCE(AVG(accuracy), 0) as avg_accuracy
       FROM daily_submissions
       WHERE challenge_id = $1`,
      [challengeId]
    );
    
    return parseFloat(result.rows[0].avg_accuracy);
  }
  
  // Check if user has completed today's challenge
  static async hasUserCompleted(userId: string, challengeId: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT id FROM daily_submissions
       WHERE user_id = $1 AND challenge_id = $2`,
      [userId, challengeId]
    );
    
    return result.rows.length > 0;
  }
  
  // Get user's submission for a challenge (if exists)
  static async getUserSubmission(userId: string, challengeId: string) {
    const result = await pool.query(
      `SELECT accuracy, time_taken_ms, submitted_at
       FROM daily_submissions
       WHERE user_id = $1 AND challenge_id = $2
       LIMIT 1`,
      [userId, challengeId]
    );
    
    return result.rows[0] || null;
  }
  
  // Get remaining time until next challenge
  static getTimeUntilNextChallenge(): { hours: number; minutes: number; seconds: number } {
    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const diffMs = tomorrow.getTime() - now.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    return { hours, minutes, seconds };
  }
}