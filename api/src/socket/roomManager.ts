import { Room, Player, RoomConfig, GamePhase, PlayerStatus } from './types.js';
import { HSLColor, DIFFICULTY_CONFIGS } from '../types/game.types.js';
import { generateRandomColor } from '../utils/hsl.utils.js';

// Generate 8-digit hex room code
function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerToRoom: Map<string, string> = new Map(); // socketId -> roomCode
  private disconnectTimeouts: Map<string, NodeJS.Timeout> = new Map(); // socketId -> timeout

  // Create a new room
  createRoom(hostSocketId: string, hostUserId: string, hostUsername: string, config: RoomConfig): Room {
    const code = generateRoomCode();
    
    const host: Player = {
      socketId: hostSocketId,
      userId: hostUserId,
      username: hostUsername,
      status: 'waiting',
      isHost: true,
      totalAccuracy: 0,
      roundsPlayed: 0,
    };
    
    const room: Room = {
      code,
      config,
      players: new Map([[hostSocketId, host]]),
      phase: 'waiting',
      currentRound: 0,
      totalRounds: config.specificRounds,
      roundResults: new Map(),
      playAgainVotes: new Set(),
      createdAt: new Date(),
    };
    
    this.rooms.set(code, room);
    this.playerToRoom.set(hostSocketId, code);
    
    return room;
  }

  // Join an existing room
  joinRoom(code: string, socketId: string, userId: string, username: string): Room | null {
    const room = this.rooms.get(code);
    
    if (!room) return null;
    
    // Check if room is full
    if (room.players.size >= room.config.maxPlayers) {
      throw new Error('Room is full');
    }
    
    // Check if game already started
    if (room.phase !== 'waiting') {
      throw new Error('Game already in progress');
    }
    
    const player: Player = {
      socketId,
      userId,
      username,
      status: 'waiting',
      isHost: false,
      totalAccuracy: 0,
      roundsPlayed: 0,
    };
    
    room.players.set(socketId, player);
    this.playerToRoom.set(socketId, code);
    
    return room;
  }

  // Leave room
  leaveRoom(socketId: string): { roomCode: string | null; newHostSocketId: string | null } {
    const roomCode = this.playerToRoom.get(socketId);
    if (!roomCode) return { roomCode: null, newHostSocketId: null };
    
    const room = this.rooms.get(roomCode);
    if (!room) return { roomCode: null, newHostSocketId: null };
    
    const player = room.players.get(socketId);
    const wasHost = player?.isHost || false;
    const username = player?.username;
    
    room.players.delete(socketId);
    this.playerToRoom.delete(socketId);
    
    // Clear disconnect timeout if exists
    const timeout = this.disconnectTimeouts.get(socketId);
    if (timeout) {
      clearTimeout(timeout);
      this.disconnectTimeouts.delete(socketId);
    }
    
    let newHostSocketId: string | null = null;
    
    // If no players left, delete room
    if (room.players.size === 0) {
      this.rooms.delete(roomCode);
      return { roomCode, newHostSocketId: null };
    }
    
    // If host left, assign new host
    if (wasHost) {
      const firstPlayer = room.players.values().next().value;
      if (firstPlayer) {
        firstPlayer.isHost = true;
        newHostSocketId = firstPlayer.socketId;
      }
    }
    
    return { roomCode, newHostSocketId };
  }

  // Mark player as ready/unready
  setPlayerReady(socketId: string, isReady: boolean): Room | null {
    const roomCode = this.playerToRoom.get(socketId);
    if (!roomCode) return null;
    
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    
    // Don't allow ready if game is ended (waiting for play again)
    if (room.phase === 'ended') {
      return null;
    }
    
    const player = room.players.get(socketId);
    if (!player) return null;
    
    player.status = isReady ? 'ready' : 'waiting';
    
    return room;
  }

  // Check if all players are ready
  areAllPlayersReady(room: Room): boolean {
    if (room.players.size < 2) return false;
    
    for (const player of room.players.values()) {
      if (player.status !== 'ready') return false;
    }
    return true;
  }

  // Start a NEW GAME (resets all stats, called only once per session)
  startNewGame(roomCode: string): Room | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    
    if (!this.areAllPlayersReady(room)) return null;
    if (room.currentRound !== 0) {
      return null;
    }
    
    // Set phase to 'waiting' first - countdown will be handled by handler
    // We don't set to 'countdown' here because we need to start the first round immediately after countdown
    room.phase = 'waiting';
    room.currentRound = 1;
    room.roundResults.clear();
    room.playAgainVotes.clear();
    
    // Reset all player stats
    for (const player of room.players.values()) {
      player.status = 'playing';
      player.totalAccuracy = 0;
      player.roundsPlayed = 0;
      player.currentAccuracy = undefined;
    }
    
    return room;
  }

  // Start a NEW ROUND (preserves stats, increments round counter)
  startNextRound(roomCode: string): { room: Room; color: HSLColor } | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    
    // Ensure we're in waiting phase and game has started (currentRound > 0)
    // Also allow from 'results' phase if we just finished a round
    if (room.phase !== 'waiting' && room.phase !== 'results') {
      return null;
    }
    
    // Generate color based on difficulty
    const config = DIFFICULTY_CONFIGS[room.config.difficulty];
    const color = generateRandomColor(config.saturationRange, config.lightnessRange);
    
    room.phase = 'memorization';
    room.currentColor = color;
    room.roundStartTime = new Date();
    room.roundEndTime = new Date(Date.now() + room.config.colorTimeSeconds * 1000);
    
    // Clear previous round results
    room.roundResults.clear();
    
    return { room, color };
  }

  // End memorization, start reconstruction
  startReconstruction(roomCode: string): Room | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    
    room.phase = 'reconstruction';
    room.roundEndTime = new Date(Date.now() + room.config.roundTimeSeconds * 1000);
    
    return room;
  }

  // Submit a player's guess
  submitGuess(roomCode: string, userId: string, color: HSLColor, isTimeout: boolean = false): Room | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    
    if (room.phase !== 'reconstruction') return null;
    
    // Find player by userId
    let playerEntry: [string, Player] | undefined;
    for (const [sid, p] of room.players) {
      if (p.userId === userId) {
        playerEntry = [sid, p];
        break;
      }
    }
    
    if (!playerEntry) return null;
    
    const [socketId, player] = playerEntry;
    
    // Check if already submitted
    if (room.roundResults.has(socketId)) return null;
    
    // Calculate accuracy (3 decimal places)
    const accuracy = isTimeout ? 0 : this.calculateAccuracy(room.currentColor!, color);
    
    room.roundResults.set(socketId, {
      accuracy,
      userColor: color,
      submittedAt: new Date(),
      isTimeout,
    });
    
    return room;
  }

  // Calculate accuracy (returns 3 decimal places)
  private calculateAccuracy(original: HSLColor, user: HSLColor): number {
    const hueDiff = Math.min(
      Math.abs(original.h - user.h),
      360 - Math.abs(original.h - user.h)
    ) / 180;
    
    const satDiff = Math.abs(original.s - user.s) / 100;
    const lightDiff = Math.abs(original.l - user.l) / 100;
    
    const weightedDiff = (hueDiff * 0.5) + (satDiff * 0.25) + (lightDiff * 0.25);
    const accuracy = Math.max(0, Math.min(100, (1 - weightedDiff) * 100));
    
    // Round to 3 decimal places
    return Math.round(accuracy * 1000) / 1000;
  }

  // End round and calculate results
  endRound(roomCode: string): Room | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    
    // Auto-submit 0% for players who didn't submit
    for (const [socketId, player] of room.players) {
      if (!room.roundResults.has(socketId)) {
        room.roundResults.set(socketId, {
          accuracy: 0,
          userColor: { h: 0, s: 0, l: 0 },
          submittedAt: new Date(),
          isTimeout: true,
        });
      }
    }
    
    // Update player stats (accumulate accuracy)
    for (const [socketId, player] of room.players) {
      const result = room.roundResults.get(socketId)!;
      player.totalAccuracy += result.accuracy;
      player.roundsPlayed++;
      player.currentAccuracy = result.accuracy;
    }
    
    room.phase = 'results';
    
    return room;
  }

  // Get round results with cumulative average (3 decimals)
  getRoundResults(room: Room): any[] {
    const results = [];
    for (const [socketId, result] of room.roundResults) {
      const player = room.players.get(socketId)!;
      const cumulativeAvg = player.roundsPlayed > 0 ? player.totalAccuracy / player.roundsPlayed : 0;
      results.push({
        socketId,
        userId: player.userId,
        username: player.username,
        accuracy: Math.round(result.accuracy * 1000) / 1000,
        userColor: result.userColor,
        isTimeout: result.isTimeout,
        cumulativeAverage: Math.round(cumulativeAvg * 1000) / 1000,
      });
    }
    
    // Sort by accuracy (descending)
    results.sort((a, b) => b.accuracy - a.accuracy);
    return results;
  }

  // Get overall room leaderboard (3 decimals)
  getRoomLeaderboard(room: Room): any[] {
    const leaderboard = [];
    for (const [socketId, player] of room.players) {
      leaderboard.push({
        socketId,
        userId: player.userId,
        username: player.username,
        averageAccuracy: player.roundsPlayed > 0 ? Math.round((player.totalAccuracy / player.roundsPlayed) * 1000) / 1000 : 0,
        roundsPlayed: player.roundsPlayed,
        totalAccuracy: Math.round(player.totalAccuracy * 1000) / 1000,
      });
    }
    
    leaderboard.sort((a, b) => b.averageAccuracy - a.averageAccuracy);
    return leaderboard;
  }

  // Check if round is complete (all submitted or timeout)
  isRoundComplete(room: Room): boolean {
    if (room.phase !== 'reconstruction') return false;
    
    // All players submitted
    if (room.roundResults.size === room.players.size) return true;
    
    // Time's up
    if (room.roundEndTime && new Date() >= room.roundEndTime) return true;
    
    return false;
  }

  // Check if game should end
  shouldEndGame(room: Room): boolean {
    // Specific rounds limit reached
    if (room.totalRounds && room.currentRound >= room.totalRounds) {
      return true;
    }
    
    // Less than 2 players
    if (room.players.size < 2) {
      return true;
    }
    
    return false;
  }

  // Reset room for next round (increments round counter, keeps stats)
  advanceToNextRound(roomCode: string): Room | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    
    if (this.shouldEndGame(room)) {
      room.phase = 'ended';
      return room;
    }
    
    // Increment round counter for next round
    room.currentRound++;
    room.phase = 'waiting';
    room.playAgainVotes.clear();
    room.roundResults.clear();
    
    // Reset player statuses to 'waiting' (not ready)
    // IMPORTANT: Do NOT reset totalAccuracy or roundsPlayed
    for (const player of room.players.values()) {
      player.status = 'waiting';
    }
    
    return room;
  }

  // Vote for play again
  votePlayAgain(roomCode: string, socketId: string): { room: Room; allVoted: boolean } | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    
    room.playAgainVotes.add(socketId);
    
    const allVoted = room.playAgainVotes.size === room.players.size;
    
    return { room, allVoted };
  }

  // Reset room for new game after play again vote
  resetForNewGame(roomCode: string): Room | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    
    room.phase = 'waiting';
    room.currentRound = 0;
    room.roundResults.clear();
    room.playAgainVotes.clear();
    
    for (const player of room.players.values()) {
      player.status = 'waiting';
      player.totalAccuracy = 0;
      player.roundsPlayed = 0;
      player.currentAccuracy = undefined;
    }
    
    return room;
  }

  // Handle player disconnect
  handleDisconnect(socketId: string): { roomCode: string | null; player: Player | null } {
    const roomCode = this.playerToRoom.get(socketId);
    if (!roomCode) return { roomCode: null, player: null };
    
    const room = this.rooms.get(roomCode);
    if (!room) return { roomCode: null, player: null };
    
    const player = room.players.get(socketId);
    if (!player) return { roomCode: null, player: null };
    
    // Mark as disconnected
    player.status = 'disconnected';
    player.disconnectedAt = new Date();
    
    // Set timeout to remove after 30 seconds
    const timeout = setTimeout(() => {
      this.leaveRoom(socketId);
      this.disconnectTimeouts.delete(socketId);
    }, 30000);
    
    this.disconnectTimeouts.set(socketId, timeout);
    
    return { roomCode, player };
  }

  // Handle player reconnect
  handleReconnect(socketId: string, newSocketId: string): { roomCode: string | null; room: Room | null } {
    const roomCode = this.playerToRoom.get(socketId);
    if (!roomCode) return { roomCode: null, room: null };
    
    const room = this.rooms.get(roomCode);
    if (!room) return { roomCode: null, room: null };
    
    const player = room.players.get(socketId);
    if (!player) return { roomCode: null, room: null };
    
    // Clear disconnect timeout
    const timeout = this.disconnectTimeouts.get(socketId);
    if (timeout) {
      clearTimeout(timeout);
      this.disconnectTimeouts.delete(socketId);
    }
    
    // Update mapping
    this.playerToRoom.delete(socketId);
    this.playerToRoom.set(newSocketId, roomCode);
    
    // Update player
    room.players.delete(socketId);
    player.socketId = newSocketId;
    player.status = room.phase === 'waiting' || room.phase === 'results' ? 'waiting' : 'playing';
    player.disconnectedAt = undefined;
    room.players.set(newSocketId, player);
    
    // If in reconstruction phase and didn't submit this round, auto-submit 0%
    if (room.phase === 'reconstruction' && !room.roundResults.has(newSocketId)) {
      this.submitGuess(roomCode, player.userId, { h: 0, s: 0, l: 0 }, true);
    }
    
    return { roomCode, room };
  }

  // Get room by code
  getRoom(code: string): Room | null {
    return this.rooms.get(code) || null;
  }

  // Get room by socket ID
  getRoomBySocketId(socketId: string): Room | null {
    const roomCode = this.playerToRoom.get(socketId);
    return roomCode ? this.rooms.get(roomCode) || null : null;
  }

  // Get player in room
  getPlayer(roomCode: string, userId: string): Player | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    
    for (const player of room.players.values()) {
      if (player.userId === userId) return player;
    }
    return null;
  }

  // End session (host only) - resets everything but keeps room
  endSession(roomCode: string): Room | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    
    room.phase = 'waiting';
    room.currentRound = 0;
    room.roundResults.clear();
    room.playAgainVotes.clear();
    
    for (const player of room.players.values()) {
      player.status = 'waiting';
      player.totalAccuracy = 0;
      player.roundsPlayed = 0;
      player.currentAccuracy = undefined;
    }
    
    return room;
  }
}

export const roomManager = new RoomManager();