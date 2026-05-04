import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js';
import gameRoutes from './routes/game.routes.js';
import statsRoutes from './routes/stats.routes.js';
import leaderboardRoutes from './routes/leaderboard.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { rateLimiter, authRateLimiter, gameSubmitLimiter } from './middleware/rateLimiter.js';
import { sanitizeStrings, sanitizeColorInput } from './middleware/sanitizer.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Global middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10kb' })); // Limit request body size
app.use(sanitizeStrings); // Sanitize all string inputs
app.use(rateLimiter(60000, 100)); // Global: 100 requests per minute

// Health check (no rate limit)
app.get('/api/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Routes with specific rate limits
app.use('/api/auth', authRateLimiter(), authRoutes);
app.use('/api/game/submit', gameSubmitLimiter(), sanitizeColorInput);
app.use('/api/game', gameRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  
  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  res.status(500).json({ error: message });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎨 HueGuess API running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

export default app;