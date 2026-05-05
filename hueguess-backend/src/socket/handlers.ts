import { Server, Socket } from 'socket.io'
import { roomManager, type RoomConfig } from './roomManager.js'
import { calculateMultiplayerAccuracy } from './gameManager.js'
import type { ColorHSL } from '../types/index.js'
import { GameService } from '../services/game.service.js'

export function registerHandlers(io: Server, socket: Socket) {
  // ─── Room Management ───────────────────

  socket.on('create_room', (data: { username: string; config: RoomConfig; userId?: string }) => {
    try {
      const roundDuration = Math.max(15, Math.min(30, data.config.roundDuration || 20))
      const colorDuration = Math.max(0.5, Math.min(7, data.config.colorDuration || 3))

      const config: RoomConfig = { roundDuration, colorDuration }
      const room = roomManager.createRoom(socket.id, data.username, config, data.userId || null)

      socket.join(room.code)

      socket.emit('room_created', {
        code: room.code,
        config: room.config,
        players: room.players,
        hostSocketId: room.hostSocketId,
      })

      console.log(`🏠 Room ${room.code} created by ${data.username}`)
    } catch (error) {
      socket.emit('error', { message: 'Failed to create room' })
    }
  })

  socket.on('join_room', (data: { code: string; username: string; userId?: string }) => {
    try {
      const code = data.code.toUpperCase().replace(/[^0-9A-F]/g, '')
      
      if (code.length !== 8) {
        socket.emit('error', { message: 'Invalid room code — must be 8 characters' })
        return
      }

      const result = roomManager.joinRoom(code, socket.id, data.username, data.userId || null)

      if ('error' in result) {
        socket.emit('error', { message: result.error })
        return
      }

      socket.join(result.room.code)

      // Notify the joiner
      socket.emit('room_joined', {
        code: result.room.code,
        config: result.room.config,
        players: result.room.players,
        hostSocketId: result.room.hostSocketId,
        status: result.room.status,
      })

      // Notify others
      socket.to(result.room.code).emit('player_joined', {
        username: data.username,
        players: result.room.players,
      })

      console.log(`👤 ${data.username} joined room ${result.room.code}`)
    } catch (error) {
      socket.emit('error', { message: 'Failed to join room' })
    }
  })

  socket.on('leave_room', () => {
    const data = roomManager.getRoomBySocket(socket.id)
    if (!data) return

    const player = data.players.find(p => p.socketId === socket.id)
    const username = player?.username || 'Unknown'

    const result = roomManager.leaveRoom(socket.id)
    if (!result) return

    socket.leave(result.room.code)

    socket.emit('left_room', { success: true })

    // Notify remaining players
    io.to(result.room.code).emit('player_left', {
      username,
      players: result.room.players,
      hostSocketId: result.room.hostSocketId,
    })

    // If host changed
    if (result.wasHost && result.room.players.length > 0) {
      io.to(result.room.code).emit('host_changed', {
        newHostSocketId: result.room.hostSocketId,
        newHostUsername: result.room.players[0].username,
      })
    }

    console.log(`👋 ${username} left room ${result.room.code}`)
  })

  // ─── Ready System (FIXED) ──────────────

  socket.on('player_ready', () => {
    const data = roomManager.getPlayer(socket.id)
    if (!data) {
      socket.emit('error', { message: 'Not in a room' })
      return
    }

    // Set player as ready
    data.player.isReady = true

    // IMMEDIATELY emit to everyone that this player is ready
    io.to(data.room.code).emit('player_ready_update', {
      socketId: socket.id,
      username: data.player.username,
      players: data.room.players,
    })

    console.log(`✅ ${data.player.username} is ready in room ${data.room.code}`)

    // Check if ALL connected players are ready AND min 2 players
    const connectedPlayers = data.room.players.filter(p => p.connected)
    const allReady = connectedPlayers.every(p => p.isReady)
    const minPlayersMet = connectedPlayers.length >= 2

    if (allReady && minPlayersMet && data.room.status === 'waiting') {
      console.log(`🚀 All players ready in room ${data.room.code} — starting countdown`)
      
      roomManager.startCountdown(data.room)

      // Send countdown
      io.to(data.room.code).emit('all_ready_countdown', { countdown: 3 })

      let count = 3
      const countdownInterval = setInterval(() => {
        count--
        if (count > 0) {
          io.to(data.room.code).emit('all_ready_countdown', { countdown: count })
        } else {
          clearInterval(countdownInterval)
          
          // Generate color and start round
          const color = GameService.generateColor('medium')
          roomManager.startRound(data.room, color)

io.to(data.room.code).emit('round_started', {
  round: data.room.currentRound,
  totalRounds: data.room.totalRounds,
  color,
  colorDuration: data.room.config.colorDuration,
  roundDuration: data.room.config.roundDuration,
})

// Auto-end round after: colorDuration (memorization) + roundDuration (reconstruction)
const totalRoundTime = (data.room.config.colorDuration + data.room.config.roundDuration) * 1000

          // Auto-end round after duration
          setTimeout(() => {
  if (data.room.status === 'playing') {
    roomManager.endRound(data.room)
    const leaderboard = roomManager.getLeaderboard(data.room)
    const results = Array.from(data.room.roundResults.values())
    
    // Fill in non-submitters
    connectedPlayers.forEach(p => {
      if (!data.room.roundResults.has(p.socketId)) {
        results.push({
          username: p.username,
          accuracy: 0,
          score: 0,
          originalColor: color,
          userColor: { h: 0, s: 0, l: 0 },
          submitted: false,
        })
      }
    })
    
    io.to(data.room.code).emit('round_ended', {
      round: data.room.currentRound,
      results,
      leaderboard,
      timedOut: true,
    })
  }
}, totalRoundTime)
        }
      }, 1000)
    }
  })

  socket.on('player_unready', () => {
    const data = roomManager.getPlayer(socket.id)
    if (!data) {
      socket.emit('error', { message: 'Not in a room' })
      return
    }

    data.player.isReady = false

    // IMMEDIATELY emit to everyone that this player is unready
    io.to(data.room.code).emit('player_unready_update', {
      socketId: socket.id,
      username: data.player.username,
      players: data.room.players,
    })

    console.log(`❌ ${data.player.username} is NOT ready in room ${data.room.code}`)
  })

  // ─── Game Actions ───────────────────────

  socket.on('submit_color', (data: { color: ColorHSL }) => {
    const playerData = roomManager.getPlayer(socket.id)
    if (!playerData || playerData.room.status !== 'playing') {
      socket.emit('error', { message: 'Cannot submit now' })
      return
    }

    if (!playerData.room.roundColor) {
      socket.emit('error', { message: 'No active round' })
      return
    }

    // Prevent double submission
    if (playerData.room.roundResults.has(socket.id)) {
      socket.emit('error', { message: 'Already submitted' })
      return
    }

    const { accuracy, score } = calculateMultiplayerAccuracy(
      playerData.room.roundColor,
      data.color
    )

    const result = roomManager.submitColor(socket.id, data.color, accuracy, score)
    if (!result) return

    // Notify everyone that this player submitted
    const connectedPlayers = playerData.room.players.filter(p => p.connected)
    io.to(result.room.code).emit('player_submitted', {
      username: playerData.player.username,
      socketId: socket.id,
      submittedCount: result.room.roundResults.size,
      totalPlayers: connectedPlayers.length,
    })

    // If all submitted, end round early
    if (result.allSubmitted) {
      roomManager.endRound(result.room)
      const leaderboard = roomManager.getLeaderboard(result.room)
      const results = Array.from(result.room.roundResults.values())

      io.to(result.room.code).emit('round_ended', {
        round: result.room.currentRound,
        results,
        leaderboard,
        timedOut: false,
      })
    }
  })

// Replace the play_again handler:

socket.on('play_again', () => {
  const playerData = roomManager.getPlayer(socket.id)
  if (!playerData || playerData.room.status !== 'round_ended') {
    socket.emit('error', { message: 'Cannot vote now' })
    return
  }

  const player = playerData.player
  const room = playerData.room

  // Add vote
  room.playAgainVotes.add(socket.id)

  const connectedPlayers = room.players.filter(p => p.connected)
  const allVoted = connectedPlayers.every(p => room.playAgainVotes.has(p.socketId))

  // 🔥 Emit vote update AFTER adding the vote
  io.to(room.code).emit('play_again_update', {
    username: player.username,
    socketId: socket.id,
    votes: Array.from(room.playAgainVotes),
    totalNeeded: connectedPlayers.length,
  })

  console.log(`🗳 ${player.username} voted to play again (${room.playAgainVotes.size}/${connectedPlayers.length})`)

  // If all voted, start countdown immediately
  if (allVoted) {
    room.playAgainVotes.clear()
    room.status = 'countdown'

    io.to(room.code).emit('all_ready_countdown', { countdown: 3 })
    console.log(`🚀 All players voted — starting next round in room ${room.code}`)

    let count = 3
    const countdownInterval = setInterval(() => {
      count--
      if (count > 0) {
        io.to(room.code).emit('all_ready_countdown', { countdown: count })
      } else {
        clearInterval(countdownInterval)

        // Generate color and start round
        const color = GameService.generateColor('medium')
        roomManager.startRound(room, color)

        io.to(room.code).emit('round_started', {
          round: room.currentRound,
          totalRounds: room.totalRounds,
          color,
          colorDuration: room.config.colorDuration,
          roundDuration: room.config.roundDuration,
        })

        // Auto-end round after total time
        const totalRoundTime = (room.config.colorDuration + room.config.roundDuration) * 1000
        setTimeout(() => {
          if (room.status === 'playing') {
            roomManager.endRound(room)
            const leaderboard = roomManager.getLeaderboard(room)
            const results = Array.from(room.roundResults.values())

            // Fill in non-submitters
            connectedPlayers.forEach(p => {
              if (!room.roundResults.has(p.socketId)) {
                results.push({
                  username: p.username,
                  accuracy: 0,
                  score: 0,
                  originalColor: color,
                  userColor: { h: 0, s: 0, l: 0 },
                  submitted: false,
                })
              }
            })

            io.to(room.code).emit('round_ended', {
              round: room.currentRound,
              results,
              leaderboard,
              timedOut: true,
            })
          }
        }, totalRoundTime)
      }
    }, 1000)
  }
})

  socket.on('end_room', () => {
    const playerData = roomManager.getPlayer(socket.id)
    if (!playerData || !playerData.player.isHost) {
      socket.emit('error', { message: 'Only host can end the session' })
      return
    }

    roomManager.endRoom(playerData.room)

    io.to(playerData.room.code).emit('room_reset', {
      players: playerData.room.players,
      status: playerData.room.status,
    })

    io.to(playerData.room.code).emit('session_ended', {
      message: 'Host ended the session. Room is now open for new players.',
    })

    console.log(`⏹ Host ended session in room ${playerData.room.code}`)
  })
}