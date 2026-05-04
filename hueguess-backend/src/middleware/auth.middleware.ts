import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';

export interface AuthRequest extends Request {
  userId?: string;
  username?: string;
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = AuthService.verifyToken(token);
      req.userId = payload.userId;
      req.username = payload.username;
    } catch (err) {
      // Token invalid — proceed without auth
    }
  }
  
  next();
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const payload = AuthService.verifyToken(token);
    req.userId = payload.userId;
    req.username = payload.username;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
}