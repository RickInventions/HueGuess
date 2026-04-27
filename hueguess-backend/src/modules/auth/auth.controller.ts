import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service.js';
import { registerSchema, loginSchema, guestRegisterSchema } from './auth.schema.js';
import { AppError } from '../../middleware/errorHandler.js';
import { sendSuccess } from '@/utils/reponse.js';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = registerSchema.parse(req.body);
    const result = await authService.registerUser(validated);
    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = loginSchema.parse(req.body);
    const result = await authService.loginUser(validated);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const guestLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = guestRegisterSchema.parse(req.body);
    const result = await authService.createGuestUser(validated.username);
    sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400);
    }

    const tokens = await authService.refreshAccessToken(refreshToken);
    sendSuccess(res, tokens);
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getUserById(req.userId!);
    sendSuccess(res, { user });
  } catch (error) {
    next(error);
  }
};