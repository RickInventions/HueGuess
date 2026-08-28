import { Router, raw } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware.js';
import { VoiceService } from '../services/voice.service.js';
import { roomManager } from '../socket/roomManager.js';
import { getSocketServer } from '../socket/presence.js';
import type { ChatMessage } from '../socket/types.js';

/**
 * Voice notes for Challenge-mode chat.
 *
 * The route uploads *and* broadcasts. Doing both here rather than having the
 * client post the recording, get a URL back and then send it over the socket
 * closes two holes: there is no window in which a file exists on Cloudinary with
 * no message pointing at it, and a client can never choose the URL that every
 * other browser in the room is then told to fetch.
 */

const router = Router();

/** Containers MediaRecorder actually produces across Chrome, Firefox and Safari. */
const ALLOWED_TYPES = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg'];

const MAX_BYTES = 300 * 1024;
const MAX_DURATION_MS = 12_000;

/**
 * Phases where speaking is allowed.
 *
 * Mid-round audio would be a channel for coaching — one player describing the
 * colour they just saw while another is still reconstructing it. The recorder is
 * hidden client-side too, but a hidden button is not a security boundary, so the
 * check that matters is this one.
 */
const OPEN_PHASES = new Set(['waiting', 'results', 'ended']);

/** userId → timestamps of recent uploads, for a crude per-user rate limit. */
const recent = new Map<string, number[]>();
const RATE_LIMIT = 8;
const RATE_WINDOW_MS = 60_000;

function withinRateLimit(userId: string): boolean {
  const now = Date.now();
  const times = (recent.get(userId) ?? []).filter(t => now - t < RATE_WINDOW_MS);

  if (times.length >= RATE_LIMIT) {
    recent.set(userId, times);
    return false;
  }

  times.push(now);
  recent.set(userId, times);
  return true;
}

router.post(
  '/',
  authMiddleware,
  // Scoped to audio types only. The global express.json() at server.ts claims
  // application/json and nothing else, so the two never fight over a body.
  raw({ type: ALLOWED_TYPES, limit: MAX_BYTES }),
  async (req: AuthRequest, res) => {
    try {
      if (!VoiceService.isConfigured) {
        res.status(503).json({ error: 'Voice messages are not available' });
        return;
      }

      const userId = req.user!.userId;
      const buffer = req.body;

      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        res.status(400).json({ error: 'Expected an audio body' });
        return;
      }
      if (buffer.length > MAX_BYTES) {
        res.status(413).json({ error: 'Recording too large' });
        return;
      }

      const durationMs = Number(req.query.ms);
      if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > MAX_DURATION_MS) {
        res.status(400).json({ error: 'Invalid recording length' });
        return;
      }

      if (!withinRateLimit(userId)) {
        res.status(429).json({ error: 'Slow down a little' });
        return;
      }

      // Membership is read from the room registry rather than trusted from the
      // request: the socket layer is a singleton in this process, so the room the
      // caller is actually in is knowable, and the `room` query param is only a
      // cross-check against a stale client.
      const room = roomManager.getRoomByUserId(userId);
      if (!room) {
        res.status(403).json({ error: 'You are not in a room' });
        return;
      }

      const claimed = String(req.query.room ?? '').toUpperCase();
      if (claimed && claimed !== room.code) {
        res.status(409).json({ error: 'You have moved to a different room' });
        return;
      }

      if (!OPEN_PHASES.has(room.phase)) {
        res.status(400).json({ error: 'Voice messages are paused during a round' });
        return;
      }

      const player = roomManager.getPlayerByUserId(room, userId);
      if (!player) {
        res.status(403).json({ error: 'You are not in a room' });
        return;
      }

      const { url } = await VoiceService.upload(buffer, room.code);

      const message: ChatMessage = {
        username: player.username,
        // Text fallback, so a client that has not learned about voice notes still
        // shows that something was said rather than an empty bubble.
        message: '🎤 Voice message',
        timestamp: new Date().toISOString(),
        userId,
        socketId: player.socketId,
        voice: { url, durationMs: Math.round(durationMs) },
      };

      roomManager.addChatMessage(room, message);

      // Broadcast from here rather than from a socket event: the message and the
      // upload are the same operation, and splitting them would let one happen
      // without the other.
      getSocketServer()?.to(room.code).emit('new_message', message);

      res.json({ success: true });
    } catch (error) {
      console.error('Voice upload error:', error);
      res.status(500).json({ error: 'Failed to send voice message' });
    }
  }
);

export default router;
