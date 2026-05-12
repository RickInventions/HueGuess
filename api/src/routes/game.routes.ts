import { Router } from 'express';
import { GameService } from '../services/game.service.js';
import { CompetitiveService } from '../services/competitive.service.js';
import { authMiddleware, AuthRequest, optionalAuthMiddleware } from '../middleware/auth.middleware.js';
import { DIFFICULTY_CONFIGS } from '../types/game.types.js';
import { validateHSL } from '../utils/hsl.utils.js';

const router = Router();

// Generate a new round (optional auth - casual doesn't need it)
router.post('/generate', optionalAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    const { difficulty } = req.body;
    
    if (!difficulty || !['easy', 'medium', 'hard', 'extreme'].includes(difficulty)) {
      res.status(400).json({ error: 'Invalid difficulty' });
      return;
    }
    
    const config = GameService.getDifficultyConfig(difficulty);
    const color = GameService.generateColorForDifficulty(difficulty);
    
    res.json({
      success: true,
      color,
      config: {
        multiplier: config.multiplier,
        negThreshold: config.negThreshold,
        colorTimeSeconds: config.colorTimeSeconds,
        roundTimeSeconds: config.roundTimeSeconds,
      },
    });
  } catch (error) {
    console.error('Generate round error:', error);
    res.status(500).json({ error: 'Failed to generate round' });
  }
});

// Submit a guess (optional auth - casual doesn't need it, competitive does)
router.post('/submit', optionalAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    const {
      mode,
      difficulty,
      originalH,
      originalS,
      originalL,
      userH,
      userS,
      userL,
      memorizationSeconds,
    } = req.body;
    
    // Validation
    if (!mode || !['casual', 'competitive', 'challenge'].includes(mode)) {
      res.status(400).json({ error: 'Invalid mode' });
      return;
    }
    
    if (!difficulty || !['easy', 'medium', 'hard', 'extreme'].includes(difficulty)) {
      res.status(400).json({ error: 'Invalid difficulty' });
      return;
    }
    
    if (originalH === undefined || originalS === undefined || originalL === undefined) {
      res.status(400).json({ error: 'Missing original color' });
      return;
    }
    
    if (userH === undefined || userS === undefined || userL === undefined) {
      res.status(400).json({ error: 'Missing user color' });
      return;
    }
    
    const original = { h: originalH, s: originalS, l: originalL };
    const user = { h: userH, s: userS, l: userL };
    
    if (!validateHSL(original) || !validateHSL(user)) {
      res.status(400).json({ error: 'Invalid HSL values' });
      return;
    }
    
    // Process the guess
    const result = GameService.processGuess(original, user, difficulty);
    
    // Handle competitive mode (requires auth)
    let roundId = null;
    let huePointsUpdate = null;
    
    if (mode === 'competitive') {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required for competitive mode' });
        return;
      }
      
      // STEP 1: Save the round FIRST to get the roundId
      roundId = await GameService.saveRound({
        userId: req.user.userId,
        mode: 'competitive',
        difficulty,
        originalH,
        originalS,
        originalL,
        userH,
        userS,
        userL,
        memorizationSeconds,
        isReload: false,
      });
      
      // STEP 2: Update competitive stats with the roundId
      huePointsUpdate = await CompetitiveService.updateAfterGame(
        req.user.userId,
        roundId,  // Now passing the roundId
        result.accuracy,
        difficulty
      );
    }
    
    // For casual mode, just return the result (no DB save)
    res.json({
      success: true,
      roundId,
      result: {
        accuracy: result.accuracy,
        isNegative: result.isNegative,
        originalColor: result.originalColor,
        userColor: result.userColor,
        multiplier: result.multiplier,
        negThreshold: result.negThreshold,
        difficulty: result.difficulty,
      },
      ...(huePointsUpdate && {
        huePoints: {
          oldRating: huePointsUpdate.oldRating,
          newRating: huePointsUpdate.newRating,
          change: huePointsUpdate.ratingChange,
          streak: huePointsUpdate.newStreak,
          rankTier: huePointsUpdate.rankTier,
        },
          newlyUnlocked: huePointsUpdate.newlyUnlocked,
      }),
    });
  } catch (error) {
    console.error('Submit guess error:', error);
    res.status(500).json({ error: 'Failed to process guess' });
  }
});

// Register reload penalty (requires auth)
router.post('/reload-penalty', authMiddleware, async (req, res) => {
  try {
    const { mode, difficulty, originalH, originalS, originalL, memorizationSeconds } = req.body;
    const authReq = req as AuthRequest;
    
    if (!authReq.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    if (!mode || !difficulty || originalH === undefined) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    
    // STEP 1: Save the round FIRST
    const roundId = await GameService.registerReloadPenalty(
      authReq.user.userId,
      mode,
      difficulty,
      { h: originalH, s: originalS, l: originalL },
      memorizationSeconds
    );
    
    // STEP 2: Update stats for competitive mode with the roundId
    if (mode === 'competitive') {
      const update = await CompetitiveService.updateAfterGame(
        authReq.user.userId,
        roundId,
        0,  // 0% accuracy for reload
        difficulty
      );
      
      res.json({
        success: true,
        roundId,
        message: 'Reload penalty registered (0% accuracy)',
        huePoints: {
          oldRating: update.oldRating,
          newRating: update.newRating,
          change: update.ratingChange,
          streak: update.newStreak,
          rankTier: update.rankTier,
        },
      });
      return;
    }
    
    res.json({
      success: true,
      roundId,
      message: 'Reload penalty registered (0% accuracy)',
    });
  } catch (error) {
    console.error('Reload penalty error:', error);
    res.status(500).json({ error: 'Failed to register reload penalty' });
  }
});

// Get difficulty configurations (public)
router.get('/difficulties', (req, res) => {
  const configs = {
    easy: DIFFICULTY_CONFIGS.easy,
    medium: DIFFICULTY_CONFIGS.medium,
    hard: DIFFICULTY_CONFIGS.hard,
    extreme: DIFFICULTY_CONFIGS.extreme,
  };
  res.json(configs);
});

export default router;