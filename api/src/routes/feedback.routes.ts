import { Router } from 'express';
import { FeedbackService } from '../services/feedback.service.js';
import { authMiddleware, AuthRequest, optionalAuthMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// Submit feedback (auth optional)
router.post('/', optionalAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    const { type, title, description, contactEmail } = req.body;
    
    if (!type || !title || !description) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    
    const validTypes = ['bug', 'feature', 'review', 'other'];
    if (!validTypes.includes(type)) {
      res.status(400).json({ error: 'Invalid feedback type' });
      return;
    }
    
    const feedback = await FeedbackService.submitFeedback({
      userId: req.user?.userId,
      type,
      title,
      description,
      contactEmail,
    });
    
    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      feedback,
    });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

export default router;