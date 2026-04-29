import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env.js';
import { generateColor, calculateScore } from '../game/game.service.js';
import type { HSLColor } from '../game/game.types.js';
import type {
  Room,
  Player,
  PlayerStatus,
  RoomStatus,
  RoundRecord,
  RoundSubmission,
  RoundResult,
  RoundRanking,
  LeaderboardEntry,
} from './challenge.types.js';

// Active rooms storage
const rooms = new Map<string, Room>();
const socketToRoom = new Map<string, string>(); // socketId -> roomCode
const codeToRoomId = new Map<string, string>(); // code -> roomId

// Cleanup stale rooms (older than 2 hours)
const ROOM_TTL = 2 * 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (now - room.createdAt > ROOM_TTL) {
      deleteRoom(id);
    }
  }
}, 10 * 60 * 1000);

export function createRoom(
  hostId: string,
  hostUsername: string,
  socketId: string,
  roundDuration: number,
  colorDuration: number
): { room: Room; code: string } {
  // Generate unique 8-char hex code
  let code: string;
  do {
    code = generateRoomCode();
  } while (codeToRoomId.has(code));
  
  const room: Room = {
    id: uuidv4(),
    code,
    hostId,
    settings: {
      roundDuration,
      colorDuration,
      maxPlayers: env.MAX_PLAYERS,
    },
    players: new Map(),
    status: 'waiting',
    rounds: [],
    currentRound: 0,
    createdAt: Date.now(),
  };
  
  // Add host as first player
  room.players.set(hostId, {
    userId: hostId,
    username: hostUsername,
    socketId,
    status: 'joined',
    joinedAt: Date.now(),
  });
  
  rooms.set(room.id, room);
  codeToRoomId.set(code, room.id);
  socketToRoom.set(socketId, room.id);
  
  return { room, code };
}

export function joinRoom(
  userId: string,
  username: string,
  socketId: string,
  code: string
): { room: Room; player: Player; players: Player[] } {
  const roomId = codeToRoomId.get(code.toUpperCase());
  
  if (!roomId) {
    throw new Error('Room not found');
  }
  
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Room no longer exists');
  }
  
  if (room.status !== 'waiting') {
    throw new Error('Game already in progress');
  }
  
  if (room.players.size >= room.settings.maxPlayers) {
    throw new Error('Room is full');
  }
  
  if (room.players.has(userId)) {
    throw new Error('You are already in this room');
  }
  
  const player: Player = {
    userId,
    username,
    socketId,
    status: 'joined',
    joinedAt: Date.now(),
  };
  
  room.players.set(userId, player);
  socketToRoom.set(socketId, room.id);
  
  return {
    room,
    player,
    players: Array.from(room.players.values()),
  };
}

export function leaveRoom(userId: string, socketId: string): {
  room: Room | null;
  wasHost: boolean;
  newHostId?: string;
  remainingPlayers: Player[];
} {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) return { room: null, wasHost: false, remainingPlayers: [] };
  
  const room = rooms.get(roomId);
  if (!room) return { room: null, wasHost: false, remainingPlayers: [] };
  
  // Reset player status
  const player = room.players.get(userId);
  if (player) {
    player.status = 'joined'; // Reset status for cleanup
  }
  
  const wasHost = userId === room.hostId;
  room.players.delete(userId);
  socketToRoom.delete(socketId);
  
  // Handle host leaving
  let newHostId: string | undefined;
  if (wasHost && room.players.size > 0) {
    // Assign new host (first remaining player)
    const newHost = room.players.values().next().value;
    if (newHost) {
      room.hostId = newHost.userId;
      newHostId = newHost.userId;
    }
  }
  
  // Clean up empty rooms
  if (room.players.size === 0) {
    deleteRoom(room.id);
    return { room: null, wasHost, remainingPlayers: [] };
  }
  
  // If game in progress and too few players, end game
  if (room.status !== 'waiting' && room.players.size < 2) {
    room.status = 'finished';
  }
  
  return {
    room,
    wasHost,
    newHostId,
    remainingPlayers: Array.from(room.players.values()),
  };
}

