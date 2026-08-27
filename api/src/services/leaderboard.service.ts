import pool from '../config/db.js';
import { DIFFICULTY_CONFIGS, type Difficulty } from '../types/game.types.js';

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
  key: string;
  category: string;
  icon: string;
  username: string;
  value: number;
  /** Rendered straight after the value, e.g. '%'. */
  suffix: string;
}

/**
 * Competitive games an account needs before it is ranked. Quoted on the FAQ page
 * ("Play at least 20 competitive games"), so keep the two in step.
 */
export const MIN_RANKED_GAMES = 20;

/**
 * Window each period covers. Interpolated into SQL, so it is a fixed lookup and
 * never built from a request value.
 */
const PERIOD_INTERVALS: Record<Exclude<LeaderboardPeriod, 'all-time'>, string> = {
  weekly: '7 days',
  daily: '1 day',
};

/** Only these difficulties move the streak — mirrors CompetitiveService.updateAfterGame. */
const STREAK_DIFFICULTIES: Difficulty[] = ['hard', 'extreme'];

const STREAK_DIFFICULTY_LIST = STREAK_DIFFICULTIES.map(d => `'${d}'`).join(', ');

/**
 * "This round continued a streak", generated from DIFFICULTY_CONFIGS so the
 * period streak cannot drift from the live rule, which is
 * `!isNegative && accuracy > 0` with `isNegative = accuracy < negThreshold`.
 * The ELSE can't be reached — streak_rounds filters to the difficulties above —
 * and 101 is simply unsatisfiable if it ever were.
 */
const STREAK_CONTINUES_SQL = `(
        rh.accuracy > 0 AND rh.accuracy >= CASE rh.difficulty
          ${STREAK_DIFFICULTIES.map(d => `WHEN '${d}' THEN ${DIFFICULTY_CONFIGS[d].negThreshold}`).join('\n          ')}
          ELSE 101 END
      )`;

