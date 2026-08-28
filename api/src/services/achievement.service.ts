import pool from '../config/db.js';

/**
 * Achievements.
 *
 * The whole service turns on one idea: a single snapshot of the player's stats
 * and a single pure function that reads it. Unlocking and progress used to be
 * two separate switch statements, and they had already drifted — three
 * requirement types unlocked correctly but reported 0% progress forever, because
 * only one of the two switches had ever learned about them. `evaluate` is now
 * the only place that knows what an achievement means, so they cannot disagree.
 *
 * Nothing here is tied to Challenge mode. Challenge rooms live in memory and are
 * gone when the last player leaves, so there is no history to award anything
 * from — the two multiplayer achievements that used to exist could never unlock
 * and have been removed rather than left as permanently-locked cards.
 */

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface Achievement {
  key: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  requirement_type: string;
  requirement_value: number;
  requirement_metadata: any;
  tier: AchievementTier;
  points: number;
  sort_order: number;
}

export interface AchievementWithProgress extends Achievement {
  progress_current: number;
  progress_target: number;
}

/**
 * Everything any achievement can be judged against, read once per check.
 *
 * Built from the tables that actually persist: competitive rounds, the daily
 * challenge, friendships and the account itself. Casual games are deliberately
 * absent — they are never written to the database at all.
 */
export interface AchievementStats {
  /** Competitive */
  rating: number;
  bestRatingGain: number;
  gamesPlayed: number;
  currentStreak: number;
  bestStreak: number;
  bestAccuracy: number;
  /** How many rounds cleared a given accuracy bar, e.g. 90 -> 41 rounds. */
  roundsAtAccuracy: (threshold: number) => number;
  gamesByDifficulty: Map<string, number>;
  bestAccuracyByDifficulty: Map<string, number>;
  /** Best accuracy achieved with a memorization time at or under N seconds. */
  bestAccuracyUnderMemorize: (seconds: number) => number;

  /** Daily challenge */
  dailyPlayed: number;
  dailyStreak: number;
  dailyBestAccuracy: number;
  /** Fastest daily submission, in ms. Infinity when they have never played one. */
  dailyFastestMs: number;

  /** Social + account */
  friends: number;
  accountAgeDays: number;

  /** Meta — how many achievements are already unlocked. */
  unlockedCount: number;
}

const ACCURACY_BUCKETS = [50, 60, 70, 75, 80, 85, 90, 95, 99] as const;
const MEMORIZE_BUCKETS = [1, 2, 3] as const;

export class AchievementService {
  // ── Reads ─────────────────────────────────────────────────────────────────

  static async getAllAchievements(): Promise<Achievement[]> {
    // Ordered by the stored sort_order. The previous ORDER BY was a CASE over
    // category names with no ELSE, so every category added after it was written
    // sorted arbitrarily.
    const result = await pool.query(
      `SELECT key, name, description, category, icon,
              requirement_type, requirement_value, requirement_metadata,
              COALESCE(tier, 'bronze')  AS tier,
              COALESCE(points, 10)      AS points,
              COALESCE(sort_order, 0)   AS sort_order
       FROM achievements
       ORDER BY sort_order ASC, requirement_value ASC, key ASC`
    );

    return result.rows;
  }

  static async getUnlockedKeys(userId: string): Promise<Set<string>> {
    const result = await pool.query(
      `SELECT achievement_key FROM user_achievements WHERE user_id = $1`,
      [userId]
    );
    return new Set(result.rows.map((r: any) => r.achievement_key));
  }

  /**
   * The player's achievement wall.
   *
   * Syncs first, so achievements added since their last game appear unlocked
   * immediately rather than waiting for them to play again. That matters here
   * more than usual: the catalogue grew from 18 to 100, and without this every
   * existing account would show the new ones locked despite having long since
   * earned them.
   */
  static async getUserAchievements(userId: string): Promise<{
    unlocked: Achievement[];
    locked: AchievementWithProgress[];
  }> {
    const [all, stats] = await Promise.all([
      this.getAllAchievements(),
      this.buildStats(userId),
    ]);

    const unlockedKeys = await this.syncFromStats(userId, all, stats);

    const unlocked: Achievement[] = [];
    const locked: AchievementWithProgress[] = [];

    for (const ach of all) {
      if (unlockedKeys.has(ach.key)) {
        unlocked.push(ach);
      } else {
        const { current, target } = evaluate(ach, stats);
        locked.push({ ...ach, progress_current: current, progress_target: target });
      }
    }

    return { unlocked, locked };
  }

