import pool from '../config/db.js';

export type LeaderboardPeriod = 'all-time' | 'weekly' | 'daily';
export type LeaderboardSortBy = 'points' | 'gamesPlayed' | 'avgAccuracy' | 'streak';
export type SortOrder = 'ASC' | 'DESC';

export interface LeaderboardFilters {
  period: LeaderboardPeriod;
  sortBy: LeaderboardSortBy;
  sortOrder: SortOrder;
  search?: string;
  limit: number;
  offset: number;
}

export interface AwardEmblem {
  category: string;
  icon: string;
  rank: number;
  username: string;
  value: number;
}

export class LeaderboardService {
  
  // Get leaderboard entries
  static async getLeaderboard(filters: LeaderboardFilters) {
    const { period, sortBy, sortOrder, search, limit, offset } = filters;
    
    let orderByColumn = '';
    switch (sortBy) {
      case 'points':
        orderByColumn = 'rating';
        break;
      case 'gamesPlayed':
        orderByColumn = 'games_played';
        break;
      case 'avgAccuracy':
        orderByColumn = 'avg_accuracy';
        break;
      case 'streak':
        orderByColumn = 'best_streak';
        break;
    }
    
    let query = '';
    let countQuery = '';
    const params: any[] = [];
    let paramIndex = 1;
    
    if (period === 'all-time') {
      query = `
        SELECT cs.user_id, u.username, cs.rating, cs.rank_tier, 
               cs.games_played, cs.avg_accuracy, cs.best_streak
        FROM competitive_stats cs
        JOIN users u ON cs.user_id = u.id
        WHERE cs.games_played >= 20
      `;
      countQuery = `
        SELECT COUNT(*) as total
        FROM competitive_stats cs
        WHERE cs.games_played >= 20
      `;
    } else if (period === 'weekly') {
      query = `
        SELECT cs.user_id, u.username, cs.rating, cs.rank_tier,
               cs.games_played, cs.avg_accuracy, cs.best_streak,
               COUNT(CASE WHEN gr.created_at > NOW() - INTERVAL '7 days' THEN 1 END) as games_this_week,
               AVG(CASE WHEN gr.created_at > NOW() - INTERVAL '7 days' THEN gr.accuracy END) as weekly_avg_accuracy
        FROM competitive_stats cs
        JOIN users u ON cs.user_id = u.id
        LEFT JOIN game_rounds gr ON cs.user_id = gr.user_id AND gr.mode = 'competitive'
        WHERE cs.games_played >= 20
        GROUP BY cs.user_id, u.username, cs.rating, cs.rank_tier, cs.games_played, cs.avg_accuracy, cs.best_streak
      `;
      countQuery = `
        SELECT COUNT(DISTINCT cs.user_id) as total
        FROM competitive_stats cs
        WHERE cs.games_played >= 20
      `;
    } else { // daily
      query = `
        SELECT cs.user_id, u.username, cs.rating, cs.rank_tier,
               cs.games_played, cs.avg_accuracy, cs.best_streak,
               COUNT(CASE WHEN gr.created_at > NOW() - INTERVAL '1 day' THEN 1 END) as games_today,
               AVG(CASE WHEN gr.created_at > NOW() - INTERVAL '1 day' THEN gr.accuracy END) as daily_avg_accuracy
        FROM competitive_stats cs
        JOIN users u ON cs.user_id = u.id
        LEFT JOIN game_rounds gr ON cs.user_id = gr.user_id AND gr.mode = 'competitive'
        WHERE cs.games_played >= 20
        GROUP BY cs.user_id, u.username, cs.rating, cs.rank_tier, cs.games_played, cs.avg_accuracy, cs.best_streak
      `;
      countQuery = `
        SELECT COUNT(DISTINCT cs.user_id) as total
        FROM competitive_stats cs
        WHERE cs.games_played >= 20
      `;
    }
    
    // Add search filter
    if (search) {
      query += ` AND u.username ILIKE $${paramIndex}`;
      countQuery += ` AND EXISTS (SELECT 1 FROM users u WHERE u.id = cs.user_id AND u.username ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    // Add ordering and pagination
    query += ` ORDER BY ${orderByColumn} ${sortOrder}`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    // Get total count (without pagination)
    const totalResult = await pool.query(countQuery, search ? [`%${search}%`] : []);
    
    // Add rank to each entry
    const entries = result.rows.map((row: any, index: number) => ({
      rank: offset + index + 1,
      userId: row.user_id,
      username: row.username,
      rating: row.rating,
      rankTier: row.rank_tier,
      gamesPlayed: row.games_played,
      avgAccuracy: Math.round(row.avg_accuracy * 100) / 100,
      bestStreak: row.best_streak,
      periodStats: period === 'weekly' ? {
        gamesThisWeek: parseInt(row.games_this_week) || 0,
        weeklyAvgAccuracy: row.weekly_avg_accuracy ? Math.round(row.weekly_avg_accuracy * 100) / 100 : 0,
      } : period === 'daily' ? {
        gamesToday: parseInt(row.games_today) || 0,
        dailyAvgAccuracy: row.daily_avg_accuracy ? Math.round(row.daily_avg_accuracy * 100) / 100 : 0,
      } : null,
    }));
    
    return {
      entries,
      total: parseInt(totalResult.rows[0].total),
      limit,
      offset,
    };
  }
  
// Get global stats (for leaderboard header)
static async getGlobalStats() {
  // Get total players and averages
  const statsResult = await pool.query(`
    SELECT 
      COUNT(*) as total_players,
      COALESCE(AVG(rating), 0) as avg_rating,
      COALESCE(MAX(rating), 0) as highest_rating
    FROM competitive_stats
    WHERE games_played >= 20
  `);

  // Get top player (highest rating) separately
  const topPlayerResult = await pool.query(`
    SELECT u.username, cs.rating
    FROM competitive_stats cs
    JOIN users u ON cs.user_id = u.id
    WHERE cs.games_played >= 20
    ORDER BY cs.rating DESC
    LIMIT 1
  `);

  // Get top score (max rating) – could reuse highest_rating, but explicit for clarity
  const topScoreResult = await pool.query(`
    SELECT MAX(rating) as top_score
    FROM competitive_stats
    WHERE games_played >= 20
  `);

  return {
    totalPlayers: parseInt(statsResult.rows[0].total_players),
    avgRating: Math.round(statsResult.rows[0].avg_rating),
    highestRating: statsResult.rows[0].highest_rating,
    topPlayer: topPlayerResult.rows[0]?.username || null,
    topScore: topScoreResult.rows[0]?.top_score || 0,
  };
}
  
  // Get award emblems (top performers in different categories)
  static async getAwardEmblems(): Promise<AwardEmblem[]> {
    const awards: AwardEmblem[] = [];
    
    // Top 100 by Points
    const pointsResult = await pool.query(`
      SELECT u.username, cs.rating, ROW_NUMBER() OVER (ORDER BY cs.rating DESC) as rank
      FROM competitive_stats cs
      JOIN users u ON cs.user_id = u.id
      WHERE cs.games_played >= 20
      LIMIT 100
    `);
    
    // Top 100 by Accuracy (min 20 games)
    const accuracyResult = await pool.query(`
      SELECT u.username, cs.avg_accuracy, ROW_NUMBER() OVER (ORDER BY cs.avg_accuracy DESC) as rank
      FROM competitive_stats cs
      JOIN users u ON cs.user_id = u.id
      WHERE cs.games_played >= 20
      LIMIT 100
    `);
    
    // Top 100 by Games Played
    const gamesResult = await pool.query(`
      SELECT u.username, cs.games_played, ROW_NUMBER() OVER (ORDER BY cs.games_played DESC) as rank
      FROM competitive_stats cs
      JOIN users u ON cs.user_id = u.id
      WHERE cs.games_played >= 20
      LIMIT 100
    `);
    
    // Top 100 by Streak
    const streakResult = await pool.query(`
      SELECT u.username, cs.best_streak, ROW_NUMBER() OVER (ORDER BY cs.best_streak DESC) as rank
      FROM competitive_stats cs
      JOIN users u ON cs.user_id = u.id
      WHERE cs.games_played >= 20
      LIMIT 100
    `);
    
    // Points award
    if (pointsResult.rows.length > 0) {
      awards.push({
        category: 'Top Points',
        icon: '🏆',
        rank: pointsResult.rows[0].rank,
        username: pointsResult.rows[0].username,
        value: pointsResult.rows[0].rating,
      });
    }
    
    // Accuracy award
    if (accuracyResult.rows.length > 0) {
      awards.push({
        category: 'Top Accuracy',
        icon: '🎯',
        rank: accuracyResult.rows[0].rank,
        username: accuracyResult.rows[0].username,
        value: Math.round(accuracyResult.rows[0].avg_accuracy * 100) / 100,
      });
    }
    
    // Games Played award
    if (gamesResult.rows.length > 0) {
      awards.push({
        category: 'Most Games',
        icon: '📊',
        rank: gamesResult.rows[0].rank,
        username: gamesResult.rows[0].username,
        value: gamesResult.rows[0].games_played,
      });
    }
    
    // Streak award
    if (streakResult.rows.length > 0) {
      awards.push({
        category: 'Longest Streak',
        icon: '🔥',
        rank: streakResult.rows[0].rank,
        username: streakResult.rows[0].username,
        value: streakResult.rows[0].best_streak,
      });
    }
    
    return awards;
  }
  
  // Get top 10 for special badge
  static async getTop10Players(): Promise<string[]> {
    const result = await pool.query(`
      SELECT u.username
      FROM competitive_stats cs
      JOIN users u ON cs.user_id = u.id
      WHERE cs.games_played >= 20
      ORDER BY cs.rating DESC
      LIMIT 10
    `);
    
    return result.rows.map((row: any) => row.username);
  }
  
  // Refresh materialized views (admin)
  static async refreshMaterializedViews() {
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_all_time');
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_weekly');
    console.log('Leaderboard materialized views refreshed');
  }
}