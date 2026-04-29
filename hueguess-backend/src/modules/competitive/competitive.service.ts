import { sql } from '../db/connection.js';
import type { HSLColor } from '../game/game.types.js';
import { calculateScore } from '../game/game.service.js';
import type { CompetitiveGameResult, RankTier, LeaderboardEntry, CompetitiveStats, LeaderboardPeriod } from './competitive.types.js';

const BASE_RATING = 1000;
const K_FACTOR = 32; // How much rating changes per game

export async function submitCompetitiveRound(
  userId: string,
  roundId: string,
  originalColor: HSLColor,
  userColor: HSLColor,
  memorizationTime: number
): Promise<CompetitiveGameResult> {
  // Calculate score using same formula
  const scoreResult = calculateScore(originalColor, userColor, roundId);
  
  // Get current rating
  const [stats] = await sql`
    SELECT rating, games_played 
    FROM competitive_stats 
    WHERE user_id = ${userId}
  `;
  
  const currentRating = stats?.rating || BASE_RATING;
  const gamesPlayed = (stats?.games_played || 0) + 1;
  
  // Calculate expected performance (0-1 scale)
  const performance = scoreResult.accuracy / 100;
  
  // Expected score based on rating vs average (simplified ELO)
  const expectedPerformance = 0.5; // Using global average as baseline
  const ratingChange = Math.round(K_FACTOR * (performance - expectedPerformance) * 10) / 10;
  const newRating = Math.round((currentRating + ratingChange) * 10) / 10;
  
  // Determine rank tier
  const rankTier = getRankTier(newRating);
  
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
  
  // Update competitive stats
  await sql`
    INSERT INTO competitive_stats (user_id, rating, avg_accuracy, games_played, best_score, rank_tier)
    VALUES (
      ${userId}, ${newRating}, ${scoreResult.accuracy}, 1, ${scoreResult.accuracy}, ${rankTier}
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET
      rating = ${newRating},
      avg_accuracy = (
        SELECT ROUND(AVG(accuracy)::numeric, 3)
        FROM games 
        WHERE user_id = ${userId} AND mode = 'competitive'
      ),
      games_played = competitive_stats.games_played + 1,
      best_score = GREATEST(competitive_stats.best_score, ${scoreResult.accuracy}),
      rank_tier = ${rankTier},
      updated_at = NOW()
  `;
  
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
  let dateFilter = '';
  
  switch (period) {
    case 'daily':
      dateFilter = `AND g.created_at >= NOW() - INTERVAL '1 day'`;
      break;
    case 'weekly':
      dateFilter = `AND g.created_at >= NOW() - INTERVAL '7 days'`;
      break;
    default:
      dateFilter = '';
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
      ${dateFilter ? sql`AND EXISTS (
        SELECT 1 FROM games g 
        WHERE g.user_id = u.id 
        AND g.mode = 'competitive'
        ${sql.unsafe(dateFilter)}
      )` : sql``}
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