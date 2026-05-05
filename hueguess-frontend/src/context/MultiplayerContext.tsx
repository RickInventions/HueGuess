import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useSocket } from './SocketContext'
import { useAuth } from './AuthContext'
import type { 
  MultiplayerConfig, RoomPlayer, RoundResult, LeaderboardEntry,
  ColorHSL 
} from '../types'

interface MultiplayerState {
  roomCode: string | null
  config: MultiplayerConfig | null
  players: RoomPlayer[]
  hostSocketId: string | null
  status: 'idle' | 'waiting' | 'countdown' | 'playing' | 'round_ended'
  currentRound: number
  totalRounds: number
  roundColor: ColorHSL | null
  colorDuration: number
  roundDuration: number
  myColor: ColorHSL
  roundResults: RoundResult[]
  leaderboard: LeaderboardEntry[]
  submittedCount: number
  totalPlayers: number
  timedOut: boolean
  countdown: number
  playAgainVotes: string[]
  hasSubmitted: boolean
}

interface MultiplayerContextValue extends MultiplayerState {
  isHost: boolean
  isConnected: boolean
  createRoom: (config: MultiplayerConfig) => void
  joinRoom: (code: string) => void
  leaveRoom: () => void
  setReady: () => void
  setUnready: () => void
  updateMyColor: (channel: 'h' | 's' | 'l', value: number) => void
  submitColor: () => void
  playAgain: () => void
  endRoom: () => void
}

const INITIAL_STATE: MultiplayerState = {
  roomCode: null,
  config: null,
  players: [],
  hostSocketId: null,
  status: 'idle',
  currentRound: 0,
  totalRounds: 5,
  roundColor: null,
  colorDuration: 3,
  roundDuration: 20,
  myColor: { h: 0, s: 0, l: 0 },
  roundResults: [],
  leaderboard: [],
  submittedCount: 0,
  totalPlayers: 0,
  timedOut: false,
  countdown: 0,
  playAgainVotes: [],
  hasSubmitted: false,
}

const MultiplayerContext = createContext<MultiplayerContextValue | null>(null)

