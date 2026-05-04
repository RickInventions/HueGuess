import { Router } from 'express';
import { EloService } from '../services/elo.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

// GET /api/stats/me
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const playerData = await EloService.getPlayerStats(req.userId!);
    
    const unlockedDifficulties = EloService.getUnlockedDifficulties(playerData.stats.rank_tier);
    
    res.json({
      stats: {
        rating: playerData.stats.rating,
        rankTier: playerData.stats.rank_tier,
        gamesPlayed: playerData.stats.games_played,
        gamesWon: playerData.stats.games_won,
        avgAccuracy: playerData.stats.avg_accuracy,
        bestScore: playerData.stats.best_score,
        currentStreak: playerData.stats.current_streak,
        bestStreak: playerData.stats.best_streak,
        lastGameAt: playerData.stats.last_game_at,
      },
      unlockedDifficulties,
      ratingHistory: playerData.ratingHistory.map((rh: any) => ({
        ratingBefore: rh.rating_before,
        ratingAfter: rh.rating_after,
        ratingChange: rh.rating_change,
        accuracy: rh.accuracy,
        difficulty: rh.difficulty,
        createdAt: rh.created_at,
      })),
      recentGames: playerData.recentGames.map((game: any) => ({
        id: game.id,
        difficulty: game.difficulty,
        accuracy: game.accuracy,
        originalColor: { h: game.original_h, s: game.original_s, l: game.original_l },
        userColor: { h: game.user_h, s: game.user_s, l: game.user_l },
        createdAt: game.created_at,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get stats';
    res.status(500).json({ error: message });
  }
});

// GET /api/stats/difficulty-check?difficulty=hard
router.get('/difficulty-check', requireAuth, async (req: AuthRequest, res) => {
  try {
    const difficulty = (req.query.difficulty as string) || 'medium';
    const stats = await EloService.getOrCreateStats(req.userId!);
    const gate = EloService.canPlayDifficulty(stats.rank_tier, difficulty);
    
    res.json({
      ...gate,
      currentTier: stats.rank_tier,
      currentRating: stats.rating,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check difficulty';
    res.status(500).json({ error: message });
  }
});

export default router;