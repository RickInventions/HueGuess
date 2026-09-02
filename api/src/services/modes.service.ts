import crypto from 'crypto';
import pool from '../config/db.js';
import { AchievementService } from './achievement.service.js';
import { DIFFICULTY_CONFIGS, type Difficulty } from '../types/game.types.js';
import {
  calculateAccuracy,
  generateRandomColor,
  validateHSL,
  type HSLColor,
} from '../utils/hsl.utils.js';

/**
 * Inverted and Blind — the two modes that sit outside the ladder.
 *
 * Their rounds are deliberately *not* `game_rounds` rows. That table's `mode`
 * column was created by hand outside this repo, so whether it has a CHECK
 * constraint is unknowable from here and a new value in it is a coin flip at
 * runtime. These live in their own table instead and never touch
 * `competitive_stats`: no HuePoints, no rank, no effect on the ladder. The boards
 * are percentage only.
 *
 * They do award achievements — their own family of them, read straight off
 * `mode_rounds` — because an unranked mode with nothing to chase is a mode
 * nobody replays.
 */
export type ExtraMode = 'inverted' | 'blind_target' | 'blind_sliders';

export const EXTRA_MODES: ExtraMode[] = ['inverted', 'blind_target', 'blind_sliders'];
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'extreme'];

export const isExtraMode = (value: unknown): value is ExtraMode =>
  EXTRA_MODES.includes(value as ExtraMode);

export const isDifficulty = (value: unknown): value is Difficulty =>
  DIFFICULTIES.includes(value as Difficulty);

/**
 * What a board can be filtered to. `'all'` is the default view: one row per
 * player still, but their best round at *any* difficulty, labelled with the one
 * it was set at.
 */
export type BoardDifficulty = Difficulty | 'all';

export const isBoardDifficulty = (value: unknown): value is BoardDifficulty =>
  value === 'all' || isDifficulty(value);

/**
 * The colour Inverted shows you during memorization.
 *
 * Hue across the wheel and lightness flipped, saturation untouched — which
 * makes it an involution: complement(complement(c)) is c again. That matters,
 * because "invert it back yourself" has to be a single well-defined move rather
 * than a guess at what the page did to the colour.
 */
export function complement(color: HSLColor): HSLColor {
  return { h: (color.h + 180) % 360, s: color.s, l: 100 - color.l };
}

/**
 * Signing key for round tokens.
 *
 * Falls back to a per-process random key rather than a constant: a missing
 * JWT_SECRET must not quietly leave every token forgeable. The cost of the
 * fallback is that tokens stop verifying across a restart, which costs a player
 * one round.
 */
const SIGNING_KEY = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

/** Long enough for the slowest difficulty plus a phone locking mid-round. */
const TOKEN_TTL_MS = 15 * 60 * 1000;

interface RoundClaim {
  /** mode */ m: ExtraMode;
  /** difficulty */ d: Difficulty;
  h: number;
  s: number;
  l: number;
  /** user the round was issued to */ u: string;
  /** issued at */ t: number;
}

const mac = (body: string): string =>
  crypto.createHmac('sha256', SIGNING_KEY).update(body).digest('base64url');

function signRound(claim: RoundClaim): string {
  const body = Buffer.from(JSON.stringify(claim)).toString('base64url');
  return `${body}.${mac(body)}`;
}

/**
 * Reads a round token back, or null if it is anything other than one this
 * process issued inside the TTL.
 *
 * The target colour rides in the token instead of in a table because Blind's
 * whole premise is that the client never sees it: the legacy `/game/submit`
 * flow has the browser post the original colour back, which would make
 * "guess a colour you were never shown" a one-line cheat.
 */
export function readRoundToken(token: unknown): RoundClaim | null {
  if (typeof token !== 'string' || token.length > 512) return null;

  const dot = token.indexOf('.');
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = mac(body);

  // Length first — timingSafeEqual throws rather than returning false when the
  // two buffers differ in size.
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  let claim: any;
  try {
    claim = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!claim || !isExtraMode(claim.m) || !isDifficulty(claim.d)) return null;
  if (typeof claim.u !== 'string' || typeof claim.t !== 'number') return null;
  if (Date.now() - claim.t > TOKEN_TTL_MS) return null;
  if (!validateHSL({ h: claim.h, s: claim.s, l: claim.l })) return null;

  return claim as RoundClaim;
}

