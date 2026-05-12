import pool from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

async function refreshLeaderboard() {
  try {
    console.log('Refreshing leaderboard materialized views...');
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_all_time');
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_weekly');
    console.log('✅ Leaderboard refreshed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Failed to refresh leaderboard:', error);
    process.exit(1);
  }
}

refreshLeaderboard();