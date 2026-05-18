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
  
  // Refs to track timer states
  const memPhaseRef = useRef(false)
  const reconPhaseRef = useRef(false)

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

  // Update refs when phase changes
  useEffect(() => {
    memPhaseRef.current = phase === 'memorization'
    reconPhaseRef.current = phase === 'reconstruction'
  }, [phase])

  // Timer for memorization phase
  const memTimer = useTimer({
    duration: config?.colorTimeSeconds || 6,
    autoStart: false,
    onExpire: () => {
      if (memPhaseRef.current) {
        soundService.playMemorizationEnd()
        setPhase('reconstruction')
      reconTimer.reset(config.roundTimeSeconds)
      reconTimer.start()
      }
      
    },
  })

  // Timer for reconstruction phase
  const reconTimer = useTimer({
    duration: config?.roundTimeSeconds || 35,
    autoStart: false,
    onExpire: () => {
      if (reconPhaseRef.current && currentColor && selectedDifficulty) {
        const memorizationSeconds = config?.colorTimeSeconds || 6
        submitGuess(selectedDifficulty, currentColor, userColor, memorizationSeconds)
          .catch(console.error)
      }
    },
  })


  // Start a new round
const startRound = useCallback(async (difficulty: Difficulty) => {
  try {
    const data = await generateRound(difficulty)

    setPhase('memorization')

    soundService.playRoundStart()

    // 🔥 START TIMER HERE (guaranteed config exists)
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
    
    // Update URL without reload
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
    // Clear URL difficulty param
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
    
    const memorizationSeconds = config?.colorTimeSeconds || 6
    
    try {
      reconTimer.pause()
      await submitGuess(selectedDifficulty, currentColor, userColor, memorizationSeconds)
    } catch (error) {
      console.error('Submit failed:', error)
    }
  }, [selectedDifficulty, currentColor, userColor, isSubmitting, config, submitGuess, reconTimer])

  // Initial load for casual mode - start with Easy by default
  useEffect(() => {
    if (mode === 'casual' && !selectedDifficulty && !showDifficultySelect && !currentColor) {
      handleDifficultySelect('easy')
    }
  }, [mode, selectedDifficulty, showDifficultySelect, currentColor, handleDifficultySelect])

  // Determine timer props
  const activeTimer = phase === 'memorization' ? memTimer : reconTimer
  const timerLabel = phase === 'memorization' 
    ? `Memorize · ${config?.colorTimeSeconds || 6}s`
    : `Reconstruct · ${config?.roundTimeSeconds || 35}s`

  return (
    <div className="max-w-game mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleGoHome}
          className="flex items-center gap-1 text-muted hover:text-deep transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Exit</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted bg-surface-alt px-3 py-1 rounded-full capitalize">
            {mode}
          </span>
          {selectedDifficulty && phase !== 'result' && (
            <span className="text-xs font-medium text-muted bg-surface-alt px-3 py-1 rounded-full capitalize">
              {selectedDifficulty}
            </span>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* Difficulty Select */}
        {showDifficultySelect && (
          <motion.div
            key="difficulty-select"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="pt-4"
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
        {!showDifficultySelect && currentColor && (
          <motion.div
            key="game-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
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
              <div className="space-y-6">
                <ColorDisplay color={currentColor} showControls={false} />
                <p className="text-center text-sm text-muted">
                  Memorize this color before it disappears
                </p>
              </div>
            )}

            {/* Reconstruction Phase */}
            {phase === 'reconstruction' && (
              <div className="space-y-6">
                <ColorSliders
                  color={userColor}
                  onChange={handleColorChange}
                  onSubmit={handleSubmit}
                  disabled={isSubmitting}
                />

                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-primary to-accent text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Guess'}
                </button>
              </div>
            )}

            {/* Result Phase */}
            {phase === 'result' && result && (
              <div className="space-y-6">
                <ResultCard
                  result={result}
                  difficulty={selectedDifficulty || undefined}
                  huePoints={huePointsUpdate}
                  newlyUnlocked={newlyUnlocked}
                  mode={mode}
                />

                <div className="flex gap-3">
                  <button
                    onClick={handleRetry}
                    className="flex-1 bg-gradient-to-r from-primary to-accent text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-all"
                  >
                    <RefreshCw className="w-4 h-4 inline mr-2" />
                    Play Again
                  </button>
                  <button
                    onClick={handleGoHome}
                    className="flex-1 bg-surface-alt text-deep py-3 rounded-xl font-semibold hover:bg-surface-alt/80 transition-all"
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
  )
}