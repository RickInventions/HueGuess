import type { HSLColor, Difficulty } from './index';

export type PlayerStatus = 'waiting' | 'ready' | 'playing' | 'disconnected';
export type GamePhase = 'waiting' | 'countdown' | 'memorization' | 'reconstruction' | 'results' | 'ended';
export type GameEndReason =
  | 'rounds_complete'
  | 'not_enough_players'
  | 'host_ended'
  | 'last_player_standing';

/** How a room scores itself. Duel awards a point per round win; challenge averages accuracy. */
export type RoomMode = 'challenge' | 'duel';

/**
 * What the room does to the colour on its way to the players' eyes.
 *
 * Deliberately the same four values as the single-player `ExtraMode` union, so
 * the wording and the mechanics keep meaning the same thing whichever way you
 * reached them. None of them changes how a guess is scored.
 */
export type RoomVisualMode = 'normal' | 'inverted' | 'blind_target' | 'blind_sliders';

export interface Player {
  socketId: string;
  userId: string;
  username: string;
  isHost: boolean;
  status: PlayerStatus;
  totalAccuracy: number;
  roundsPlayed: number;
  /** Duel mode: rounds won. */
  points: number;
  /** Elimination mode: knocked out, now a spectator. Outranks `status` in the UI. */
  eliminated: boolean;
  currentAccuracy?: number;
}

export interface RoomConfig {
  roundTimeSeconds: number;      // RT - reconstruction time (10-40)
  colorTimeSeconds: number;      // CT - memorization time (0.5-7)
  difficulty: Difficulty;
  specificRounds: number | null; // null = unlimited
  maxPlayers: number;            // 2-8
  mode: RoomMode;
  /** Start the reconstruction sliders somewhere random instead of 0/0/0. */
  sliderShuffle: boolean;
  /** Battle royale: drop the lowest scorer every `elimEveryRounds` rounds. */
  elimination: boolean;
  elimEveryRounds: number;
  /** Inverted / Blind, or none of them. Never changes how a guess is scored. */
  visualMode: RoomVisualMode;
}

export interface Room {
  code: string;
  config: RoomConfig;
  players: Player[];
  phase: GamePhase;
  currentRound: number;
  totalRounds: number | null;
  hostSocketId: string | null;
}

export interface RoundResult {
  socketId: string;
  userId: string;
  username: string;
  accuracy: number;
  userColor: HSLColor;
  isTimeout: boolean;
  /** Running average across the rounds played so far. */
  cumulativeAverage?: number;
}

export interface LeaderboardEntry {
  socketId: string;
  userId: string;
  username: string;
  averageAccuracy: number;
  roundsPlayed: number;
  totalAccuracy: number;
  /** Duel mode: rounds won. Ordering key in duel, decoration elsewhere. */
  points: number;
  eliminated: boolean;
  /** Eliminated players only — the round they went out on, which is their place. */
  eliminatedRound?: number;
  /** Set locally from `play_again_update`, not sent by the server. */
  playedAgain?: boolean;
}

/**
 * Reactions on the wire: whose result → emoji → the userIds that picked it.
 *
 * Keyed by userId throughout, because socketIds change on reconnect.
 */
export type ReactionMap = Record<string, Record<string, string[]>>;

/** The seven reactions, in display order. Mirrors REACTION_EMOJIS on the server. */
export const REACTION_EMOJIS = ['😂', '😭', '🔥', '🤯', '💀', '👀', '🍅'] as const;

/**
 * The message a reply is answering, quoted inline.
 *
 * A snippet rather than a reference: chat history is capped, so a message the
 * reply points at can be trimmed away, and an id-based reply would then render
 * as a quote of nothing.
 */
export interface ChatReplyTo {
  username: string;
  message: string;
}

export interface ChatMessage {
  username: string;
  message: string;
  timestamp: string;
  userId?: string;
  socketId?: string;
  replyTo?: ChatReplyTo;
  /** A voice note. Stamped by the server on upload; never sent by a client. */
  voice?: {
    url: string;
    durationMs: number;
  };
}

/**
 * Somebody is composing a message.
 *
 * Keyed by socketId rather than userId: the same account can legitimately have
 * two tabs open, and the server broadcasts per socket.
 */
export interface TypingSignal {
  socketId: string;
  userId?: string;
  username: string;
  isTyping: boolean;
  /** Epoch ms after which the client should drop the signal on its own. */
  expiresAt?: number;
}

/** Full room state, sent on join and on every reconnect. */
export interface RoomSnapshot {
  code: string;
  config: RoomConfig;
  players: Player[];
  hostSocketId: string | null;
  phase: GamePhase;
  currentRound: number;
  totalRounds: number | null;
  color: HSLColor | null;
  /** The round's answer — only present while results are showing. */
  targetColor: HSLColor | null;
  /** Where the sliders start this round when slider shuffle is on. */
  startColor: HSLColor | null;
  phaseEndsAt: number | null;
  serverTime: number;
  colorDuration: number;
  roundDuration: number;
  results: RoundResult[];
  leaderboard: LeaderboardEntry[];
  reactions: ReactionMap;
  /** Who elimination knocked out at the end of the round on screen, if anyone. */
  lastEliminated: { userId: string; username: string } | null;
  chat: ChatMessage[];
  yourSocketId: string;
  hasSubmitted: boolean;
  submittedCount: number;
  totalPlayers: number;
  playAgainVotes: number;
  playAgainNeeded: number;
}

// ── Outgoing payloads ───────────────────────────────────────────────────────
// Identity comes from the JWT on the server; username is sent only so a recent
// rename is reflected without reissuing the token.

export interface CreateRoomPayload {
  username?: string;
  config: RoomConfig;
}

export interface JoinRoomPayload {
  code: string;
  username?: string;
}

/** Host-only, lobby-only: replaces the room's settings wholesale. */
export interface UpdateRoomConfigPayload {
  config: RoomConfig;
}

export interface SubmitColorPayload {
  color: HSLColor;
}

export interface SocketErrorPayload {
  message: string;
  code?: string;
}
