import pool from '../config/db.js';
import { Difficulty, DIFFICULTY_CONFIGS } from '../types/game.types.js';
import { AchievementService } from './achievement.service.js';
import { getRankTier, getRankProgress, STARTING_RATING } from '../utils/rank.utils.js';

const DIFFICULTY_PARAMS = {
  easy: {
    threshold: 65,
    gainAtThreshold: 5,
    gainAt100: 70,
    lossAtThresholdMinus15: -20,   // at 50% accuracy
  },
  medium: {
    threshold: 75,
    gainAtThreshold: 20,
    gainAt100: 110,
    lossAtThresholdMinus15: -60,   // at 60% accuracy
  },
  hard: {
    threshold: 80,
    gainAtThreshold: 40,
    gainAt100: 180,
    lossAtThresholdMinus15: -90,   // at 65% accuracy
  },
  extreme: {
    threshold: 85,
    gainAtThreshold: 25,
    gainAt100: 400,
    lossAtThresholdMinus15: -180,  // at 70% accuracy
  },
};

function calculateRatingChange(accuracy: number, difficulty: Difficulty, currentRating: number): number {
  const p = DIFFICULTY_PARAMS[difficulty];
  const belowPoint = p.threshold - 15;
  let change = 0;
  
  if (accuracy >= p.threshold) {
    const slope = (p.gainAt100 - p.gainAtThreshold) / (100 - p.threshold);
    change = p.gainAtThreshold + (accuracy - p.threshold) * slope;
  } else {
    const slope = (p.gainAtThreshold - p.lossAtThresholdMinus15) / 15;
    change = p.gainAtThreshold + (accuracy - p.threshold) * slope;
  }
  
  change = Math.round(Math.min(change, p.gainAt100)); // cap at 100% reward
  if (currentRating + change < 0) change = -currentRating;
  return change;
}

export class CompetitiveService {
  static async initializeUserStats(userId: string) {
    const exists = await pool.query('SELECT 1 FROM competitive_stats WHERE user_id = $1', [userId]);
    if (exists.rowCount === 0) {
      await pool.query(`INSERT INTO competitive_stats (user_id, rating, rank_tier) VALUES ($1, $2, $3)`, [
        userId,
        STARTING_RATING,
        getRankTier(STARTING_RATING),
      ]);
    }
  }

  static async updateAfterGame(userId: string, roundId: string, accuracy: number, difficulty: Difficulty) {
    const stats = await pool.query(`SELECT rating, current_streak, best_streak, games_played, total_accuracy FROM competitive_stats WHERE user_id = $1`, [userId]);
    let oldRating = STARTING_RATING, streak = 0, bestStreak = 0, games = 0, totalAcc = 0;
    if (stats.rows.length) {
      oldRating = stats.rows[0].rating;
      streak = stats.rows[0].current_streak || 0;
      bestStreak = stats.rows[0].best_streak || 0;
      games = stats.rows[0].games_played || 0;
      totalAcc = stats.rows[0].total_accuracy || 0;
    } else await this.initializeUserStats(userId);

    const cfg = DIFFICULTY_CONFIGS[difficulty];
    const isNegative = accuracy < cfg.negThreshold;
    const change = calculateRatingChange(accuracy, difficulty, oldRating);
    let newRating = Math.max(0, oldRating + change);
    let newStreak = streak;
    if (difficulty === 'hard' || difficulty === 'extreme') {
      newStreak = (!isNegative && accuracy > 0) ? streak + 1 : 0;
    }
    const newBestStreak = Math.max(bestStreak, newStreak);
    const newTier = getRankTier(newRating);
    const newGames = games + 1;
    const newTotalAcc = totalAcc + accuracy;
    const newAvgAcc = newTotalAcc / newGames;

    await pool.query(`UPDATE competitive_stats SET rating=$1, rank_tier=$2, games_played=$3, total_accuracy=$4, avg_accuracy=$5, current_streak=$6, best_streak=$7, best_score=GREATEST(COALESCE(best_score, 0), $8), last_game_at=NOW(), updated_at=NOW() WHERE user_id=$9`,
      [newRating, newTier, newGames, newTotalAcc, newAvgAcc, newStreak, newBestStreak, accuracy, userId]);

    await pool.query(`INSERT INTO rating_history (user_id, game_round_id, rating_before, rating_after, rating_change, accuracy, difficulty) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userId, roundId, oldRating, newRating, change, accuracy, difficulty]);

    // Re-derived from the database rather than from this round's deltas. The old
    // call passed `ratingAfter`/`streakAfter` in, and the service coalesced them
    // with `||` — so a streak that had just been broken (0) fell through to the
    // stale stored value and could unlock a streak achievement the player had
    // lost. Nothing is passed now, so nothing can disagree with the stats.
    //
    // Swallowed rather than thrown: the round, the rating and the history row are
    // all committed above, so throwing here would 500 a game that actually
    // counted. Achievements are recomputed from scratch on every sync, so the
    // unlock simply surfaces on the next round.
    const newlyUnlocked = await AchievementService.syncAchievements(userId).catch(error => {
      console.error('Competitive achievement sync failed:', (error as Error).message);
      return [];
    });

    return { oldRating, newRating, ratingChange: change, oldStreak: streak, newStreak, rankTier: newTier, newlyUnlocked };
  }

  

  // Get user stats
  static async getUserStats(userId: string): Promise<any> {
    const result = await pool.query(
      `SELECT rating, rank_tier, games_played, total_accuracy, avg_accuracy,
              best_score, current_streak, best_streak, last_game_at, created_at, updated_at
       FROM competitive_stats
       WHERE user_id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      await this.initializeUserStats(userId);
      return this.getUserStats(userId);
    }
    
    const stats = result.rows[0];
    const rankProgress = getRankProgress(stats.rating);
    
    // Get games per difficulty breakdown
    const gamesPerDifficulty = await pool.query(
      `SELECT difficulty, COUNT(*) as count
       FROM game_rounds
       WHERE user_id = $1 AND mode = 'competitive' AND accuracy IS NOT NULL
       GROUP BY difficulty`,
      [userId]
    );
    
    // Get recent games
    const recentGames = await pool.query(
      `SELECT id, difficulty, accuracy, memorization_seconds, created_at, is_reload
       FROM game_rounds
       WHERE user_id = $1 AND mode = 'competitive' AND accuracy IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId]
    );
    
    // Get rating history for chart
    const ratingHistory = await pool.query(
      `SELECT created_at, rating_after as rating
       FROM rating_history
       WHERE user_id = $1
       ORDER BY created_at ASC
       LIMIT 100`,
      [userId]
    );
    
    return {
      ...stats,
      rankProgress,
      gamesPerDifficulty: gamesPerDifficulty.rows,
      recentGames: recentGames.rows,
      ratingHistory: ratingHistory.rows,
    };
}}