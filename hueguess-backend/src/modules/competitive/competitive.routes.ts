import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import {
  startCompetitiveRound,
  submitCompetitiveRound,
  getLeaderboard,
  getUserStats,
} from './competitive.controller.js';

const router = Router();

// Protected routes (require auth)
router.post('/start', authenticate, startCompetitiveRound);
router.post('/submit', authenticate, submitCompetitiveRound);
router.get('/stats', authenticate, getUserStats);

// Public route
router.get('/leaderboard', getLeaderboard);

export default router;