export function setPlayerReady(roomId: string, userId: string): {
  readyCount: number;
  totalPlayers: number;
  allReady: boolean;
} {
  const room = rooms.get(roomId);
  if (!room) throw new Error('Room not found');
  if (room.status !== 'waiting') throw new Error('Game already started');
  
  const player = room.players.get(userId);
  if (!player) throw new Error('Player not in room');
  
  player.status = 'ready';
  
  const readyCount = Array.from(room.players.values()).filter(p => p.status === 'ready').length;
  const totalPlayers = room.players.size;
  const allReady = readyCount === totalPlayers && totalPlayers >= 2;
  
  return { readyCount, totalPlayers, allReady };
}

export function setPlayerUnready(roomId: string, userId: string): {
  readyCount: number;
  totalPlayers: number;
} {
  const room = rooms.get(roomId);
  if (!room) throw new Error('Room not found');
  if (room.status !== 'waiting') throw new Error('Game already started');
  
  const player = room.players.get(userId);
  if (!player) throw new Error('Player not in room');
  
  player.status = 'joined';
  
  const readyCount = Array.from(room.players.values()).filter(p => p.status === 'ready').length;
  const totalPlayers = room.players.size;
  
  return { readyCount, totalPlayers };
}

export function startRound(roomId: string): {
  roundNumber: number;
  color: HSLColor;
  colorDuration: number;
  roundDuration: number;
} {
  const room = rooms.get(roomId);
  if (!room) throw new Error('Room not found');
  
  room.status = 'playing';
  room.currentRound++;
  
  // Set all players to playing
  room.players.forEach(p => {
    p.status = 'playing';
  });
  
  const color = generateColor('medium');
  
  // Create round record
  const round: RoundRecord = {
    roundNumber: room.currentRound,
    originalColor: color,
    submissions: new Map(),
    startTime: Date.now(),
  };
  
  room.rounds.push(round);
  
  return {
    roundNumber: room.currentRound,
    color,
    colorDuration: room.settings.colorDuration,
    roundDuration: room.settings.roundDuration,
  };
}

export function submitColor(
  roomId: string,
  userId: string,
  username: string,
  h: number,
  s: number,
  l: number,
  timeTaken: number
): { allSubmitted: boolean; submission?: RoundSubmission } {
  const room = rooms.get(roomId);
  if (!room) throw new Error('Room not found');
  if (room.status !== 'playing') throw new Error('Round not in progress');
  
  const player = room.players.get(userId);
  if (!player) throw new Error('Player not in room');
  if (player.status === 'submitted') throw new Error('Already submitted');
  
  const currentRound = room.rounds[room.rounds.length - 1];
  if (!currentRound) throw new Error('No active round');
  
  const accuracyResult = calculateScore(
    currentRound.originalColor,
    { h, s, l },
    'challenge'
  );
  
  const submission: RoundSubmission = {
    userId,
    username,
    color: { h, s, l },
    accuracy: accuracyResult.accuracy,
    accuracyFormatted: accuracyResult.accuracyFormatted,
    submittedAt: Date.now(),
    timeTaken,
  };
  
  currentRound.submissions.set(userId, submission);
  player.status = 'submitted';
  
  const submittedCount = Array.from(room.players.values())
    .filter(p => p.status === 'submitted' || p.status === 'finished')
    .length;
  
  const allSubmitted = submittedCount === room.players.size;
  
  return { allSubmitted, submission };
}

export function resetRoomToLobby(roomId: string): {
  players: Player[];
} {
  const room = rooms.get(roomId);
  if (!room) throw new Error('Room not found');
  
  // Reset room state
  room.status = 'waiting';
  room.rounds = [];
  room.currentRound = 0;
  
  // Reset all players to 'joined' status
  room.players.forEach(player => {
    player.status = 'joined';
  });
  
  return {
    players: Array.from(room.players.values()),
  };
}

