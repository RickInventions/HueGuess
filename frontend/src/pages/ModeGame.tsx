import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  EyeOff,
  FlipHorizontal2,
  Home,
  RefreshCw,
  Skull,
  Trophy,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ColorSliders } from '../components/game/ColorSliders'
import { TimerBar } from '../components/game/TimerBar'
import { AchievementCelebration } from '../components/game/AchievementCelebration'
import { useTimer } from '../hooks/useTimer'
import { modes as modesApi } from '../lib/api'
import { soundService } from '../services/soundService'
import type { Difficulty, HSLColor } from '../types'
import type { ExtraMode, ExtraRoundResponse, ExtraRoundResult } from '../types/modes'
import { EXTRA_MODE_META, hasMemorization } from '../types/modes'

type Phase = 'setup' | 'memorization' | 'reconstruction' | 'result'

interface ModeGameProps {
  /** Which card on the home page you arrived from. Blind then picks a variant. */
  family: 'inverted' | 'blind'
}

interface DifficultyOption {
  id: Difficulty
  label: string
  Icon: LucideIcon
  color: string
}

const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  { id: 'easy', label: 'Easy', Icon: Clock, color: '#1FC98E' },
  { id: 'medium', label: 'Medium', Icon: Zap, color: '#5E60FF' },
  { id: 'hard', label: 'Hard', Icon: Skull, color: '#FF7A59' },
  { id: 'extreme', label: 'Extreme', Icon: AlertTriangle, color: '#FF2D55' },
]

/** Mirrors `DIFFICULTY_CONFIGS` on the server, for the setup screen's captions. */
const DIFFICULTY_SECONDS: Record<Difficulty, { memorize: number; round: number }> = {
  easy: { memorize: 6, round: 35 },
  medium: { memorize: 4, round: 30 },
  hard: { memorize: 2, round: 15 },
  extreme: { memorize: 0.5, round: 15 },
}

/**
 * The page repainted for Inverted memorization: every token below is the exact
 * RGB inverse of its Tailwind counterpart.
 *
 * Written out rather than produced with a CSS `filter: invert(1)` on a wrapper.
 * A filter inverts everything it contains — including the swatch, which then has
 * to be painted pre-inverted to survive, and including shadows, borders and any
 * portal that happens to render inside. This is a handful of constants and it
 * behaves identically in every browser.
 */
const INVERTED = {
  base: '#000207',
  surfaceAlt: '#080B12',
  deep: '#E2E2E0',
  muted: '#91918C',
  primary: '#A19F00',
}

const hslString = (c: HSLColor) => `hsl(${c.h}, ${c.s}%, ${c.l}%)`

/** Fallbacks match `DIFFICULTY_CONFIGS` on the server for `easy`. */
const FALLBACK_CONFIG = { colorTimeSeconds: 6, roundTimeSeconds: 35, negThreshold: 65 }

