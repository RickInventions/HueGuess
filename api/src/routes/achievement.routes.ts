import { Router } from 'express';
import { AchievementService } from '../services/achievement.service.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

/** Keep in step with the picker's cap in the frontend. */
const MAX_SHOWCASE = 3;

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
    const userId = req.user!.userId;

    // In parallel: getUserAchievements syncs first, and the rest only read, so
    // there is no ordering requirement between them.
    const [achievements, stats, unseenCount, unseenKeys, recent, showcase] = await Promise.all([
      AchievementService.getUserAchievements(userId),
      AchievementService.getAchievementStats(userId),
      AchievementService.getUnseenCount(userId),
      AchievementService.getUnseenKeys(userId),
      AchievementService.getRecentUnlocked(userId, 10),
      AchievementService.getShowcase(userId),
    ]);

    res.json({
      success: true,
      ...achievements,
      stats,
      unseenCount,  // NEW - number for badge
      unseenKeys,   // which ones to float to the top and highlight
      recent,
      showcase,
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

// The up-to-three achievements pinned to your profile
router.get('/showcase', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const showcase = await AchievementService.getShowcase(req.user!.userId);
    res.json({ success: true, showcase });
  } catch (error) {
    console.error('Get showcase error:', error);
    res.status(500).json({ error: 'Failed to fetch showcase' });
  }
});

router.put('/showcase', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { keys } = req.body;

    if (!Array.isArray(keys) || keys.some(k => typeof k !== 'string')) {
      res.status(400).json({ error: 'keys must be an array of achievement keys' });
      return;
    }
    if (keys.length > MAX_SHOWCASE) {
      res.status(400).json({ error: `Pin at most ${MAX_SHOWCASE} achievements` });
      return;
    }

    // The service filters to keys the caller has actually unlocked, so a pin of
    // something locked is dropped rather than rejected — but a request that was
    // *entirely* locked keys is a client bug worth reporting.
    const showcase = await AchievementService.setShowcase(req.user!.userId, keys);
    if (keys.length > 0 && showcase.length === 0) {
      res.status(400).json({ error: 'You have not unlocked those achievements' });
      return;
    }

    res.json({ success: true, showcase });
  } catch (error) {
    console.error('Set showcase error:', error);
    res.status(500).json({ error: 'Failed to update showcase' });
  }
});

export default router;