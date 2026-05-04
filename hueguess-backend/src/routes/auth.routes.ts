import { Router } from 'express';
import { AuthService } from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

// POST /api/auth/register
// Returns: { message: string } — NO TOKEN
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ error: 'Username, email, and password are required' });
      return;
    }

    if (username.length < 3 || username.length > 30) {
      res.status(400).json({ error: 'Username must be between 3 and 30 characters' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    const result = await AuthService.register(username, email, password);
    
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    const status = message.includes('already') ? 409 : 500;
    res.status(status).json({ error: message });
  }
});

// POST /api/auth/login
// Returns: { user, token } — ONLY for verified users
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const result = await AuthService.login(email, password);
    
    res.json({
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    
    if (message.includes('not verified')) {
      res.status(403).json({ error: message, code: 'EMAIL_NOT_VERIFIED' });
      return;
    }
    
    res.status(401).json({ error: message });
  }
});

// POST /api/auth/verify-email
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      res.status(400).json({ error: 'Email and verification code are required' });
      return;
    }

    const result = await AuthService.verifyEmail(email, code);
    
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verification failed';
    res.status(400).json({ error: message });
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const result = await AuthService.resendVerification(email);
    
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resend';
    res.status(500).json({ error: message });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await AuthService.getMe(req.userId!);
    res.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get user';
    res.status(404).json({ error: message });
  }
});

export default router;