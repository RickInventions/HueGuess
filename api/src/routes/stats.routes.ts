import { Router } from 'express';
import { CompetitiveService } from '../services/competitive.service.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

// Get my stats
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const stats = await CompetitiveService.getUserStats(req.user!.userId);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get rank thresholds (public)
router.get('/rank-thresholds', (req, res) => {
  res.json({
    bronze: 0,
    silver: 300,
    gold: 700,
    platinum: 1400,
    diamond: 2500,
  });
});

export default router;