import { Router } from 'express';
import { LeaderboardService } from '../services/leaderboard.service.js';
import { EloService } from '../services/elo.service.js';
import { optionalAuth } from '../middleware/auth.middleware.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import type { RankTier } from '../types/index.js';

const router = Router();

// GET /api/leaderboard
// Query params: period=daily|weekly|all-time, page=1, limit=50, tier=Gold, search=username
router.get('/', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const period = (req.query.period as string) || 'all-time';
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const rankTier = req.query.tier as RankTier | undefined;
    const search = req.query.search as string | undefined;
    
    const validPeriods = ['daily', 'weekly', 'all-time'];
    if (!validPeriods.includes(period)) {
      res.status(400).json({ error: `Invalid period. Must be one of: ${validPeriods.join(', ')}` });
      return;
    }
    
    const leaderboard = await LeaderboardService.getLeaderboard({
      period: period as 'daily' | 'weekly' | 'all-time',
      page,
      limit,
      rankTier,
      search,
    });
    
    // If user is authenticated, include their rank
    let playerRank = null;
    if (req.userId) {
      playerRank = await LeaderboardService.getPlayerRank(req.userId);
    }
    
    res.json({
      ...leaderboard,
      playerRank,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get leaderboard';
    res.status(500).json({ error: message });
  }
});

// GET /api/leaderboard/global-stats
router.get('/global-stats', async (_req, res) => {
  try {
    const stats = await LeaderboardService.getGlobalStats();
    res.json(stats);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get stats';
    res.status(500).json({ error: message });
  }
});

// GET /api/leaderboard/top-players
router.get('/top-players', async (_req, res) => {
  try {
    const topPlayers = await EloService.getTopPlayersByTier(3);
    res.json({ topPlayers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get top players';
    res.status(500).json({ error: message });
  }
});

export default router;