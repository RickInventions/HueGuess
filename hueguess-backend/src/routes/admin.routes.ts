import { Router } from 'express';
import { query } from '../config/db.js';
import { LeaderboardService } from '../services/leaderboard.service.js';

const router = Router();

// GET /api/admin/health — detailed health check
router.get('/health', async (_req, res) => {
  try {
    const dbCheck = await query('SELECT 1 as healthy');
    const statsCheck = await query('SELECT COUNT(*) FROM competitive_stats');
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: {
        connected: dbCheck.rows[0]?.healthy === 1,
        competitivePlayers: parseInt(statsCheck.rows[0]?.count) || 0,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/admin/refresh-leaderboard — refresh materialized view
router.post('/refresh-leaderboard', async (_req, res) => {
  try {
    await LeaderboardService.refreshMaterializedView();
    res.json({ message: 'Leaderboard refreshed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to refresh';
    res.status(500).json({ error: message });
  }
});

// POST /api/admin/cleanup-casual — remove old casual games
router.post('/cleanup-casual', async (req, res) => {
  try {
    const daysOld = parseInt(req.query.days as string) || 90;
    
    const result = await query(
      `DELETE FROM game_rounds 
       WHERE mode = 'casual' 
       AND created_at < NOW() - INTERVAL '1 day' * $1
       RETURNING id`,
      [daysOld]
    );
    
    res.json({
      message: `Cleaned up ${result.rowCount} casual games older than ${daysOld} days`,
      deleted: result.rowCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cleanup failed';
    res.status(500).json({ error: message });
  }
});

export default router;