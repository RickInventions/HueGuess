import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, RefreshCw, Home } from 'lucide-react'
import { useGame } from '../hooks/useGame'
import { useTimer } from '../hooks/useTimer'
import { useAuth } from '../context/AuthContext'
import { ColorDisplay } from '../components/game/ColorDisplay'
import { ColorSliders } from '../components/game/ColorSliders'
import { TimerBar } from '../components/game/TimerBar'
import { ResultCard } from '../components/game/ResultCard'
import { DifficultySelect } from '../components/game/DifficultySelect'
import { soundService } from '../services/soundService'
import type { Difficulty } from '../types'

export default function Game() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isVerified } = useAuth()

  const mode = (searchParams.get('mode') || 'casual') as 'casual' | 'competitive'
  const initialDifficulty = searchParams.get('difficulty') as Difficulty | null

  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(
    initialDifficulty || null
  )
  const [showDifficultySelect, setShowDifficultySelect] = useState(!initialDifficulty)

  // Game hook integration
  const {
    phase,
    setPhase,
    currentColor,
    userColor,
    setUserColor,
    result,
    huePointsUpdate,
    newlyUnlocked,
    config,
    isSubmitting,
    generateRound,
    submitGuess,
    submitTimeout,
    resetGame,
  } = useGame({
    mode,
    onGameComplete: (res, huePoints, achievements) => {
      if (achievements?.length) {
        achievements.forEach(() => {
          soundService.playAchievementUnlock()
        })
      }
    },
  })

  // Keep latest values in refs so timer callbacks don't go stale
  const phaseRef = useRef(phase)
  const configRef = useRef(config)
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { configRef.current = config }, [config])

  // Stable onExpire callbacks that read from refs — these never change identity,
  // so they won't cause useTimer's interval to restart on re-renders.
  const handleMemExpire = useCallback(() => {
    if (phaseRef.current === 'memorization') {
      soundService.playMemorizationEnd()
      setPhase('reconstruction')
      reconTimer.reset(configRef.current?.roundTimeSeconds || 35)
      reconTimer.start()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty — reads phase/config via refs

  const handleReconExpire = useCallback(() => {
    if (phaseRef.current === 'reconstruction') {
      submitTimeout()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitTimeout])

  // Timer for memorization phase
  const memTimer = useTimer({
    duration: config?.colorTimeSeconds || 6,
    autoStart: false,
    onExpire: handleMemExpire,
  })

  // Timer for reconstruction phase
  const reconTimer = useTimer({
    duration: config?.roundTimeSeconds || 35,
    autoStart: false,
    onExpire: handleReconExpire,
  })

  // Start a new round
  const startRound = useCallback(async (difficulty: Difficulty) => {
    try {
      const data = await generateRound(difficulty)
      setPhase('memorization')
      soundService.playRoundStart()
      memTimer.reset(data.config.colorTimeSeconds)
      memTimer.start()
    } catch (error) {
      console.error('Failed to start round:', error)
    }
  }, [generateRound, setPhase, memTimer])

  // Handle difficulty selection
  const handleDifficultySelect = useCallback(async (difficulty: Difficulty) => {
    setSelectedDifficulty(difficulty)
    setShowDifficultySelect(false)

    const params = new URLSearchParams(searchParams)
    params.set('difficulty', difficulty)
    navigate(`/play?${params.toString()}`, { replace: true })

    await startRound(difficulty)
  }, [navigate, searchParams, startRound])

  // Handle play again
  const handlePlayAgain = useCallback(() => {
    if (mode === 'competitive' && !isVerified) {
      navigate('/verify')
      return
    }

    resetGame()
    setShowDifficultySelect(true)
    setSelectedDifficulty(null)
    navigate('/play', { replace: true })
  }, [mode, isVerified, resetGame, navigate])

  // Handle retry with same difficulty
  const handleRetry = useCallback(() => {
    if (selectedDifficulty) {
      resetGame()
      startRound(selectedDifficulty)
    } else {
      handlePlayAgain()
    }
  }, [selectedDifficulty, resetGame, startRound, handlePlayAgain])

  // Handle home navigation
  const handleGoHome = useCallback(() => {
    navigate('/')
  }, [navigate])

  // Handle color change
  const handleColorChange = useCallback((channel: 'h' | 's' | 'l', value: number) => {
    setUserColor(prev => ({ ...prev, [channel]: value }))
  }, [setUserColor])

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!selectedDifficulty || !currentColor || isSubmitting) return
    if (phase !== 'reconstruction') return

    const memorizationSeconds = config?.colorTimeSeconds || 6

    try {
      reconTimer.pause()
      await submitGuess(selectedDifficulty, currentColor, userColor, memorizationSeconds)
    } catch (error) {
      console.error('Submit failed:', error)
    }
  }, [selectedDifficulty, currentColor, userColor, isSubmitting, config, submitGuess, reconTimer, phase])

  // Keyboard submit (Enter/Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase === 'reconstruction' && !isSubmitting && selectedDifficulty && currentColor) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleSubmit()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [phase, isSubmitting, selectedDifficulty, currentColor, handleSubmit])

  // Initial load for casual mode
  useEffect(() => {
    if (mode === 'casual' && !selectedDifficulty && !showDifficultySelect && !currentColor) {
      handleDifficultySelect('easy')
    }
  }, [mode, selectedDifficulty, showDifficultySelect, currentColor, handleDifficultySelect])

  // Determine active timer
  const activeTimer = phase === 'memorization' ? memTimer : reconTimer
  const timerLabel = phase === 'memorization'
    ? `Memorize · ${config?.colorTimeSeconds || 6}s`
    : `Reconstruct · ${config?.roundTimeSeconds || 35}s`

  const isLoading = !currentColor && !result && !showDifficultySelect && phase !== 'result'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-game mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleGoHome}
            className="flex items-center gap-1 text-muted hover:text-deep transition-colors p-2 -ml-2 active:scale-95 touch-manipulation"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-xs sm:text-sm">Exit</span>
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-[10px] sm:text-xs font-medium text-muted bg-surface-alt px-2 sm:px-3 py-1 rounded-full capitalize">
              {mode}
            </span>
            {selectedDifficulty && phase !== 'result' && (
              <span className="text-[10px] sm:text-xs font-medium text-muted bg-surface-alt px-2 sm:px-3 py-1 rounded-full capitalize">
                {selectedDifficulty}
              </span>
            )}
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-16 sm:py-20">
            <div className="text-center space-y-3 sm:space-y-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-muted text-xs sm:text-sm">Loading color...</p>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Difficulty Select */}
          {showDifficultySelect && (
            <motion.div
              key="difficulty-select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="pt-2 sm:pt-4"
            >
              <DifficultySelect
                onSelect={handleDifficultySelect}
                unlockedDifficulties={['easy', 'medium', 'hard', 'extreme']}
                currentTier="All unlocked"
                mode={mode}
              />
            </motion.div>
          )}

          {/* Game Content */}
          {!showDifficultySelect && currentColor && !isLoading && (
            <motion.div
              key="game-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4 sm:space-y-6"
            >
              {/* Timer Bar */}
              {(phase === 'memorization' || phase === 'reconstruction') && (
                <TimerBar
                  timeRemaining={activeTimer.timeRemaining}
                  totalTime={phase === 'memorization' ? config?.colorTimeSeconds || 6 : config?.roundTimeSeconds || 35}
                  label={timerLabel}
                  isUrgent={activeTimer.isUrgent}
                />
              )}

              {/* Memorize Phase */}
              {phase === 'memorization' && (
                <div className="space-y-4 sm:space-y-6">
                  <ColorDisplay color={currentColor} showControls={false} />
                  <p className="text-center text-xs sm:text-sm text-muted px-2">
                    Memorize this color before it disappears
                  </p>
                </div>
              )}

              {/* Reconstruction Phase */}
              {phase === 'reconstruction' && (
                <div className="space-y-4 sm:space-y-6">
                  <ColorSliders
                    color={userColor}
                    onChange={handleColorChange}
                    onSubmit={handleSubmit}
                    disabled={isSubmitting}
                  />

                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-primary to-accent text-white py-3 sm:py-4 rounded-xl font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 text-sm sm:text-base touch-manipulation"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Guess'}
                  </button>
                </div>
              )}

              {/* Result Phase */}
              {phase === 'result' && result && (
                <div className="space-y-4 sm:space-y-6">
                  <ResultCard
                    result={result}
                    difficulty={selectedDifficulty || undefined}
                    huePoints={huePointsUpdate}
                    newlyUnlocked={newlyUnlocked}
                    mode={mode}
                  />

                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <button
                      onClick={handleRetry}
                      className="w-full sm:flex-1 bg-gradient-to-r from-primary to-accent text-white py-3 sm:py-4 rounded-xl font-semibold hover:opacity-90 active:scale-[0.98] transition-all text-sm sm:text-base touch-manipulation"
                    >
                      <RefreshCw className="w-4 h-4 inline mr-2" />
                      Play Again
                    </button>
                    <button
                      onClick={handleGoHome}
                      className="w-full sm:flex-1 bg-surface-alt text-deep py-3 sm:py-4 rounded-xl font-semibold hover:bg-surface-alt/80 active:scale-[0.98] transition-all text-sm sm:text-base touch-manipulation"
                    >
                      <Home className="w-4 h-4 inline mr-2" />
                      Home
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}