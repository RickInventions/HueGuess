import { Router } from 'express';
import { authMiddleware, optionalAuthMiddleware, AuthRequest } from '../middleware/auth.middleware.js';
import {
  DIFFICULTIES,
  EXTRA_MODES,
  ModesService,
  isBoardDifficulty,
  isDifficulty,
  isExtraMode,
  readRoundToken,
} from '../services/modes.service.js';
import { validateHSL } from '../utils/hsl.utils.js';

const router = Router();

/** `parseInt('') || fallback` turns a deliberate 0 into the fallback. */
function toInt(value: unknown, fallback: number): number {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Start a round.
 *
 * Signed in only — the round has to be attributable to put a score on a board,
 * and both modes are reached from gated cards on the home page anyway.
 */
router.post('/generate', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { mode, difficulty } = req.body;

    if (!isExtraMode(mode)) {
      res.status(400).json({ error: 'Invalid mode', valid: EXTRA_MODES });
      return;
    }
    if (!isDifficulty(difficulty)) {
      res.status(400).json({ error: 'Invalid difficulty', valid: DIFFICULTIES });
      return;
    }
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const round = ModesService.startRound(String(req.user.userId), mode, difficulty);

    res.json({
      success: true,
      mode,
      difficulty,
      token: round.token,
      // Null for Blind's no-target variant — there is nothing to show.
      color: round.shownColor,
      config: round.config,
    });
  } catch (error) {
    console.error('Extra mode generate error:', error);
    res.status(500).json({ error: 'Failed to start round' });
  }
});

/** Score a round. The target comes out of the token, never off the request. */
router.post('/submit', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { token, userH, userS, userL } = req.body;

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const claim = readRoundToken(token);
    if (!claim) {
      res.status(400).json({ error: 'That round has expired — start a new one', code: 'BAD_ROUND' });
      return;
    }

    // The token is bound to whoever it was issued to, so one player cannot
    // submit another's round.
    if (claim.u !== String(req.user.userId)) {
      res.status(403).json({ error: 'That round belongs to another player', code: 'BAD_ROUND' });
      return;
    }

    if (userH === undefined || userS === undefined || userL === undefined) {
      res.status(400).json({ error: 'Missing user color' });
      return;
    }

    const guess = { h: Math.round(Number(userH)), s: Math.round(Number(userS)), l: Math.round(Number(userL)) };
    if (!validateHSL(guess)) {
      res.status(400).json({ error: 'Invalid HSL values' });
      return;
    }

    const result = await ModesService.submitRound(String(req.user.userId), claim, guess);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Extra mode submit error:', error);
    res.status(500).json({ error: 'Failed to score round' });
  }
});

/**
 * One board. Public, and optional auth only so a signed-in visitor can be
 * highlighted on it.
 */
router.get('/leaderboard', optionalAuthMiddleware, async (req, res) => {
  try {
    const mode = req.query.mode;
    // Absent means `all` — the default view is every difficulty at once, with
    // each row labelled. A present-but-invalid value is still an error.
    const difficulty = req.query.difficulty ?? 'all';

    if (!isExtraMode(mode)) {
      res.status(400).json({ error: 'Invalid mode', valid: EXTRA_MODES });
      return;
    }
    if (!isBoardDifficulty(difficulty)) {
      res.status(400).json({ error: 'Invalid difficulty', valid: ['all', ...DIFFICULTIES] });
      return;
    }

    const board = await ModesService.getBoard({
      mode,
      difficulty,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      limit: Math.min(Math.max(toInt(req.query.limit, 100), 1), 100),
      offset: Math.max(toInt(req.query.offset, 0), 0),
    });

    res.json({ success: true, board });
  } catch (error) {
    console.error('Extra mode leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

/** Player count and top score for every (mode, difficulty) pair that has rows. */
router.get('/summary', async (_req, res) => {
  try {
    res.json({ success: true, summary: await ModesService.getBoardSummary() });
  } catch (error) {
    console.error('Extra mode summary error:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

export default router;
