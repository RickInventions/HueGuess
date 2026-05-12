import { Router } from 'express';
import { AchievementService } from '../services/achievement.service.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

// Get all achievements
router.get('/', async (req, res) => {
  try {
    const achievements = await AchievementService.getAllAchievements();
    res.json({ success: true, achievements });
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// Get my achievements (unlocked + locked with progress)
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const achievements = await AchievementService.getUserAchievements(req.user!.userId);
    const stats = await AchievementService.getAchievementStats(req.user!.userId);
    const recent = await AchievementService.getRecentUnlocked(req.user!.userId);
    
    res.json({
      success: true,
      ...achievements,
      stats,
      recent,
    });
  } catch (error) {
    console.error('Get my achievements error:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// Get recent unlocked achievements (for notifications)
router.get('/recent', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const recent = await AchievementService.getRecentUnlocked(req.user!.userId);
    res.json({ success: true, recent });
  } catch (error) {
    console.error('Get recent achievements error:', error);
    res.status(500).json({ error: 'Failed to fetch recent achievements' });
  }
});

export default router;