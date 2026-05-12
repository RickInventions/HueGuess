import { Router } from 'express';
import { GameService } from '../services/game.service.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware.js';
import { DIFFICULTY_CONFIGS } from '../types/game.types.js';
import { validateHSL } from '../utils/hsl.utils.js';

const router = Router();

// Helper to get user ID from request (if authenticated)
const getUserId = (req: AuthRequest): string | undefined => {
  return req.user?.userId;
};

// Generate a new round (NO auth required for casual)
router.post('/generate', async (req, res) => {
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

// Submit a guess (NO auth required for casual)
router.post('/submit', async (req, res) => {
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
    
    // Save round for competitive mode only (requires auth)
    let roundId = null;
    if (mode !== 'casual') {
      // For competitive/challenge, we need the user to be authenticated
      // Cast req to AuthRequest to access user
      const authReq = req as AuthRequest;
      if (!authReq.user) {
        res.status(401).json({ error: 'Authentication required for competitive mode' });
        return;
      }
      
      roundId = await GameService.saveRound({
        userId: authReq.user.userId,
        mode: mode as any,
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
    }
    
    res.json({
      success: true,
      roundId,
      result: {
        accuracy: result.accuracy,
        score: result.score,
        isNegative: result.isNegative,
        originalColor: result.originalColor,
        userColor: result.userColor,
        multiplier: result.multiplier,
        negThreshold: result.negThreshold,
      },
    });
  } catch (error) {
    console.error('Submit guess error:', error);
    res.status(500).json({ error: 'Failed to process guess' });
  }
});

// Register reload penalty (auth required - need user ID)
router.post('/reload-penalty', async (req, res) => {
  try {
    const { mode, difficulty, originalH, originalS, originalL, memorizationSeconds } = req.body;
    
    // Cast to AuthRequest to check user
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    if (!mode || !difficulty || originalH === undefined) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    
    const roundId = await GameService.registerReloadPenalty(
      authReq.user.userId,
      mode,
      difficulty,
      { h: originalH, s: originalS, l: originalL },
      memorizationSeconds
    );
    
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