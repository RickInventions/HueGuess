import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimits = new Map<string, RateLimitEntry>();

export const rateLimiter = (windowMs: number, maxRequests: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = rateLimits.get(ip);

    if (!entry || now > entry.resetAt) {
      rateLimits.set(ip, {
        count: 1,
        resetAt: now + windowMs,
      });
      next();
      return;
    }

    if (entry.count >= maxRequests) {
      res.status(429).json({ error: 'Too many requests, please try again later' });
      return;
    }

    entry.count++;
    next();
  };
};

// Specific limiters
export const authRateLimiter = rateLimiter(15 * 60 * 1000, 10); // 10 requests per 15 min
export const emailRateLimiter = rateLimiter(60 * 60 * 1000, 10); // 3 requests per hour