import { getIO } from './index.js'
import type { ColorHSL } from '../types/index.js'

// ─── Types ───────────────────────────────
export interface RoomPlayer {
  socketId: string
  userId: string | null
  username: string
  isReady: boolean
  isHost: boolean
  connected: boolean
}

export interface RoundResult {
  username: string
  accuracy: number
  score: number
  originalColor: ColorHSL
  userColor: ColorHSL
  submitted: boolean
}

export interface RoomState {
  code: string
  hostSocketId: string
  players: RoomPlayer[]
  config: RoomConfig
  status: 'waiting' | 'countdown' | 'playing' | 'round_ended'
  currentRound: number
  totalRounds: number
  roundResults: Map<string, RoundResult>  // socketId -> result
  leaderboard: Map<string, { totalAccuracy: number; roundsPlayed: number }>
  roundStartTime: number
  roundColor: ColorHSL | null
  playAgainVotes: Set<string>
}

export interface RoomConfig {
  roundDuration: number    // 15-30 seconds
  colorDuration: number    // 0.5-7 seconds
}

const MAX_PLAYERS = parseInt(process.env.MAX_MULTIPLAYER_PLAYERS || '4')
const TOTAL_ROUNDS = 5

class RoomManager {
  private rooms: Map<string, RoomState> = new Map()
  private socketToRoom: Map<string, string> = new Map()

  // ─── Room CRUD ─────────────────────────
  
  generateCode(): string {
    const code = Math.floor(Math.random() * 0x100000000)
      .toString(16)
      .padStart(8, '0')
      .toUpperCase()
    return code
  }

  createRoom(socketId: string, username: string, config: RoomConfig, userId: string | null = null): RoomState {
    let code = this.generateCode()
    while (this.rooms.has(code)) {
      code = this.generateCode()
    }

    const room: RoomState = {
      code,
      hostSocketId: socketId,
      players: [{
        socketId,
        userId,
        username,
        isReady: false,
        isHost: true,
        connected: true,
      }],
      config,
      status: 'waiting',
      currentRound: 0,
      totalRounds: TOTAL_ROUNDS,
      roundResults: new Map(),
      leaderboard: new Map(),
      roundStartTime: 0,
      roundColor: null,
      playAgainVotes: new Set(),
    }

    this.rooms.set(code, room)
    this.socketToRoom.set(socketId, code)
    return room
  }

  getRoom(code: string): RoomState | undefined {
    return this.rooms.get(code)
  }

  getRoomBySocket(socketId: string): RoomState | undefined {
    const code = this.socketToRoom.get(socketId)
    if (!code) return undefined
    return this.rooms.get(code)
  }

  getPlayer(socketId: string): { room: RoomState; player: RoomPlayer } | undefined {
    const room = this.getRoomBySocket(socketId)
    if (!room) return undefined
    const player = room.players.find(p => p.socketId === socketId)
    if (!player) return undefined
    return { room, player }
  }

  joinRoom(code: string, socketId: string, username: string, userId: string | null = null): { room: RoomState; player: RoomPlayer } | { error: string } {
    const room = this.rooms.get(code)
    
    if (!room) {
      return { error: 'Room not found' }
    }

    if (room.status !== 'waiting') {
      return { error: 'Game already in progress' }
    }

    if (room.players.length >= MAX_PLAYERS) {
      return { error: 'Room is full' }
    }

    // Check if already in room
    const existingPlayer = room.players.find(p => p.socketId === socketId)
    if (existingPlayer) {
      return { room, player: existingPlayer }
    }

    const player: RoomPlayer = {
      socketId,
      userId,
      username,
      isReady: false,
      isHost: false,
      connected: true,
    }

    room.players.push(player)
    this.socketToRoom.set(socketId, code)
    
    return { room, player }
  }

leaveRoom(socketId: string): { room: RoomState; wasHost: boolean } | undefined {
  const data = this.getRoomBySocket(socketId)
  if (!data) return undefined

  const room = data
  const player = room.players.find(p => p.socketId === socketId)
  if (!player) return undefined

  const wasHost = player.isHost

  // Remove player
  room.players = room.players.filter(p => p.socketId !== socketId)
  this.socketToRoom.delete(socketId)

  // 🔥 If only 1 connected player left AND game hasn't started playing yet (waiting or countdown)
  const connectedPlayers = room.players.filter(p => p.connected)
  const gameNotStarted = room.status === 'waiting' || room.status === 'countdown'
  
  if (connectedPlayers.length < 2 && gameNotStarted) {
    // Notify remaining player before dissolving
    const io = getIO()
    io.to(room.code).emit('room_dissolved', {
      message: 'Not enough players — room dissolved.'
    })
    this.rooms.delete(room.code)
    room.players.forEach(p => this.socketToRoom.delete(p.socketId))
    return { room, wasHost }
  }

  // If room is empty, delete it
  if (room.players.length === 0) {
    this.rooms.delete(room.code)
    return { room, wasHost }
  }

  // Transfer host if needed
  if (wasHost && room.players.length > 0) {
    room.hostSocketId = room.players[0].socketId
    room.players[0].isHost = true
  }

  return { room, wasHost }
}

handleDisconnect(socketId: string): void {
  const data = this.getRoomBySocket(socketId)
  if (!data) return

  const room = data
  const player = room.players.find(p => p.socketId === socketId)
  if (!player) return

  player.connected = false

  // 🔥 Check if we should dissolve immediately
  const connectedPlayers = room.players.filter(p => p.connected)
  const gameNotStarted = room.status === 'waiting' || room.status === 'countdown'
  
  if (connectedPlayers.length < 2 && gameNotStarted) {
    const io = getIO()
    io.to(room.code).emit('room_dissolved', {
      message: 'Not enough players — room dissolved.'
    })
    this.rooms.delete(room.code)
    room.players.forEach(p => this.socketToRoom.delete(p.socketId))
    return
  }

  // If game is in progress, give grace period
  if (room.status === 'playing') {
    setTimeout(() => {
      const currentRoom = this.rooms.get(room.code)
      if (!currentRoom) return
      
      const disconnectedPlayer = currentRoom.players.find(
        p => p.socketId === socketId && !p.connected
      )
      if (disconnectedPlayer) {
        this.leaveRoom(socketId)
        const io = getIO()
        io.to(room.code).emit('player_left', {
          username: disconnectedPlayer.username,
          players: currentRoom.players.filter(p => p.connected),
        })
      }
    }, 30000)
  }
}

