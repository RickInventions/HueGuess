import { Router } from 'express';
import { GameService } from '../services/game.service.js';
import { optionalAuth, requireAuth } from '../middleware/auth.middleware.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

// POST /api/game/round
// Query params: ?difficulty=easy|medium|hard&mode=casual|competitive
router.post('/round', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const mode = (req.query.mode as string) || 'casual';
    let difficulty = (req.query.difficulty as string) || 'medium';

    // Casual mode always gets casual difficulty
    if (mode === 'casual') {
      difficulty = 'casual';
    }

    // Validate difficulty
    const validDifficulties = ['easy', 'medium', 'hard', 'casual'];
    if (!validDifficulties.includes(difficulty)) {
      res.status(400).json({ error: `Invalid difficulty. Must be one of: ${validDifficulties.join(', ')}` });
      return;
    }

    // For competitive, require auth
    if (mode === 'competitive' && !req.userId) {
      res.status(401).json({ error: 'Authentication required for competitive mode' });
      return;
    }

    const difficultyKey = difficulty as 'easy' | 'medium' | 'hard' | 'casual';
    const round = await GameService.createRound(
      mode === 'competitive' ? req.userId! : null,
      difficultyKey
    );

    res.status(201).json(round);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create round';
    res.status(500).json({ error: message });
  }
});

// POST /api/game/submit
router.post('/submit', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { roundId, userColor } = req.body;

    if (!roundId || !userColor) {
      res.status(400).json({ error: 'roundId and userColor are required' });
      return;
    }

    if (
      typeof userColor.h !== 'number' ||
      typeof userColor.s !== 'number' ||
      typeof userColor.l !== 'number'
    ) {
      res.status(400).json({ error: 'userColor must have h, s, and l as numbers' });
      return;
    }

    // Clamp values
    const clampedColor = {
      h: Math.max(0, Math.min(360, userColor.h)),
      s: Math.max(0, Math.min(100, userColor.s)),
      l: Math.max(0, Math.min(100, userColor.l)),
    };

    const result = await GameService.submitRound(
      roundId,
      clampedColor,
      req.userId || null
    );

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit round';
    
    if (message.includes('not found')) {
      res.status(404).json({ error: message });
      return;
    }
    if (message.includes('Unauthorized') || message.includes('expired') || message.includes('too fast')) {
      res.status(400).json({ error: message });
      return;
    }
    
    res.status(500).json({ error: message });
  }
});

export default router;