export function MultiplayerProvider({ children }: { children: ReactNode }) {
  const { socket, isConnected } = useSocket()
  const { user } = useAuth()

  const stateRef = useRef<MultiplayerState>({ ...INITIAL_STATE })
  const [, forceRender] = useState(0)

  const updateState = useCallback((updates: Partial<MultiplayerState>) => {
    stateRef.current = { ...stateRef.current, ...updates }
    forceRender(n => n + 1)
  }, [])

  const s = stateRef.current
  const isHost = s.hostSocketId === socket?.id

  // 🔥 Listen to ALL socket events HERE — once, in context
  useEffect(() => {
    if (!socket) return

    const onRoomCreated = (data: any) => {
      console.log('📦 room_created', data)
      updateState({
        roomCode: data.code,
        config: data.config,
        players: data.players,
        hostSocketId: data.hostSocketId,
        status: 'waiting',
        currentRound: 0,
        leaderboard: [],
        roundResults: [],
        countdown: 0,
        myColor: { h: 0, s: 0, l: 0 },
        submittedCount: 0,
        hasSubmitted: false,
        playAgainVotes: [],
      })
    }

    const onRoomJoined = (data: any) => {
      console.log('📦 room_joined', data)
      updateState({
        roomCode: data.code,
        config: data.config,
        players: data.players,
        hostSocketId: data.hostSocketId,
        status: data.status === 'playing' ? 'playing' : data.status === 'round_ended' ? 'round_ended' : 'waiting',
        currentRound: 0,
        leaderboard: [],
        roundResults: [],
        myColor: { h: 0, s: 0, l: 0 },
        countdown: 0,
      })
    }

    const onLeftRoom = () => {
      console.log('📦 left_room')
      updateState({ ...INITIAL_STATE, status: 'idle' })
    }

    const onPlayerJoined = (data: any) => {
      console.log('📦 player_joined', data)
      updateState({ players: data.players })
    }

    const onPlayerLeft = (data: any) => {
      console.log('📦 player_left', data)
      updateState({ 
        players: data.players,
        hostSocketId: data.hostSocketId || stateRef.current.hostSocketId,
      })
    }

    const onHostChanged = (data: any) => {
      console.log('📦 host_changed', data)
      updateState({ hostSocketId: data.newHostSocketId })
    }

    const onPlayerReadyUpdate = (data: any) => {
      console.log('📦 player_ready_update', data)
      updateState({ players: data.players })
    }

    const onPlayerUnreadyUpdate = (data: any) => {
      console.log('📦 player_unready_update', data)
      updateState({ players: data.players })
    }

    const onAllReadyCountdown = (data: any) => {
      console.log('📦 all_ready_countdown', data)
      updateState({ countdown: data.countdown, status: 'countdown' })
    }

const onRoundStarted = (data: any) => {
  console.log('📦 round_started', data)
  const connectedCount = stateRef.current.players.filter((p: RoomPlayer) => p.connected).length
  updateState({
    status: 'playing',
    currentRound: data.round,
    totalRounds: data.totalRounds,
    roundColor: data.color,
    colorDuration: data.colorDuration,
    roundDuration: data.roundDuration,
    myColor: { h: 0, s: 0, l: 0 },
    submittedCount: 0,
    totalPlayers: connectedCount,  // 🔥 Use actual connected count
    roundResults: [],
    timedOut: false,
    playAgainVotes: [],
    hasSubmitted: false,
    countdown: 0,
  })
}

    const onPlayerSubmitted = (data: any) => {
      console.log('📦 player_submitted', data)
      updateState({ submittedCount: data.submittedCount })
    }

    const onRoundEnded = (data: any) => {
      console.log('📦 round_ended', data)
      updateState({
        status: 'round_ended',
        roundResults: data.results || [],
        leaderboard: data.leaderboard || [],
        timedOut: data.timedOut || false,
        roundColor: null,
      })
    }

    const onPlayAgainUpdate = (data: any) => {
      console.log('📦 play_again_update', data)
      updateState({ playAgainVotes: data.votes || [] })
    }

    const onRoomReset = (data: any) => {
      console.log('📦 room_reset', data)
      updateState({
        status: 'waiting',
        currentRound: 0,
        roundColor: null,
        roundResults: [],
        leaderboard: [],
        myColor: { h: 0, s: 0, l: 0 },
        submittedCount: 0,
        hasSubmitted: false,
        players: data.players,
        playAgainVotes: [],
        countdown: 0,
      })
    }

    const onSessionEnded = () => {
      console.log('📦 session_ended')
      updateState({
        status: 'waiting',
        currentRound: 0,
        leaderboard: [],
        roundResults: [],
        roundColor: null,
        myColor: { h: 0, s: 0, l: 0 },
        submittedCount: 0,
        hasSubmitted: false,
        playAgainVotes: [],
        countdown: 0,
      })
    }

    const onError = (data: any) => {
      console.error('Socket error:', data.message)
    }

    socket.on('room_created', onRoomCreated)
    socket.on('room_joined', onRoomJoined)
    socket.on('left_room', onLeftRoom)
    socket.on('player_joined', onPlayerJoined)
    socket.on('player_left', onPlayerLeft)
    socket.on('host_changed', onHostChanged)
    socket.on('player_ready_update', onPlayerReadyUpdate)
    socket.on('player_unready_update', onPlayerUnreadyUpdate)
    socket.on('all_ready_countdown', onAllReadyCountdown)
    socket.on('round_started', onRoundStarted)
    socket.on('player_submitted', onPlayerSubmitted)
    socket.on('round_ended', onRoundEnded)
    socket.on('play_again_update', onPlayAgainUpdate)
    socket.on('room_reset', onRoomReset)
    socket.on('session_ended', onSessionEnded)
    socket.on('error', onError)

    return () => {
      socket.off('room_created', onRoomCreated)
      socket.off('room_joined', onRoomJoined)
      socket.off('left_room', onLeftRoom)
      socket.off('player_joined', onPlayerJoined)
      socket.off('player_left', onPlayerLeft)
      socket.off('host_changed', onHostChanged)
      socket.off('player_ready_update', onPlayerReadyUpdate)
      socket.off('player_unready_update', onPlayerUnreadyUpdate)
      socket.off('all_ready_countdown', onAllReadyCountdown)
      socket.off('round_started', onRoundStarted)
      socket.off('player_submitted', onPlayerSubmitted)
      socket.off('round_ended', onRoundEnded)
      socket.off('play_again_update', onPlayAgainUpdate)
      socket.off('room_reset', onRoomReset)
      socket.off('session_ended', onSessionEnded)
      socket.off('error', onError)
    }
  }, [socket, updateState])

  // Actions
  const createRoom = useCallback((config: MultiplayerConfig) => {
    socket?.emit('create_room', {
      username: user?.username || 'Anonymous',
      config,
      userId: user?.id || null,
    })
  }, [socket, user])

  const joinRoom = useCallback((code: string) => {
    socket?.emit('join_room', {
      code: code.toUpperCase().replace(/[^0-9A-F]/g, ''),
      username: user?.username || 'Anonymous',
      userId: user?.id || null,
    })
  }, [socket, user])

  const leaveRoom = useCallback(() => {
    socket?.emit('leave_room')
    updateState({ ...INITIAL_STATE, status: 'idle' })
  }, [socket, updateState])

  const setReady = useCallback(() => {
    console.log('🎮 Emitting player_ready')
    socket?.emit('player_ready')
  }, [socket])

  const setUnready = useCallback(() => {
    console.log('🎮 Emitting player_unready')
    socket?.emit('player_unready')
  }, [socket])

  const updateMyColor = useCallback((channel: 'h' | 's' | 'l', value: number) => {
    updateState({
      myColor: { ...stateRef.current.myColor, [channel]: value },
    })
  }, [updateState])

  const submitColor = useCallback(() => {
    socket?.emit('submit_color', { color: stateRef.current.myColor })
    updateState({ hasSubmitted: true })
  }, [socket, updateState])

  const playAgain = useCallback(() => {
    socket?.emit('play_again')
  }, [socket])

  const endRoom = useCallback(() => {
    socket?.emit('end_room')
  }, [socket])

  const value: MultiplayerContextValue = {
    ...s,
    isHost,
    isConnected,
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    setUnready,
    updateMyColor,
    submitColor,
    playAgain,
    endRoom,
  }

  return (
    <MultiplayerContext.Provider value={value}>
      {children}
    </MultiplayerContext.Provider>
  )
}

export function useMultiplayer() {
  const ctx = useContext(MultiplayerContext)
  if (!ctx) throw new Error('useMultiplayer must be used within MultiplayerProvider')
  return ctx
}