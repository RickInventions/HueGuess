import dotenv from 'dotenv';
import pool from '../config/db.js';
import { backfillRankTiers } from '../config/bootstrap.js';

dotenv.config();

/**
 * There are no leaderboard materialized views — every ranking is read live from
 * competitive_stats. The one piece of denormalised data that can drift is the
 * stored `rank_tier` label, so that is what this reconciles.
 */
async function refreshLeaderboard() {
  try {
    console.log('Reconciling stored rank labels with the current ladder...');
    const updated = await backfillRankTiers();
    console.log(
      updated > 0
        ? `✅ Rank labels rewritten for ${updated} account(s)`
        : '✅ Rank labels already current'
    );
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Failed to refresh leaderboard:', error);
    process.exit(1);
  }
}

refreshLeaderboard();
