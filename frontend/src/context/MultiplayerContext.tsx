import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import type {
  Room,
  Player,
  RoomConfig,
  RoundResult,
  ChatMessage,
  GamePhase,
  GameEndReason,
  LeaderboardEntry,
  RoomSnapshot,
  SocketErrorPayload,
} from '../types/multiplayer';
import type { HSLColor } from '../types';

/** Survives a page reload so a refresh mid-game rejoins instead of abandoning the room. */
const ROOM_KEY = 'hueguess:room';
const ACTION_TIMEOUT_MS = 10_000;

function rememberRoom(code: string) {
  try {
    sessionStorage.setItem(ROOM_KEY, code);
  } catch {
    /* private mode — reconnect still works within the same page session */
  }
}

function forgetRoom() {
  try {
    sessionStorage.removeItem(ROOM_KEY);
  } catch {
    /* ignore */
  }
}

function recallRoom(): string | null {
  try {
    return sessionStorage.getItem(ROOM_KEY);
  } catch {
    return null;
  }
}

interface MultiplayerContextType {
  currentRoom: Room | null;
  players: Player[];
  phase: GamePhase;
  currentRound: number;
  totalRounds: number | null;
  roundResults: RoundResult[];
  leaderboard: LeaderboardEntry[];
  chatMessages: ChatMessage[];
  countdown: number | null;
  currentColor: HSLColor | null;
  /** The colour of the round just finished — only set while results are showing. */
  targetColor: HSLColor | null;
  /** Seconds left in the current phase, derived from the server deadline. */
  timeRemaining: number | null;
  /** Raw server deadline (epoch ms) for smooth progress animations. */
  phaseEndsAt: number | null;
  submittedCount: number;
  totalSubmitters: number;
  hasSubmitted: boolean;
  playAgainVotes: number;
  playAgainNeeded: number;
  gameEndReason: GameEndReason | null;
  isFinalRound: boolean;
  /** This client is offline / reconnecting. */
  isReconnecting: boolean;
  isConnected: boolean;
  isOnline: boolean;
  connectionMessage: string | null;
  isCreating: boolean;
  isJoining: boolean;
  error: string | null;
  sessionEnded: boolean;

  createRoom: (config: RoomConfig) => Promise<string>;
  joinRoom: (code: string) => Promise<void>;
  leaveRoom: () => void;
  setReady: (isReady: boolean) => void;
  submitColor: (color: HSLColor) => void;
  playAgain: () => void;
  endRoom: () => void;
  sendMessage: (message: string) => void;
  resetRoom: () => void;
  /** Ask the server for a fresh snapshot (used after a reconnect or tab refocus). */
  requestState: () => void;
  retryConnection: () => void;
}

const MultiplayerContext = createContext<MultiplayerContextType | undefined>(undefined);

