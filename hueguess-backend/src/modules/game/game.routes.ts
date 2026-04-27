import { Router } from 'express';
import { startRoundHandler, submitHandler } from './game.controller.js';

const router = Router();

router.post('/start', startRoundHandler);
router.post('/submit', submitHandler);

export default router;