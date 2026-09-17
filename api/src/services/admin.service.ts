import pool from '../config/db.js';
import { backfillRankTiers } from '../config/bootstrap.js';
import { getOnlineUserIds } from '../socket/presence.js';

/**
 * The predicate that decides whether an account is restricted right now.
 *
 * Written once and reused because the dashboard, the moderation list and the
 * single-user read all have to agree; three hand-written copies of "banned and
 * not yet lapsed" is how a suspended player shows up as active in one place and
 * restricted in another.
 */
const BAN_IS_ACTIVE = `(u.banned_at IS NOT NULL AND (u.banned_until IS NULL OR u.banned_until > NOW()))`;

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
      // Currently restricted, split by whether the term has run out
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE ${BAN_IS_ACTIVE} AND u.banned_until IS NULL) AS banned,
           COUNT(*) FILTER (WHERE ${BAN_IS_ACTIVE} AND u.banned_until IS NOT NULL) AS suspended
         FROM users u`
      ),
      // Signup windows
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')  AS week,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS month
         FROM users`
      ),
      // Rounds recorded across every mode, the extra modes included
      pool.query(
        `SELECT (SELECT COUNT(*) FROM game_rounds) + (SELECT COUNT(*) FROM mode_rounds) AS count`
      ),
      // Newest accounts, for the "did anything just happen" glance
      pool.query(
        `SELECT id, username, email, is_verified, created_at, banned_at, banned_until,
                ${BAN_IS_ACTIVE} AS is_restricted
           FROM users u ORDER BY created_at DESC LIMIT 5`
      ),
      // Best players by rating
      pool.query(
        `SELECT u.id, u.username, cs.rating, cs.rank_tier, cs.games_played
           FROM competitive_stats cs
           JOIN users u ON u.id = cs.user_id
          WHERE cs.games_played >= 5
          ORDER BY cs.rating DESC LIMIT 5`
      ),
      // What other admins have been doing
      pool.query(
        `SELECT id, admin_id, action, details, created_at
           FROM admin_logs ORDER BY created_at DESC LIMIT 6`
      ),
    ]);

    const bans = results[7].rows[0];
    const signups = results[8].rows[0];

    return {
      totalUsers: parseInt(results[0].rows[0].count),
      verifiedUsers: parseInt(results[1].rows[0].count),
      totalCompetitiveGames: parseInt(results[2].rows[0].count),
      totalCasualGames: parseInt(results[3].rows[0].count),
      activeUsers24h: parseInt(results[4].rows[0].count),
      averageRating: Math.round(results[5].rows[0].avg || 0),
      pendingFeedback: parseInt(results[6].rows[0].count),
      bannedUsers: parseInt(bans.banned),
      suspendedUsers: parseInt(bans.suspended),
      signups7d: parseInt(signups.week),
      signups30d: parseInt(signups.month),
      totalRounds: parseInt(results[9].rows[0].count),
      // In-memory, so it can disagree with `activeUsers24h`: this is right now.
      onlineNow: getOnlineUserIds().size,
      recentSignups: results[10].rows,
      topPlayers: results[11].rows,
      recentActions: results[12].rows,
    };
  }
  
  // Get all users (paginated)
  static async getAllUsers(filters: {
    search?: string;
    status?: string;
    limit: number;
    offset: number;
  }) {
    const { search, status, limit, offset } = filters;

    // One place decides what each filter means, so the page and its total can
    // never be built from different conditions.
    const where: string[] = ['1=1'];
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      where.push(`(u.username ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }

    if (status === 'banned') {
      // Permanent only. A suspension is in force but it has an end date, so
      // folding the two together would make the filter mean "restricted" twice.
      where.push(`u.banned_at IS NOT NULL AND ${BAN_IS_ACTIVE} AND u.banned_until IS NULL`);
    } else if (status === 'suspended') {
      where.push(`u.banned_at IS NOT NULL AND u.banned_until IS NOT NULL AND u.banned_until > NOW()`);
    } else if (status === 'restricted') where.push(BAN_IS_ACTIVE);
    else if (status === 'unverified') where.push('u.is_verified = false');

    const clause = where.join(' AND ');

    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.is_verified, u.created_at, u.last_username_change,
              u.banned_at, u.banned_until, u.ban_reason,
              u.total_challenge_games, u.total_challenge_rounds,
              ${BAN_IS_ACTIVE} AS is_restricted,
              cs.rating, cs.games_played, cs.avg_accuracy
       FROM users u
       LEFT JOIN competitive_stats cs ON u.id = cs.user_id
       WHERE ${clause}
       ORDER BY u.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const totalResult = await pool.query(
      `SELECT COUNT(*) as total FROM users u WHERE ${clause}`,
      params
    );

    return {
      users: result.rows,
      total: parseInt(totalResult.rows[0].total),
    };
  }

  // Get user details (admin)
  static async getUserDetails(userId: string) {
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.is_verified, u.created_at, u.last_username_change,
              u.banned_at, u.banned_until, u.ban_reason, u.banned_by,
              u.total_challenge_games, u.total_challenge_rounds,
              ${BAN_IS_ACTIVE} AS is_restricted,
              cs.rating, cs.rank_tier, cs.games_played, cs.avg_accuracy,
              cs.current_streak, cs.best_streak,
              COUNT(DISTINCT gr.id) as total_games
       FROM users u
       LEFT JOIN competitive_stats cs ON u.id = cs.user_id
       LEFT JOIN game_rounds gr ON u.id = gr.user_id
       WHERE u.id = $1
       GROUP BY u.id, cs.rating, cs.rank_tier, cs.games_played, cs.avg_accuracy,
                cs.current_streak, cs.best_streak`,
      [userId]
    );

    const user = result.rows[0];
    if (!user) return null;

    // Everything moderation-related that ever happened to this account, so the
    // decision to lift a restriction is made with the history in view.
    const history = await pool.query(
      `SELECT id, admin_id, action, details, created_at
         FROM admin_logs
        WHERE details->>'userId' = $1
        ORDER BY created_at DESC
        LIMIT 20`,
      [userId]
    );

    return { ...user, moderationHistory: history.rows };
  }

  // ── Moderation ────────────────────────────────────────────────────────────

  /**
   * Restrict an account.
   *
   * `durationHours` of null is a permanent ban; anything else is a suspension
   * that lapses on its own, because the expiry is a timestamp on the row rather
   * than a flag somebody has to remember to clear.
   */
  static async banUser(input: {
    userId: string;
    reason: string;
    durationHours: number | null;
    actor: string;
  }) {
    const { userId, reason, durationHours, actor } = input;

    const until =
      durationHours && durationHours > 0
        ? new Date(Date.now() + durationHours * 3_600_000)
        : null;

    const result = await pool.query(
      `UPDATE users
          SET ban_reason = $2, banned_at = NOW(), banned_until = $3, banned_by = $4
        WHERE id = $1
        RETURNING id, username, banned_at, banned_until, ban_reason`,
      [userId, reason || null, until, actor]
    );

    if (result.rows.length === 0) return null;

    await this.logAdminAction(actor, until ? 'suspend_user' : 'ban_user', {
      userId,
      username: result.rows[0].username,
      reason: reason || null,
      until,
    });

    return result.rows[0];
  }

  static async unbanUser(userId: string, actor: string) {
    const result = await pool.query(
      `UPDATE users
          SET ban_reason = NULL, banned_at = NULL, banned_until = NULL, banned_by = NULL
        WHERE id = $1
        RETURNING id, username`,
      [userId]
    );

    if (result.rows.length === 0) return null;

    await this.logAdminAction(actor, 'unban_user', {
      userId,
      username: result.rows[0].username,
    });

    return result.rows[0];
  }

  /** Everyone who is, or ever was, restricted — newest first. */
  static async getModerationList(filters: {
    status?: string;
    limit: number;
    offset: number;
  }) {
    const { status, limit, offset } = filters;

    const where = ['u.banned_at IS NOT NULL'];
    if (status === 'active') where.push(BAN_IS_ACTIVE);
    else if (status === 'expired') where.push(`NOT ${BAN_IS_ACTIVE}`);
    const clause = where.join(' AND ');

    const [rows, totalResult] = await Promise.all([
      pool.query(
        `SELECT u.id, u.username, u.email, u.created_at,
                u.ban_reason, u.banned_at, u.banned_until, u.banned_by,
                ${BAN_IS_ACTIVE} AS is_restricted
           FROM users u
          WHERE ${clause}
          ORDER BY u.banned_at DESC
          LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query(`SELECT COUNT(*) as total FROM users u WHERE ${clause}`),
    ]);

    return { users: rows.rows, total: parseInt(totalResult.rows[0].total) };
  }

  static async setVerified(userId: string, verified: boolean, actor: string) {
    const result = await pool.query(
      `UPDATE users SET is_verified = $2 WHERE id = $1
       RETURNING id, username, is_verified`,
      [userId, verified]
    );

    if (result.rows.length === 0) return null;

    await this.logAdminAction(actor, verified ? 'verify_user' : 'unverify_user', {
      userId,
      username: result.rows[0].username,
    });

    return result.rows[0];
  }

  /**
   * Remove an account for good.
   *
   * The row is read first: after the delete there is nothing left to name in the
   * audit log, and an entry saying only "deleted a user" is worthless.
   */
  static async deleteUser(userId: string, actor: string) {
    const existing = await pool.query(
      'SELECT id, username, email FROM users WHERE id = $1',
      [userId]
    );

    if (existing.rows.length === 0) return null;

    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await this.logAdminAction(actor, 'delete_user', existing.rows[0]);

    return existing.rows[0];
  }

  static async getAdminLogs(filters: { action?: string; limit: number; offset: number }) {
    const { action, limit, offset } = filters;

    const params: any[] = [];
    let clause = '1=1';
    if (action) {
      params.push(action);
      clause = `action = $${params.length}`;
    }

    const [rows, totalResult] = await Promise.all([
      pool.query(
        `SELECT id, admin_id, action, details, created_at
           FROM admin_logs WHERE ${clause}
          ORDER BY created_at DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      pool.query(`SELECT COUNT(*) as total FROM admin_logs WHERE ${clause}`, params),
    ]);

    return { logs: rows.rows, total: parseInt(totalResult.rows[0].total) };
  }
  
  // Reconcile the leaderboard's denormalised data.
  // There is nothing to materialise — every ranking is read live from
  // competitive_stats — so the one thing that can drift is the stored rank_tier
  // label, which this rewrites onto the current ladder.
  static async refreshLeaderboard() {
    const updated = await backfillRankTiers();
    return {
      success: true,
      updated,
      message:
        updated > 0
          ? `Rank labels rewritten for ${updated} account(s)`
          : 'Rank labels already current',
    };
  }
  
  /**
   * Record an admin write.
   *
   * `admin_logs.admin_id` is a uuid with a foreign key onto the accounts table,
   * but admin access is a shared key with no account behind it — so there is
   * usually no id to record, and the actor is a free-text label instead. That
   * label goes into `details.actor` rather than being forced into a column that
   * cannot hold it. The uuid branch is kept for the day admins are real accounts.
   *
   * Never throws. The log is a record of the action, not part of it — an audit
   * insert that fails must not leave an account half-restricted.
   */
  static async logAdminAction(adminId: string, action: string, details: any = null) {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isAccountId = UUID_RE.test(adminId);

    const payload = {
      ...(details && typeof details === 'object' ? details : {}),
      ...(isAccountId ? {} : { actor: adminId }),
    };

    try {
      await pool.query(
        `INSERT INTO admin_logs (admin_id, action, details)
         VALUES ($1, $2, $3)`,
        [isAccountId ? adminId : null, action, JSON.stringify(payload)]
      );
    } catch (error) {
      console.warn(`⚠️  Could not log admin action "${action}":`, (error as Error).message);
    }
  }
}