import { Router, Request } from 'express';
import { AdminService } from '../services/admin.service.js';
import { FeedbackService } from '../services/feedback.service.js';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';
import { disconnectUser } from '../socket/presence.js';

const router = Router();

// Apply admin auth to all routes
router.use(adminAuthMiddleware);
router.get('/verify', adminAuthMiddleware, (req, res) => {
  res.json({ success: true, message: 'Admin key is valid' });
});

/**
 * Who to credit in the audit log.
 *
 * Admin access is a shared key, not an account, so there is no id that could be
 * trusted — anything the client sends is unverifiable, and this treats it as
 * exactly what it is: a free-text label. `x-admin-id` is kept for that and
 * falls back to a constant so every entry has some actor.
 */
const actorOf = (req: Request): string => {
  const raw = req.headers['x-admin-id'];
  const label = Array.isArray(raw) ? raw[0] : raw;
  return String(label ?? '').trim().slice(0, 60) || 'admin-key';
};

const paging = (req: Request) => ({
  limit: Math.min(parseInt(req.query.limit as string) || 50, 200),
  offset: parseInt(req.query.offset as string) || 0,
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
    const result = await AdminService.getAllUsers({
      search: req.query.search as string,
      status: req.query.status as string,
      ...paging(req),
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user details
router.get('/users/:userId', async (req, res) => {
  try {
    const user = await AdminService.getUserDetails(req.params.userId);

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

// ── Moderation ──────────────────────────────────────────────────────────────

// Restrict an account. `durationHours` absent or null means permanent.
router.post('/users/:userId/restrict', async (req, res) => {
  try {
    const { userId } = req.params;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '';
    const rawHours = req.body?.durationHours;

    // Null means permanent; anything else has to be a sane positive number, so a
    // malformed body can't silently become "0 hours" and lift itself.
    let durationHours: number | null = null;
    if (rawHours !== null && rawHours !== undefined && rawHours !== '') {
      const parsed = Number(rawHours);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        res.status(400).json({ error: 'Duration must be a positive number of hours, or empty for permanent' });
        return;
      }
      durationHours = parsed;
    }

    const target = await AdminService.getUserDetails(userId);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const result = await AdminService.banUser({
      userId,
      reason,
      durationHours,
      actor: actorOf(req),
    });

    // Cut the live session, not just the next login: sockets carry their identity
    // from the handshake and are never re-checked, so without this they would sit
    // in their room until they closed the tab. The disconnect runs the ordinary
    // leave path, which handles host reassignment and the room broadcast.
    const closed = disconnectUser(userId);

    res.json({ success: true, user: result, sessionsClosed: closed });
  } catch (error) {
    console.error('Restrict user error:', error);
    res.status(500).json({ error: 'Failed to restrict user' });
  }
});

// Lift a restriction
router.post('/users/:userId/unrestrict', async (req, res) => {
  try {
    const result = await AdminService.unbanUser(req.params.userId, actorOf(req));

    if (!result) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ success: true, user: result });
  } catch (error) {
    console.error('Unrestrict user error:', error);
    res.status(500).json({ error: 'Failed to lift restriction' });
  }
});

// Everyone currently or previously restricted
router.get('/moderation', async (req, res) => {
  try {
    const result = await AdminService.getModerationList({
      status: req.query.status as string,
      ...paging(req),
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Get moderation list error:', error);
    res.status(500).json({ error: 'Failed to fetch moderation list' });
  }
});

// ── Account actions ─────────────────────────────────────────────────────────

// Flip verification, for accounts stuck on a code that never arrived
router.post('/users/:userId/verification', async (req, res) => {
  try {
    const verified = req.body?.verified === true;
    const result = await AdminService.setVerified(req.params.userId, verified, actorOf(req));

    if (!result) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ success: true, user: result });
  } catch (error) {
    console.error('Set verification error:', error);
    res.status(500).json({ error: 'Failed to update verification' });
  }
});

// Delete an account outright
router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Same reason as restricting: their sockets are live and would otherwise
    // keep playing as an account that no longer exists.
    const closed = disconnectUser(userId);

    const result = await AdminService.deleteUser(userId, actorOf(req));
    if (!result) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ success: true, deleted: result, sessionsClosed: closed });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ── Audit trail ─────────────────────────────────────────────────────────────

router.get('/logs', async (req, res) => {
  try {
    const result = await AdminService.getAdminLogs({
      action: req.query.action as string,
      ...paging(req),
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Get admin logs error:', error);
    res.status(500).json({ error: 'Failed to fetch admin logs' });
  }
});

// ── Feedback ────────────────────────────────────────────────────────────────

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
    const adminId = actorOf(req);

    const feedback = await FeedbackService.getFeedbackById(id);
    if (!feedback) {
      res.status(404).json({ error: 'Feedback not found' });
      return;
    }

    const result = await FeedbackService.resolveFeedback(id, adminId);
    await AdminService.logAdminAction(adminId, 'resolve_feedback', { feedbackId: id });

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
    await AdminService.logAdminAction(actorOf(req), 'refresh_leaderboard');

    res.json(result);
  } catch (error) {
    console.error('Refresh leaderboard error:', error);
    res.status(500).json({ error: 'Failed to refresh leaderboard' });
  }
});

export default router;
