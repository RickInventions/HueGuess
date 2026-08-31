import { Router } from 'express';
import { FriendService } from '../services/friend.service.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware.js';
import { getOnlineUserIds, notifyUser } from '../socket/presence.js';
import { roomManager } from '../socket/roomManager.js';

const router = Router();

// Every friend action is about the caller, so the whole router is authenticated.
router.use(authMiddleware);

/**
 * What a friend is busy with, so the list can say so before you invite them.
 *
 * Deliberately not the room code: the state is all the UI needs, and the code
 * would let someone walk into a room they were never invited to.
 */
function activityOf(userId: string): 'in_room' | 'in_game' | null {
  const room = roomManager.getRoomByUserId(userId);
  if (!room) return null;
  // `ended` is the post-game results screen — they can walk out of it, so it
  // still counts as invitable. Same predicate the invite handler rejects on.
  return room.phase === 'waiting' || room.phase === 'ended' ? 'in_room' : 'in_game';
}

/** Friends, incoming and outgoing requests, plus who is online right now. */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const overview = await FriendService.getOverview(req.user!.userId);
    const online = getOnlineUserIds();

    res.json({
      success: true,
      friends: overview.friends.map(friend => ({
        ...friend,
        isOnline: online.has(friend.userId),
        activity: activityOf(friend.userId),
      })),
      incoming: overview.incoming,
      outgoing: overview.outgoing,
    });
  } catch (error) {
    console.error('List friends error:', error);
    res.status(500).json({ error: 'Failed to load friends' });
  }
});

/** Username search annotated with the caller's relationship to each result. */
router.get('/search', async (req: AuthRequest, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      res.status(400).json({ error: 'Enter at least 2 characters' });
      return;
    }

    const results = await FriendService.search(req.user!.userId, q.trim(), 10);
    const online = getOnlineUserIds();

    res.json({
      success: true,
      results: results.map(row => ({ ...row, isOnline: online.has(row.userId) })),
    });
  } catch (error) {
    console.error('Search friends error:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
});

/** Relationship with one specific account — used by the add-friend icon in a room. */
router.get('/status/:userId', async (req: AuthRequest, res) => {
  try {
    const relationship = await FriendService.getRelationship(req.user!.userId, req.params.userId);
    res.json({ success: true, relationship });
  } catch (error) {
    console.error('Friend status error:', error);
    res.status(500).json({ error: 'Failed to load status' });
  }
});

router.post('/request', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.body;
    if (!userId || typeof userId !== 'string') {
      res.status(400).json({ error: 'userId required' });
      return;
    }

    const me = req.user!;
    const result = await FriendService.sendRequest(me.userId, userId);

    // Live nudge so the other side's modal updates without a refresh. Which event
    // depends on what actually happened: sendRequest accepts a request already
    // waiting from them rather than creating a mirror row.
    if (result.status === 'accepted') {
      notifyUser(userId, 'friend_request_accepted', { userId: me.userId, username: me.username });
    } else {
      notifyUser(userId, 'friend_request_received', { userId: me.userId, username: me.username });
    }

    res.json({ success: true, status: result.status, friend: result.friend });
  } catch (error) {
    console.error('Friend request error:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/accept', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.body;
    if (!userId || typeof userId !== 'string') {
      res.status(400).json({ error: 'userId required' });
      return;
    }

    const me = req.user!;
    await FriendService.acceptRequest(me.userId, userId);
    notifyUser(userId, 'friend_request_accepted', { userId: me.userId, username: me.username });

    res.json({ success: true });
  } catch (error) {
    console.error('Accept friend error:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/decline', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.body;
    if (!userId || typeof userId !== 'string') {
      res.status(400).json({ error: 'userId required' });
      return;
    }

    await FriendService.declineRequest(req.user!.userId, userId);
    // Declines are deliberately silent — nobody needs a rejection notification.
    res.json({ success: true });
  } catch (error) {
    console.error('Decline friend error:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/cancel', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.body;
    if (!userId || typeof userId !== 'string') {
      res.status(400).json({ error: 'userId required' });
      return;
    }

    await FriendService.cancelRequest(req.user!.userId, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Cancel friend request error:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

router.delete('/:userId', async (req: AuthRequest, res) => {
  try {
    const me = req.user!;
    await FriendService.removeFriend(me.userId, req.params.userId);
    notifyUser(req.params.userId, 'friend_removed', { userId: me.userId, username: me.username });
    res.json({ success: true });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

export default router;