export function endRound(roomId: string): RoundResult {
  const room = rooms.get(roomId);
  if (!room) throw new Error('Room not found');
  
  room.status = 'round_end';
  
  const currentRound = room.rounds[room.rounds.length - 1];
  currentRound.endTime = Date.now();
  
  // Mark any non-submitted players
  room.players.forEach(p => {
    if (p.status === 'playing') {
      p.status = 'finished';
    }
  });
  
  // Calculate round rankings
  const submissions = Array.from(currentRound.submissions.values());
  const rankings: RoundRanking[] = submissions
    .sort((a, b) => b.accuracy - a.accuracy)
    .map((sub, index) => ({
      rank: index + 1,
      userId: sub.userId,
      username: sub.username,
      accuracy: sub.accuracy,
      accuracyFormatted: sub.accuracyFormatted,
    }));
  
  // Calculate leaderboard (average accuracy across all rounds)
  const leaderboard = calculateLeaderboard(room);
  
  return {
    roundNumber: currentRound.roundNumber,
    originalColor: currentRound.originalColor,
    submissions: submissions.sort((a, b) => b.accuracy - a.accuracy),
    rankings,
    leaderboard,
  };
}

export function requestPlayAgain(roomId: string, userId: string): {
  playAgainCount: number;
  totalPlayers: number;
  allReady: boolean;
} {
  const room = rooms.get(roomId);
  if (!room) throw new Error('Room not found');
  if (room.status !== 'round_end') throw new Error('Round not ended');
  
  const player = room.players.get(userId);
  if (!player) throw new Error('Player not in room');
  
  player.status = 'ready';
  
  const playAgainCount = Array.from(room.players.values())
    .filter(p => p.status === 'ready')
    .length;
  const totalPlayers = room.players.size;
  const allReady = playAgainCount === totalPlayers;
  
  return { playAgainCount, totalPlayers, allReady };
}

export function endGame(roomId: string): { reason: string } {
  const room = rooms.get(roomId);
  if (!room) throw new Error('Room not found');
  
  room.status = 'finished';
  
  // Reset all players to joined
  room.players.forEach(p => {
    p.status = 'joined';
  });
  
  return { reason: 'Host ended the game' };
}

export function getRoomBySocketId(socketId: string): Room | undefined {
  const roomId = socketToRoom.get(socketId);
  return roomId ? rooms.get(roomId) : undefined;
}

export function getRoomById(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

function calculateLeaderboard(room: Room): LeaderboardEntry[] {
  const playerAccuracies = new Map<string, { total: number; rounds: number }>();
  
  // Aggregate all rounds for each player
  room.rounds.forEach(round => {
    round.submissions.forEach(sub => {
      const stats = playerAccuracies.get(sub.userId) || { total: 0, rounds: 0 };
      stats.total += sub.accuracy;
      stats.rounds += 1;
      playerAccuracies.set(sub.userId, stats);
    });
  });
  
  // Calculate averages and rank
  const entries: LeaderboardEntry[] = Array.from(playerAccuracies.entries())
    .map(([userId, stats]) => {
      const player = room.players.get(userId);
      const avgAccuracy = Math.round((stats.total / stats.rounds) * 1000) / 1000;
      return {
        rank: 0, // Will be set after sorting
        userId,
        username: player?.username || 'Unknown',
        avgAccuracy,
        avgAccuracyFormatted: `${avgAccuracy.toFixed(3)}%`,
        roundsPlayed: stats.rounds,
        totalAccuracy: Math.round(stats.total * 1000) / 1000,
      };
    })
    .sort((a, b) => b.avgAccuracy - a.avgAccuracy)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  
  return entries;
}

function generateRoomCode(): string {
  return Array.from({ length: 8 }, () =>
    '0123456789ABCDEF'[Math.floor(Math.random() * 16)]
  ).join('');
}

function deleteRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (room) {
    codeToRoomId.delete(room.code);
    room.players.forEach(player => {
      socketToRoom.delete(player.socketId);
    });
    rooms.delete(roomId);
  }
}