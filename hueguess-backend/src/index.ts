import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { testConnection } from './db/connection.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logger.js';
import { authRoutes } from './modules/auth/index.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS),
  max: parseInt(env.RATE_LIMIT_MAX_REQUESTS),
  message: { status: 'error', message: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(requestLogger);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const start = async () => {
  await testConnection();
  
  app.listen(parseInt(env.PORT), () => {
    console.log(`\n🚀 Server running on port ${env.PORT}`);
    console.log(`📍 Environment: ${env.NODE_ENV}`);
    console.log(`🌐 CORS origin: ${env.CORS_ORIGIN}\n`);
  });
};

start().catch(console.error);

export default app;