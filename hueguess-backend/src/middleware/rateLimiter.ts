import type { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const key in store) {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  }
}, 5 * 60 * 1000);

export function rateLimiter(windowMs: number = 60000, maxRequests: number = 60) {
  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${identifier}:${req.path}`;
    const now = Date.now();
    
    if (!store[key] || store[key].resetTime < now) {
      store[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
      next();
      return;
    }
    
    store[key].count++;
    
    const remaining = maxRequests - store[key].count;
    const resetInSeconds = Math.ceil((store[key].resetTime - now) / 1000);
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining));
    res.setHeader('X-RateLimit-Reset', Math.ceil(store[key].resetTime / 1000));
    
    if (store[key].count > maxRequests) {
      res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again in ${resetInSeconds}s`,
        retryAfter: resetInSeconds,
      });
      return;
    }
    
    next();
  };
}

// Stricter limiter for auth routes (prevent brute force)
export function authRateLimiter() {
  return rateLimiter(15 * 60 * 1000, 10); // 10 attempts per 15 minutes
}

// Strict limiter for game submission (prevent spam)
export function gameSubmitLimiter() {
  return rateLimiter(60000, 20); // 20 submissions per minute
}