const num = (value: any, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const int = (value: any): number => Math.trunc(num(value));
const round3 = (value: any): number => Math.round(num(value) * 1000) / 1000;

/** Same escaping as the competitive board: `%` and `_` are ILIKE wildcards. */
const likePattern = (term: string): string => `%${term.replace(/[#%_]/g, ch => `#${ch}`)}%`;

export interface BoardFilters {
  mode: ExtraMode;
  difficulty: BoardDifficulty;
  search?: string;
  limit: number;
  offset: number;
}

export class ModesService {
  /**
   * Starts a round. The target never leaves this function except inside the
   * token; what the client is allowed to *see* is returned separately.
   */
  static startRound(userId: string, mode: ExtraMode, difficulty: Difficulty) {
    const config = DIFFICULTY_CONFIGS[difficulty];
    const target = generateRandomColor(config.saturationRange, config.lightnessRange);

    // Inverted shows the complement, Blind's grey variant shows the real colour,
    // and Blind's no-target variant shows nothing at all.
    const shown =
      mode === 'inverted' ? complement(target) : mode === 'blind_sliders' ? target : null;

    return {
      token: signRound({
        m: mode,
        d: difficulty,
        h: target.h,
        s: target.s,
        l: target.l,
        u: userId,
        t: Date.now(),
      }),
      shownColor: shown,
      config: {
        colorTimeSeconds: config.colorTimeSeconds,
        roundTimeSeconds: config.roundTimeSeconds,
        negThreshold: config.negThreshold,
      },
    };
  }

  /** Scores a submission against the token's target and records it. */
  static async submitRound(userId: string, claim: RoundClaim, guess: HSLColor) {
    const target: HSLColor = { h: claim.h, s: claim.s, l: claim.l };
    const accuracy = calculateAccuracy(target, guess);

    // Read the old best before inserting, so "personal best" is a comparison
    // against the player's history rather than against the row just written.
    const previous = await pool.query(
      `SELECT MAX(accuracy) AS best FROM mode_rounds
       WHERE user_id = $1 AND mode = $2 AND difficulty = $3`,
      [userId, claim.m, claim.d]
    );
    const previousBest = previous.rows[0]?.best == null ? null : round3(previous.rows[0].best);

    await pool.query(
      `INSERT INTO mode_rounds
         (user_id, mode, difficulty, accuracy,
          original_h, original_s, original_l, user_h, user_s, user_l)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        userId,
        claim.m,
        claim.d,
        accuracy,
        target.h,
        target.s,
        target.l,
        guess.h,
        guess.s,
        guess.l,
      ]
    );

    const best = previousBest == null ? accuracy : Math.max(previousBest, accuracy);

    // The round is already committed, and these modes are replayable, so an
    // achievement failure must not turn a scored round into a 500. Achievements
    // are recomputed from scratch every sync, so the unlock surfaces next round.
    const newlyUnlocked = await AchievementService.syncAchievements(userId).catch(error => {
      console.error('Extra mode achievement sync failed:', (error as Error).message);
      return [];
    });

    // Where that best now sits on the board, counted over players rather than
    // rows — every board here is best-of-all-attempts.
    const standing = await pool.query(
      `WITH bests AS (
         SELECT user_id, MAX(accuracy) AS best FROM mode_rounds
         WHERE mode = $1 AND difficulty = $2 GROUP BY user_id
       )
       SELECT COUNT(*) FILTER (WHERE best > $3) + 1 AS rank, COUNT(*) AS players FROM bests`,
      [claim.m, claim.d, best]
    );

    return {
      mode: claim.m,
      difficulty: claim.d,
      accuracy,
      originalColor: target,
      userColor: guess,
      previousBest,
      personalBest: best,
      isPersonalBest: previousBest == null || accuracy > previousBest,
      rank: int(standing.rows[0]?.rank) || 1,
      totalPlayers: int(standing.rows[0]?.players),
      newlyUnlocked,
    };
  }

  /**
   * One board: best accuracy per player, for one mode and either a single
   * difficulty or all of them at once.
   *
   * Ranked before the username filter is applied, the same way the competitive
   * board does it, so searching for a player shows their real position instead
   * of "#1 of the one row that matched". Ties break on who reached the score
   * first.
   *
   * Always one row per player, including on the `all` view — a leaderboard where
   * one person can hold four adjacent places is not a ranking. Which difficulty
   * produced that best round travels with the row instead, since on `all` an easy
   * 96% and an extreme 96% are very different achievements.
   */
  static async getBoard(filters: BoardFilters) {
    const limit = Math.min(Math.max(int(filters.limit) || 100, 1), 100);
    const offset = Math.max(int(filters.offset), 0);
    const term = (filters.search ?? '').trim().slice(0, 50);
    const search = term.length > 0 ? likePattern(term) : null;
    const difficulty = filters.difficulty === 'all' ? null : filters.difficulty;

    const query = `
      WITH scoped AS (
        SELECT user_id, difficulty, accuracy, created_at
        FROM mode_rounds
        WHERE mode = $1 AND ($2::text IS NULL OR difficulty = $2)
      ),
      bests AS (
        SELECT user_id, MAX(accuracy) AS best_accuracy, COUNT(*) AS attempts
        FROM scoped
        GROUP BY user_id
      ),
      -- The earliest round that reached the player's best, which hands us both
      -- the tie-break timestamp and the difficulty label in one pass.
      achieved AS (
        SELECT DISTINCT ON (s.user_id)
               s.user_id, s.created_at AS achieved_at, s.difficulty AS best_difficulty
        FROM scoped s
        JOIN bests b ON b.user_id = s.user_id AND s.accuracy = b.best_accuracy
        ORDER BY s.user_id, s.created_at ASC
      ),
      ranked AS (
        SELECT u.id AS user_id, u.username, b.best_accuracy, b.attempts,
               a.achieved_at, a.best_difficulty,
               ROW_NUMBER() OVER (
                 ORDER BY b.best_accuracy DESC, a.achieved_at ASC, u.username ASC
               ) AS board_rank
        FROM bests b
        JOIN users u ON u.id = b.user_id
        LEFT JOIN achieved a ON a.user_id = b.user_id
      )
      SELECT *, COUNT(*) OVER () AS total_matching
      FROM ranked
      WHERE ($3::text IS NULL OR username ILIKE $3 ESCAPE '#')
      ORDER BY board_rank
      LIMIT $4 OFFSET $5`;

    const result = await pool.query(query, [filters.mode, difficulty, search, limit, offset]);

    const entries = result.rows.map((row: any) => ({
      rank: int(row.board_rank),
      userId: row.user_id,
      username: row.username,
      bestAccuracy: round3(row.best_accuracy),
      attempts: int(row.attempts),
      achievedAt: row.achieved_at,
      /** The difficulty this player's best round was played at. */
      difficulty: row.best_difficulty as Difficulty,
    }));

    return {
      entries,
      total: result.rows.length > 0 ? int(result.rows[0].total_matching) : 0,
      limit,
      offset,
      // Echoed back so the client labels what was actually served.
      mode: filters.mode,
      difficulty: filters.difficulty,
    };
  }

  /** Every board's player count and top score, for the board picker. */
  static async getBoardSummary() {
    const result = await pool.query(
      `WITH bests AS (
         SELECT mode, difficulty, user_id, MAX(accuracy) AS best
         FROM mode_rounds GROUP BY mode, difficulty, user_id
       )
       SELECT mode, difficulty, COUNT(*) AS players, MAX(best) AS top_accuracy
       FROM bests GROUP BY mode, difficulty`
    );

    return result.rows.map((row: any) => ({
      mode: row.mode as ExtraMode,
      difficulty: row.difficulty as Difficulty,
      players: int(row.players),
      topAccuracy: round3(row.top_accuracy),
    }));
  }
}
