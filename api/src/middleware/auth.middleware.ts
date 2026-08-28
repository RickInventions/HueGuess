import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types/index.js';
import { AuthService } from '../services/auth.service.js';

const JWT_SECRET = process.env.JWT_SECRET!;

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const optionalAuthMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      req.user = decoded;
    } catch (error) {
      // Invalid token - just continue without user
      console.error('Optional auth token invalid:', error);
    }
  }
  
  next();
};

/**
 * Gate for verified-only routes.
 *
 * Reads the flag from the database rather than the token's `isVerified` claim.
 * The claim is fixed at login and cannot know about a verification that happened
 * afterwards, which is how freshly-verified users ended up being told to verify
 * an address the database had already confirmed.
 */
export const requireVerified = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  try {
    if (!(await AuthService.isVerified(String(userId)))) {
      res.status(403).json({ error: 'Email verification required', code: 'EMAIL_NOT_VERIFIED' });
      return;
    }
    next();
  } catch (error) {
    console.error('requireVerified error:', error);
    res.status(500).json({ error: 'Could not check verification status' });
  }
};