import { Server, Socket } from 'socket.io';
import { roomManager } from './roomManager.js';
import { CreateRoomInput, JoinRoomInput, SubmitColorInput, RoomConfig } from './types.js';
import { GameService } from '../services/game.service.js';

// Timer intervals for game phases
const roundTimers: Map<string, NodeJS.Timeout> = new Map();
const roundEndTimers: Map<string, NodeJS.Timeout> = new Map(); // Track end round timers separately

export function setupSocketHandlers(io: Server, socket: Socket) {
  
  // Create room
// Create room - with defaults
socket.on('create_room', async (data: CreateRoomInput) => {
  try {
    const { username, userId, config } = data;
    
    // Apply defaults for missing values
    const fullConfig: RoomConfig = {
      roundTimeSeconds: config.roundTimeSeconds ?? 20,      // Default: 20s
      colorTimeSeconds: config.colorTimeSeconds ?? 3,       // Default: 3s
      difficulty: config.difficulty ?? 'medium',            // Default: medium
      specificRounds: config.specificRounds ?? null,        // Default: null (unlimited)
      maxPlayers: config.maxPlayers ?? 4,                   // Default: 4
    };
    
    // Validate ranges
    if (fullConfig.roundTimeSeconds < 10 || fullConfig.roundTimeSeconds > 40) {
      socket.emit('error', { message: 'Round time must be between 10 and 40 seconds' });
      return;
    }
    
    if (fullConfig.colorTimeSeconds < 0.5 || fullConfig.colorTimeSeconds > 7) {
      socket.emit('error', { message: 'Color time must be between 0.5 and 7 seconds' });
      return;
    }
    
    if (fullConfig.maxPlayers < 2 || fullConfig.maxPlayers > 4) {
      socket.emit('error', { message: 'Max players must be between 2 and 4' });
      return;
    }
    
    if (fullConfig.specificRounds !== null && (fullConfig.specificRounds < 1 || fullConfig.specificRounds > 50)) {
      socket.emit('error', { message: 'Specific rounds must be between 1 and 50' });
      return;
    }
    
    const room = roomManager.createRoom(socket.id, userId, username, fullConfig);
    
    socket.join(room.code);
    
    socket.emit('room_created', {
      code: room.code,
      config: room.config,
      players: Array.from(room.players.values()).map(p => ({
        socketId: p.socketId,
        username: p.username,
        isHost: p.isHost,
        status: p.status,
      })),
      hostSocketId: socket.id,
    });
  } catch (error) {
    socket.emit('error', { message: (error as Error).message });
  }
});
  
  // Join room
  socket.on('join_room', async (data: JoinRoomInput) => {
    try {
      const { code, username, userId } = data;
      
      const room = roomManager.joinRoom(code, socket.id, userId, username);
      
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      
      socket.join(code);
      
      // Notify all players in room
      io.to(code).emit('player_joined', {
        username,
        players: Array.from(room.players.values()).map(p => ({
          socketId: p.socketId,
          username: p.username,
          isHost: p.isHost,
          status: p.status,
        })),
      });
      
      socket.emit('room_joined', {
        code: room.code,
        config: room.config,
        players: Array.from(room.players.values()).map(p => ({
          socketId: p.socketId,
          username: p.username,
          isHost: p.isHost,
          status: p.status,
        })),
        hostSocketId: Array.from(room.players.values()).find(p => p.isHost)?.socketId,
        status: room.phase,
      });
    } catch (error) {
      socket.emit('error', { message: (error as Error).message });
    }
  });
  
  // Leave room
  socket.on('leave_room', () => {
    const { roomCode, newHostSocketId } = roomManager.leaveRoom(socket.id);
    
    if (roomCode) {
      socket.leave(roomCode);
      
      // Clear any timers for this room
      clearRoomTimers(roomCode);
      
      if (newHostSocketId) {
        io.to(roomCode).emit('host_changed', {
          newHostSocketId,
          newHostUsername: roomManager.getRoom(roomCode)?.players.get(newHostSocketId)?.username,
        });
      }
      
      io.to(roomCode).emit('player_left', {
        socketId: socket.id,
        players: roomManager.getRoom(roomCode) ? 
          Array.from(roomManager.getRoom(roomCode)!.players.values()).map(p => ({
            socketId: p.socketId,
            username: p.username,
            isHost: p.isHost,
            status: p.status,
          })) : [],
        hostSocketId: newHostSocketId,
      });
    }
    
    socket.emit('left_room', { success: true });
  });
  
  // Player ready
  socket.on('player_ready', () => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) return;
    
    roomManager.setPlayerReady(socket.id, true);
    
    io.to(room.code).emit('player_ready_update', {
      socketId: socket.id,
      username: room.players.get(socket.id)?.username,
      players: Array.from(room.players.values()).map(p => ({
        socketId: p.socketId,
        username: p.username,
        isHost: p.isHost,
        status: p.status,
      })),
    });
    
    // Check if all ready and start countdown
    if (roomManager.areAllPlayersReady(room) && room.players.size >= 2) {
      startCountdown(io, room.code);
    }
  });
  
  // Player unready
  socket.on('player_unready', () => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) return;
    
    roomManager.setPlayerReady(socket.id, false);
    
    io.to(room.code).emit('player_unready_update', {
      socketId: socket.id,
      username: room.players.get(socket.id)?.username,
      players: Array.from(room.players.values()).map(p => ({
        socketId: p.socketId,
        username: p.username,
        isHost: p.isHost,
        status: p.status,
      })),
    });
  });
  
  // Submit color
  socket.on('submit_color', async (data: SubmitColorInput) => {
    const { roomCode, userId, color } = data;
    
    const room = roomManager.getRoom(roomCode);
    if (!room) return;
    
    roomManager.submitGuess(roomCode, userId, color);
    
    const submittedCount = room.roundResults.size;
    const totalPlayers = room.players.size;
    
    io.to(roomCode).emit('player_submitted', {
      username: room.players.get(socket.id)?.username,
      socketId: socket.id,
      submittedCount,
      totalPlayers,
    });
    
    // Check if round is complete (all players submitted)
    if (room.roundResults.size === totalPlayers) {
      // Clear the round end timer if it exists
      const endTimer = roundEndTimers.get(roomCode);
      if (endTimer) {
        clearTimeout(endTimer);
        roundEndTimers.delete(roomCode);
      }
      // End round immediately
      endRound(io, roomCode);
    }
  });
  
  // Play again
  socket.on('play_again', () => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) return;
    
    const result = roomManager.votePlayAgain(room.code, socket.id);
    if (!result) return;
    
    const { room: updatedRoom, allVoted } = result;
    
    io.to(room.code).emit('play_again_update', {
      username: updatedRoom.players.get(socket.id)?.username,
      socketId: socket.id,
      votes: updatedRoom.playAgainVotes.size,
      totalNeeded: updatedRoom.players.size,
    });
    
    if (allVoted) {
      // Clear any existing timers
      clearRoomTimers(room.code);
      
      // Reset for new game
      roomManager.resetForNewGame(room.code);
      io.to(room.code).emit('room_reset', {
        players: Array.from(updatedRoom.players.values()).map(p => ({
          socketId: p.socketId,
          username: p.username,
          isHost: p.isHost,
          status: p.status,
        })),
        status: 'waiting',
      });
    }
  });
  
  // End session (host only)
  socket.on('end_room', () => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) return;
    
    const player = room.players.get(socket.id);
    if (!player?.isHost) {
      socket.emit('error', { message: 'Only host can end the session' });
      return;
    }
    
    // Clear all timers
    clearRoomTimers(room.code);
    
    roomManager.endSession(room.code);
    
    io.to(room.code).emit('session_ended', {
      message: 'Host ended the session',
    });
    
    io.to(room.code).emit('room_reset', {
      players: Array.from(room.players.values()).map(p => ({
        socketId: p.socketId,
        username: p.username,
        isHost: p.isHost,
        status: p.status,
      })),
      status: 'waiting',
    });
  });
  
  // Chat message
  socket.on('send_message', (data: { message: string }) => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) return;
    
    const player = room.players.get(socket.id);
    if (!player) return;
    
    io.to(room.code).emit('new_message', {
      username: player.username,
      message: data.message,
      timestamp: new Date().toISOString(),
    });
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    const { roomCode, player } = roomManager.handleDisconnect(socket.id);
    
    if (roomCode && player) {
      io.to(roomCode).emit('player_left', {
        socketId: socket.id,
        username: player.username,
        players: roomManager.getRoom(roomCode) ? 
          Array.from(roomManager.getRoom(roomCode)!.players.values()).map(p => ({
            socketId: p.socketId,
            username: p.username,
            isHost: p.isHost,
            status: p.status,
          })) : [],
      });
      
      // Check if room should be dissolved (less than 2 players)
      const room = roomManager.getRoom(roomCode);
      if (room && room.players.size < 2) {
        // Clear timers before dissolving
        clearRoomTimers(roomCode);
        io.to(roomCode).emit('room_dissolved', { message: 'Not enough players' });
      }
    }
  });
}

