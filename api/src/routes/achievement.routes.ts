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
    const unseenCount = await AchievementService.getUnseenCount(req.user!.userId);
    const recent = await AchievementService.getRecentUnlocked(req.user!.userId, 10);
    
    res.json({
      success: true,
      ...achievements,
      stats,
      unseenCount,  // NEW - number for badge
      recent,
    });
  } catch (error) {
    console.error('Get my achievements error:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// Get recent UNSEEN unlocked achievements (for notifications)
router.get('/recent/unseen', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const recent = await AchievementService.getRecentUnseenUnlocked(req.user!.userId);
    res.json({ success: true, recent });
  } catch (error) {
    console.error('Get recent unseen achievements error:', error);
    res.status(500).json({ error: 'Failed to fetch recent achievements' });
  }
});

// Mark specific achievements as seen
router.post('/mark-seen', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { achievementKeys } = req.body;
    
    if (!achievementKeys || !Array.isArray(achievementKeys)) {
      res.status(400).json({ error: 'achievementKeys array required' });
      return;
    }
    
    await AchievementService.markAchievementsAsSeen(req.user!.userId, achievementKeys);
    const remainingUnseen = await AchievementService.getUnseenCount(req.user!.userId);
    
    res.json({ 
      success: true, 
      message: 'Achievements marked as seen',
      remainingUnseen 
    });
  } catch (error) {
    console.error('Mark achievements seen error:', error);
    res.status(500).json({ error: 'Failed to mark achievements as seen' });
  }
});

// Mark ALL achievements as seen (when achievements page is opened)
router.post('/mark-all-seen', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await AchievementService.markAllRecentAsSeen(req.user!.userId);
    res.json({ 
      success: true, 
      message: 'All achievements marked as seen' 
    });
  } catch (error) {
    console.error('Mark all achievements seen error:', error);
    res.status(500).json({ error: 'Failed to mark achievements as seen' });
  }
});

// Get unseen count only (for navbar badge)
router.get('/unseen-count', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const count = await AchievementService.getUnseenCount(req.user!.userId);
    res.json({ success: true, count });
  } catch (error) {
    console.error('Get unseen count error:', error);
    res.status(500).json({ error: 'Failed to get unseen count' });
  }
});

export default router;