export default function ModeGame({ family }: ModeGameProps) {
  const navigate = useNavigate()

  const [variant, setVariant] = useState<ExtraMode>(
    family === 'inverted' ? 'inverted' : 'blind_target'
  )
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [phase, setPhase] = useState<Phase>('setup')
  const [round, setRound] = useState<ExtraRoundResponse | null>(null)
  const [userColor, setUserColor] = useState<HSLColor>({ h: 0, s: 0, l: 0 })
  const [result, setResult] = useState<ExtraRoundResult | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const meta = EXTRA_MODE_META[variant]
  const config = round?.config ?? FALLBACK_CONFIG

  // Timer callbacks fire from an interval, so everything they read comes from a
  // ref — a stale closure here would submit the wrong round or none at all.
  const phaseRef = useRef(phase)
  const roundRef = useRef(round)
  const colorRef = useRef(userColor)
  const busyRef = useRef(false)
  const timersRef = useRef<{ pauseRecon: () => void } | null>(null)
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { roundRef.current = round }, [round])
  useEffect(() => { colorRef.current = userColor }, [userColor])

  const submitGuess = useCallback(async () => {
    const active = roundRef.current
    if (!active || phaseRef.current !== 'reconstruction' || busyRef.current) return

    busyRef.current = true
    setIsSubmitting(true)
    timersRef.current?.pauseRecon()

    try {
      const { data } = await modesApi.submit(active.token, colorRef.current)
      setResult(data.result)
      setPhase('result')
      soundService.playSubmitDing()
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
        'Could not score that round'
      setError(message)
      // The token is single-use in practice and may have expired; back to setup
      // rather than stranding the player on dead sliders.
      setPhase('setup')
      setRound(null)
    } finally {
      busyRef.current = false
      setIsSubmitting(false)
    }
  }, [])

  const handleMemExpire = useCallback(() => {
    if (phaseRef.current !== 'memorization') return
    soundService.playMemorizationEnd()
    setPhase('reconstruction')
  }, [])

  const handleReconExpire = useCallback(() => {
    if (phaseRef.current !== 'reconstruction') return
    soundService.playExpired()
    void submitGuess()
  }, [submitGuess])

  const memTimer = useTimer({
    duration: config.colorTimeSeconds,
    autoStart: false,
    onExpire: handleMemExpire,
  })

  const reconTimer = useTimer({
    duration: config.roundTimeSeconds,
    autoStart: false,
    onExpire: handleReconExpire,
  })

  // Latest-ref for the one timer action a callback needs to reach backwards for.
  useEffect(() => {
    timersRef.current = { pauseRecon: reconTimer.pause }
  })

  // The reconstruction clock starts when the phase does — whether that is after
  // memorization ran out or straight off the setup screen in the no-target
  // variant, which has no memorization phase at all.
  //
  // `start()` closes over the timeRemaining of the render it came from and
  // refuses to run at 0, so the reset has to have left a positive value behind.
  // It always has: useTimer restores timeRemaining to its full duration whenever
  // it goes inactive, and this timer is inactive on every path into this effect.
  useEffect(() => {
    if (phase !== 'reconstruction') return
    reconTimer.reset(config.roundTimeSeconds)
    reconTimer.start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const startRound = useCallback(
    async (chosen: Difficulty) => {
      setIsStarting(true)
      setError(null)
      setResult(null)
      setUserColor({ h: 0, s: 0, l: 0 })

      try {
        const { data } = await modesApi.generate(variant, chosen)
        setRound(data)
        setDifficulty(chosen)
        soundService.playRoundStart()

        if (hasMemorization(variant)) {
          setPhase('memorization')
          memTimer.reset(data.config.colorTimeSeconds)
          memTimer.start()
        } else {
          setPhase('reconstruction')
        }
      } catch (err) {
        const message =
          (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
          'Could not start a round'
        setError(message)
      } finally {
        setIsStarting(false)
      }
    },
    [variant, memTimer]
  )

  const handleChange = useCallback((channel: 'h' | 's' | 'l', value: number) => {
    setUserColor((prev) => ({ ...prev, [channel]: value }))
  }, [])

  const backToSetup = useCallback(() => {
    memTimer.pause()
    reconTimer.pause()
    setPhase('setup')
    setRound(null)
    setResult(null)
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Enter/Space submits, matching the single-player game.
  useEffect(() => {
    if (phase !== 'reconstruction') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      void submitGuess()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, submitGuess])

  /* ─── Inverted memorization: the whole screen, repainted ─────────────── */
  if (phase === 'memorization' && variant === 'inverted' && round?.color) {
    const elapsed = Math.max(0, config.colorTimeSeconds - memTimer.timeRemaining)
    const progress = Math.min(100, (elapsed / Math.max(config.colorTimeSeconds, 0.5)) * 100)

    return (
      <div
        className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-4"
        style={{ backgroundColor: INVERTED.base, color: INVERTED.deep }}
      >
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2 text-center">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: INVERTED.primary }}
            >
              Inverted
            </p>
            <p className="text-sm" style={{ color: INVERTED.muted }}>
              This is the complement. Remember the colour it came from.
            </p>
          </div>

          <div
            className="aspect-square w-full rounded-2xl"
            style={{
              backgroundColor: hslString(round.color),
              boxShadow: '0 0 0 1px rgba(255,255,255,0.14)',
            }}
          />

          {/* Its own bar: TimerBar is painted in light-theme tokens. */}
          <div
            className="h-1.5 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: INVERTED.surfaceAlt }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-1000 ease-linear"
              style={{ width: `${progress}%`, backgroundColor: INVERTED.primary }}
            />
          </div>

          <p className="text-center text-xs" style={{ color: INVERTED.muted }}>
            Hue is 180° away and lightness is flipped — the same move gets you back.
          </p>

          {/* The only control on this screen. Nothing else is reachable while the
              panel is up, so there has to be a way off it. */}
          <button
            onClick={backToSetup}
            className="mx-auto block px-3 py-2 text-xs underline-offset-4 hover:underline touch-manipulation"
            style={{ color: INVERTED.muted }}
          >
            Quit round
          </button>
        </div>
      </div>
    )
  }

  /* ─── Everything else ────────────────────────────────────────────────── */
  const showGreySliders = variant === 'blind_sliders'
  const timerLabel =
    phase === 'memorization'
      ? `Memorize · ${config.colorTimeSeconds}s`
      : `Reconstruct · ${config.roundTimeSeconds}s`
  const activeTimer = phase === 'memorization' ? memTimer : reconTimer

  return (
    <div className="min-h-screen bg-base">
      <div className="max-w-game mx-auto space-y-5 px-3 py-4 sm:px-4 sm:py-6 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => (phase === 'setup' ? navigate('/') : backToSetup())}
            className="-ml-2 flex items-center gap-1 p-2 text-muted transition-colors hover:text-deep active:scale-95 touch-manipulation"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-xs sm:text-sm">{phase === 'setup' ? 'Home' : 'Quit round'}</span>
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="rounded-full bg-surface-alt px-2 py-1 text-[10px] font-medium text-muted sm:px-3 sm:text-xs">
              {meta.name}
            </span>
            {difficulty && phase !== 'setup' && (
              <span className="rounded-full bg-surface-alt px-2 py-1 text-[10px] font-medium capitalize text-muted sm:px-3 sm:text-xs">
                {difficulty}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-deep">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ── Setup ─────────────────────────────────────────────────── */}
          {phase === 'setup' && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="space-y-6"
            >
              <div className="space-y-2 text-center">
                <h1 className="font-heading text-2xl font-bold text-deep sm:text-3xl">
                  {family === 'inverted' ? 'Inverted' : 'Blind'}
                </h1>
                <p className="mx-auto max-w-md text-sm text-muted">{meta.blurb}</p>
                <p className="text-xs text-muted">
                  No HuePoints, no rank — just a percentage on its own board.
                </p>
              </div>

              {/* Blind's two variants */}
              {family === 'blind' && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                    Pick your handicap
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(['blind_target', 'blind_sliders'] as ExtraMode[]).map((option) => {
                      const selected = variant === option
                      const Icon = option === 'blind_target' ? EyeOff : FlipHorizontal2
                      return (
                        <button
                          key={option}
                          onClick={() => setVariant(option)}
                          aria-pressed={selected}
                          className={`rounded-card border p-4 text-left transition-all touch-manipulation ${
                            selected
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-border bg-surface hover:bg-surface-alt'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon
                              className={`h-4 w-4 ${selected ? 'text-primary' : 'text-muted'}`}
                            />
                            <span className="text-sm font-semibold text-deep">
                              {EXTRA_MODE_META[option].short}
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs text-muted">
                            {option === 'blind_target'
                              ? 'The colour is never shown at all. Pure guesswork, then a score.'
                              : 'You see the colour, then the sliders lose theirs — no gradients, no preview.'}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted">
                    Each variant keeps its own leaderboard, per difficulty.
                  </p>
                </div>
              )}

              {/* Difficulty */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Difficulty
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {DIFFICULTY_OPTIONS.map(({ id, label, Icon, color }) => (
                    <button
                      key={id}
                      onClick={() => void startRound(id)}
                      disabled={isStarting}
                      className="rounded-card border border-border bg-surface p-4 text-center transition-all hover:-translate-y-0.5 hover:shadow-card disabled:opacity-60 active:scale-[0.98] touch-manipulation"
                    >
                      <Icon className="mx-auto h-5 w-5" style={{ color }} />
                      <span className="mt-2 block text-sm font-semibold text-deep">{label}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">
                        {variant === 'blind_target'
                          ? `${DIFFICULTY_SECONDS[id].round}s to guess`
                          : `${DIFFICULTY_SECONDS[id].memorize}s look`}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted">
                  {variant === 'blind_target'
                    ? 'Harder difficulties draw from a wider colour range and give you less time.'
                    : 'Harder difficulties show the colour for less time and draw from a wider range.'}
                </p>
              </div>

              <div className="text-center">
                <Link
                  to={`/leaderboard?board=${variant}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <Trophy className="h-4 w-4" />
                  See the {meta.name} board
                </Link>
              </div>
            </motion.div>
          )}

          {/* ── Memorization (grey-sliders variant) ───────────────────── */}
          {phase === 'memorization' && variant !== 'inverted' && round?.color && (
            <motion.div
              key="memorize"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4 sm:space-y-6"
            >
              <TimerBar
                timeRemaining={memTimer.timeRemaining}
                totalTime={config.colorTimeSeconds}
                label={timerLabel}
                isUrgent={memTimer.isUrgent}
              />
              <div
                className="mx-auto aspect-square w-full max-w-[280px] rounded-2xl shadow-card"
                style={{ backgroundColor: hslString(round.color) }}
              />
              <p className="px-2 text-center text-xs text-muted sm:text-sm">
                Memorize it — the sliders go grey next.
              </p>
            </motion.div>
          )}

          {/* ── Reconstruction ───────────────────────────────────────── */}
          {phase === 'reconstruction' && round && (
            <motion.div
              key="reconstruct"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4 sm:space-y-6"
            >
              <TimerBar
                timeRemaining={activeTimer.timeRemaining}
                totalTime={config.roundTimeSeconds}
                label={timerLabel}
                isUrgent={activeTimer.isUrgent}
              />

              <p className="rounded-xl bg-surface-alt px-4 py-3 text-center text-xs text-deep sm:text-sm">
                {variant === 'inverted'
                  ? 'You saw the complement. Flip it back: hue 180° away, lightness inverted.'
                  : variant === 'blind_sliders'
                    ? 'No gradients and no preview from here. Set it by feel.'
                    : 'Nothing was shown. Set a colour and see how close you land.'}
              </p>

              <ColorSliders
                color={userColor}
                onChange={handleChange}
                onSubmit={() => void submitGuess()}
                disabled={isSubmitting}
                plain={showGreySliders}
              />

              <button
                onClick={() => void submitGuess()}
                disabled={isSubmitting}
                className="w-full rounded-xl bg-gradient-to-r from-primary to-accent py-3 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 active:scale-[0.98] sm:py-4 touch-manipulation"
              >
                {isSubmitting ? 'Scoring…' : 'Lock it in'}
              </button>
            </motion.div>
          )}

          {/* ── Result ───────────────────────────────────────────────── */}
          {phase === 'result' && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4 sm:space-y-6"
            >
              <div className="rounded-card border border-border bg-surface p-5 text-center shadow-card sm:p-6">
                {result.isPersonalBest && (
                  <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                    <Trophy className="h-3.5 w-3.5" />
                    {result.previousBest === null ? 'First score' : 'Personal best'}
                  </span>
                )}

                <p className="font-heading text-4xl font-bold text-deep sm:text-5xl">
                  {result.accuracy.toFixed(1)}%
                </p>
                <p className="mt-1 text-sm text-muted">accuracy</p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div
                      className="h-20 rounded-xl border border-border"
                      style={{ backgroundColor: hslString(result.originalColor) }}
                    />
                    <p className="text-xs font-medium text-muted">Target</p>
                    <p className="font-mono text-[11px] text-deep">
                      {result.originalColor.h}° {result.originalColor.s}% {result.originalColor.l}%
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <div
                      className="h-20 rounded-xl border border-border"
                      style={{ backgroundColor: hslString(result.userColor) }}
                    />
                    <p className="text-xs font-medium text-muted">Yours</p>
                    <p className="font-mono text-[11px] text-deep">
                      {result.userColor.h}° {result.userColor.s}% {result.userColor.l}%
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-center">
                  <div>
                    <p className="font-heading text-lg font-semibold text-deep">
                      {result.personalBest.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted">your best</p>
                  </div>
                  <div>
                    <p className="font-heading text-lg font-semibold text-deep">
                      #{result.rank}
                      <span className="text-sm font-normal text-muted"> / {result.totalPlayers}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {meta.short} · {result.difficulty}
                    </p>
                  </div>
                </div>
              </div>

              {/* Under the score, not over it: the number is what you came back
                  for, and the unlock is the bonus on top of it. */}
              <AchievementCelebration achievements={result.newlyUnlocked} />

              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <button
                  onClick={() => difficulty && void startRound(difficulty)}
                  disabled={isStarting}
                  className="w-full rounded-xl bg-gradient-to-r from-primary to-accent py-3 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 active:scale-[0.98] sm:flex-1 sm:py-4 touch-manipulation"
                >
                  <RefreshCw className="mr-2 inline h-4 w-4" />
                  Again
                </button>
                <Link
                  // No difficulty in the link: the board opens on `All`, which is
                  // where your best round actually sits, labelled with the
                  // difficulty it was set on.
                  to={`/leaderboard?board=${variant}`}
                  className="w-full rounded-xl bg-surface-alt py-3 text-center text-sm font-semibold text-deep transition-all hover:bg-surface-muted active:scale-[0.98] sm:flex-1 sm:py-4 touch-manipulation"
                >
                  <Trophy className="mr-2 inline h-4 w-4" />
                  Board
                </Link>
                <button
                  onClick={() => navigate('/')}
                  className="w-full rounded-xl bg-surface-alt py-3 text-sm font-semibold text-deep transition-all hover:bg-surface-muted active:scale-[0.98] sm:flex-1 sm:py-4 touch-manipulation"
                >
                  <Home className="mr-2 inline h-4 w-4" />
                  Home
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
