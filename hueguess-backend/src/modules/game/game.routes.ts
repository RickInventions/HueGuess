import { Router } from 'express';
import { startRoundHandler, submitHandler } from './game.controller.js';
import { authenticate } from '../auth/auth.middleware.js';

const router = Router();

router.post('/start', startRoundHandler);
router.post('/submit', submitHandler);

// router.post('/competitive/start', authenticate, competitiveStartHandler);

export default router;