import pool from './db.js';
import { RANK_LADDER, getRankTier } from '../utils/rank.utils.js';
import { VoiceService } from '../services/voice.service.js';

/**
 * Idempotent schema work, run once at boot.
 *
 * This project has no migration tool — the schema was built directly against the
 * database — so anything new has to create itself on startup. Every statement
 * here must be safe to run against a database that already has it applied.
 */

const USER_ID_TYPES = new Set(['uuid', 'text', 'integer', 'bigint', 'character varying']);

/**
 * The declared type of `users.id`, so the foreign keys below match it.
 *
 * Read rather than assumed: this schema was built by hand outside the repo, and
 * a guessed `UUID` against a `bigint` column fails the whole bootstrap.
 */
async function userIdType(): Promise<string> {
  const result = await pool.query<{ data_type: string }>(
    `SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id'`
  );

  const found = result.rows[0]?.data_type;
  if (!found) throw new Error('users.id not found — cannot create friendships table');
  if (!USER_ID_TYPES.has(found)) throw new Error(`Unexpected users.id type: ${found}`);
  return found;
}

/** `id` is BIGSERIAL so the table needs no uuid-generation extension. */
function friendshipSchema(idType: string): string {
  return `
  CREATE TABLE IF NOT EXISTS friendships (
    id           BIGSERIAL PRIMARY KEY,
    requester_id ${idType} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id ${idType} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status       TEXT NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    CONSTRAINT friendships_status_check CHECK (status IN ('pending', 'accepted')),
    CONSTRAINT friendships_no_self CHECK (requester_id <> addressee_id)
  );

  -- One row per pair regardless of who asked: the index is on the ordered pair,
  -- so A→B and B→A cannot both exist.
  CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_idx
    ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

  CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON friendships (addressee_id, status);
  CREATE INDEX IF NOT EXISTS friendships_requester_idx ON friendships (requester_id, status);
`;
}

/**
 * Rewrite every stored rank label onto the current ladder.
 *
 * `rank_tier` is a denormalised display string, so a ladder change leaves it
 * stale until each player's next competitive game. Ranks are recomputed here in
 * one pass per division rather than row by row.
 *
 * Exported because it is also the only meaningful "refresh the leaderboard"
 * action there is — the board itself is read live, nothing is materialised.
 */
export async function backfillRankTiers(): Promise<number> {
  let updated = 0;

  for (const band of RANK_LADDER) {
    const isTop = band === RANK_LADDER[RANK_LADDER.length - 1];
    const span = band.max - band.min + 1;

    for (let index = 0; index < band.divisions; index++) {
      const floor = band.min + Math.floor((span * index) / band.divisions);
      const ceiling = band.min + Math.floor((span * (index + 1)) / band.divisions) - 1;
      const label = getRankTier(floor);
      const last = index === band.divisions - 1;

      // The top division of the top tier absorbs anything above the ceiling.
      const result =
        last && isTop
          ? await pool.query(
              `UPDATE competitive_stats SET rank_tier = $1 WHERE rating >= $2 AND rank_tier IS DISTINCT FROM $1`,
              [label, floor]
            )
          : await pool.query(
              `UPDATE competitive_stats SET rank_tier = $1
               WHERE rating >= $2 AND rating <= $3 AND rank_tier IS DISTINCT FROM $1`,
              [label, floor, ceiling]
            );

      updated += result.rowCount ?? 0;
    }
  }

  return updated;
}

/**
 * Columns the achievement rework needs.
 *
 * `sort_order` exists because the catalogue used to be ordered by a
 * `CASE category` with no `ELSE`, which put any category the CASE had not heard
 * of in an arbitrary place. The seed script assigns it, so display order is
 * decided in one readable list rather than by a SQL expression.
 */
const ACHIEVEMENT_COLUMNS = `
  ALTER TABLE achievements ADD COLUMN IF NOT EXISTS tier       TEXT    DEFAULT 'bronze';
  ALTER TABLE achievements ADD COLUMN IF NOT EXISTS points     INTEGER DEFAULT 10;
  ALTER TABLE achievements ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

  -- Up to three keys the player pins to their profile. A JSONB array rather than
  -- a join table: it is ordered, capped at three, and only ever read as a whole.
  ALTER TABLE users ADD COLUMN IF NOT EXISTS showcase_achievements JSONB DEFAULT '[]'::jsonb;
`;

/**
 * Runs the bootstrap. Never throws: a database that is briefly unreachable at
 * boot should not stop the server from coming up and serving what it can.
 */
export async function bootstrapSchema(): Promise<void> {
  try {
    await pool.query(friendshipSchema(await userIdType()));
    console.log('✅ Friendship schema ready');
  } catch (error) {
    console.error('❌ Friendship schema failed:', (error as Error).message);
  }

  try {
    await pool.query(ACHIEVEMENT_COLUMNS);
    console.log('✅ Achievement schema ready');
  } catch (error) {
    console.error('❌ Achievement schema failed:', (error as Error).message);
  }

  try {
    const updated = await backfillRankTiers();
    if (updated > 0) console.log(`✅ Rank labels rewritten for ${updated} account(s)`);
    else console.log('✅ Rank labels already current');
  } catch (error) {
    console.error('❌ Rank backfill failed:', (error as Error).message);
  }

  // Rooms live in memory, so every voice note from a room that was open when the
  // process last died is now unreachable — nothing points at it and nothing ever
  // will. Without this sweep they accumulate as billable storage forever.
  try {
    const swept = await VoiceService.sweepOrphans();
    if (swept > 0) console.log(`🧹 Removed ${swept} orphaned voice note(s)`);
  } catch (error) {
    console.error('❌ Voice sweep failed:', (error as Error).message);
  }
}