  // ── Unlocking ─────────────────────────────────────────────────────────────

  /**
   * Re-evaluate every achievement against the player's current stats.
   *
   * Call this after anything that could move a number — a competitive round, a
   * daily submission, opening the achievements page. It derives from current
   * state rather than from one game's delta, which makes it idempotent and
   * retroactive: no backfill script is needed when achievements are added.
   *
   * Returns only what was newly unlocked, so callers can toast it.
   */
  static async syncAchievements(userId: string): Promise<Achievement[]> {
    const [all, stats] = await Promise.all([
      this.getAllAchievements(),
      this.buildStats(userId),
    ]);

    const before = await this.getUnlockedKeys(userId);
    const after = await this.syncFromStats(userId, all, stats, before);

    return all.filter(a => after.has(a.key) && !before.has(a.key));
  }

  /**
   * The write half of a sync, given work already done by the caller.
   *
   * Split out so `getUserAchievements` can sync and render from one pair of
   * queries instead of two. Returns the full unlocked set afterwards.
   */
  private static async syncFromStats(
    userId: string,
    all: Achievement[],
    stats: AchievementStats,
    knownUnlocked?: Set<string>
  ): Promise<Set<string>> {
    const unlocked = knownUnlocked ?? (await this.getUnlockedKeys(userId));

    // `unlockedCount` is part of the stats, so meta achievements ("unlock 50
    // achievements") are judged against the count as it stands before this pass.
    // Deliberate: letting one pass cascade would unlock a chain of meta tiers
    // from a single game.
    const toUnlock = all
      .filter(a => !unlocked.has(a.key))
      .filter(a => evaluate(a, stats).unlocked)
      .map(a => a.key);

    if (toUnlock.length === 0) return unlocked;

    // One statement rather than one per achievement. The old code awaited a
    // SELECT per achievement inside the loop just to ask whether it was already
    // unlocked — at 100 achievements that was 100 round trips per game.
    const values = toUnlock.map((_, i) => `($1, $${i + 2}, NOW())`).join(', ');
    await pool.query(
      `INSERT INTO user_achievements (user_id, achievement_key, unlocked_at)
       VALUES ${values}
       ON CONFLICT (user_id, achievement_key) DO NOTHING`,
      [userId, ...toUnlock]
    );

    for (const key of toUnlock) unlocked.add(key);
    return unlocked;
  }

  static async unlockAchievement(userId: string, achievementKey: string): Promise<void> {
    await pool.query(
      `INSERT INTO user_achievements (user_id, achievement_key, unlocked_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, achievement_key) DO NOTHING`,
      [userId, achievementKey]
    );
  }

