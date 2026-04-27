import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/errorHandler.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401);
    }

    const token = authHeader.split(' ')[1];
    
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      userId: string;
    };

    req.userId = decoded.userId;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Token expired', 401));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid token', 401));
    } else {
      next(error);
    }
  }
};

export const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      userId: string;
    };

    req.userId = decoded.userId;
    next();
  } catch {
    // Token invalid, but it's okay since auth is optional
    next();
  }
};