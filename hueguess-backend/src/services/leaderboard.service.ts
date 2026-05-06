import { query } from '../config/db.js';
import type { 
  LeaderboardEntry, 
  LeaderboardResponse, 
  PlayerRankResponse,
  GlobalStats,
  LeaderboardFilters,
  RankTier 
} from '../types/index.js';

const RANK_TIERS: RankTier[] = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];

export class LeaderboardService {
  /**
   * Get leaderboard with pagination and filtering
   */
  static async getLeaderboard(filters: LeaderboardFilters): Promise<LeaderboardResponse & { pagination: any }> {
    const { period, page = 1, limit = 50, rankTier, search } = filters;
    const offset = (page - 1) * limit;
    
    let whereClauses: string[] = ['cs.games_played > 0'];
    const params: any[] = [];
    let paramIndex = 1;
    
    // Time period filter
    if (period === 'daily') {
      whereClauses.push(`cs.last_game_at >= NOW() - INTERVAL '1 day'`);
    } else if (period === 'weekly') {
      whereClauses.push(`cs.last_game_at >= NOW() - INTERVAL '7 days'`);
    }
    
    // Rank tier filter
    if (rankTier && RANK_TIERS.includes(rankTier)) {
      whereClauses.push(`cs.rank_tier = $${paramIndex}`);
      params.push(rankTier);
      paramIndex++;
    }
    
    // Search by username
    if (search) {
      whereClauses.push(`u.username ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    // Count total
    const countResult = await query(
      `SELECT COUNT(*) as total FROM competitive_stats cs 
       JOIN users u ON cs.user_id = u.id ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);
    
    // Get page
    const result = await query(
      `SELECT 
        u.username,
        cs.rating,
        cs.rank_tier,
        cs.games_played,
        cs.avg_accuracy,
        cs.best_score,
        cs.current_streak,
        ROW_NUMBER() OVER (ORDER BY cs.rating DESC) as rank
      FROM competitive_stats cs
      JOIN users u ON cs.user_id = u.id
      ${whereClause}
      ORDER BY cs.rating DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
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
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get enhanced player rank with progress tracking
   */
  static async getPlayerRank(userId: string): Promise<PlayerRankResponse> {
    const statsResult = await query(
      `SELECT rating, rank_tier FROM competitive_stats WHERE user_id = $1`,
      [userId]
    );
    
    if (statsResult.rows.length === 0) {
      return {
        rank: 0,
        totalPlayers: 0,
        percentile: 0,
        nextTierProgress: {
          currentTier: 'Bronze',
          nextTier: 'Silver',
          ratingNeeded: 150,
          progressPercent: 0,
        },
      };
    }
    
    const { rating, rank_tier } = statsResult.rows[0] as { rating: number; rank_tier: RankTier };
    
    // Get position
    const positionResult = await query(
      `SELECT COUNT(*) + 1 as rank FROM competitive_stats WHERE rating > $1 AND games_played > 0`,
      [rating]
    );
    
    const totalResult = await query(
      `SELECT COUNT(*) as total FROM competitive_stats WHERE games_played > 0`
    );
    
    const rank = parseInt(positionResult.rows[0].rank);
    const totalPlayers = parseInt(totalResult.rows[0].total);
    const percentile = totalPlayers > 0 ? Math.round((1 - rank / totalPlayers) * 100) : 0;
    
    // Calculate next tier progress
    const tierThresholds: Record<RankTier, number> = {
      Bronze: 0,
      Silver: 150,
      Gold: 300,
      Platinum: 500,
      Diamond: 750,
    };
    
    const currentTierIndex = RANK_TIERS.indexOf(rank_tier);
    const nextTier = currentTierIndex < RANK_TIERS.length - 1 ? RANK_TIERS[currentTierIndex + 1] : null;
    
    let nextTierProgress = {
      currentTier: rank_tier,
      nextTier: null as RankTier | null,
      ratingNeeded: 0,
      progressPercent: 100,
    };
    
    if (nextTier) {
      const currentMin = tierThresholds[rank_tier];
      const nextMin = tierThresholds[nextTier];
      const progressInTier = rating - currentMin;
      const tierRange = nextMin - currentMin;
      const progressPercent = Math.min(100, Math.round((progressInTier / tierRange) * 100));
      
      nextTierProgress = {
        currentTier: rank_tier,
        nextTier,
        ratingNeeded: nextMin - rating,
        progressPercent,
      };
    }
    
    return {
      rank,
      totalPlayers,
      percentile,
      nextTierProgress,
    };
  }

  /**
   * Get global stats for the game
   */
  static async getGlobalStats(): Promise<GlobalStats> {
    const statsResult = await query(
      `SELECT 
        COUNT(*) as total_players,
        SUM(games_played) as total_games,
        ROUND(AVG(avg_accuracy)::numeric, 2) as average_accuracy
      FROM competitive_stats WHERE games_played > 0`
    );
    
    const distributionResult = await query(
      `SELECT rank_tier, COUNT(*) as count
       FROM competitive_stats
       WHERE games_played > 0
       GROUP BY rank_tier`
    );
    
    const distribution: Record<string, number> = {
      Bronze: 0,
      Silver: 0,
      Gold: 0,
      Platinum: 0,
      Diamond: 0,
    };
    
    distributionResult.rows.forEach((row: any) => {
      distribution[row.rank_tier as RankTier] = parseInt(row.count);
    }
  );
    
    return {
      totalPlayers: parseInt(statsResult.rows[0].total_players) || 0,
      totalGames: parseInt(statsResult.rows[0].total_games) || 0,
      averageAccuracy: parseFloat(statsResult.rows[0].average_accuracy) || 0,
      distributionByTier: distribution as Record<RankTier, number>,
    };
  }

  /**
   * Refresh materialized view (call periodically)
   */
  static async refreshMaterializedView(): Promise<void> {
    try {
      await query('REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_all_time');
      console.log('Leaderboard materialized view refreshed');
    } catch (error) {
      console.error('Failed to refresh materialized view:', error);
    }
  }
}