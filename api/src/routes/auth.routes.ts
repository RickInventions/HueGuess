import { Router } from 'express';
import { AuthService } from '../services/auth.service.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware.js';
import { authRateLimiter, emailRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Register - NO TOKEN returned
router.post('/register', authRateLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Validation
    const errors: string[] = [];
    if (!username) errors.push('Username is required');
    if (!email) errors.push('Email is required');
    if (!password) errors.push('Password is required');
    if (password && password.length < 6) errors.push('Password must be at least 6 characters');
    if (username && username.length < 3) errors.push('Username must be at least 3 characters');
    if (username && username.length > 30) errors.push('Username must be less than 30 characters');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid email format');
    
    if (errors.length > 0) {
      res.status(400).json({ error: errors.join(', ') });
      return;
    }
    
    const result = await AuthService.register({ username, email, password });
    res.status(201).json(result);
  } catch (error) {
    console.error('Register error:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// Login - ONLY for verified users, returns token
router.post('/login', authRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }
    
    const result = await AuthService.login({ email, password });
    res.json(result);
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: (error as Error).message });
  }
});

// Verify email with magic link (GET - for clicking link)
router.get('/verify', async (req, res) => {
  try {
    const { token, email } = req.query;
    
    if (!token || !email) {
      res.redirect(`${process.env.FRONTEND_URL}/verify-error?error=Missing verification data`);
      return;
    }
    
    await AuthService.verifyEmail(token as string, email as string);
    
    // Redirect to frontend success page
    res.redirect(`${process.env.FRONTEND_URL}/verify-success`);
  } catch (error) {
    const errorMessage = encodeURIComponent((error as Error).message);
    res.redirect(`${process.env.FRONTEND_URL}/verify-error?error=${errorMessage}`);
  }
});

// Verify email with code (POST - for OTP fallback)
router.post('/verify-code', authRateLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      res.status(400).json({ error: 'Email and code are required' });
      return;
    }
    
    const result = await AuthService.verifyWithCode(email, code);
    res.json(result);
  } catch (error) {
    console.error('Verify code error:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// Resend verification email
router.post('/resend-verification', emailRateLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }
    
    const result = await AuthService.resendVerification(email);
    res.json(result);
  } catch (error) {
    console.error('Resend error:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// Forgot password
router.post('/forgot-password', emailRateLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }
    
    const result = await AuthService.forgotPassword(email);
    res.json(result);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// Reset password (POST - after clicking magic link)
router.post('/reset-password', authRateLimiter, async (req, res) => {
  try {
    const { token, email, newPassword } = req.body;
    
    const errors: string[] = [];
    if (!token) errors.push('Token is required');
    if (!email) errors.push('Email is required');
    if (!newPassword) errors.push('New password is required');
    if (newPassword && newPassword.length < 6) errors.push('Password must be at least 6 characters');
    
    if (errors.length > 0) {
      res.status(400).json({ error: errors.join(', ') });
      return;
    }
    
    const result = await AuthService.resetPassword(token, email, newPassword);
    res.json(result);
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await AuthService.getMe(req.user!.userId);
    res.json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(404).json({ error: (error as Error).message });
  }
});

// Admin: Cleanup expired users (optional endpoint)
router.post('/admin/cleanup-users', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    res.status(403).json({ error: 'Unauthorized' });
    return;
  }
  
  const cleaned = await AuthService.cleanupExpiredUsers();
  res.json({ cleaned: cleaned.length, users: cleaned });
});

export default router;