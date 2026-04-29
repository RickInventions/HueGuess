import type { Server, Socket, Namespace } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import * as challengeService from './challenge.service.js';
import { createRoomSchema, joinRoomSchema, submitColorSchema } from './challenge.schema.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from './challenge.types.js';

export function setupChallengeSocket(io: Server) {
  const challengeNamespace: Namespace = io.of('/challenge');
  
  // Auth middleware for WebSocket
  challengeNamespace.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      const payload = jwt.verify(
        token as string,
        env.JWT_ACCESS_SECRET
      ) as { userId: string };
      
      // Get user info
      const { sql } = await import('../db/connection.js');
      const [user] = await sql`
        SELECT id, username FROM users WHERE id = ${payload.userId}
      `;
      
      if (!user) {
        return next(new Error('User not found'));
      }
      
      (socket as any).userId = user.id;
      (socket as any).username = user.username;
      next();
    } catch (error) {
      // DON'T disconnect, just send error through auth error
      const err = error instanceof Error ? error : new Error('Invalid token');
      next(err);
    }
  });
  
  challengeNamespace.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId as string;
    const username = (socket as any).username as string;
    
    console.log(`👤 ${username} connected to challenge (socket: ${socket.id})`);
    
    // ============ HELPER: Safe event handler ============
    const safeHandler = (event: string, handler: (data: any) => void) => {
      return (data: any) => {
        try {
          handler(data);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Something went wrong';
          console.error(`❌ Error in ${event} from ${username}: ${message}`);
          // Send error to THIS socket only, don't disconnect
          socket.emit('error', { message });
        }
      };
    };
    
    // ============ CREATE ROOM ============
    socket.on('create_room', safeHandler('create_room', (data: any) => {
      const { roundDuration, colorDuration } = createRoomSchema.parse(data);
      
      // Leave current room if in one
      const currentRoom = challengeService.getRoomBySocketId(socket.id);
      if (currentRoom) {
        const leaveResult = challengeService.leaveRoom(userId, socket.id);
        if (leaveResult.room) {
          socket.leave(leaveResult.room.id);
          challengeNamespace.to(leaveResult.room.id).emit('player_left', {
            userId,
            players: leaveResult.remainingPlayers,
            wasHost: leaveResult.wasHost,
            newHostId: leaveResult.newHostId,
          });
          if (leaveResult.wasHost && leaveResult.newHostId) {
            challengeNamespace.to(leaveResult.room.id).emit('host_changed', {
              newHostId: leaveResult.newHostId,
            });
          }
        }
      }
      
      const { room, code } = challengeService.createRoom(
        userId,
        username,
        socket.id,
        roundDuration,
        colorDuration
      );
      
      socket.join(room.id);
      
      socket.emit('room_created', {
        code,
        settings: room.settings,
        players: Array.from(room.players.values()),
      });
      
      console.log(`🏠 Room ${code} created by ${username}`);
    }));
    
    // ============ JOIN ROOM ============
    socket.on('join_room', safeHandler('join_room', (data: any) => {
      const { code } = joinRoomSchema.parse(data);
      
      // Leave current room if in one
      const currentRoom = challengeService.getRoomBySocketId(socket.id);
      if (currentRoom) {
        const leaveResult = challengeService.leaveRoom(userId, socket.id);
        if (leaveResult.room) {
          socket.leave(leaveResult.room.id);
          challengeNamespace.to(leaveResult.room.id).emit('player_left', {
            userId,
            players: leaveResult.remainingPlayers,
            wasHost: leaveResult.wasHost,
            newHostId: leaveResult.newHostId,
          });
          if (leaveResult.wasHost && leaveResult.newHostId) {
            challengeNamespace.to(leaveResult.room.id).emit('host_changed', {
              newHostId: leaveResult.newHostId,
            });
          }
        }
      }
      
      const { room, player, players } = challengeService.joinRoom(
        userId,
        username,
        socket.id,
        code
      );
      
      socket.join(room.id);
      
      // Notify EVERYONE in room about new player (including the joiner)
      challengeNamespace.to(room.id).emit('player_joined', {
        player,
        players,
      });
      
      // Send room state to the new player
      socket.emit('room_joined', {
        code: room.code,
        hostId: room.hostId,
        settings: room.settings,
        players,
        status: room.status,
        currentRound: room.currentRound,
      });
      
      console.log(`👋 ${username} joined room ${code}`);
    }));
    
    // ============ LEAVE ROOM ============
    socket.on('leave_room', safeHandler('leave_room', () => {
      const result = challengeService.leaveRoom(userId, socket.id);
      
      if (result.room) {
        socket.leave(result.room.id);
        
        challengeNamespace.to(result.room.id).emit('player_left', {
          userId,
          players: result.remainingPlayers,
          wasHost: result.wasHost,
          newHostId: result.newHostId,
        });
        
        if (result.wasHost && result.newHostId) {
          challengeNamespace.to(result.room.id).emit('host_changed', {
            newHostId: result.newHostId,
          });
        }
        
        console.log(`👋 ${username} left room ${result.room.code}`);
      }
    }));
    
    // ============ PLAYER READY ============
    socket.on('player_ready', safeHandler('player_ready', () => {
      const room = challengeService.getRoomBySocketId(socket.id);
      if (!room) throw new Error('Not in a room');
      
      const { readyCount, totalPlayers, allReady } = challengeService.setPlayerReady(room.id, userId);
      
      // Broadcast to ALL players in room
      challengeNamespace.to(room.id).emit('player_ready', {
        userId,
        username,
        readyCount,
        totalPlayers,
      });
      
      console.log(`✅ ${username} ready (${readyCount}/${totalPlayers}) in room ${room.code}`);
      
      // If all ready, start countdown
      if (allReady) {
        startGameCountdown(challengeNamespace, room.id);
      }
    }));
    
    // ============ PLAYER UNREADY ============
    socket.on('player_unready', safeHandler('player_unready', () => {
      const room = challengeService.getRoomBySocketId(socket.id);
      if (!room) throw new Error('Not in a room');
      
      const { readyCount, totalPlayers } = challengeService.setPlayerUnready(room.id, userId);
      
      challengeNamespace.to(room.id).emit('player_unready', {
        userId,
        username,
        readyCount,
        totalPlayers,
      });
      
      console.log(`❌ ${username} unready (${readyCount}/${totalPlayers}) in room ${room.code}`);
    }));
    
    // ============ SUBMIT COLOR ============
    socket.on('submit_color', safeHandler('submit_color', (data: any) => {
      const { roundNumber, h, s, l, timeTaken } = submitColorSchema.parse(data);
      const room = challengeService.getRoomBySocketId(socket.id);
      if (!room) throw new Error('Not in a room');
      
      const { allSubmitted } = challengeService.submitColor(
        room.id,
        userId,
        username,
        h,
        s,
        l,
        timeTaken
      );
      
      // ✅ FIX #1: Broadcast submission to ALL players
      challengeNamespace.to(room.id).emit('player_submitted', {
        userId,
        username,
        submittedAt: Date.now(),
      });
      
      console.log(`🎨 ${username} submitted color in room ${room.code} (round ${roundNumber})`);
      
      // If all submitted, end round early
      if (allSubmitted) {
        console.log(`✅ All players submitted in room ${room.code}`);
        endCurrentRound(challengeNamespace, room.id);
      }
    }));
    
    // ============ PLAY AGAIN ============
    socket.on('play_again', safeHandler('play_again', () => {
      const room = challengeService.getRoomBySocketId(socket.id);
      if (!room) throw new Error('Not in a room');
      
      const { playAgainCount, totalPlayers, allReady } = challengeService.requestPlayAgain(
        room.id,
        userId
      );
      
      // ✅ FIX #2: Broadcast play_again to ALL players
      challengeNamespace.to(room.id).emit('play_again_update', {
        userId,
        username,
        playAgainCount,
        totalPlayers,
      });
      
      console.log(`🔄 ${username} wants to play again (${playAgainCount}/${totalPlayers}) in room ${room.code}`);
      
      if (allReady) {
        console.log(`🚀 All players ready for next round in room ${room.code}`);
        startGameCountdown(challengeNamespace, room.id);
      }
    }));
    
    // ============ END ROOM (RESET TO LOBBY) ============
    socket.on('end_room', safeHandler('end_room', () => {
      const room = challengeService.getRoomBySocketId(socket.id);
      if (!room) throw new Error('Not in a room');
      if (room.hostId !== userId) throw new Error('Only the host can end the room');
      
      // ✅ FIX #3: Reset room to lobby instead of disconnecting everyone
      const resetResult = challengeService.resetRoomToLobby(room.id);
      
      // Broadcast room reset to all players (they stay connected)
      challengeNamespace.to(room.id).emit('room_reset', {
        reason: 'Host reset the room',
        settings: room.settings,
        hostId: room.hostId,
        players: resetResult.players,
        roomCode: room.code,
      });
      
      console.log(`🔄 Room ${room.code} reset to lobby by host ${username}`);
    }));
    
    // ============ DISCONNECT ============
    socket.on('disconnect', () => {
      console.log(`👋 ${username} disconnected (socket: ${socket.id})`);
      
      const result = challengeService.leaveRoom(userId, socket.id);
      
      if (result.room) {
        challengeNamespace.to(result.room.id).emit('player_left', {
          userId,
          players: result.remainingPlayers,
          wasHost: result.wasHost,
          newHostId: result.newHostId,
        });
        
        if (result.wasHost && result.newHostId) {
          challengeNamespace.to(result.room.id).emit('host_changed', {
            newHostId: result.newHostId,
          });
        }
        
        // If game in progress and too few players, end round
        if (result.room.status === 'playing' && result.remainingPlayers.length < 2) {
          endCurrentRound(challengeNamespace, result.room.id);
        }
        
        console.log(`👋 ${username} removed from room ${result.room.code}`);
      }
    });
  });
  
  // ✅ FIX #4: Handle connection errors gracefully
  challengeNamespace.on('connect_error', (err) => {
    console.error('Connection error:', err.message);
    // This is handled by the client receiving 'connect_error' event
  });
  
  return challengeNamespace;
}

// ============ GAME FUNCTIONS ============

async function startGameCountdown(nsp: Namespace, roomId: string) {
  const room = challengeService.getRoomById(roomId);
  if (!room) return;
  
  room.status = 'countdown';
  
  // 3-second countdown
  for (let i = 3; i > 0; i--) {
    nsp.to(roomId).emit('game_countdown', { count: i });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Start the round
  const roundData = challengeService.startRound(roomId);
  nsp.to(roomId).emit('round_started', roundData);
  
  console.log(`🎮 Round ${roundData.roundNumber} started in room ${room.code}`);
  
  // Set timeout for round end
  setTimeout(() => {
    const currentRoom = challengeService.getRoomById(roomId);
    if (currentRoom && currentRoom.status === 'playing') {
      console.log(`⏰ Round time expired in room ${currentRoom.code}`);
      endCurrentRound(nsp, roomId);
    }
  }, room.settings.roundDuration * 1000);
}

function endCurrentRound(nsp: Namespace, roomId: string) {
  const room = challengeService.getRoomById(roomId);
  if (!room) return;
  
  const results = challengeService.endRound(roomId);
  nsp.to(roomId).emit('round_ended', { results });
  
  console.log(`🏁 Round ${results.roundNumber} ended in room ${room.code}`);
}