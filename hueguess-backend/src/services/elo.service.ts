import { query } from '../config/db.js';
import type { CompetitiveStats, RankTier, RatingChange } from '../types/index.js';

// K-factor determines how much rating changes per game
const BASE_K = 32;

// Rank tiers with rating thresholds
const RANK_THRESHOLDS: { tier: RankTier; minRating: number }[] = [
  { tier: 'Bronze', minRating: 0 },
  { tier: 'Silver', minRating: 150 },
  { tier: 'Gold', minRating: 300 },
  { tier: 'Platinum', minRating: 500 },
  { tier: 'Diamond', minRating: 750 },
];

export class EloService {
  /**
   * Calculate ELO rating change based on accuracy vs expected performance
   * 
   * Expected accuracy is based on the player's current rating:
   * - 100 rating = expected ~50% accuracy
   * - 500 rating = expected ~75% accuracy
   * - 1000 rating = expected ~90% accuracy
   */
  static calculateRatingChange(
    currentRating: number,
    accuracy: number,
    difficulty: 'easy' | 'medium' | 'hard'
  ): { ratingChange: number; expectedAccuracy: number } {
    // Expected accuracy scales with rating (sigmoid-like)
    const expectedAccuracy = this.getExpectedAccuracy(currentRating);
    
    // Performance delta: how much better/worse than expected
    const performanceDelta = accuracy - expectedAccuracy;
    
    // K-factor adjustments
    let kFactor = BASE_K;
    
    // Higher volatility for new players (fewer games = bigger swings)
    // We'll pass gamesPlayed optionally, but for now apply difficulty scaling
    if (difficulty === 'hard') {
      kFactor *= 1.2; // Bigger swings on hard mode
    } else if (difficulty === 'easy') {
      kFactor *= 0.8; // Smaller swings on easy mode
    }
    
    // Rating floor: can't go below 0
    let ratingChange = Math.round(kFactor * (performanceDelta / 100));
    
    if (currentRating + ratingChange < 0) {
      ratingChange = -currentRating; // Clamp to floor of 0
    }
    
    return {
      ratingChange,
      expectedAccuracy: Math.round(expectedAccuracy * 100) / 100,
    };
  }

  /**
   * Get expected accuracy for a given rating
   * Maps rating → expected accuracy percentage
   */
  static getExpectedAccuracy(rating: number): number {
    // Logarithmic curve that maps:
    // 0 rating → 30%
    // 100 rating → 50%
    // 300 rating → 65%
    // 500 rating → 75%
    // 750 rating → 83%
    // 1000 rating → 88%
    
    if (rating <= 0) return 30;
    
    // This creates a nice diminishing returns curve
    const expectedAccuracy = 30 + (55 * Math.log10(rating / 10 + 1)) / Math.log10(101);
    
    return Math.min(95, Math.max(30, expectedAccuracy));
  }

  /**
   * Determine rank tier from rating
   */
  static getRankTier(rating: number): RankTier {
    let tier: RankTier = 'Bronze';
    
    for (const threshold of RANK_THRESHOLDS) {
      if (rating >= threshold.minRating) {
        tier = threshold.tier;
      }
    }
    
    return tier;
  }

  /**
   * Get unlocked difficulties for a rank tier
   */
  static getUnlockedDifficulties(rankTier: RankTier): string[] {
    const tiers: RankTier[] = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
    const tierIndex = tiers.indexOf(rankTier);
    
    const unlocked: string[] = ['easy', 'medium'];
    
    if (tierIndex >= 2) { // Gold+
      unlocked.push('hard');
    }
    
    return unlocked;
  }

  /**
   * Check if player can play a given difficulty
   */
  static canPlayDifficulty(rankTier: RankTier, difficulty: string): { allowed: boolean; message?: string; unlockedDifficulties: string[] } {
    const unlocked = this.getUnlockedDifficulties(rankTier);
    
    if (difficulty === 'casual') {
      return { allowed: true, unlockedDifficulties: unlocked };
    }
    
    if (!unlocked.includes(difficulty)) {
      const nextTier = this.getNextTierForDifficulty(difficulty);
      return {
        allowed: false,
        message: `Hard mode unlocks at ${nextTier} rank`,
        unlockedDifficulties: unlocked,
      };
    }
    
    return { allowed: true, unlockedDifficulties: unlocked };
  }

  static getNextTierForDifficulty(difficulty: string): RankTier {
    if (difficulty === 'hard') return 'Gold';
    return 'Bronze';
  }