  // ─── Game Logic ─────────────────────────

  setPlayerReady(socketId: string): RoomState | undefined {
    const data = this.getPlayer(socketId)
    if (!data) return undefined
    
    data.player.isReady = true

    // Check if all connected players are ready and min players met
    const connectedPlayers = data.room.players.filter(p => p.connected)
    const allReady = connectedPlayers.every(p => p.isReady)
    const minPlayersMet = connectedPlayers.length >= 2

    if (allReady && minPlayersMet && data.room.status === 'waiting') {
      return data.room
    }

    return undefined
  }

  setPlayerUnready(socketId: string): void {
    const data = this.getPlayer(socketId)
    if (data) {
      data.player.isReady = false
    }
  }

  startCountdown(room: RoomState): void {
    room.status = 'countdown'
  }

  startRound(room: RoomState, color: ColorHSL): void {
    room.status = 'playing'
    room.currentRound++
    room.roundResults.clear()
    room.playAgainVotes.clear()
    room.roundColor = color
    room.roundStartTime = Date.now()
  }

  submitColor(socketId: string, color: ColorHSL, accuracy: number, score: number): { room: RoomState; allSubmitted: boolean } | undefined {
    const data = this.getPlayer(socketId)
    if (!data) return undefined

    const originalColor = data.room.roundColor!
    
    const result: RoundResult = {
      username: data.player.username,
      accuracy,
      score,
      originalColor,
      userColor: color,
      submitted: true,
    }

    data.room.roundResults.set(socketId, result)

    // Update leaderboard
    const lbEntry = data.room.leaderboard.get(data.player.username) || { totalAccuracy: 0, roundsPlayed: 0 }
    lbEntry.totalAccuracy += accuracy
    lbEntry.roundsPlayed++
    data.room.leaderboard.set(data.player.username, lbEntry)

    const connectedPlayers = data.room.players.filter(p => p.connected)
    const allSubmitted = connectedPlayers.every(p => data.room.roundResults.has(p.socketId))

    return { room: data.room, allSubmitted }
  }

  endRound(room: RoomState): void {
    room.status = 'round_ended'
  }

votePlayAgain(socketId: string): { room: RoomState; allVoted: boolean } | undefined {
  const data = this.getPlayer(socketId)
  if (!data) return undefined

  data.room.playAgainVotes.add(socketId)

  const connectedPlayers = data.room.players.filter(p => p.connected)
  const allVoted = connectedPlayers.every(p => data.room.playAgainVotes.has(p.socketId))

  if (allVoted) {
    // 🔥 Don't set status to 'waiting' — go straight to countdown
    // The handlers.ts will handle the countdown → round start
    data.room.playAgainVotes.clear()
    return { room: data.room, allVoted: true }
  }

  return { room: data.room, allVoted: false }
}

  endRoom(room: RoomState): void {
    // Reset room to waiting state (dissolves rounds, allows new players)
    room.status = 'waiting'
    room.currentRound = 0
    room.roundResults.clear()
    room.leaderboard.clear()
    room.playAgainVotes.clear()
    room.roundColor = null
    room.players.forEach(p => { p.isReady = false })
  }

  getLeaderboard(room: RoomState): { username: string; avgAccuracy: number; roundsPlayed: number }[] {
    const entries: { username: string; avgAccuracy: number; roundsPlayed: number }[] = []
    
    room.leaderboard.forEach((value, username) => {
      entries.push({
        username,
        avgAccuracy: value.roundsPlayed > 0 
          ? Math.round((value.totalAccuracy / value.roundsPlayed) * 1000) / 1000 
          : 0,
        roundsPlayed: value.roundsPlayed,
      })
    })

    return entries.sort((a, b) => b.avgAccuracy - a.avgAccuracy)
  }
}

export const roomManager = new RoomManager()