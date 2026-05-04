import { query } from '../config/db.js';
import type { LeaderboardEntry, LeaderboardResponse } from '../types/index.js';

export class LeaderboardService {
  /**
   * Get leaderboard for a given time period
   */
  static async getLeaderboard(
    period: 'daily' | 'weekly' | 'all-time',
    limit: number = 50
  ): Promise<LeaderboardResponse> {
    let dateFilter = '';
    
    if (period === 'daily') {
      dateFilter = `AND cs.last_game_at >= NOW() - INTERVAL '1 day'`;
    } else if (period === 'weekly') {
      dateFilter = `AND cs.last_game_at >= NOW() - INTERVAL '7 days'`;
    }
    
    const result = await query(
      `SELECT 
        u.username,
        cs.rating,
        cs.rank_tier,
        cs.games_played,
        cs.avg_accuracy,
        cs.best_score,
        ROW_NUMBER() OVER (ORDER BY cs.rating DESC) as rank
      FROM competitive_stats cs
      JOIN users u ON cs.user_id = u.id
      WHERE cs.games_played > 0 ${dateFilter}
      ORDER BY cs.rating DESC
      LIMIT $1`,
      [limit]
    );
    
    const leaderboard: LeaderboardEntry[] = result.rows.map((row: any) => ({
      rank: parseInt(row.rank),
      username: row.username,
      rating: row.rating,
      rankTier: row.rank_tier,
      gamesPlayed: row.games_played,
      avgAccuracy: parseFloat(row.avg_accuracy),
      bestScore: parseFloat(row.best_score),
    }));
    
    return {
      leaderboard,
      period,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get player's rank position
   */
  static async getPlayerRank(userId: string): Promise<{
    rank: number;
    totalPlayers: number;
  }> {
    const rankResult = await query(
      `SELECT rating FROM competitive_stats WHERE user_id = $1`,
      [userId]
    );
    
    if (rankResult.rows.length === 0) {
      return { rank: 0, totalPlayers: 0 };
    }
    
    const playerRating = rankResult.rows[0].rating;
    
    const positionResult = await query(
      `SELECT COUNT(*) + 1 as rank FROM competitive_stats WHERE rating > $1 AND games_played > 0`,
      [playerRating]
    );
    
    const totalResult = await query(
      `SELECT COUNT(*) as total FROM competitive_stats WHERE games_played > 0`
    );
    
    return {
      rank: parseInt(positionResult.rows[0].rank),
      totalPlayers: parseInt(totalResult.rows[0].total),
    };
  }
}