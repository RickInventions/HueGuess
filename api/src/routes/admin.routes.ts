import { Router } from 'express';
import { AdminService } from '../services/admin.service.js';
import { FeedbackService } from '../services/feedback.service.js';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';

const router = Router();

// Apply admin auth to all routes
router.use(adminAuthMiddleware);
router.get('/verify', adminAuthMiddleware, (req, res) => {
  res.json({ success: true, message: 'Admin key is valid' });
});
// Dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await AdminService.getDashboardStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const search = req.query.search as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const result = await AdminService.getAllUsers({ search, limit, offset });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user details
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await AdminService.getUserDetails(userId);
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// Get all feedback
router.get('/feedback', async (req, res) => {
  try {
    const resolved = req.query.resolved === 'true' ? true : 
                     req.query.resolved === 'false' ? false : undefined;
    const type = req.query.type as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const result = await FeedbackService.getAllFeedback({ resolved, type, limit, offset });
    const stats = await FeedbackService.getFeedbackStats();
    
    res.json({ success: true, ...result, stats });
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Resolve feedback
router.put('/feedback/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    // Get admin ID from header (optional, can be a real user ID or null)
    const adminId = req.headers['x-admin-id'] as string || null;
    
    // Validate UUID format if provided
    if (adminId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(adminId) && adminId !== 'system') {
        // If it's not a valid UUID and not 'system', use null
        console.warn(`Invalid admin ID format: ${adminId}, using null instead`);
      }
    }
    
    const feedback = await FeedbackService.getFeedbackById(id);
    if (!feedback) {
      res.status(404).json({ error: 'Feedback not found' });
      return;
    }
    
    const result = await FeedbackService.resolveFeedback(id, adminId);
    
    // Log action only if adminId is a valid UUID
    if (adminId && adminId !== 'system') {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(adminId)) {
        await AdminService.logAdminAction(adminId, 'resolve_feedback', { feedbackId: id });
      }
    }
    
    res.json({ success: true, message: 'Feedback resolved', feedback: result });
  } catch (error) {
    console.error('Resolve feedback error:', error);
    res.status(500).json({ error: 'Failed to resolve feedback' });
  }
});

// Refresh leaderboard
router.post('/refresh-leaderboard', async (req, res) => {
  try {
    const result = await AdminService.refreshLeaderboard();
    const adminId = req.headers['x-admin-id'] as string || 'system';
    await AdminService.logAdminAction(adminId, 'refresh_leaderboard');
    
    res.json(result);
  } catch (error) {
    console.error('Refresh leaderboard error:', error);
    res.status(500).json({ error: 'Failed to refresh leaderboard' });
  }
});

export default router;