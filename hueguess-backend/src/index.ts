import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { env } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import gameRoutes from './modules/game/game.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import competitiveRoutes from './modules/competitive/competitive.routes.js';
import { setupChallengeSocket } from './modules/challenge/challenge.socket.js';

const app = express();
const httpServer = createServer(app);

// Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());
app.use(requestLogger);

// REST Routes
app.use('/api/auth', authRoutes);
app.use('/api/round', gameRoutes);
app.use('/api/competitive', competitiveRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Setup WebSocket
setupChallengeSocket(io);

// Error handler (must be last)
app.use(errorHandler);

httpServer.listen(env.PORT, () => {
  console.log(`\n🎨 HueGuess API running on http://localhost:${env.PORT}`);
  console.log(`🔌 WebSocket server ready`);
  console.log(`📝 Mode: ${env.NODE_ENV}`);
  console.log(`🌐 CORS: ${env.CORS_ORIGIN}`);
  console.log(`👥 Max players per room: ${env.MAX_PLAYERS}\n`);
});

export default app;