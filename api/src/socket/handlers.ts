import { Server, Socket } from 'socket.io';
import { roomManager } from './roomManager.js';
import { CreateRoomInput, JoinRoomInput, SubmitColorInput, RoomConfig } from './types.js';

// Timer maps
const roundTimers: Map<string, NodeJS.Timeout> = new Map();
const roundEndTimers: Map<string, NodeJS.Timeout> = new Map();

export function setupSocketHandlers(io: Server, socket: Socket) {
  
  // Create room
  socket.on('create_room', async (data: CreateRoomInput) => {
    try {
      const { username, userId, config } = data;
      
      const fullConfig: RoomConfig = {
        roundTimeSeconds: config.roundTimeSeconds ?? 20,
        colorTimeSeconds: config.colorTimeSeconds ?? 3,
        difficulty: config.difficulty ?? 'medium',
        specificRounds: config.specificRounds ?? null,
        maxPlayers: config.maxPlayers ?? 4,
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
    
    // Don't allow ready if game is ended (waiting for play again)
    if (room.phase === 'ended') {
      socket.emit('error', { message: 'Game has ended. Please click "Play Again" to start a new game.' });
      return;
    }
    
    // Don't allow ready if game is in progress
    if (room.phase !== 'waiting' && room.phase !== 'results') {
      socket.emit('error', { message: 'Cannot ready during active round' });
      return;
    }
    
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
    
    // Check if all ready
    if (roomManager.areAllPlayersReady(room) && room.players.size >= 2) {
      // Determine if this is a new game or next round
      if (room.currentRound === 0) {
        // New game
        startCountdownForNewGame(io, room.code);
      } else if (room.phase === 'waiting' && room.currentRound > 0) {
        // Next round (game already started)
        startCountdownForNextRound(io, room.code);
      } else if (room.phase === 'results' && room.currentRound > 0) {
        // This case shouldn't happen, but handle it
        startCountdownForNextRound(io, room.code);
      }
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
    
    // Check if round is complete
    if (room.roundResults.size === totalPlayers) {
      const endTimer = roundEndTimers.get(roomCode);
      if (endTimer) {
        clearTimeout(endTimer);
        roundEndTimers.delete(roomCode);
      }
      endRound(io, roomCode);
    }
  });
  
  // Play again (only after game ended)
  socket.on('play_again', () => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) return;
    
    // Only allow play again when game ended
    if (room.phase !== 'ended') {
      socket.emit('error', { message: 'Game not ended yet' });
      return;
    }
    
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
      clearRoomTimers(room.code);
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
    
    clearRoomTimers(room.code);
    roomManager.endSession(room.code);
    
    io.to(room.code).emit('session_ended', { message: 'Host ended the session' });
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
      
      const room = roomManager.getRoom(roomCode);
      if (room && room.players.size < 2) {
        clearRoomTimers(roomCode);
        io.to(roomCode).emit('room_dissolved', { message: 'Not enough players' });
      }
    }
  });
}

// Helper: Clear all timers for a room
function clearRoomTimers(roomCode: string) {
  const timer1 = roundTimers.get(roomCode);
  if (timer1) {
    clearTimeout(timer1);
    roundTimers.delete(roomCode);
  }
  const timer2 = roundEndTimers.get(roomCode);
  if (timer2) {
    clearTimeout(timer2);
    roundEndTimers.delete(roomCode);
  }
}

// Countdown for NEW GAME (resets stats)
function startCountdownForNewGame(io: Server, roomCode: string) {
  let countdown = 3;
  const interval = setInterval(() => {
    io.to(roomCode).emit('all_ready_countdown', { countdown });
    countdown--;
    if (countdown < 0) {
      clearInterval(interval);
      startNewGame(io, roomCode);
    }
  }, 1000);
}

// Countdown for NEXT ROUND (preserves stats)
function startCountdownForNextRound(io: Server, roomCode: string) {
  let countdown = 3;
  const interval = setInterval(() => {
    io.to(roomCode).emit('all_ready_countdown', { countdown });
    countdown--;
    if (countdown < 0) {
      clearInterval(interval);
      startNextRound(io, roomCode);
    }
  }, 1000);
}

// Start a brand new game (first round)
function startNewGame(io: Server, roomCode: string) {
  const room = roomManager.startNewGame(roomCode);
  if (!room) {
    console.error(`[Game] Failed to start new game in room ${roomCode}`);
    return;
  }
  
  
  // Start the first round
  const result = roomManager.startNextRound(roomCode);
  if (!result) {
    console.error(`[Game] Failed to start first round in room ${roomCode}`);
    return;
  }
  
  const { room: updatedRoom, color } = result;
  
  io.to(roomCode).emit('round_started', {
    round: updatedRoom.currentRound,
    totalRounds: updatedRoom.totalRounds,
    color,
    colorDuration: updatedRoom.config.colorTimeSeconds,
    roundDuration: updatedRoom.config.roundTimeSeconds,
  });
  
  // Set timer for memorization phase
  const memorizationTimer = setTimeout(() => {
    startReconstruction(io, roomCode);
  }, updatedRoom.config.colorTimeSeconds * 1000);
  roundTimers.set(roomCode, memorizationTimer);
}

// Start the next round (preserving stats)
function startNextRound(io: Server, roomCode: string) {
  const result = roomManager.startNextRound(roomCode);
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
  
  // Clear memorization timer
  const memTimer = roundTimers.get(roomCode);
  if (memTimer) {
    clearTimeout(memTimer);
    roundTimers.delete(roomCode);
  }
  
  // Set timer for round end
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
    // Game ended
    io.to(roomCode).emit('game_ended', {
      finalLeaderboard: roomManager.getRoomLeaderboard(room),
    });
    
    // Mark as ended so players cannot ready, only play again
    setTimeout(() => {
      const currentRoom = roomManager.getRoom(roomCode);
      if (currentRoom && currentRoom.phase === 'results') {
        currentRoom.phase = 'ended';
        io.to(roomCode).emit('game_ended_ready', { message: 'Click Play Again to start a new game' });
      }
    }, 3000);
  } else {
    // Prepare for next round - show results, then wait for players to ready
    setTimeout(() => {
      const currentRoom = roomManager.getRoom(roomCode);
      if (currentRoom && currentRoom.phase === 'results') {
        // Advance to next round (increment counter, set to waiting)
        const nextRoom = roomManager.advanceToNextRound(roomCode);
        if (nextRoom) {
          io.to(roomCode).emit('round_interval', {
            message: `Round ${nextRoom.currentRound} starting soon. Get ready!`,
            nextRound: nextRoom.currentRound,
          });
        }
      }
    }, 5000); // 5 second break
  }
}