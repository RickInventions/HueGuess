import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js';
import gameRoutes from './routes/game.routes.js';
import statsRoutes from './routes/stats.routes.js';
import leaderboardRoutes from './routes/leaderboard.routes.js';  
import dailyRoutes from './routes/daily.routes.js';         
import achievementRoutes from './routes/achievement.routes.js';     
import userRoutes from './routes/user.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});