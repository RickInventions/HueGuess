import { Router } from 'express';
import { registerHandler, loginHandler, refreshHandler, meHandler } from './auth.controller.js';
import { authenticate } from './auth.middleware.js';

const router = Router();

router.post('/register', registerHandler);
router.post('/login', loginHandler);
router.post('/refresh', refreshHandler);
router.get('/me', authenticate, meHandler);

export default router;