import { Request, Response, NextFunction } from 'express';

const ADMIN_KEY = process.env.ADMIN_KEY || 'admin-secret-key-change-this';

export const adminAuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const adminKey = req.headers['x-admin-key'] || req.query.adminKey;
  
  if (!adminKey || adminKey !== ADMIN_KEY) {
    res.status(401).json({ error: 'Invalid or missing admin key' });
    return;
  }
  
  next();
};