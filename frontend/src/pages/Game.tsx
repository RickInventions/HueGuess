import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, RefreshCw, Home, AlertTriangle, Clock } from 'lucide-react'
import { useGame } from '../hooks/useGame'
import { useTimer } from '../hooks/useTimer'
import { useAuth } from '../context/AuthContext'
import { ColorDisplay } from '../components/game/ColorDisplay'
import { ColorSliders } from '../components/game/ColorSliders'
import { TimerBar } from '../components/game/TimerBar'
import { ResultCard } from '../components/game/ResultCard'
import { DifficultySelect } from '../components/game/DifficultySelect'
import { Button } from '../components/ui/Button'
import type { GameMode, Difficulty } from '../types'
import api from '../lib/api'

const TOTAL_GAME_SECONDS = 30

export default function Game() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const initialMode = (searchParams.get('mode') || 'casual') as GameMode
  const initialDifficulty = searchParams.get('difficulty') as Difficulty | null

  const [mode] = useState<GameMode>(initialMode)
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(
    initialDifficulty || (mode === 'competitive' ? null : null)
  )
  const [showDifficultySelect, setShowDifficultySelect] = useState(
    mode === 'competitive' && !initialDifficulty
  )
  const [unlockedDifficulties, setUnlockedDifficulties] = useState<string[]>(['easy', 'medium'])
  const [currentTier, setCurrentTier] = useState<string>('Bronze')

  // Fetch difficulty access for competitive
  useEffect(() => {
    if (mode !== 'competitive' || !user) return
    
    api.difficultyCheck('hard')
      .then((data) => {
        setUnlockedDifficulties(data.unlockedDifficulties || ['easy', 'medium'])
        setCurrentTier(data.currentTier || 'Bronze')
      })
      .catch(() => {
        setUnlockedDifficulties(['easy', 'medium'])
      })
  }, [mode, user])

  const game = useGame(mode, selectedDifficulty || undefined)

  // Start round on mount for casual, or after difficulty selected for competitive
  useEffect(() => {
    if (mode === 'casual' && !game.round && game.phase !== 'result' && game.phase !== 'expired') {
      game.startRound()
    }
    if (selectedDifficulty && showDifficultySelect) {
      game.startRound()
      setShowDifficultySelect(false)
    }
  }, [mode, selectedDifficulty]) // eslint-disable-line react-hooks/exhaustive-deps

  // Timer for memorization phase
  const memTimer = useTimer({
    duration: game.round?.memorizationSeconds || 3,
    autoStart: game.phase === 'memorize',
    onExpire: game.onMemorizeComplete,
  })

  // Timer for reconstruction phase
  const reconTimer = useTimer({
    duration: TOTAL_GAME_SECONDS - (game.round?.memorizationSeconds || 3),
    autoStart: game.phase === 'reconstruct',
    onExpire: game.onExpire,
  })

  useEffect(() => {
    if (game.phase === 'memorize') memTimer.start()
  }, [game.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (game.phase === 'reconstruct') reconTimer.start()
  }, [game.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDifficultySelect = useCallback((diff: Difficulty) => {
    setSelectedDifficulty(diff)
    const params = new URLSearchParams(searchParams)
    params.set('difficulty', diff)
    navigate(`/play?${params.toString()}`, { replace: true })
  }, [navigate, searchParams])

  const handlePlayAgain = useCallback(() => {
    if (mode === 'competitive') {
      // Clear game state and show difficulty select
      setShowDifficultySelect(true)
      setSelectedDifficulty(null)
      // Reset game state by forcing a re-render key
      // The useGame hook will reset when selectedDifficulty changes to null then back
    } else {
      game.playAgain()
    }
  }, [mode, game])

  // Loading while fetching round (not during difficulty select)
  if (game.phase === 'loading' && !showDifficultySelect) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-3.5rem)]">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted text-sm">Generating color...</p>
        </div>
      </div>
    )
  }

  // Fatal error (no round, no difficulty select)
  if (game.error && !game.round && !showDifficultySelect) {
    return (
      <div className="max-w-game mx-auto px-4 py-12 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-accent mx-auto" />
        <p className="text-deep font-medium">{game.error}</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={game.goHome} icon={<Home className="w-4 h-4" />}>
            Home
          </Button>
        </div>
      </div>
    )
  }

  const isReconstructPhase = game.phase === 'reconstruct' || game.phase === 'submitting'
  const isMemorizePhase = game.phase === 'memorize'
  const currentTimer = game.phase === 'memorize' ? memTimer : reconTimer
  const timerLabel =
    game.phase === 'memorize'
      ? `Memorize · ${game.round?.memorizationSeconds || 3}s`
      : 'Reconstruct · 30s window'

  return (
    <div className="max-w-game mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={game.goHome}
          className="flex items-center gap-1 text-muted hover:text-deep transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Exit</span>
        </button>

        <div className="flex items-center gap-2">
          {mode === 'competitive' && (
            <span className="text-xs font-medium text-accent bg-accent/5 px-3 py-1 rounded-full">
              Competitive
            </span>
          )}
          {selectedDifficulty && (
            <span className="text-xs font-medium text-muted bg-surface-alt px-3 py-1 rounded-full capitalize">
              {selectedDifficulty}
            </span>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* Difficulty select — show INSTEAD of game content, not alongside */}
        {showDifficultySelect && mode === 'competitive' && (
          <motion.div
            key="difficulty-select"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="pt-4"
          >
            <DifficultySelect
              onSelect={handleDifficultySelect}
              unlockedDifficulties={unlockedDifficulties}
              currentTier={currentTier}
            />
          </motion.div>
        )}

        {/* Game content — only show when NOT showing difficulty select */}
        {!showDifficultySelect && (
          <motion.div
            key="game-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Timer bar (during gameplay) */}
            {(isMemorizePhase || isReconstructPhase) && (
              <TimerBar
                percentage={currentTimer.percentage}
                isWarning={currentTimer.percentage < 25}
                label={timerLabel}
                phase={game.phase === 'memorize' ? 'memorize' : 'reconstruct'}
              />
            )}

            {/* Memorize phase */}
            {game.phase === 'memorize' && game.round && (
              <div className="space-y-6">
                <ColorDisplay color={game.round.color} visible={true} />
                <p className="text-center text-sm text-muted">
                  Memorize this color before it disappears
                </p>
              </div>
            )}

            {/* Reconstruct / Submitting */}
            {isReconstructPhase && (
              <div className="space-y-6">
                <ColorSliders
                  color={game.userColor}
                  onChange={game.updateColor}
                  disabled={game.phase === 'submitting'}
                />

                <Button
                  fullWidth
                  onClick={game.submitGuess}
                  loading={game.phase === 'submitting'}
                  disabled={game.phase === 'submitting'}
                >
                  Submit Guess
                </Button>

                {game.error && game.phase === 'reconstruct' && (
                  <p className="text-center text-sm text-accent">{game.error}</p>
                )}
              </div>
            )}

            {/* Expired */}
            {game.phase === 'expired' && (
              <div className="text-center space-y-6 py-8">
                <Clock className="w-12 h-12 text-accent mx-auto" />
                <div>
                  <p className="font-heading text-xl font-semibold text-deep mb-1">Round Expired</p>
                  <p className="text-sm text-muted">30-second submission window closed</p>
                </div>
                <div className="flex gap-3 justify-center">
                  <Button onClick={handlePlayAgain} icon={<RefreshCw className="w-4 h-4" />}>
                    Play Again
                  </Button>
                  <Button variant="secondary" onClick={game.goHome} icon={<Home className="w-4 h-4" />}>
                    Home
                  </Button>
                </div>
              </div>
            )}

            {/* Result */}
            {game.phase === 'result' && game.result && (
              <div className="space-y-6">
                <ResultCard result={game.result} difficulty={selectedDifficulty || undefined} />

                <div className="flex gap-3">
                  <Button
                    onClick={handlePlayAgain}
                    icon={<RefreshCw className="w-4 h-4" />}
                    fullWidth
                  >
                    Play Again
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={game.goHome}
                    icon={<Home className="w-4 h-4" />}
                    fullWidth
                  >
                    Home
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}