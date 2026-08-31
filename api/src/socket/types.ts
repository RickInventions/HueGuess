import { HSLColor, Difficulty } from '../types/game.types.js';

export type PlayerStatus = 'waiting' | 'ready' | 'playing' | 'disconnected';
export type GamePhase = 'waiting' | 'countdown' | 'memorization' | 'reconstruction' | 'results' | 'ended';

/** Reason a game ended — surfaced to the client so it can explain itself. */
export type GameEndReason =
  | 'rounds_complete'
  | 'not_enough_players'
  | 'host_ended'
  | 'last_player_standing';

/** How a room scores itself. Duel awards a point per round win; challenge averages accuracy. */
export type RoomMode = 'challenge' | 'duel';

export interface Player {
  socketId: string;
  userId: string;
  username: string;
  status: PlayerStatus;
  isHost: boolean;
  currentAccuracy?: number;
  totalAccuracy: number;
  roundsPlayed: number;
  /** Duel mode: rounds won. Always present so the DTO never has to branch. */
  points: number;
  /**
   * Elimination mode: knocked out, now a spectator — in the room and in chat,
   * but out of the running.
   *
   * A flag rather than a PlayerStatus, because status is rewritten on every
   * phase change and on disconnect/reconnect, all of which would erase it.
   */
  eliminated: boolean;
  disconnectedAt?: Date;
}

/** Player shape sent over the wire (must stay in sync with frontend types/multiplayer.ts). */
export interface PlayerDTO {
  socketId: string;
  userId: string;
  username: string;
  isHost: boolean;
  status: PlayerStatus;
  totalAccuracy: number;
  roundsPlayed: number;
  points: number;
  eliminated: boolean;
  currentAccuracy?: number;
}

export interface RoomConfig {
  roundTimeSeconds: number;    // RT - reconstruction time
  colorTimeSeconds: number;    // CT - memorization time
  difficulty: Difficulty;
  specificRounds: number | null; // null = unlimited
  maxPlayers: number;
  mode: RoomMode;
  /** Start the reconstruction sliders somewhere random instead of 0/0/0. */
  sliderShuffle: boolean;
  /** Battle royale: drop the lowest scorer every `elimEveryRounds` rounds. */
  elimination: boolean;
  elimEveryRounds: number;
}

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
  /**
   * A voice note. Set only by the upload route — a client can neither send this
   * over the socket nor choose the URL, so nobody can make every other browser
   * in the room fetch an address of their choosing.
   */
  voice?: {
    url: string;
    durationMs: number;
  };
}

export interface Room {
  code: string;
  config: RoomConfig;
  players: Map<string, Player>;
  phase: GamePhase;
  currentRound: number;
  totalRounds: number | null;
  currentColor?: HSLColor;
  /** The colour of the round just played — kept so results survive a reconnect. */
  lastColor?: HSLColor;
  /**
   * Where the reconstruction sliders start this round (slider shuffle).
   * Generated server-side so every player begins from the same place and a
   * reconnect mid-round restores it rather than re-rolling.
   */
  startColor?: HSLColor;
  roundStartTime?: Date;
  /** Epoch ms at which the current phase ends — clients derive their timers from this. */
  phaseEndsAt?: number;
  roundResults: Map<string, RoundResult>;
  playAgainVotes: Set<string>;
  /**
   * Emoji reactions on this round's results: whose result → who reacted → emoji.
   *
   * Keyed by userId, not socketId: a reconnect rebinds a player's socket, which
   * would orphan every reaction pointing at the old id.
   */
  reactions: Map<string, Map<string, string>>;
  /**
   * Who elimination knocked out at the end of the round just played, if anyone.
   * Held on the room rather than returned from endRound so the results screen
   * still announces it after a reconnect. Cleared when the next round starts.
   */
  lastEliminated?: { userId: string; username: string };
  /** Last N chat messages, replayed to players who join or reconnect. */
  chat: ChatMessage[];
  createdAt: Date;
}

export interface RoundResult {
  accuracy: number;
  userColor: HSLColor;
  submittedAt: Date;
  isTimeout: boolean;
}

export interface RoundResultDTO {
  socketId: string;
  userId: string;
  username: string;
  accuracy: number;
  userColor: HSLColor;
  isTimeout: boolean;
  cumulativeAverage: number;
}

export interface LeaderboardEntryDTO {
  socketId: string;
  userId: string;
  username: string;
  averageAccuracy: number;
  roundsPlayed: number;
  totalAccuracy: number;
  points: number;
  eliminated: boolean;
}

/**
 * Reactions on the wire: whose result → emoji → the userIds that picked it.
 *
 * Reactor ids rather than counts, so one broadcast serves every viewer — each
 * client derives both the tally and whether the reaction is its own.
 */
export type ReactionMapDTO = Record<string, Record<string, string[]>>;

/** The only emoji a client may send. Anything else is dropped, not stored. */
export const REACTION_EMOJIS = ['😂', '😭', '🔥', '🤯', '💀', '👀'] as const;

/** Identity resolved from the JWT during the socket handshake. */
export interface SocketUser {
  userId: string;
  username: string;
  isVerified: boolean;
}

export interface CreateRoomInput {
  username?: string;
  userId?: string;
  config: Partial<RoomConfig>;
}

export interface JoinRoomInput {
  code: string;
  username?: string;
  userId?: string;
}

export interface SubmitColorInput {
  roomCode?: string;
  userId?: string;
  color: HSLColor;
}