// Helper: Clear all timers for a room
function clearRoomTimers(roomCode: string) {
  const memorizationTimer = roundTimers.get(roomCode);
  if (memorizationTimer) {
    clearTimeout(memorizationTimer);
    roundTimers.delete(roomCode);
  }
  
  const reconstructionTimer = roundEndTimers.get(roomCode);
  if (reconstructionTimer) {
    clearTimeout(reconstructionTimer);
    roundEndTimers.delete(roomCode);
  }
}

// Start countdown before game
function startCountdown(io: Server, roomCode: string) {
  let countdown = 3;
  
  const interval = setInterval(() => {
    io.to(roomCode).emit('all_ready_countdown', { countdown });
    countdown--;
    
    if (countdown < 0) {
      clearInterval(interval);
      startGame(io, roomCode);
    }
  }, 1000);
}

// Start the game
function startGame(io: Server, roomCode: string) {
  const room = roomManager.startGame(roomCode);
  if (!room) return;
  
  startRound(io, roomCode);
}

// Start a round
function startRound(io: Server, roomCode: string) {
  const result = roomManager.startRound(roomCode);
  if (!result) return;
  
  const { room, color } = result;
  
  io.to(roomCode).emit('round_started', {
    round: room.currentRound,
    totalRounds: room.totalRounds,
    color,
    colorDuration: room.config.colorTimeSeconds,
    roundDuration: room.config.roundTimeSeconds,
  });
  
  // Set timer for memorization phase
  const memorizationTimer = setTimeout(() => {
    startReconstruction(io, roomCode);
  }, room.config.colorTimeSeconds * 1000);
  
  roundTimers.set(roomCode, memorizationTimer);
}