const num = (value: any, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const int = (value: any): number => Math.trunc(num(value));
const round2 = (value: any): number => Math.round(num(value) * 100) / 100;

/**
 * `%` and `_` are ILIKE wildcards, so a username search for "100%" would
 * otherwise match everything. Escaped with `#` rather than a backslash to keep
 * the SQL literal readable.
 */
const likePattern = (term: string): string => `%${term.replace(/[#%_]/g, ch => `#${ch}`)}%`;

export class LeaderboardService {

  /**
   * One page of the board.
   *
   * The position of every row is computed with a window function over the whole
   * qualifying set *before* the username filter is applied, so searching for a
   * player shows their real rank rather than "#1 of the 1 row that matched".
   */
  static async getLeaderboard(filters: LeaderboardFilters) {
    const period: LeaderboardPeriod = ['all-time', 'weekly', 'daily'].includes(filters.period)
      ? filters.period
      : 'all-time';
    const direction: SortOrder = filters.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    const limit = Math.min(Math.max(int(filters.limit) || 100, 1), 100);
    const offset = Math.max(int(filters.offset), 0);
    const term = (filters.search ?? '').trim().slice(0, 50);
    const search = term.length > 0 ? likePattern(term) : null;

    const isPeriod = period !== 'all-time';

    // Period views rank on what happened inside the window, from rating_history
    // (competitive rounds only). An INNER JOIN onto period_totals is what makes
    // the filter real: a player who did not play this week is not on the board.
    const cte = isPeriod
      ? `WITH window_rounds AS (
      SELECT rh.user_id, rh.created_at, rh.game_round_id, rh.difficulty,
             rh.rating_change, rh.accuracy,
             ${STREAK_CONTINUES_SQL} AS streak_ok
      FROM rating_history rh
      WHERE rh.created_at >= NOW() - INTERVAL '${PERIOD_INTERVALS[period as 'weekly' | 'daily']}'
    ),
    period_totals AS (
      SELECT user_id,
             COUNT(*) AS period_games,
             COALESCE(SUM(rating_change), 0) AS period_points,
             AVG(accuracy) AS period_accuracy
      FROM window_rounds
      GROUP BY user_id
    ),
    streak_rounds AS (
      SELECT user_id, created_at, game_round_id, streak_ok
      FROM window_rounds
      WHERE difficulty IN (${STREAK_DIFFICULTY_LIST})
    ),
    -- Gaps and islands: consecutive rounds with the same streak_ok value share a
    -- difference between the two row numbers, which makes each run groupable.
    streak_islands AS (
      SELECT user_id, streak_ok,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at, game_round_id)
           - ROW_NUMBER() OVER (PARTITION BY user_id, streak_ok ORDER BY created_at, game_round_id) AS island
      FROM streak_rounds
    ),
    streak_runs AS (
      SELECT user_id, COUNT(*) AS run_length
      FROM streak_islands
      WHERE streak_ok
      GROUP BY user_id, island
    ),
    period_streaks AS (
      SELECT user_id, MAX(run_length) AS period_streak
      FROM streak_runs
      GROUP BY user_id
    ),
    ranked AS (`
      : `WITH ranked AS (`;

    const periodSelect = isPeriod
      ? `,
             pt.period_games, pt.period_points, pt.period_accuracy,
             COALESCE(ps.period_streak, 0) AS period_streak`
      : '';

    const periodJoins = isPeriod
      ? `
      JOIN period_totals pt ON pt.user_id = cs.user_id
      LEFT JOIN period_streaks ps ON ps.user_id = cs.user_id`
      : '';

    const sortColumns: Record<LeaderboardSortBy, string> = isPeriod
      ? {
          points: 'pt.period_points',
          gamesPlayed: 'pt.period_games',
          avgAccuracy: 'pt.period_accuracy',
          streak: 'COALESCE(ps.period_streak, 0)',
        }
      : {
          points: 'cs.rating',
          gamesPlayed: 'cs.games_played',
          avgAccuracy: 'cs.avg_accuracy',
          streak: 'cs.best_streak',
        };
    const sortBy: LeaderboardSortBy = sortColumns[filters.sortBy] ? filters.sortBy : 'points';
    // Rating then username as tiebreakers: without them equal values come back
    // in whatever order the planner chose, so a row could appear on two pages.
    const orderBy = `${sortColumns[sortBy]} ${direction} NULLS LAST, cs.rating DESC, u.username ASC`;

    const rankedBody = `
      SELECT cs.user_id, u.username, cs.rating, cs.rank_tier, cs.games_played,
             cs.avg_accuracy, cs.best_streak,
             ROW_NUMBER() OVER (ORDER BY ${orderBy}) AS board_rank${periodSelect}
      FROM competitive_stats cs
      JOIN users u ON u.id = cs.user_id${periodJoins}
      WHERE cs.games_played >= $1
    )`;

    // $1 minimum games, $2 search pattern (nullable), $3 limit, $4 offset.
    const params: any[] = [MIN_RANKED_GAMES, search, limit, offset];

    const query = `${cte}${rankedBody}
      SELECT *, COUNT(*) OVER () AS total_matching
      FROM ranked
      WHERE ($2::text IS NULL OR username ILIKE $2 ESCAPE '#')
      ORDER BY board_rank
      LIMIT $3 OFFSET $4`;

    const result = await pool.query(query, params);

    let total = result.rows.length > 0 ? int(result.rows[0].total_matching) : 0;
    if (result.rows.length === 0 && offset > 0) {
      // Paged past the end, so the window function had no row to report from.
      const countResult = await pool.query(
        `${cte}${rankedBody}
         SELECT COUNT(*) AS total FROM ranked
         WHERE ($2::text IS NULL OR username ILIKE $2 ESCAPE '#')`,
        [MIN_RANKED_GAMES, search]
      );
      total = int(countResult.rows[0]?.total);
    }

    const entries = result.rows.map((row: any) => ({
      rank: int(row.board_rank),
      userId: row.user_id,
      username: row.username,
      rating: int(row.rating),
      rankTier: row.rank_tier,
      gamesPlayed: int(row.games_played),
      avgAccuracy: round2(row.avg_accuracy),
      bestStreak: int(row.best_streak),
      periodStats: isPeriod
        ? {
            games: int(row.period_games),
            pointsGained: int(row.period_points),
            avgAccuracy: round2(row.period_accuracy),
            bestStreak: int(row.period_streak),
          }
        : null,
    }));

    return {
      entries,
      total,
      limit,
      offset,
      // Echoed back so the client can label columns and medal positions without
      // guessing whether the request it sent was the one that was served.
      period,
      sortBy,
      sortOrder: direction,
      minRankedGames: MIN_RANKED_GAMES,
    };
  }

  /** Header figures. One pass over competitive_stats, ranked and unranked split out. */
  static async getGlobalStats() {
    const [totals, topPlayer] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS total_players,
                COUNT(*) FILTER (WHERE games_played >= $1) AS ranked_players,
                COALESCE(AVG(rating) FILTER (WHERE games_played >= $1), 0) AS avg_rating,
                COALESCE(MAX(rating) FILTER (WHERE games_played >= $1), 0) AS highest_rating,
                COALESCE(SUM(games_played), 0) AS total_games
         FROM competitive_stats`,
        [MIN_RANKED_GAMES]
      ),
      pool.query(
        `SELECT u.username, cs.rating
         FROM competitive_stats cs
         JOIN users u ON u.id = cs.user_id
         WHERE cs.games_played >= $1
         ORDER BY cs.rating DESC, u.username ASC
         LIMIT 1`,
        [MIN_RANKED_GAMES]
      ),
    ]);

    const row = totals.rows[0] ?? {};

    return {
      totalPlayers: int(row.total_players),
      rankedPlayers: int(row.ranked_players),
      avgRating: Math.round(num(row.avg_rating)),
      highestRating: int(row.highest_rating),
      totalGames: int(row.total_games),
      topPlayer: topPlayer.rows[0]?.username ?? null,
      topPlayerRating: topPlayer.rows[0] ? int(topPlayer.rows[0].rating) : null,
      minRankedGames: MIN_RANKED_GAMES,
    };
  }

  /**
   * The four category leaders.
   *
   * Each branch is an explicit `ORDER BY … LIMIT 1`. The previous version ranked
   * with ROW_NUMBER() but had no outer ORDER BY, so the row it read as the winner
   * was whichever the planner happened to return first.
   */
  static async getAwardEmblems(): Promise<AwardEmblem[]> {
    const categories = [
      { key: 'points', category: 'Top Points', icon: '🏆', column: 'cs.rating', suffix: '' },
      { key: 'accuracy', category: 'Top Accuracy', icon: '🎯', column: 'cs.avg_accuracy', suffix: '%' },
      { key: 'games', category: 'Most Games', icon: '📊', column: 'cs.games_played', suffix: '' },
      { key: 'streak', category: 'Longest Streak', icon: '🔥', column: 'cs.best_streak', suffix: '' },
    ] as const;

    // One round trip. Values are cast to numeric so the branches union cleanly.
    const branches = categories.map(
      c => `(SELECT '${c.key}' AS key, u.username, ${c.column}::numeric AS value
             FROM competitive_stats cs
             JOIN users u ON u.id = cs.user_id
             WHERE cs.games_played >= $1
             ORDER BY ${c.column} DESC, u.username ASC
             LIMIT 1)`
    );

    const result = await pool.query(branches.join('\nUNION ALL\n'), [MIN_RANKED_GAMES]);
    const byKey = new Map<string, any>(result.rows.map((row: any) => [row.key, row]));

    return categories.flatMap(c => {
      const row = byKey.get(c.key);
      if (!row) return [];
      return [
        {
          key: c.key,
          category: c.category,
          icon: c.icon,
          username: row.username,
          value: c.suffix === '%' ? round2(row.value) : int(row.value),
          suffix: c.suffix,
        },
      ];
    });
  }

  /** Usernames of the current points top 10, for the badge on other screens. */
  static async getTop10Players(): Promise<string[]> {
    const result = await pool.query(
      `SELECT u.username
       FROM competitive_stats cs
       JOIN users u ON u.id = cs.user_id
       WHERE cs.games_played >= $1
       ORDER BY cs.rating DESC, u.username ASC
       LIMIT 10`,
      [MIN_RANKED_GAMES]
    );

    return result.rows.map((row: any) => row.username);
  }
}
