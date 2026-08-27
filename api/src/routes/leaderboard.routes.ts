import { Router } from 'express';
import {
  LeaderboardService,
  MIN_RANKED_GAMES,
  type LeaderboardPeriod,
  type LeaderboardSortBy,
  type SortOrder,
} from '../services/leaderboard.service.js';

const router = Router();

const VALID_PERIODS: LeaderboardPeriod[] = ['all-time', 'weekly', 'daily'];
const VALID_SORT_BY: LeaderboardSortBy[] = ['points', 'gamesPlayed', 'avgAccuracy', 'streak'];
const VALID_SORT_ORDER: SortOrder[] = ['ASC', 'DESC'];

/** `parseInt('') || fallback` turns a deliberate 0 into the fallback, so parse explicitly. */
function toInt(value: unknown, fallback: number): number {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Get leaderboard
router.get('/', async (req, res) => {
  try {
    const period = (req.query.period as LeaderboardPeriod) || 'all-time';
    const sortBy = (req.query.sortBy as LeaderboardSortBy) || 'points';
    const sortOrder = ((req.query.sortOrder as string) || 'DESC').toUpperCase() as SortOrder;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;

    if (!VALID_PERIODS.includes(period)) {
      res.status(400).json({ error: 'Invalid period' });
      return;
    }

    if (!VALID_SORT_BY.includes(sortBy)) {
      res.status(400).json({ error: 'Invalid sortBy' });
      return;
    }

    if (!VALID_SORT_ORDER.includes(sortOrder)) {
      res.status(400).json({ error: 'Invalid sortOrder' });
      return;
    }

    const [leaderboard, globalStats, awards, top10] = await Promise.all([
      LeaderboardService.getLeaderboard({
        period,
        sortBy,
        sortOrder,
        search,
        // Clamped in the service too, but bound it here so a hostile limit never
        // reaches the query planner.
        limit: Math.min(Math.max(toInt(req.query.limit, 100), 1), 100),
        offset: Math.max(toInt(req.query.offset, 0), 0),
      }),
      LeaderboardService.getGlobalStats(),
      LeaderboardService.getAwardEmblems(),
      LeaderboardService.getTop10Players(),
    ]);

    res.json({
      success: true,
      leaderboard,
      globalStats,
      awards,
      top10,
      minRankedGames: MIN_RANKED_GAMES,
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get awards only (for quick display)
router.get('/awards', async (_req, res) => {
  try {
    const [awards, top10] = await Promise.all([
      LeaderboardService.getAwardEmblems(),
      LeaderboardService.getTop10Players(),
    ]);

    res.json({ success: true, awards, top10, minRankedGames: MIN_RANKED_GAMES });
  } catch (error) {
    console.error('Awards error:', error);
    res.status(500).json({ error: 'Failed to fetch awards' });
  }
});

// Get global stats only
router.get('/global-stats', async (_req, res) => {
  try {
    const stats = await LeaderboardService.getGlobalStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Global stats error:', error);
    res.status(500).json({ error: 'Failed to fetch global stats' });
  }
});

export default router;
