import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { RoundResponse, SubmitResponse, ColorHSL, GameMode, Difficulty } from '../types'

interface GameState {
  phase: 'idle' | 'loading' | 'memorize' | 'reconstruct' | 'submitting' | 'result' | 'expired'
  round: RoundResponse | null
  result: SubmitResponse | null
  userColor: ColorHSL
  error: string | null
}

const DEFAULT_COLOR: ColorHSL = { h: 0, s: 0, l: 0 }

const INITIAL_STATE: GameState = {
  phase: 'idle',
  round: null,
  result: null,
  userColor: { ...DEFAULT_COLOR },
  error: null,
}

export function useGame(mode: GameMode, difficulty?: Difficulty) {
  const navigate = useNavigate()
  const [state, setState] = useState<GameState>(INITIAL_STATE)

  const startRound = useCallback(async () => {
    setState({
      phase: 'loading',
      round: null,
      result: null,
      userColor: { ...DEFAULT_COLOR },
      error: null,
    })

    try {
      const diff = mode === 'competitive' ? difficulty || 'medium' : undefined
      const round = await api.createRound(mode, diff)
      setState({
        phase: 'memorize',
        round,
        result: null,
        userColor: { ...DEFAULT_COLOR },
        error: null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start round'
      setState({ ...INITIAL_STATE, phase: 'idle', error: message })
    }
  }, [mode, difficulty])

  const onMemorizeComplete = useCallback(() => {
    setState((prev) => ({ ...prev, phase: 'reconstruct' }))
  }, [])

  const updateColor = useCallback((channel: 'h' | 's' | 'l', value: number) => {
    setState((prev) => ({
      ...prev,
      userColor: { ...prev.userColor, [channel]: value },
    }))
  }, [])

  const submitGuess = useCallback(async () => {
    if (!state.round) return

    setState((prev) => ({ ...prev, phase: 'submitting' }))

    try {
      const result = await api.submitRound(state.round.roundId, state.userColor)
      setState((prev) => ({ ...prev, phase: 'result', result }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Submission failed'
      if (message.includes('expired')) {
        setState((prev) => ({ ...prev, phase: 'expired', error: 'Round expired' }))
      } else {
        setState((prev) => ({ ...prev, phase: 'reconstruct', error: message }))
      }
    }
  }, [state.round, state.userColor])

  const onExpire = useCallback(() => {
    setState((prev) => {
      if (prev.phase === 'reconstruct') {
        return { ...prev, phase: 'expired', error: 'Time ran out — round expired' }
      }
      return prev
    })
  }, [])

  const goHome = useCallback(() => {
    setState(INITIAL_STATE)
    navigate('/')
  }, [navigate])

  const playAgain = useCallback(() => {
    startRound()
  }, [startRound])

  return {
    ...state,
    startRound,
    onMemorizeComplete,
    updateColor,
    submitGuess,
    onExpire,
    goHome,
    playAgain,
  }
}