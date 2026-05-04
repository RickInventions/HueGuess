import { Router } from 'express';
import { LeaderboardService } from '../services/leaderboard.service.js';
import { optionalAuth } from '../middleware/auth.middleware.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

// GET /api/leaderboard?period=daily|weekly|all-time
router.get('/', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const period = (req.query.period as string) || 'all-time';
    const validPeriods = ['daily', 'weekly', 'all-time'];
    
    if (!validPeriods.includes(period)) {
      res.status(400).json({ error: `Invalid period. Must be one of: ${validPeriods.join(', ')}` });
      return;
    }
    
    const leaderboard = await LeaderboardService.getLeaderboard(period as 'daily' | 'weekly' | 'all-time');
    
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

export default router;