  /**
   * Update player stats after a competitive game
   */
  static async updateStatsAfterGame(
    userId: string,
    accuracy: number,
    score: number,
    difficulty: 'easy' | 'medium' | 'hard',
    gameRoundId: string
  ): Promise<RatingChange> {
    // Get current stats or create if not exists
    let stats = await this.getOrCreateStats(userId);
    
    // Calculate rating change
    const { ratingChange } = this.calculateRatingChange(stats.rating, accuracy, difficulty);
    
    const newRating = Math.max(0, stats.rating + ratingChange);
    const newTier = this.getRankTier(newRating);
    const tierChanged = newTier !== stats.rank_tier;
    
    // Calculate new averages
    const newGamesPlayed = stats.games_played + 1;
    const newTotalAccuracy = stats.total_accuracy + accuracy;
    const newAvgAccuracy = Math.round((newTotalAccuracy / newGamesPlayed) * 100) / 100;
    
    // Streak logic: positive score = win, negative = loss
    let newStreak: number;
    let newGamesWon = stats.games_won;
    
    if (score >= 0) {
      newStreak = stats.current_streak >= 0 ? stats.current_streak + 1 : 1;
      newGamesWon += 1;
    } else {
      newStreak = stats.current_streak <= 0 ? stats.current_streak - 1 : -1;
    }
    
    const newBestStreak = Math.max(stats.best_streak, newStreak);
    const newBestScore = Math.max(stats.best_score, score);
    
    // Update competitive_stats
    await query(
      `UPDATE competitive_stats SET
        rating = $1,
        rank_tier = $2,
        games_played = $3,
        games_won = $4,
        total_accuracy = $5,
        avg_accuracy = $6,
        best_score = $7,
        current_streak = $8,
        best_streak = $9,
        last_game_at = NOW(),
        updated_at = NOW()
      WHERE user_id = $10`,
      [
        newRating,
        newTier,
        newGamesPlayed,
        newGamesWon,
        newTotalAccuracy,
        newAvgAccuracy,
        newBestScore,
        newStreak,
        newBestStreak,
        userId,
      ]
    );
    
    // Record rating history
    await query(
      `INSERT INTO rating_history (user_id, game_round_id, rating_before, rating_after, rating_change, accuracy, difficulty)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, gameRoundId, stats.rating, newRating, ratingChange, accuracy, difficulty]
    );
    
    return {
      ratingBefore: stats.rating,
      ratingAfter: newRating,
      ratingChange,
      newTier,
      tierChanged,
    };
  }

  /**
   * Get or create competitive stats for a user
   */
  static async getOrCreateStats(userId: string): Promise<CompetitiveStats> {
    const result = await query(
      'SELECT * FROM competitive_stats WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    
    // Create default stats
    const insertResult = await query(
      `INSERT INTO competitive_stats (user_id, rating, rank_tier)
       VALUES ($1, 100, 'Bronze')
       RETURNING *`,
      [userId]
    );
    
    return insertResult.rows[0];
  }

  /**
   * Get player stats with rating history
   */
  static async getPlayerStats(userId: string): Promise<{
    stats: CompetitiveStats;
    recentGames: any[];
    ratingHistory: any[];
  }> {
    const stats = await this.getOrCreateStats(userId);
    
    const recentGames = await query(
      `SELECT gr.* FROM game_rounds gr
       WHERE gr.user_id = $1 AND gr.mode = 'competitive' AND gr.submitted_at IS NOT NULL
       ORDER BY gr.created_at DESC
       LIMIT 20`,
      [userId]
    );
    
    const ratingHistory = await query(
      `SELECT * FROM rating_history
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );
    
    return {
      stats,
      recentGames: recentGames.rows,
      ratingHistory: ratingHistory.rows,
    };
  }

  /**
 * Apply rating decay for inactive players (opt-in, not automatic)
 * Called when a player returns after >7 days inactivity
 */
static async applyDecayIfNeeded(userId: string): Promise<{ decayed: boolean; ratingLost: number }> {
  const result = await query(
    `SELECT rating, last_game_at FROM competitive_stats WHERE user_id = $1`,
    [userId]
  );
  
  if (result.rows.length === 0) {
    return { decayed: false, ratingLost: 0 };
  }
  
  const { rating, last_game_at } = result.rows[0];
  
  if (!last_game_at) {
    return { decayed: false, ratingLost: 0 };
  }
  
  const daysSinceLastGame = (Date.now() - new Date(last_game_at).getTime()) / (1000 * 60 * 60 * 24);
  
  // Only decay after 7 days of inactivity
  if (daysSinceLastGame < 7) {
    return { decayed: false, ratingLost: 0 };
  }
  
  // Decay: lose 5 rating per week of inactivity, max 50
  const weeksInactive = Math.floor(daysSinceLastGame / 7);
  const ratingLoss = Math.min(50, weeksInactive * 5);
  const newRating = Math.max(0, rating - ratingLoss);
  
  await query(
    `UPDATE competitive_stats SET rating = $1, updated_at = NOW() WHERE user_id = $2`,
    [newRating, userId]
  );
  
  return { decayed: true, ratingLost: ratingLoss };
}

/**
 * Get top players by tier (for display)
 */
static async getTopPlayersByTier(limit: number = 3): Promise<Record<RankTier, any[]>> {
  const tiers: RankTier[] = ['Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze'];
  const result: Record<string, any[]> = {};
  
  for (const tier of tiers) {
    const players = await query(
      `SELECT u.username, cs.rating, cs.games_played, cs.avg_accuracy
       FROM competitive_stats cs
       JOIN users u ON cs.user_id = u.id
       WHERE cs.rank_tier = $1 AND cs.games_played > 0
       ORDER BY cs.rating DESC
       LIMIT $2`,
      [tier, limit]
    );
    result[tier] = players.rows;
  }
  
  return result as Record<RankTier, any[]>;
}
}