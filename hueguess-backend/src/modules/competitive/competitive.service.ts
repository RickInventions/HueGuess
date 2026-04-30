import { sql } from '../db/connection.js';
import type { HSLColor } from '../game/game.types.js';
import { calculateScore } from '../game/game.service.js';
import type { CompetitiveGameResult, RankTier, LeaderboardEntry, CompetitiveStats, LeaderboardPeriod } from './competitive.types.js';

const BASE_RATING = 1000;
const K_FACTOR = 32;

export async function submitCompetitiveRound(
  userId: string,
  roundId: string,
  originalColor: HSLColor,
  userColor: HSLColor,
  memorizationTime: number
): Promise<CompetitiveGameResult> {
  // Calculate score using same formula
  const scoreResult = calculateScore(originalColor, userColor, roundId);
  
  // Get current stats
  const [stats] = await sql`
    SELECT rating, games_played, best_score 
    FROM competitive_stats 
    WHERE user_id = ${userId}
  `;
  
  const currentRating = stats?.rating ? Number(stats.rating) : BASE_RATING;
  const gamesPlayed = (stats?.games_played ? Number(stats.games_played) : 0) + 1;
  const currentBestScore = stats?.best_score ? Number(stats.best_score) : 0;
  
  // Calculate rating change
  const performance = scoreResult.accuracy / 100;
  const expectedPerformance = 0.5;
  const ratingChange = Math.round(K_FACTOR * (performance - expectedPerformance) * 10) / 10;
  const newRating = Math.round((currentRating + ratingChange) * 10) / 10;
  
  const rankTier = getRankTier(newRating);
  const newBestScore = Math.max(currentBestScore, scoreResult.accuracy);
  
  // Save game record
  const [game] = await sql`
    INSERT INTO games (
      user_id, mode, original_h, original_s, original_l,
      user_h, user_s, user_l, accuracy, memorization_time
    ) VALUES (
      ${userId}, 'competitive',
      ${originalColor.h}, ${originalColor.s}, ${originalColor.l},
      ${userColor.h}, ${userColor.s}, ${userColor.l},
      ${scoreResult.accuracy}, ${memorizationTime}
    )
    RETURNING id
  `;
  
  // Calculate new average from all competitive games
  const [avgResult] = await sql`
    SELECT ROUND(AVG(accuracy)::numeric, 3) as avg_acc
    FROM games 
    WHERE user_id = ${userId} AND mode = 'competitive'
  `;
  
  const avgAccuracy = Number(avgResult.avg_acc);
  
  // Update or insert competitive stats
  if (stats) {
    await sql`
      UPDATE competitive_stats 
      SET 
        rating = ${newRating},
        avg_accuracy = ${avgAccuracy},
        games_played = ${gamesPlayed},
        best_score = ${newBestScore},
        rank_tier = ${rankTier},
        updated_at = NOW()
      WHERE user_id = ${userId}
    `;
  } else {
    await sql`
      INSERT INTO competitive_stats (user_id, rating, avg_accuracy, games_played, best_score, rank_tier)
      VALUES (${userId}, ${newRating}, ${avgAccuracy}, ${gamesPlayed}, ${newBestScore}, ${rankTier})
    `;
  }
  
  return {
    id: game.id,
    userId,
    original: originalColor,
    user: userColor,
    accuracy: scoreResult.accuracy,
    accuracyFormatted: scoreResult.accuracyFormatted,
    ratingChange,
    newRating,
    rankTier,
  };
}

export async function getLeaderboard(period: LeaderboardPeriod = 'all-time', limit: number = 100): Promise<LeaderboardEntry[]> {
  let dateFilter;
  
  switch (period) {
    case 'daily':
      dateFilter = sql`AND EXISTS (
        SELECT 1 FROM games g 
        WHERE g.user_id = cs.user_id 
        AND g.mode = 'competitive'
        AND g.created_at >= NOW() - INTERVAL '1 day'
      )`;
      break;
    case 'weekly':
      dateFilter = sql`AND EXISTS (
        SELECT 1 FROM games g 
        WHERE g.user_id = cs.user_id 
        AND g.mode = 'competitive'
        AND g.created_at >= NOW() - INTERVAL '7 days'
      )`;
      break;
    default:
      dateFilter = sql``;
  }
  
  const entries = await sql`
    WITH stats AS (
      SELECT 
        u.id as user_id,
        u.username,
        cs.rating,
        cs.avg_accuracy,
        cs.games_played,
        cs.rank_tier
      FROM users u
      JOIN competitive_stats cs ON cs.user_id = u.id
      WHERE cs.games_played > 0
      ${dateFilter}
    )
    SELECT 
      ROW_NUMBER() OVER (ORDER BY rating DESC) as rank,
      user_id,
      username,
      rating,
      avg_accuracy,
      games_played,
      rank_tier
    FROM stats
    ORDER BY rating DESC
    LIMIT ${limit}
  `;
  
  return entries.map(e => ({
    rank: Number(e.rank),
    userId: e.user_id,
    username: e.username,
    rating: Number(e.rating),
    avgAccuracy: Number(e.avg_accuracy),
    gamesPlayed: Number(e.games_played),
    rankTier: e.rank_tier as RankTier,
  }));
}

export async function getUserStats(userId: string): Promise<CompetitiveStats | null> {
  const [stats] = await sql`
    WITH ranked AS (
      SELECT 
        user_id,
        ROW_NUMBER() OVER (ORDER BY rating DESC) as rank
      FROM competitive_stats
      WHERE games_played > 0
    )
    SELECT 
      u.username,
      cs.rating,
      cs.avg_accuracy,
      cs.games_played,
      cs.best_score,
      cs.rank_tier,
      r.rank
    FROM competitive_stats cs
    JOIN users u ON u.id = cs.user_id
    LEFT JOIN ranked r ON r.user_id = cs.user_id
    WHERE cs.user_id = ${userId}
  `;
  
  if (!stats) return null;
  
  return {
    userId,
    username: stats.username,
    rating: Number(stats.rating),
    avgAccuracy: Number(stats.avg_accuracy),
    gamesPlayed: Number(stats.games_played),
    bestScore: Number(stats.best_score),
    rankTier: stats.rank_tier as RankTier,
    rank: stats.rank ? Number(stats.rank) : 0,
  };
}

function getRankTier(rating: number): RankTier {
  if (rating >= 1300) return 'diamond';
  if (rating >= 1150) return 'platinum';
  if (rating >= 1050) return 'gold';
  if (rating >= 1000) return 'silver';
  return 'bronze';
}