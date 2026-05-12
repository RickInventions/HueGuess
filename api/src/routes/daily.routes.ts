import { Router } from 'express';
import { DailyChallengeService } from '../services/daily.service.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware.js';
import { validateHSL } from '../utils/hsl.utils.js';

const router = Router();

// Get today's challenge
router.get('/today', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const challenge = await DailyChallengeService.getTodayChallenge();
    const hasCompleted = await DailyChallengeService.hasUserCompleted(
      req.user!.userId,
      challenge.id
    );
    const userSubmission = hasCompleted 
      ? await DailyChallengeService.getUserSubmission(req.user!.userId, challenge.id)
      : null;
    const globalAvg = await DailyChallengeService.getGlobalAverage(challenge.id);
    const timeUntilNext = DailyChallengeService.getTimeUntilNextChallenge();
    
    res.json({
      success: true,
      challenge: {
        id: challenge.id,
        date: challenge.date,
        color: challenge.color,
        difficulty: challenge.difficulty,
      },
      hasCompleted,
      userSubmission,
      globalAverage: Math.round(globalAvg * 100) / 100,
      timeUntilNext,
    });
  } catch (error) {
    console.error('Get daily challenge error:', error);
    res.status(500).json({ error: 'Failed to fetch daily challenge' });
  }
});

// Submit daily challenge guess (ONCE ONLY)
router.post('/submit', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { challengeId, userH, userS, userL, timeTakenMs } = req.body;
    
    if (!challengeId || userH === undefined || userS === undefined || userL === undefined) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    
    const userColor = { h: userH, s: userS, l: userL };
    if (!validateHSL(userColor)) {
      res.status(400).json({ error: 'Invalid HSL values' });
      return;
    }
    
    const result = await DailyChallengeService.submitGuess(
      req.user!.userId,
      challengeId,
      userColor,
      timeTakenMs || 0
    );
    
    // Get updated leaderboard
    const leaderboard = await DailyChallengeService.getDailyLeaderboard(challengeId, 50);
    const globalAvg = await DailyChallengeService.getGlobalAverage(challengeId);
    const timeUntilNext = DailyChallengeService.getTimeUntilNextChallenge();
    
    res.json({
      success: true,
      result,
      leaderboard,
      globalAverage: Math.round(globalAvg * 100) / 100,
      timeUntilNext,
    });
  } catch (error) {
    console.error('Submit daily challenge error:', error);
    const message = (error as Error).message;
    if (message.includes('already completed')) {
      res.status(400).json({ error: message });
    } else {
      res.status(500).json({ error: 'Failed to submit daily challenge' });
    }
  }
});

// Get daily challenge leaderboard
router.get('/leaderboard/:challengeId', async (req, res) => {
  try {
    const { challengeId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const leaderboard = await DailyChallengeService.getDailyLeaderboard(challengeId, limit);
    const globalAvg = await DailyChallengeService.getGlobalAverage(challengeId);
    
    res.json({
      success: true,
      leaderboard,
      globalAverage: Math.round(globalAvg * 100) / 100,
    });
  } catch (error) {
    console.error('Daily leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;