  static async isAchievementUnlocked(userId: string, achievementKey: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1 FROM user_achievements WHERE user_id = $1 AND achievement_key = $2`,
      [userId, achievementKey]
    );
    return result.rows.length > 0;
  }

  // ── Stats snapshot ────────────────────────────────────────────────────────

  /**
   * One read of everything achievements care about.
   *
   * Every query is scoped to modes that persist. `mode = 'competitive'` is the
   * ranked single-player game; casual is never saved and Challenge mode has no
   * table behind it at all.
   */
  static async buildStats(userId: string): Promise<AchievementStats> {
    const [
      competitive,
      accuracyBuckets,
      byDifficulty,
      memorizeBuckets,
      daily,
      dailyDates,
      friends,
      account,
      unlockedCount,
      bestGain,
    ] = await Promise.all([
      pool.query(
        `SELECT rating, current_streak, best_streak, games_played, best_score
         FROM competitive_stats WHERE user_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT
           MAX(accuracy) AS best,
           ${ACCURACY_BUCKETS.map(b => `COUNT(*) FILTER (WHERE accuracy >= ${b}) AS acc_${b}`).join(',\n           ')}
         FROM game_rounds
         WHERE user_id = $1 AND mode = 'competitive' AND accuracy IS NOT NULL`,
        [userId]
      ),
      pool.query(
        `SELECT difficulty, COUNT(*) AS count, MAX(accuracy) AS best
         FROM game_rounds
         WHERE user_id = $1 AND mode = 'competitive' AND accuracy IS NOT NULL
         GROUP BY difficulty`,
        [userId]
      ),
      pool.query(
        `SELECT
           ${MEMORIZE_BUCKETS.map(
             b => `MAX(accuracy) FILTER (WHERE memorization_seconds <= ${b}) AS mem_${b}`
           ).join(',\n           ')}
         FROM game_rounds
         WHERE user_id = $1 AND mode = 'competitive' AND accuracy IS NOT NULL`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*) AS played, MAX(accuracy) AS best, MIN(time_taken_ms) AS fastest
         FROM daily_submissions WHERE user_id = $1`,
        [userId]
      ),
      // Distinct challenge days, newest first — the streak is walked in JS
      // because "consecutive days" is awkward to express and easy to get subtly
      // wrong in SQL, and the row count here is tiny.
      pool.query(
        `SELECT DISTINCT dc.challenge_date::date AS day
         FROM daily_submissions ds
         JOIN daily_challenges dc ON dc.id = ds.challenge_id
         WHERE ds.user_id = $1
         ORDER BY day DESC
         LIMIT 400`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*) AS count FROM friendships
         WHERE status = 'accepted' AND (requester_id = $1 OR addressee_id = $1)`,
        [userId]
      ),
      pool.query(`SELECT created_at FROM users WHERE id = $1`, [userId]),
      pool.query(`SELECT COUNT(*) AS count FROM user_achievements WHERE user_id = $1`, [userId]),
      pool.query(
        `SELECT MAX(rating_change) AS best FROM rating_history WHERE user_id = $1`,
        [userId]
      ),
    ]);

    const comp = competitive.rows[0] ?? {};
    const accRow = accuracyBuckets.rows[0] ?? {};
    const memRow = memorizeBuckets.rows[0] ?? {};
    const dailyRow = daily.rows[0] ?? {};

    const gamesByDifficulty = new Map<string, number>();
    const bestAccuracyByDifficulty = new Map<string, number>();
    for (const row of byDifficulty.rows) {
      gamesByDifficulty.set(row.difficulty, Number(row.count) || 0);
      bestAccuracyByDifficulty.set(row.difficulty, Number(row.best) || 0);
    }

    const accuracyCounts = new Map<number, number>(
      ACCURACY_BUCKETS.map(b => [b, Number(accRow[`acc_${b}`]) || 0])
    );
    const memorizeBests = new Map<number, number>(
      MEMORIZE_BUCKETS.map(b => [b, Number(memRow[`mem_${b}`]) || 0])
    );

    const createdAt = account.rows[0]?.created_at;
    const accountAgeDays = createdAt
      ? Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
      : 0;

    const fastest = Number(dailyRow.fastest);

    return {
      rating: Number(comp.rating) || 0,
      bestRatingGain: Number(bestGain.rows[0]?.best) || 0,
      gamesPlayed: Number(comp.games_played) || 0,
      currentStreak: Number(comp.current_streak) || 0,
      bestStreak: Number(comp.best_streak) || 0,
      // best_score used to be read here but was never written by the competitive
      // service. It is written now, and the round-level MAX is still the
      // authority so accounts that predate the fix are not stuck at zero.
      bestAccuracy: Math.max(Number(comp.best_score) || 0, Number(accRow.best) || 0),
      roundsAtAccuracy: threshold => nearestBucket(accuracyCounts, threshold, 'down'),
      gamesByDifficulty,
      bestAccuracyByDifficulty,
      bestAccuracyUnderMemorize: seconds => nearestBucket(memorizeBests, seconds, 'up'),

      dailyPlayed: Number(dailyRow.played) || 0,
      dailyStreak: consecutiveDays(dailyDates.rows.map(r => r.day)),
      dailyBestAccuracy: Number(dailyRow.best) || 0,
      dailyFastestMs: Number.isFinite(fastest) && fastest > 0 ? fastest : Infinity,

      friends: Number(friends.rows[0]?.count) || 0,
      accountAgeDays,

      unlockedCount: Number(unlockedCount.rows[0]?.count) || 0,
    };
  }

  // ── Aggregates for the UI ─────────────────────────────────────────────────

  static async getAchievementStats(userId: string): Promise<{
    total: number;
    byCategory: Record<string, number>;
    totalPossible: number;
    points: number;
    totalPoints: number;
  }> {
    const [totals, mine] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS count, COALESCE(SUM(COALESCE(points, 10)), 0) AS points
         FROM achievements`
      ),
      pool.query(
        `SELECT a.category, COUNT(*) AS count, COALESCE(SUM(COALESCE(a.points, 10)), 0) AS points
         FROM user_achievements ua
         JOIN achievements a ON ua.achievement_key = a.key
         WHERE ua.user_id = $1
         GROUP BY a.category`,
        [userId]
      ),
    ]);

    const byCategory: Record<string, number> = {};
    let total = 0;
    let points = 0;
    for (const row of mine.rows) {
      const count = Number(row.count) || 0;
      byCategory[row.category] = count;
      total += count;
      points += Number(row.points) || 0;
    }

    return {
      total,
      byCategory,
      totalPossible: Number(totals.rows[0]?.count) || 0,
      points,
      totalPoints: Number(totals.rows[0]?.points) || 0,
    };
  }

  static async getRecentUnlocked(userId: string, limit: number = 5): Promise<any[]> {
    const result = await pool.query(
      `SELECT ua.unlocked_at, a.key, a.name, a.description, a.icon, a.category,
              COALESCE(a.tier, 'bronze') AS tier, COALESCE(a.points, 10) AS points
       FROM user_achievements ua
       JOIN achievements a ON ua.achievement_key = a.key
       WHERE ua.user_id = $1
       ORDER BY ua.unlocked_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  static async getRecentUnseenUnlocked(userId: string, limit: number = 5): Promise<any[]> {
    const result = await pool.query(
      `SELECT ua.unlocked_at, a.key, a.name, a.description, a.icon, a.category, ua.is_seen,
              COALESCE(a.tier, 'bronze') AS tier, COALESCE(a.points, 10) AS points
       FROM user_achievements ua
       JOIN achievements a ON ua.achievement_key = a.key
       WHERE ua.user_id = $1 AND (ua.is_seen IS NULL OR ua.is_seen = false)
       ORDER BY ua.unlocked_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  static async markAchievementsAsSeen(userId: string, achievementKeys: string[]): Promise<void> {
    if (achievementKeys.length === 0) return;

    const placeholders = achievementKeys.map((_, i) => `$${i + 2}`).join(',');
    await pool.query(
      `UPDATE user_achievements
       SET is_seen = true, seen_at = NOW()
       WHERE user_id = $1 AND achievement_key IN (${placeholders})`,
      [userId, ...achievementKeys]
    );
  }

  static async markAllRecentAsSeen(userId: string): Promise<void> {
    await pool.query(
      `UPDATE user_achievements
       SET is_seen = true, seen_at = NOW()
       WHERE user_id = $1 AND (is_seen IS NULL OR is_seen = false)`,
      [userId]
    );
  }

  static async getUnseenCount(userId: string): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*) AS count FROM user_achievements
       WHERE user_id = $1 AND (is_seen IS NULL OR is_seen = false)`,
      [userId]
    );

    return Number(result.rows[0]?.count) || 0;
  }

  /**
   * The up-to-three achievements a player has pinned to their profile.
   *
   * Filtered against what they have actually unlocked on read as well as on
   * write: an achievement can in principle be removed from the catalogue after
   * being pinned, and a profile should not render a hole.
   */
  static async getShowcase(userId: string): Promise<Achievement[]> {
    const result = await pool.query(
      `SELECT a.key, a.name, a.description, a.category, a.icon,
              a.requirement_type, a.requirement_value, a.requirement_metadata,
              COALESCE(a.tier, 'bronze') AS tier,
              COALESCE(a.points, 10)     AS points,
              COALESCE(a.sort_order, 0)  AS sort_order,
              ord.position
       FROM users u
       CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(u.showcase_achievements, '[]'::jsonb))
              WITH ORDINALITY AS ord(key, position)
       JOIN achievements a ON a.key = ord.key
       JOIN user_achievements ua ON ua.achievement_key = a.key AND ua.user_id = u.id
       WHERE u.id = $1
       ORDER BY ord.position`,
      [userId]
    );

    return result.rows;
  }

  /** Replaces the pinned set. Silently drops anything not unlocked, and caps at 3. */
  static async setShowcase(userId: string, keys: string[]): Promise<string[]> {
    const unique = Array.from(new Set(keys.filter(k => typeof k === 'string'))).slice(0, 3);

    let allowed: string[] = [];
    if (unique.length > 0) {
      const owned = await pool.query(
        `SELECT achievement_key FROM user_achievements
         WHERE user_id = $1 AND achievement_key = ANY($2::text[])`,
        [userId, unique]
      );
      const ownedKeys = new Set(owned.rows.map((r: any) => r.achievement_key));
      allowed = unique.filter(k => ownedKeys.has(k));
    }

    await pool.query(`UPDATE users SET showcase_achievements = $2::jsonb WHERE id = $1`, [
      userId,
      JSON.stringify(allowed),
    ]);

    return allowed;
  }
}

// ── The evaluator ───────────────────────────────────────────────────────────

/**
 * Whether an achievement is earned, and how close it is otherwise.
 *
 * Pure and synchronous by design. Progress and unlocking read the same branch,
 * so a requirement type cannot be understood by one and not the other — which
 * is exactly how `difficulty_completed` ended up unlockable but permanently
 * displayed at 0%.
 *
 * An unrecognised type reports zero progress and never unlocks. That is the
 * safe direction: a typo in a seed row leaves a card locked rather than handing
 * it to everyone.
 */
export function evaluate(
  achievement: Achievement,
  stats: AchievementStats
): { current: number; target: number; unlocked: boolean } {
  const target = Number(achievement.requirement_value) || 0;
  const difficulty = achievement.requirement_metadata?.difficulty as string | undefined;
  const atLeast = (current: number) => ({ current: Math.min(current, target), target, unlocked: current >= target });

  switch (achievement.requirement_type) {
    case 'best_accuracy':
      return atLeast(stats.bestAccuracy);

    // "N rounds at or above X%" — the bar is in metadata, the count is the target.
    case 'accuracy_count':
      return atLeast(stats.roundsAtAccuracy(Number(achievement.requirement_metadata?.accuracy) || 0));

    case 'games_played':
      return atLeast(stats.gamesPlayed);

    case 'current_streak':
      return atLeast(stats.currentStreak);

    case 'best_streak':
      return atLeast(stats.bestStreak);

    case 'rating':
      return atLeast(stats.rating);

    case 'rating_single_gain':
      return atLeast(stats.bestRatingGain);

    case 'difficulty_games':
      return atLeast(difficulty ? stats.gamesByDifficulty.get(difficulty) ?? 0 : 0);

    case 'difficulty_accuracy':
      return atLeast(difficulty ? stats.bestAccuracyByDifficulty.get(difficulty) ?? 0 : 0);

    // "X% accuracy with N seconds or less of memorization" — seconds in metadata.
    case 'fast_memorize':
      return atLeast(stats.bestAccuracyUnderMemorize(Number(achievement.requirement_metadata?.seconds) || 1));

    case 'daily_played':
      return atLeast(stats.dailyPlayed);

    case 'daily_streak':
      return atLeast(stats.dailyStreak);

    case 'daily_accuracy':
      return atLeast(stats.dailyBestAccuracy);

    // Inverted: a lower time is better, so progress is all-or-nothing rather
    // than a fraction that would run backwards as they improve.
    case 'daily_speed': {
      const unlocked = stats.dailyFastestMs <= target;
      return { current: unlocked ? target : 0, target, unlocked };
    }

    case 'friends_count':
      return atLeast(stats.friends);

    case 'account_age_days':
      return atLeast(stats.accountAgeDays);

    case 'achievements_unlocked':
      return atLeast(stats.unlockedCount);

    default:
      return { current: 0, target, unlocked: false };
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Read a pre-aggregated bucket, tolerating a threshold the query never grouped.
 *
 * The accuracy and memorization counts are computed as a fixed set of FILTER
 * columns rather than one query per achievement. A seed row asking for a bar
 * that is not one of those columns falls to the nearest bucket that cannot
 * overstate the player: rounder for accuracy counts, stricter for memorization.
 */
function nearestBucket(
  buckets: Map<number, number>,
  wanted: number,
  direction: 'up' | 'down'
): number {
  if (buckets.has(wanted)) return buckets.get(wanted) ?? 0;

  const keys = [...buckets.keys()].sort((a, b) => a - b);
  const candidates =
    direction === 'down' ? keys.filter(k => k >= wanted) : keys.filter(k => k <= wanted);

  // 'down' wants the strictest bar that is still at least as hard as asked;
  // 'up' wants the longest memorization window no longer than asked.
  const pick = direction === 'down' ? candidates[0] : candidates[candidates.length - 1];
  return pick === undefined ? 0 : buckets.get(pick) ?? 0;
}

/**
 * Length of the daily run ending today or yesterday.
 *
 * Yesterday counts as still alive: the day rolls over at UTC midnight, so
 * requiring today would break a player's streak for the hours between midnight
 * and whenever they next sit down.
 */
function consecutiveDays(days: Array<Date | string>): number {
  if (days.length === 0) return 0;

  const toDay = (value: Date | string) => {
    const date = new Date(value);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  };

  const sorted = [...new Set(days.map(toDay))].sort((a, b) => b - a);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  if (sorted[0] !== today && sorted[0] !== today - 86_400_000) return 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1] - sorted[i] !== 86_400_000) break;
    streak++;
  }
  return streak;
}
