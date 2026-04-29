import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import gameRoutes from './modules/game/game.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import competitiveRoutes from './modules/competitive/competitive.routes.js';

const app = express();

// Middleware
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());
app.use(requestLogger);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/round', gameRoutes);
app.use('/api/competitive', competitiveRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler (must be last)
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`\n🎨 HueGuess API running on http://localhost:${env.PORT}`);
  console.log(`📝 Mode: ${env.NODE_ENV}`);
  console.log(`🌐 CORS: ${env.CORS_ORIGIN}\n`);
});

export default app;