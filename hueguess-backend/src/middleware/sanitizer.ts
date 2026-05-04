import type { Request, Response, NextFunction } from 'express';

/**
 * Sanitize and validate color inputs to prevent abuse
 */
export function sanitizeColorInput(req: Request, res: Response, next: NextFunction) {
  const { userColor } = req.body;
  
  if (!userColor) {
    next();
    return;
  }
  
  const { h, s, l } = userColor;
  
  // Check types
  if (typeof h !== 'number' || typeof s !== 'number' || typeof l !== 'number') {
    res.status(400).json({ error: 'Color values must be numbers' });
    return;
  }
  
  // Check for NaN / Infinity
  if (!isFinite(h) || !isFinite(s) || !isFinite(l)) {
    res.status(400).json({ error: 'Color values must be finite numbers' });
    return;
  }
  
  // Clamp aggressively
  req.body.userColor = {
    h: Math.max(0, Math.min(360, Math.round(h * 100) / 100)),
    s: Math.max(0, Math.min(100, Math.round(s * 100) / 100)),
    l: Math.max(0, Math.min(100, Math.round(l * 100) / 100)),
  };
  
  next();
}

/**
 * Sanitize string inputs to prevent injection
 */
export function sanitizeStrings(req: Request, _res: Response, next: NextFunction) {
  const sanitize = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove control characters, limit length
        obj[key] = obj[key]
          .replace(/[\x00-\x1F\x7F]/g, '')
          .trim()
          .substring(0, 1000);
      } else if (typeof obj[key] === 'object') {
        sanitize(obj[key]);
      }
    }
  };
  
  sanitize(req.body);
  sanitize(req.query);
  next();
}

/**
 * Validate UUID format
 */
export function validateUUID(param: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.params[param] || req.body[param] || req.query[param];
    
    if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      res.status(400).json({ error: `Invalid ${param} format` });
      return;
    }
    
    next();
  };
}