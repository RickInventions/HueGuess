import { Router } from 'express';
import * as authController from './auth.controller.js';
import { authenticate } from './auth.middleware.js';

const router = Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/guest', authController.guestLogin);
router.post('/refresh-token', authController.refreshToken);

// Protected routes
router.get('/profile', authenticate, authController.getProfile);

export default router;