export function MultiplayerProvider({ children }: { children: React.ReactNode }) {
  const {
    socket,
    isConnected,
    isReconnecting,
    isOnline,
    connectionError,
    getServerTime,
    retry,
  } = useSocket();
  const { user } = useAuth();

  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [phase, setPhase] = useState<GamePhase>('waiting');
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState<number | null>(null);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentColor, setCurrentColor] = useState<HSLColor | null>(null);
  const [targetColor, setTargetColor] = useState<HSLColor | null>(null);
  const [phaseEndsAt, setPhaseEndsAt] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [totalSubmitters, setTotalSubmitters] = useState(0);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [playAgainVotes, setPlayAgainVotes] = useState(0);
  const [playAgainNeeded, setPlayAgainNeeded] = useState(0);
  const [gameEndReason, setGameEndReason] = useState<GameEndReason | null>(null);
  const [isFinalRound, setIsFinalRound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  /** Room code we believe we belong to — drives the automatic rejoin. */
  const roomCodeRef = useRef<string | null>(recallRoom());

  const resetRoom = useCallback(() => {
    roomCodeRef.current = null;
    forgetRoom();
    setCurrentRoom(null);
    setPlayers([]);
    setPhase('waiting');
    setCurrentRound(0);
    setTotalRounds(null);
    setRoundResults([]);
    setLeaderboard([]);
    setChatMessages([]);
    setCountdown(null);
    setCurrentColor(null);
    setTargetColor(null);
    setPhaseEndsAt(null);
    setTimeRemaining(null);
    setSubmittedCount(0);
    setTotalSubmitters(0);
    setHasSubmitted(false);
    setPlayAgainVotes(0);
    setPlayAgainNeeded(0);
    setGameEndReason(null);
    setIsFinalRound(false);
    setError(null);
    setSessionEnded(false);
  }, []);

  // ── Phase timer ───────────────────────────────────────────────────────────
  // Driven by the server's deadline rather than a local decrementing counter, so
  // it stays correct through tab throttling, sleep, and reconnects.
  useEffect(() => {
    if (phaseEndsAt === null) {
      setTimeRemaining(null);
      return;
    }

    let frame: number | undefined;
    const tick = () => {
      const remaining = Math.max(0, (phaseEndsAt - getServerTime()) / 1000);
      setTimeRemaining(remaining);
      if (remaining <= 0 && frame !== undefined) {
        clearInterval(frame);
        frame = undefined;
      }
    };

    tick();
    frame = window.setInterval(tick, 200);
    return () => {
      if (frame !== undefined) clearInterval(frame);
    };
  }, [phaseEndsAt, getServerTime]);

  // ── Server events ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const applySnapshot = (snap: RoomSnapshot) => {
      roomCodeRef.current = snap.code;
      rememberRoom(snap.code);

      setCurrentRoom({
        code: snap.code,
        config: snap.config,
        players: snap.players,
        phase: snap.phase,
        currentRound: snap.currentRound,
        totalRounds: snap.totalRounds,
        hostSocketId: snap.hostSocketId,
      });
      setPlayers(snap.players);
      setPhase(snap.phase);
      setCurrentRound(snap.currentRound);
      setTotalRounds(snap.totalRounds);
      setCurrentColor(snap.color ?? null);
      setTargetColor(snap.targetColor ?? null);
      setPhaseEndsAt(snap.phaseEndsAt ?? null);
      setRoundResults(snap.results ?? []);
      setLeaderboard(snap.leaderboard ?? []);
      setChatMessages(snap.chat ?? []);
      setHasSubmitted(!!snap.hasSubmitted);
      setSubmittedCount(snap.submittedCount ?? 0);
      setTotalSubmitters(snap.totalPlayers ?? snap.players.length);
      setPlayAgainVotes(snap.playAgainVotes ?? 0);
      setPlayAgainNeeded(snap.playAgainNeeded ?? 0);
      // Reconnecting into the last round's results: derive it, otherwise the
      // screen would offer a "ready for next round" button with no next round.
      setIsFinalRound(
        snap.phase === 'results' &&
          snap.totalRounds !== null &&
          snap.currentRound >= snap.totalRounds
      );
      setCountdown(null);
      setSessionEnded(false);
      setError(null);
    };

    // ── Room lifecycle ──────────────────────────────────────────────────────
    const onRoomCreated = (data: {
      code: string;
      config: RoomConfig;
      players: Player[];
      hostSocketId: string | null;
      phase: GamePhase;
      currentRound: number;
      totalRounds: number | null;
    }) => {
      roomCodeRef.current = data.code;
      rememberRoom(data.code);
      setCurrentRoom({
        code: data.code,
        config: data.config,
        players: data.players,
        phase: data.phase ?? 'waiting',
        currentRound: data.currentRound ?? 0,
        totalRounds: data.totalRounds ?? data.config.specificRounds,
        hostSocketId: data.hostSocketId,
      });
      setPlayers(data.players);
      setPhase(data.phase ?? 'waiting');
      setCurrentRound(data.currentRound ?? 0);
      setTotalRounds(data.totalRounds ?? data.config.specificRounds);
      setError(null);
    };

    const onRoomJoined = (data: {
      code: string;
      config: RoomConfig;
      players: Player[];
      hostSocketId: string | null;
      status: GamePhase;
      currentRound: number;
      totalRounds: number | null;
    }) => {
      roomCodeRef.current = data.code;
      rememberRoom(data.code);
      setCurrentRoom({
        code: data.code,
        config: data.config,
        players: data.players,
        phase: data.status,
        currentRound: data.currentRound ?? 0,
        totalRounds: data.totalRounds ?? data.config.specificRounds,
        hostSocketId: data.hostSocketId,
      });
      setPlayers(data.players);
      setPhase(data.status);
      setError(null);
      toast.success(`Joined room ${data.code}`);
    };

    const onRoomState = (snap: RoomSnapshot) => {
      if (!snap?.code) return;
      applySnapshot(snap);
    };

    const onRoomUnavailable = () => {
      resetRoom();
    };

    const onRejoinFailed = () => {
      const had = !!roomCodeRef.current;
      resetRoom();
      if (had) toast.info('That room is no longer available');
    };

    const onLeftRoom = () => {
      resetRoom();
    };

    // ── Roster ──────────────────────────────────────────────────────────────
    const onPlayerJoined = (data: { username: string; players: Player[]; hostSocketId: string | null }) => {
      setPlayers(data.players);
      setCurrentRoom(prev => (prev ? { ...prev, players: data.players, hostSocketId: data.hostSocketId } : prev));
      toast.info(`${data.username} joined`);
    };

    const onPlayerLeft = (data: { username?: string; players: Player[]; hostSocketId: string | null }) => {
      setPlayers(data.players);
      setCurrentRoom(prev => (prev ? { ...prev, players: data.players, hostSocketId: data.hostSocketId } : prev));
      if (data.username) toast.info(`${data.username} left the room`);
    };

    const onHostChanged = (data: { newHostSocketId: string; newHostUsername?: string }) => {
      setCurrentRoom(prev => (prev ? { ...prev, hostSocketId: data.newHostSocketId } : prev));
      if (data.newHostUsername) toast.info(`${data.newHostUsername} is now the host`);
    };

    const onPlayerDisconnected = (data: {
      username: string;
      players: Player[];
      graceSeconds: number;
    }) => {
      setPlayers(data.players);
      toast.warning(`${data.username} lost connection — ${data.graceSeconds}s to return`, { duration: 4000 });
    };

    const onDisconnectWarning = (data: { username: string; secondsLeft: number }) => {
      toast.warning(`${data.username} will be removed in ${data.secondsLeft}s`, { duration: 3000 });
    };

    const onPlayerReconnected = (data: { username: string; players: Player[]; hostSocketId: string | null }) => {
      setPlayers(data.players);
      setCurrentRoom(prev => (prev ? { ...prev, players: data.players, hostSocketId: data.hostSocketId } : prev));
      toast.success(`${data.username} reconnected`);
    };

    const onPlayerRemoved = (data: {
      userId?: string;
      username: string;
      players: Player[];
      hostSocketId: string | null;
    }) => {
      if (data.userId && user?.id && String(data.userId) === String(user.id)) {
        resetRoom();
        toast.error('You were removed from the room after losing connection');
        return;
      }
      setPlayers(data.players);
      setCurrentRoom(prev => (prev ? { ...prev, players: data.players, hostSocketId: data.hostSocketId } : prev));
      toast.info(`${data.username} was removed (disconnected too long)`);
    };

    // ── Ready / countdown ───────────────────────────────────────────────────
    const onReadyUpdate = (data: { username?: string; players: Player[] }) => {
      setPlayers(data.players);
    };

    const onUnreadyUpdate = (data: { username?: string; players: Player[] }) => {
      setPlayers(data.players);
    };

    const onCountdown = (data: { countdown: number }) => {
      setCountdown(data.countdown > 0 ? data.countdown : null);
    };

    const onCountdownCancelled = (data: { reason?: string }) => {
      setCountdown(null);
      if (data?.reason) toast.info(data.reason);
    };

    // ── Round flow ──────────────────────────────────────────────────────────
    const onRoundStarted = (data: {
      round: number;
      totalRounds: number | null;
      color: HSLColor;
      colorDuration: number;
      roundDuration: number;
      phaseEndsAt: number;
      players: Player[];
    }) => {
      setCurrentRound(data.round);
      setTotalRounds(data.totalRounds);
      setCurrentColor(data.color);
      setTargetColor(null);
      setPhase('memorization');
      setPhaseEndsAt(data.phaseEndsAt ?? null);
      setPlayers(data.players);
      setRoundResults([]);
      setSubmittedCount(0);
      setHasSubmitted(false);
      setCountdown(null);
      setIsFinalRound(false);
      setError(null);
    };

    const onReconstructionStarted = (data: { roundDuration: number; phaseEndsAt: number }) => {
      setPhase('reconstruction');
      setPhaseEndsAt(data.phaseEndsAt ?? null);
      setCurrentColor(null);
    };

    const onPlayerSubmitted = (data: { submittedCount: number; totalPlayers: number }) => {
      setSubmittedCount(data.submittedCount);
      setTotalSubmitters(data.totalPlayers);
    };

    const onSubmitAck = (data: { accepted: boolean; reason?: string }) => {
      // The server is the authority on whether a guess landed; a rejected ack
      // releases the UI so the player can try again within the round.
      if (data.accepted || data.reason === 'ALREADY_SUBMITTED') {
        setHasSubmitted(true);
      } else if (data.reason === 'ROUND_CLOSED') {
        setHasSubmitted(true);
      } else {
        setHasSubmitted(false);
      }
    };

    const onRoundEnded = (data: {
      round: number;
      targetColor?: HSLColor | null;
      results: RoundResult[];
      leaderboard: LeaderboardEntry[];
      players: Player[];
      isFinalRound?: boolean;
    }) => {
      setRoundResults(data.results);
      setLeaderboard(data.leaderboard);
      setPlayers(data.players);
      setPhase('results');
      setCurrentRound(data.round);
      setCurrentColor(null);
      setTargetColor(data.targetColor ?? null);
      // Results have no deadline — they hold until everyone readies up.
      setPhaseEndsAt(null);
      setSubmittedCount(0);
      setHasSubmitted(false);
      setIsFinalRound(!!data.isFinalRound);
    };

    const onRoundInterval = (data: { nextRound: number; players: Player[]; totalRounds: number | null }) => {
      setCurrentRound(data.nextRound);
      setTotalRounds(data.totalRounds ?? null);
      setPlayers(data.players);
      setPhase('waiting');
      setPhaseEndsAt(null);
      setRoundResults([]);
      setTargetColor(null);
    };

    const onGameEnded = (data: {
      finalLeaderboard: LeaderboardEntry[];
      reason: GameEndReason;
      message?: string;
      rounds: number;
      players: Player[];
    }) => {
      setLeaderboard(data.finalLeaderboard);
      setPlayers(data.players);
      setPhase('ended');
      setPhaseEndsAt(null);
      setCurrentColor(null);
      setCountdown(null);
      setGameEndReason(data.reason);
      setPlayAgainVotes(0);
      setIsFinalRound(false);
      if (data.message) toast.info(data.message);
    };

    const onPlayAgainUpdate = (data: {
      socketId: string;
      username?: string;
      votes: number;
      totalNeeded: number;
    }) => {
      setPlayAgainVotes(data.votes);
      setPlayAgainNeeded(data.totalNeeded);
      setLeaderboard(prev =>
        prev.map(entry => (entry.socketId === data.socketId ? { ...entry, playedAgain: true } : entry))
      );
    };

    const onPlayAgainComplete = () => {
      toast.success('Everyone is in — new game!');
    };

    const onRoomReset = (data: {
      players: Player[];
      status: GamePhase;
      config?: RoomConfig;
      hostSocketId: string | null;
    }) => {
      setPlayers(data.players);
      setPhase(data.status ?? 'waiting');
      setCurrentRoom(prev =>
        prev
          ? {
              ...prev,
              players: data.players,
              phase: data.status ?? 'waiting',
              config: data.config ?? prev.config,
              hostSocketId: data.hostSocketId,
              currentRound: 0,
            }
          : prev
      );
      setCurrentRound(0);
      setRoundResults([]);
      setLeaderboard([]);
      setCurrentColor(null);
      setTargetColor(null);
      setPhaseEndsAt(null);
      setCountdown(null);
      setSubmittedCount(0);
      setHasSubmitted(false);
      setPlayAgainVotes(0);
      setGameEndReason(null);
      setIsFinalRound(false);
      setError(null);
      setSessionEnded(false);
    };

    const onSessionEnded = (data: {
      message?: string;
      players: Player[];
      status: GamePhase;
      hostSocketId: string | null;
    }) => {
      setPhase(data.status ?? 'waiting');
      setPlayers(data.players ?? []);
      setCurrentRoom(prev =>
        prev ? { ...prev, players: data.players ?? prev.players, hostSocketId: data.hostSocketId, currentRound: 0 } : prev
      );
      setCurrentRound(0);
      setRoundResults([]);
      setLeaderboard([]);
      setCurrentColor(null);
      setTargetColor(null);
      setPhaseEndsAt(null);
      setCountdown(null);
      setSubmittedCount(0);
      setHasSubmitted(false);
      setGameEndReason(null);
      setSessionEnded(true);
      toast.info(data.message || 'Host ended the session');
    };

    const onNewMessage = (data: ChatMessage) => {
      setChatMessages(prev => [...prev.slice(-99), data]);
    };

    const onError = (data: SocketErrorPayload) => {
      const message = data?.message || 'Something went wrong';
      setError(message);
      // Room-scoped failures already surface in the UI that triggered them.
      if (data?.code !== 'ROOM_NOT_FOUND' && data?.code !== 'JOIN_FAILED') {
        toast.error(message);
      }
      if (data?.code === 'NOT_IN_ROOM') resetRoom();
    };

    socket.on('room_created', onRoomCreated);
    socket.on('room_joined', onRoomJoined);
    socket.on('room_state', onRoomState);
    socket.on('room_unavailable', onRoomUnavailable);
    socket.on('rejoin_failed', onRejoinFailed);
    socket.on('left_room', onLeftRoom);
    socket.on('player_joined', onPlayerJoined);
    socket.on('player_left', onPlayerLeft);
    socket.on('host_changed', onHostChanged);
    socket.on('player_disconnected', onPlayerDisconnected);
    socket.on('disconnect_warning', onDisconnectWarning);
    socket.on('player_reconnected', onPlayerReconnected);
    socket.on('player_removed', onPlayerRemoved);
    socket.on('player_ready_update', onReadyUpdate);
    socket.on('player_unready_update', onUnreadyUpdate);
    socket.on('all_ready_countdown', onCountdown);
    socket.on('countdown_cancelled', onCountdownCancelled);
    socket.on('round_started', onRoundStarted);
    socket.on('reconstruction_started', onReconstructionStarted);
    socket.on('player_submitted', onPlayerSubmitted);
    socket.on('submit_ack', onSubmitAck);
    socket.on('round_ended', onRoundEnded);
    socket.on('round_interval', onRoundInterval);
    socket.on('game_ended', onGameEnded);
    socket.on('play_again_update', onPlayAgainUpdate);
    socket.on('play_again_complete', onPlayAgainComplete);
    socket.on('room_reset', onRoomReset);
    socket.on('session_ended', onSessionEnded);
    socket.on('new_message', onNewMessage);
    socket.on('error', onError);

    return () => {
      socket.off('room_created', onRoomCreated);
      socket.off('room_joined', onRoomJoined);
      socket.off('room_state', onRoomState);
      socket.off('room_unavailable', onRoomUnavailable);
      socket.off('rejoin_failed', onRejoinFailed);
      socket.off('left_room', onLeftRoom);
      socket.off('player_joined', onPlayerJoined);
      socket.off('player_left', onPlayerLeft);
      socket.off('host_changed', onHostChanged);
      socket.off('player_disconnected', onPlayerDisconnected);
      socket.off('disconnect_warning', onDisconnectWarning);
      socket.off('player_reconnected', onPlayerReconnected);
      socket.off('player_removed', onPlayerRemoved);
      socket.off('player_ready_update', onReadyUpdate);
      socket.off('player_unready_update', onUnreadyUpdate);
      socket.off('all_ready_countdown', onCountdown);
      socket.off('countdown_cancelled', onCountdownCancelled);
      socket.off('round_started', onRoundStarted);
      socket.off('reconstruction_started', onReconstructionStarted);
      socket.off('player_submitted', onPlayerSubmitted);
      socket.off('submit_ack', onSubmitAck);
      socket.off('round_ended', onRoundEnded);
      socket.off('round_interval', onRoundInterval);
      socket.off('game_ended', onGameEnded);
      socket.off('play_again_update', onPlayAgainUpdate);
      socket.off('play_again_complete', onPlayAgainComplete);
      socket.off('room_reset', onRoomReset);
      socket.off('session_ended', onSessionEnded);
      socket.off('new_message', onNewMessage);
      socket.off('error', onError);
    };
  }, [socket, resetRoom, user?.id]);

  // ── Automatic rejoin ──────────────────────────────────────────────────────
  // Runs after the listener effect above, so `room_state` is always handled.
  useEffect(() => {
    if (!socket || !isConnected) return;
    const code = roomCodeRef.current;
    if (!code) return;
    socket.emit('rejoin_room', { code });
  }, [socket, isConnected]);

  // Resync when the tab comes back to the foreground: a throttled tab can miss
  // events entirely, and a stale board is worse than a brief refetch.
  useEffect(() => {
    if (!socket) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (!socket.connected) {
        socket.connect();
        return;
      }
      if (roomCodeRef.current) socket.emit('request_state');
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [socket]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const guard = useCallback((): string | null => {
    if (!isOnline) return 'You are offline';
    if (!socket || !isConnected) return 'Not connected to the game server';
    if (!user) return 'You need to be signed in';
    return null;
  }, [isOnline, socket, isConnected, user]);

  const createRoom = useCallback(
    (config: RoomConfig): Promise<string> => {
      return new Promise<string>((resolve, reject) => {
        const problem = guard();
        if (problem || !socket) {
          setError(problem);
          reject(new Error(problem ?? 'Not connected'));
          return;
        }

        setIsCreating(true);
        let settled = false;
        const cleanup = () => {
          settled = true;
          clearTimeout(timer);
          socket.off('room_created', onCreated);
          socket.off('error', onErr);
          setIsCreating(false);
        };

        const onCreated = (data: { code: string }) => {
          if (settled) return;
          cleanup();
          resolve(data.code);
        };
        const onErr = (data: SocketErrorPayload) => {
          if (settled) return;
          cleanup();
          reject(new Error(data?.message || 'Could not create the room'));
        };
        const timer = setTimeout(() => {
          if (settled) return;
          cleanup();
          reject(new Error('The server did not respond. Please try again.'));
        }, ACTION_TIMEOUT_MS);

        socket.on('room_created', onCreated);
        socket.on('error', onErr);
        socket.emit('create_room', { username: user?.username, config });
      });
    },
    [guard, socket, user?.username]
  );

  const joinRoom = useCallback(
    (code: string): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        const problem = guard();
        if (problem || !socket) {
          setError(problem);
          reject(new Error(problem ?? 'Not connected'));
          return;
        }

        setIsJoining(true);
        let settled = false;
        const cleanup = () => {
          settled = true;
          clearTimeout(timer);
          socket.off('room_joined', onJoined);
          socket.off('error', onErr);
          setIsJoining(false);
        };

        const onJoined = () => {
          if (settled) return;
          cleanup();
          resolve();
        };
        const onErr = (data: SocketErrorPayload) => {
          if (settled) return;
          cleanup();
          reject(new Error(data?.message || 'Could not join the room'));
        };
        const timer = setTimeout(() => {
          if (settled) return;
          cleanup();
          reject(new Error('The server did not respond. Please try again.'));
        }, ACTION_TIMEOUT_MS);

        socket.on('room_joined', onJoined);
        socket.on('error', onErr);
        socket.emit('join_room', { code: code.trim().toUpperCase(), username: user?.username });
      });
    },
    [guard, socket, user?.username]
  );

  const leaveRoom = useCallback(() => {
    if (socket?.connected) socket.emit('leave_room');
    resetRoom();
  }, [socket, resetRoom]);

  const setReady = useCallback(
    (isReady: boolean) => {
      if (!socket?.connected) {
        toast.error('Not connected — waiting to reconnect');
        return;
      }
      socket.emit(isReady ? 'player_ready' : 'player_unready');
    },
    [socket]
  );

  const submitColor = useCallback(
    (color: HSLColor) => {
      if (!socket?.connected) {
        toast.error('Not connected — your guess was not sent');
        return;
      }
      setHasSubmitted(true); // optimistic; `submit_ack` corrects it if rejected
      socket.emit('submit_color', { color });
    },
    [socket]
  );

  const playAgain = useCallback(() => {
    if (!socket?.connected) return;
    socket.emit('play_again');
  }, [socket]);

  const endRoom = useCallback(() => {
    if (!socket?.connected) return;
    socket.emit('end_room');
  }, [socket]);

  const sendMessage = useCallback(
    (message: string) => {
      const text = message.trim();
      if (!socket?.connected || !text) return;
      socket.emit('send_message', { message: text.slice(0, 200) });
    },
    [socket]
  );

  const requestState = useCallback(() => {
    if (!socket?.connected) return;
    if (roomCodeRef.current) socket.emit('request_state');
  }, [socket]);

  const connectionMessage = !isOnline
    ? 'You are offline — waiting for your connection'
    : connectionError?.message ?? (isReconnecting ? 'Reconnecting to the game server…' : null);

  return (
    <MultiplayerContext.Provider
      value={{
        currentRoom,
        players,
        phase,
        currentRound,
        totalRounds,
        roundResults,
        leaderboard,
        chatMessages,
        countdown,
        currentColor,
        targetColor,
        timeRemaining,
        phaseEndsAt,
        submittedCount,
        totalSubmitters,
        hasSubmitted,
        playAgainVotes,
        playAgainNeeded,
        gameEndReason,
        isFinalRound,
        isReconnecting,
        isConnected,
        isOnline,
        connectionMessage,
        isCreating,
        isJoining,
        error,
        sessionEnded,
        createRoom,
        joinRoom,
        leaveRoom,
        setReady,
        submitColor,
        playAgain,
        endRoom,
        sendMessage,
        resetRoom,
        requestState,
        retryConnection: retry,
      }}
    >
      {children}
    </MultiplayerContext.Provider>
  );
}

export function useMultiplayer() {
  const context = useContext(MultiplayerContext);
  if (context === undefined) {
    throw new Error('useMultiplayer must be used within a MultiplayerProvider');
  }
  return context;
}

export { MultiplayerContext };