// Start reconstruction phase
function startReconstruction(io: Server, roomCode: string) {
  const room = roomManager.startReconstruction(roomCode);
  if (!room) return;
  
  io.to(roomCode).emit('reconstruction_started', {
    roundDuration: room.config.roundTimeSeconds,
  });
  
  // Set timer for round end - store in roundEndTimers
  const reconstructionTimer = setTimeout(() => {
    endRound(io, roomCode);
  }, room.config.roundTimeSeconds * 1000);
  
  roundEndTimers.set(roomCode, reconstructionTimer);
}

// End round and show results
function endRound(io: Server, roomCode: string) {
  // Clear the reconstruction timer
  const reconstructionTimer = roundEndTimers.get(roomCode);
  if (reconstructionTimer) {
    clearTimeout(reconstructionTimer);
    roundEndTimers.delete(roomCode);
  }
  
  const room = roomManager.endRound(roomCode);
  if (!room) return;
  
  const results = roomManager.getRoundResults(room);
  const leaderboard = roomManager.getRoomLeaderboard(room);
  
  io.to(roomCode).emit('round_ended', {
    round: room.currentRound,
    results,
    leaderboard,
  });
  
  // Check if game should end
  if (roomManager.shouldEndGame(room)) {
    // Game ended - show final results, then wait for play again
    io.to(roomCode).emit('game_ended', {
      finalLeaderboard: roomManager.getRoomLeaderboard(room),
    });
    
    // Reset to waiting state but keep room for play again
    setTimeout(() => {
      const currentRoom = roomManager.getRoom(roomCode);
      if (currentRoom && currentRoom.phase === 'ended') {
        roomManager.endSession(roomCode);
        io.to(roomCode).emit('room_reset', {
          players: Array.from(currentRoom.players.values()).map(p => ({
            socketId: p.socketId,
            username: p.username,
            isHost: p.isHost,
            status: 'waiting',
          })),
          status: 'waiting',
        });
      }
    }, 3000); // Wait 3 seconds before resetting
  } else {
    // Prepare for next round - wait 5 seconds before starting next round
    setTimeout(() => {
      const currentRoom = roomManager.getRoom(roomCode);
      if (currentRoom && currentRoom.phase === 'results') {
        const nextRoom = roomManager.resetForNextRound(roomCode);
        if (nextRoom && nextRoom.phase === 'waiting') {
          // All players are now in waiting state - they need to ready up again
          io.to(roomCode).emit('round_interval', {
            message: 'Next round starting soon. Get ready!',
            nextRound: nextRoom.currentRound + 1,
          });
          
          // Don't auto-start next round - wait for players to ready
          // Players must click "Ready" again for next round
        }
      }
    }, 5000); // 5 second break between rounds
  }
}

// Helper: Check if all players are ready for next round
function checkAllReadyForNextRound(io: Server, roomCode: string) {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;
  
  if (roomManager.areAllPlayersReady(room) && room.players.size >= 2) {
    startCountdown(io, roomCode);
  }
}