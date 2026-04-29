import type { Request, Response, NextFunction } from 'express';
import { competitiveSubmitSchema, leaderboardQuerySchema } from './competitive.schema.js';
import * as competitiveService from './competitive.service.js';
import * as gameService from '../game/game.service.js';

export async function startCompetitiveRound(req: Request, res: Response, next: NextFunction) {
  try {
    // Generate color with 3-second memorization time for competitive
    const result = gameService.startRound({ mode: 'competitive', difficulty: 'medium' });
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function submitCompetitiveRound(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId;
    const { roundId, h, s, l, memorizationTime } = competitiveSubmitSchema.parse(req.body);
    
    // Get the original color from the round
    const round = (gameService as any).activeRounds?.get(roundId);
    if (!round) {
      return res.status(404).json({
        success: false,
        error: 'Round not found or expired',
      });
    }
    
    const result = await competitiveService.submitCompetitiveRound(
      userId,
      roundId,
      round.originalColor,
      { h, s, l },
      memorizationTime
    );
    
    // Clean up round
    gameService.cleanupRound(roundId);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getLeaderboard(req: Request, res: Response, next: NextFunction) {
  try {
    const { period, limit } = leaderboardQuerySchema.parse(req.query);
    const leaderboard = await competitiveService.getLeaderboard(period, limit);
    
    res.json({
      success: true,
      data: {
        period,
        entries: leaderboard,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getUserStats(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId;
    const stats = await competitiveService.getUserStats(userId);
    
    if (!stats) {
      return res.status(404).json({
        success: false,
        error: 'No competitive stats found. Play some games first!',
      });
    }
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
}