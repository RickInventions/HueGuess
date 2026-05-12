import { Router } from 'express';
import { UserService } from '../services/user.service.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/profile/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username) {
      res.status(400).json({ error: 'Username required' });
      return;
    }
    
    const profile = await UserService.getPublicProfile(username);
    res.json({ success: true, profile });
  } catch (error) {
    console.error('Get profile error:', error);
    const errorMessage = (error as Error).message;
    if (errorMessage === 'User not found') {
      res.status(404).json({ error: errorMessage });
    } else {
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  }
});

// Get own profile (FULL DETAILS - private, requires auth)
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const profile = await UserService.getOwnProfile(req.user!.userId);
    res.json({ success: true, profile });
  } catch (error) {
    console.error('Get own profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Change username
router.put('/username', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { newUsername } = req.body;
    
    if (!newUsername) {
      res.status(400).json({ error: 'New username required' });
      return;
    }
    
    if (newUsername.length < 3 || newUsername.length > 30) {
      res.status(400).json({ error: 'Username must be between 3 and 30 characters' });
      return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
      return;
    }
    
    const result = await UserService.changeUsername(req.user!.userId, newUsername);
    res.json(result);
  } catch (error) {
    console.error('Change username error:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// Change password
router.put('/password', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current password and new password required' });
      return;
    }
    
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }
    
    const result = await UserService.changePassword(req.user!.userId, currentPassword, newPassword);
    res.json(result);
  } catch (error) {
    console.error('Change password error:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

// Search users
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q || typeof q !== 'string') {
      res.status(400).json({ error: 'Search query required' });
      return;
    }
    
    const results = await UserService.searchUsers(q, parseInt(limit as string));
    res.json({ success: true, results });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Get minimal user info (for mentions, etc.)
router.get('/:userId/minimal', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await UserService.getMinimalUserInfo(userId);
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Get minimal user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;