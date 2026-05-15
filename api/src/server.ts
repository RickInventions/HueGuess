import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import statsRoutes from './routes/stats.routes.js';
import leaderboardRoutes from './routes/leaderboard.routes.js';  
import dailyRoutes from './routes/daily.routes.js';         
import achievementRoutes from './routes/achievement.routes.js';     
import userRoutes from './routes/user.routes.js';
import { initializeSocketIO } from './socket/index.js';
import authRoutes from './routes/auth.routes.js';
import gameRoutes from './routes/game.routes.js';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Socket.IO
const io = initializeSocketIO(server);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/leaderboard', leaderboardRoutes);  
app.use('/api/daily', dailyRoutes);        
app.use('/api/achievements', achievementRoutes);    
app.use('/api/user', userRoutes);  

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/socket-test', (req, res) => {
  res.send(`
    <html>
      <script src="/socket.io/socket.io.js"></script>
      <script>
        const socket = io();
        socket.on('connect', () => {
          console.log('Connected!', socket.id);
          document.body.innerHTML = '<h1>Socket.IO Connected! ID: ' + socket.id + '</h1>';
        });
      </script>
    </html>
  `);
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 Socket.IO endpoint: http://localhost:${PORT}/socket.io`);
  console.log(`📡 Test Socket.IO at: http://localhost:${PORT}/socket-test`);
});