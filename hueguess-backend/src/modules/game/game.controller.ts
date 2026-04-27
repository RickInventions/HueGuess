import type { Request, Response, NextFunction } from 'express';
import { startRoundSchema, submitColorSchema } from './game.schema.js';
import * as gameService from './game.service.js';

export async function startRoundHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const params = startRoundSchema.parse(req.body);
    const result = gameService.startRound(params);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function submitHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { roundId, h, s, l } = submitColorSchema.parse(req.body);
    const result = gameService.submitAndGetResult(roundId, { h, s, l });
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}