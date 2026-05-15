import pool from '../config/db.js';

export class AdminService {
  
  // Get dashboard stats
  static async getDashboardStats() {
    const results = await Promise.all([
      // Total users
      pool.query('SELECT COUNT(*) as count FROM users'),
      // Verified users
      pool.query('SELECT COUNT(*) as count FROM users WHERE is_verified = true'),
      // Total competitive games
      pool.query('SELECT COUNT(*) as count FROM game_rounds WHERE mode = \'competitive\''),
      // Total casual games
      pool.query('SELECT COUNT(*) as count FROM game_rounds WHERE mode = \'casual\''),
      // Active users today
      pool.query('SELECT COUNT(DISTINCT user_id) as count FROM game_rounds WHERE created_at > NOW() - INTERVAL \'24 hours\''),
      // Average rating
      pool.query('SELECT AVG(rating) as avg FROM competitive_stats WHERE games_played >= 1'),
      // Total feedback pending
      pool.query('SELECT COUNT(*) as count FROM feedback WHERE resolved = false'),
    ]);
    
    return {
      totalUsers: parseInt(results[0].rows[0].count),
      verifiedUsers: parseInt(results[1].rows[0].count),
      totalCompetitiveGames: parseInt(results[2].rows[0].count),
      totalCasualGames: parseInt(results[3].rows[0].count),
      activeUsers24h: parseInt(results[4].rows[0].count),
      averageRating: Math.round(results[5].rows[0].avg || 0),
      pendingFeedback: parseInt(results[6].rows[0].count),
    };
  }
  
  // Get all users (paginated)
  static async getAllUsers(filters: {
    search?: string;
    limit: number;
    offset: number;
  }) {
    const { search, limit, offset } = filters;
    
    let query = `
      SELECT u.id, u.username, u.email, u.is_verified, u.created_at, u.last_username_change,
             cs.rating, cs.games_played, cs.avg_accuracy
      FROM users u
      LEFT JOIN competitive_stats cs ON u.id = cs.user_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;
    
    if (search) {
      query += ` AND (u.username ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM users u WHERE 1=1`;
    const countParams: any[] = [];
    let countIndex = 1;
    
    if (search) {
      countQuery += ` AND (username ILIKE $${countIndex} OR email ILIKE $${countIndex})`;
      countParams.push(`%${search}%`);
    }
    
    const totalResult = await pool.query(countQuery, countParams);
    
    return {
      users: result.rows,
      total: parseInt(totalResult.rows[0].total),
    };
  }
  
  // Get user details (admin)
  static async getUserDetails(userId: string) {
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.is_verified, u.created_at, u.last_username_change,
              cs.rating, cs.rank_tier, cs.games_played, cs.avg_accuracy, cs.current_streak, cs.best_streak,
              COUNT(DISTINCT gr.id) as total_games
       FROM users u
       LEFT JOIN competitive_stats cs ON u.id = cs.user_id
       LEFT JOIN game_rounds gr ON u.id = gr.user_id
       WHERE u.id = $1
       GROUP BY u.id, cs.rating, cs.rank_tier, cs.games_played, cs.avg_accuracy, cs.current_streak, cs.best_streak`,
      [userId]
    );
    
    return result.rows[0] || null;
  }
  
  // Refresh leaderboard materialized views
  static async refreshLeaderboard() {
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_all_time');
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_weekly');
    return { success: true, message: 'Leaderboard refreshed' };
  }
  
  // Log admin action
  static async logAdminAction(adminId: string, action: string, details: any = null) {
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, details)
       VALUES ($1, $2, $3)`,
      [adminId, action, details ? JSON.stringify(details) : null]
    );
  }
}