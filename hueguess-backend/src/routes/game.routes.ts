import { Router } from 'express';
import { GameService } from '../services/game.service.js';
import { EloService } from '../services/elo.service.js';
import { optionalAuth, requireAuth, requireVerified } from '../middleware/auth.middleware.js';
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

    // For competitive, require auth + verified email
    if (mode === 'competitive') {
      if (!req.userId) {
        res.status(401).json({ error: 'Authentication required for competitive mode' });
        return;
      }

      // Check email verification
      const { query: dbQuery } = await import('../config/db.js');
      const userResult = await dbQuery('SELECT is_verified FROM users WHERE id = $1', [req.userId]);
      
      if (userResult.rows.length === 0 || !userResult.rows[0].is_verified) {
        res.status(403).json({
          error: 'Email verification required',
          message: 'Please verify your email to play competitive mode'
        });
        return;
      }

      // Check difficulty gating
      const stats = await EloService.getOrCreateStats(req.userId);
      const gate = EloService.canPlayDifficulty(stats.rank_tier, difficulty);
      
      if (!gate.allowed) {
        res.status(403).json({
          error: 'Difficulty locked',
          message: gate.message,
          unlockedDifficulties: gate.unlockedDifficulties,
          currentTier: stats.rank_tier,
        });
        return;
      }

      difficulty = difficulty as 'easy' | 'medium' | 'hard';
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

    // If competitive mode, update ELO
    let ratingChange = null;
    if (req.userId && result.score !== undefined) {
      // Determine difficulty from round
      const { query } = await import('../config/db.js');
      const roundResult = await query(
        'SELECT mode, difficulty FROM game_rounds WHERE id = $1',
        [roundId]
      );

      if (roundResult.rows[0]?.mode === 'competitive' && roundResult.rows[0]?.difficulty) {
        ratingChange = await EloService.updateStatsAfterGame(
          req.userId,
          result.accuracy,
          result.score,
          roundResult.rows[0].difficulty,
          roundId
        );
      }
    }

    res.json({
      ...result,
      ratingChange: ratingChange || undefined,
    });
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