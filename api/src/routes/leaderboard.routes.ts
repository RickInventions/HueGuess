import { Router } from 'express';
import { LeaderboardService } from '../services/leaderboard.service.js';

const router = Router();

// Get leaderboard
router.get('/', async (req, res) => {
  try {
    const period = (req.query.period as any) || 'all-time';
    const sortBy = (req.query.sortBy as any) || 'points';
    const sortOrder = (req.query.sortOrder as any) || 'DESC';
    const search = req.query.search as string;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    
    // Validate inputs
    const validPeriods = ['all-time', 'weekly', 'daily'];
    const validSortBy = ['points', 'gamesPlayed', 'avgAccuracy', 'streak'];
    const validSortOrder = ['ASC', 'DESC'];
    
    if (!validPeriods.includes(period)) {
      res.status(400).json({ error: 'Invalid period' });
      return;
    }
    
    if (!validSortBy.includes(sortBy)) {
      res.status(400).json({ error: 'Invalid sortBy' });
      return;
    }
    
    if (!validSortOrder.includes(sortOrder)) {
      res.status(400).json({ error: 'Invalid sortOrder' });
      return;
    }
    
    const leaderboard = await LeaderboardService.getLeaderboard({
      period,
      sortBy,
      sortOrder,
      search,
      limit: Math.min(limit, 100), // Max 100 per page
      offset,
    });
    
    const globalStats = await LeaderboardService.getGlobalStats();
    const awards = await LeaderboardService.getAwardEmblems();
    const top10 = await LeaderboardService.getTop10Players();
    
    res.json({
      success: true,
      leaderboard,
      globalStats,
      awards,
      top10,
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get awards only (for quick display)
router.get('/awards', async (req, res) => {
  try {
    const awards = await LeaderboardService.getAwardEmblems();
    const top10 = await LeaderboardService.getTop10Players();
    
    res.json({
      success: true,
      awards,
      top10,
    });
  } catch (error) {
    console.error('Awards error:', error);
    res.status(500).json({ error: 'Failed to fetch awards' });
  }
});

// Get global stats only
router.get('/global-stats', async (req, res) => {
  try {
    const stats = await LeaderboardService.getGlobalStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Global stats error:', error);
    res.status(500).json({ error: 'Failed to fetch global stats' });
  }
});

export default router;