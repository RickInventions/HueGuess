import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, RefreshCw, Home, AlertTriangle, Clock } from 'lucide-react'
import { useTimer } from '../hooks/useTimer'
import { ColorDisplay } from '../components/game/ColorDisplay'
import { ColorSliders } from '../components/game/ColorSliders'
import { TimerBar } from '../components/game/TimerBar'
import { ResultCard } from '../components/game/ResultCard'
import { Button } from '../components/ui/Button'
import type { GameMode, Difficulty } from '../types'
import { useGame } from '../hooks/UseGame'

const TOTAL_GAME_SECONDS = 30

export default function Game() {
  const [searchParams] = useSearchParams()
  const mode = (searchParams.get('mode') || 'casual') as GameMode
  const difficulty = searchParams.get('difficulty') as Difficulty | null

  const game = useGame(mode, difficulty || undefined)

  // Start round on mount
  useEffect(() => {
    game.startRound()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Timer for memorization phase
  const memTimer = useTimer({
    duration: game.round?.memorizationSeconds || 3,
    autoStart: game.phase === 'memorize',
    onExpire: game.onMemorizeComplete,
  })

  // Timer for reconstruction phase (total 30s from round start)
  const reconTimer = useTimer({
    duration: TOTAL_GAME_SECONDS - (game.round?.memorizationSeconds || 3),
    autoStart: game.phase === 'reconstruct',
    onExpire: game.onExpire,
  })

  // Reset timers when phase changes
  useEffect(() => {
    if (game.phase === 'memorize') {
      memTimer.start()
    }
  }, [game.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (game.phase === 'reconstruct') {
      reconTimer.start()
    }
  }, [game.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Loading state
  if (game.phase === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-3.5rem)]">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted text-sm">Generating color...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (game.error && !game.round) {
    return (
      <div className="max-w-game mx-auto px-4 py-12 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-accent mx-auto" />
        <p className="text-deep font-medium">{game.error}</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={game.startRound} icon={<RefreshCw className="w-4 h-4" />}>
            Try again
          </Button>
          <Button variant="secondary" onClick={game.goHome} icon={<Home className="w-4 h-4" />}>
            Home
          </Button>
        </div>
      </div>
    )
  }

  const isReconstructPhase = game.phase === 'reconstruct' || game.phase === 'submitting'
  const currentTimer = game.phase === 'memorize' ? memTimer : reconTimer
  const timerLabel =
    game.phase === 'memorize'
      ? `Memorize · ${game.round?.memorizationSeconds || 3}s`
      : 'Reconstruct · 30s window'

  return (
    <div className="max-w-game mx-auto px-4 py-6 space-y-6">
      {/* Back + Timer */}
      <div className="flex items-center justify-between">
        <button
          onClick={game.goHome}
          className="flex items-center gap-1 text-muted hover:text-deep transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Exit</span>
        </button>

        {mode === 'competitive' && difficulty && (
          <span className="text-xs font-medium text-muted capitalize bg-surface-alt px-3 py-1 rounded-full">
            {difficulty}
          </span>
        )}
      </div>

      {/* Timer bar */}
      {(game.phase === 'memorize' || isReconstructPhase) && (
        <TimerBar
          percentage={currentTimer.percentage}
          isWarning={currentTimer.percentage < 25}
          label={timerLabel}
          phase={game.phase === 'memorize' ? 'memorize' : 'reconstruct'}
        />
      )}

      <AnimatePresence mode="wait">
        {/* Memorize phase */}
        {game.phase === 'memorize' && game.round && (
          <motion.div
            key="memorize"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            <ColorDisplay color={game.round.color} visible={true} />
            <p className="text-center text-sm text-muted">
              Memorize this color before it disappears
            </p>
          </motion.div>
        )}

        {/* Reconstruct / Submitting phase */}
        {isReconstructPhase && (
          <motion.div
            key="reconstruct"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >

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
          </motion.div>
        )}

        {/* Expired */}
        {game.phase === 'expired' && (
          <motion.div
            key="expired"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6 py-8"
          >
            <Clock className="w-12 h-12 text-accent mx-auto" />
            <div>
              <p className="font-heading text-xl font-semibold text-deep mb-1">
                Round Expired
              </p>
              <p className="text-sm text-muted">
                30-second submission window closed
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button onClick={game.playAgain} icon={<RefreshCw className="w-4 h-4" />}>
                Play Again
              </Button>
              <Button
                variant="secondary"
                onClick={game.goHome}
                icon={<Home className="w-4 h-4" />}
              >
                Home
              </Button>
            </div>
          </motion.div>
        )}

        {/* Result */}
        {game.phase === 'result' && game.result && (
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <ResultCard result={game.result} difficulty={difficulty || undefined} />

            <div className="flex gap-3">
              <Button onClick={game.playAgain} icon={<RefreshCw className="w-4 h-4" />} fullWidth>
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}