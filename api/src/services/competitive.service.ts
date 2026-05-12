import pool from '../config/db.js';
import { Difficulty, DIFFICULTY_CONFIGS } from '../types/game.types.js';

const RANK_THRESHOLDS = {
  bronze: 0,
  silver: 300,
  gold: 700,
  platinum: 1400,
  diamond: 2500,
};

function getRankTier(rating: number): string {
  if (rating < 300) return 'Bronze';
  if (rating < 700) return 'Silver';
  if (rating < 1400) return 'Gold';
  if (rating < 2500) return 'Platinum';
  return 'Diamond';
}

function getRankProgress(rating: number) {
  let current = 0, next = 300, tier = 'Bronze', nextTier = 'Silver';
  if (rating < 300) { current = 0; next = 300; tier = 'Bronze'; nextTier = 'Silver'; }
  else if (rating < 700) { current = 300; next = 700; tier = 'Silver'; nextTier = 'Gold'; }
  else if (rating < 1400) { current = 700; next = 1400; tier = 'Gold'; nextTier = 'Platinum'; }
  else if (rating < 2500) { current = 1400; next = 2500; tier = 'Platinum'; nextTier = 'Diamond'; }
  else { current = 2500; next = 2500; tier = 'Diamond'; nextTier = 'Max'; }
  const progress = next > current ? ((rating - current) / (next - current)) * 100 : 100;
  return { currentTier: tier, nextTier, progress: Math.min(100, Math.max(0, progress)), needed: Math.max(0, next - rating) };
}
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
      await pool.query(`INSERT INTO competitive_stats (user_id, rating, rank_tier) VALUES ($1, $2, $3)`, [userId, 100, 'Bronze']);
    }
  }

  static async updateAfterGame(userId: string, roundId: string, accuracy: number, difficulty: Difficulty) {
    const stats = await pool.query(`SELECT rating, current_streak, best_streak, games_played, total_accuracy FROM competitive_stats WHERE user_id = $1`, [userId]);
    let oldRating = 100, streak = 0, bestStreak = 0, games = 0, totalAcc = 0;
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

    await pool.query(`UPDATE competitive_stats SET rating=$1, rank_tier=$2, games_played=$3, total_accuracy=$4, avg_accuracy=$5, current_streak=$6, best_streak=$7, last_game_at=NOW(), updated_at=NOW() WHERE user_id=$8`,
      [newRating, newTier, newGames, newTotalAcc, newAvgAcc, newStreak, newBestStreak, userId]);

    await pool.query(`INSERT INTO rating_history (user_id, game_round_id, rating_before, rating_after, rating_change, accuracy, difficulty) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userId, roundId, oldRating, newRating, change, accuracy, difficulty]);

    return { oldRating, newRating, ratingChange: change, oldStreak: streak, newStreak, rankTier: newTier };
  }

  static async getUserStats(userId: string) { /* keep existing */ }
  static async getLeaderboard(limit: number = 100, offset: number = 0) { /* keep existing */ }
}