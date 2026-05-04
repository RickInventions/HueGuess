import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';
import { query } from '../config/db.js';

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

/**
 * Require verified email for competitive play
 */
export async function requireVerified(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const result = await query('SELECT is_verified FROM users WHERE id = $1', [req.userId]);
    
    if (result.rows.length === 0 || !result.rows[0].is_verified) {
      res.status(403).json({ 
        error: 'Email verification required',
        message: 'Please verify your email to play competitive mode'
      });
      return;
    }
    
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify user status' });
  }
}