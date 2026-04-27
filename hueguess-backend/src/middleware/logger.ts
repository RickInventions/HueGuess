import { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const { method, url } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    console.log(`${method} ${url} ${statusCode} - ${duration}ms`);
  });

  next();
};