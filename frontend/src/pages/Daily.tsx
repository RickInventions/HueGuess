import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Calendar, Trophy, Target, Clock, ArrowLeft, Home, TrendingUp, Users, Eye } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { daily as dailyApi } from '../lib/api'
import { useTimer } from '../hooks/useTimer'
import { soundService } from '../services/soundService'
import { ColorDisplay } from '../components/game/ColorDisplay'
import { ColorSliders } from '../components/game/ColorSliders'
import { TimerBar } from '../components/game/TimerBar'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import type { HSLColor, DailyChallenge, DailySubmissionResult } from '../types'
import { formatDistanceToNow } from 'date-fns'

type GamePhase = 'idle' | 'memorization' | 'reconstruction' | 'result'

export default function Daily() {
  const navigate = useNavigate()
  const { user, isVerified } = useAuth()

  const [challenge, setChallenge] = useState<DailyChallenge | null>(null)
  const [hasCompleted, setHasCompleted] = useState(false)
  const [userSubmission, setUserSubmission] = useState<any>(null)
  const [globalAverage, setGlobalAverage] = useState(0)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [gameActive, setGameActive] = useState(false)
  const [phase, setPhase] = useState<GamePhase>('idle')
  const [currentColor, setCurrentColor] = useState<HSLColor | null>(null)
  const [userColor, setUserColor] = useState<HSLColor>({ h: 0, s: 50, l: 50 })
  const [result, setResult] = useState<DailySubmissionResult | null>(null)
  const [timeTakenMs, setTimeTakenMs] = useState(0)
  const [startTime, setStartTime] = useState<number>(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Refs for latest values
  const phaseRef = useRef<GamePhase>('idle')
  const isSubmittingRef = useRef(false)
  const userColorRef = useRef<HSLColor>({ h: 0, s: 50, l: 50 })
  const challengeRef = useRef<DailyChallenge | null>(null)
  const startTimeRef = useRef<number>(0)
  const memTimerRef = useRef<ReturnType<typeof useTimer> | null>(null)
  const reconTimerRef = useRef<ReturnType<typeof useTimer> | null>(null)

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { isSubmittingRef.current = isSubmitting }, [isSubmitting])
  useEffect(() => { userColorRef.current = userColor }, [userColor])
  useEffect(() => { challengeRef.current = challenge }, [challenge])
  useEffect(() => { startTimeRef.current = startTime }, [startTime])

  const getDifficultyConfig = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':    return { colorTime: 6,   roundTime: 35 }
      case 'medium':  return { colorTime: 4,   roundTime: 30 }
      case 'hard':    return { colorTime: 2,   roundTime: 15 }
      case 'extreme': return { colorTime: 0.5, roundTime: 15 }
      default:        return { colorTime: 4,   roundTime: 30 }
    }
  }

  const difficultyConfig = challenge
    ? getDifficultyConfig(challenge.difficulty)
    : { colorTime: 4, roundTime: 30 }

  // Handlers using refs
  const handleMemExpire = useCallback(() => {
    if (phaseRef.current !== 'memorization') return
    soundService.playMemorizationEnd()
    setPhase('reconstruction')
    if (reconTimerRef.current) {
      reconTimerRef.current.reset()
      reconTimerRef.current.start()
    }
  }, [])

  const handleReconExpire = useCallback(() => {
    if (phaseRef.current !== 'reconstruction') return
    if (submitFuncRef.current) submitFuncRef.current()
  }, [])

  // Create timers
  const memTimer = useTimer({
    duration: difficultyConfig.colorTime,
    autoStart: false,
    onExpire: handleMemExpire,
  })

  const reconTimer = useTimer({
    duration: difficultyConfig.roundTime,
    autoStart: false,
    onExpire: handleReconExpire,
  })

  // Keep refs updated
  useEffect(() => { memTimerRef.current = memTimer }, [memTimer])
  useEffect(() => { reconTimerRef.current = reconTimer }, [reconTimer])

  // Submit function
  const submitFuncRef = useRef<(() => Promise<void>) | null>(null)
  
  const handleSubmit = useCallback(async () => {
    const ch = challengeRef.current
    if (!ch || phaseRef.current !== 'reconstruction' || isSubmittingRef.current) return

    isSubmittingRef.current = true
    setIsSubmitting(true)
    if (reconTimerRef.current) reconTimerRef.current.pause()

    const timeTaken = Date.now() - startTimeRef.current
    setTimeTakenMs(timeTaken)

    try {
      const response = await dailyApi.submit(ch.id, userColorRef.current, timeTaken)
      setResult(response.data.result)
      setGlobalAverage(response.data.globalAverage)
      setLeaderboard(response.data.leaderboard)
      setHasCompleted(true)
      setPhase('result')
      soundService.playSubmitDing()
      if (response.data.result.isNewRecord && response.data.result.previousBest) {
        soundService.playAchievementUnlock()
      }
    } catch (err) {
      console.error('Failed to submit:', err)
      if (reconTimerRef.current) reconTimerRef.current.start()
      setPhase('reconstruction')
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }, [])

  useEffect(() => {
    submitFuncRef.current = handleSubmit
  }, [handleSubmit])

  const startChallenge = useCallback(() => {
    const ch = challengeRef.current
    if (!ch) return
    const cfg = getDifficultyConfig(ch.difficulty)
    if (memTimerRef.current) memTimerRef.current.reset(cfg.colorTime)
    if (reconTimerRef.current) reconTimerRef.current.reset(cfg.roundTime)
    setCurrentColor(ch.color)
    setUserColor({ h: 0, s: 0, l: 0 })
    setPhase('memorization')
    setGameActive(true)
    setStartTime(Date.now())
    soundService.playRoundStart()
    if (memTimerRef.current) memTimerRef.current.start()
  }, [])

  const handleCancel = useCallback(() => {
    if (memTimerRef.current) {
      memTimerRef.current.pause()
      memTimerRef.current.reset()
    }
    if (reconTimerRef.current) {
      reconTimerRef.current.pause()
      reconTimerRef.current.reset()
    }
    setGameActive(false)
    setPhase('idle')
    setCurrentColor(null)
  }, [])

  const handleColorChange = useCallback((channel: 'h' | 's' | 'l', value: number) => {
    setUserColor(prev => ({ ...prev, [channel]: value }))
  }, [])

  const handleGoHome = useCallback(() => navigate('/'), [navigate])

  const loadDailyChallenge = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await dailyApi.getToday()
      setChallenge(response.data.challenge)
      setHasCompleted(response.data.hasCompleted)
      setUserSubmission(response.data.userSubmission)
      setGlobalAverage(response.data.globalAverage || 0)
      const challengeId = response.data.challenge?.id
      if (challengeId) {
        const leaderboardRes = await dailyApi.getLeaderboard(challengeId, 50)
        setLeaderboard(leaderboardRes.data.leaderboard)
      }
    } catch (err) {
      setError('Failed to load daily challenge')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDailyChallenge()
  }, [])

  // Render logic (same as your original, but with fixed timer references)
  if (!isVerified) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <div className="bg-accent/10 rounded-2xl p-8">
          <Target className="w-12 h-12 text-accent mx-auto mb-4" />
          <h2 className="font-heading text-xl font-semibold mb-2">Verification Required</h2>
          <p className="text-muted text-sm mb-6">Please verify your email to participate in Daily Challenges.</p>
          <Button onClick={() => navigate('/verify')}>Verify Email</Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-3.5rem)]">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted text-sm">Loading today's challenge...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <div className="bg-accent/10 rounded-2xl p-8">
          <p className="text-accent mb-4">{error}</p>
          <Button onClick={loadDailyChallenge}>Try Again</Button>
        </div>
      </div>
    )
  }

  if (!challenge) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <div className="bg-surface-alt rounded-2xl p-8">
          <Calendar className="w-12 h-12 text-muted mx-auto mb-4" />
          <h2 className="font-heading text-xl font-semibold mb-2">No Challenge Available</h2>
          <p className="text-muted text-sm mb-6">Check back tomorrow for a new daily challenge!</p>
          <Button onClick={handleGoHome}>Go Home</Button>
        </div>
      </div>
    )
  }

  // Result view
  if (phase === 'result' && result) {
    const rankBadge = result.rank === 1 ? '🥇' : result.rank === 2 ? '🥈' : result.rank === 3 ? '🥉' : null
    return (
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={handleGoHome} className="flex items-center gap-1 text-muted hover:text-deep transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Exit</span>
          </button>
          <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">Daily Challenge</span>
        </div>
        <Card className="text-center space-y-4 p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Your Accuracy</span>
            <span className="text-sm text-muted">Time: {(timeTakenMs / 1000).toFixed(1)}s</span>
          </div>
          <span className="font-heading text-5xl font-bold text-primary">{result.accuracy.toFixed(3)}%</span>
          <div className="flex items-center justify-center gap-3 py-3 bg-surface-alt rounded-xl">
            {rankBadge ? <><span className="text-2xl">{rankBadge}</span><span className="font-semibold text-deep">#{result.rank}</span></> : <><Trophy className="w-5 h-5 text-muted" /><span className="font-semibold text-deep">#{result.rank}</span></>}
            <span className="text-sm text-muted">on today's leaderboard</span>
          </div>
          {result.isNewRecord && (
            <div className="flex items-center justify-center gap-2 text-success bg-success/10 py-2 rounded-xl">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">New personal best!</span>
              {result.previousBest && <span className="text-xs text-muted">(Previous: {result.previousBest.toFixed(3)}%)</span>}
            </div>
          )}
          <div className="flex items-center justify-center gap-2 text-sm text-muted">
            <Users className="w-4 h-4" />
            <span>{result.totalParticipants} participants today</span>
          </div>
        </Card>
        {leaderboard.length > 0 && (
          <Card>
            <h3 className="font-heading font-semibold text-sm text-muted uppercase tracking-wider mb-4">Today's Top Performers</h3>
            <div className="space-y-2">
              {leaderboard.slice(0, 5).map((entry) => (
                <div key={entry.user_id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-muted font-mono">#{entry.rank}</span>
                    <span className="font-medium text-deep">{entry.username}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-primary font-semibold">{entry.accuracy.toFixed(3)}%</span>
                    <span className="text-xs text-muted">{(entry.time_taken_ms / 1000).toFixed(0)}s</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
        <p className="text-center text-xs text-muted">Global average today: {globalAverage.toFixed(3)}%</p>
        <div className="flex gap-3 pt-4">
          <Button variant="secondary" onClick={handleGoHome} fullWidth><Home className="w-4 h-4 mr-2" />Home</Button>
        </div>
      </div>
    )
  }

  if (hasCompleted && !gameActive) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={handleGoHome} className="flex items-center gap-1 text-muted hover:text-deep transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Exit</span>
          </button>
          <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">Daily Challenge</span>
        </div>
        <Card className="text-center p-6 space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">{formatDistanceToNow(new Date(challenge.date), { addSuffix: true })}</span>
          </div>
          <div>
            <h2 className="font-heading text-xl font-semibold mb-2">Already Completed!</h2>
            <p className="text-muted text-sm">You've already completed today's challenge.</p>
          </div>
          {userSubmission && (
            <div className="bg-surface-alt rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted">Your Score</span>
                <span className="text-2xl font-bold text-primary">{userSubmission.accuracy.toFixed(3)}%</span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted">
                <span>Time</span>
                <span>{(userSubmission.time_taken_ms / 1000).toFixed(3)}s</span>
              </div>
            </div>
          )}
        </Card>
        {leaderboard.length > 0 && (
          <Card>
            <h3 className="font-heading font-semibold text-sm text-muted uppercase tracking-wider mb-4">Today's Leaderboard</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {leaderboard.map((entry) => (
                <div key={entry.user_id} className="flex items-center justify-between text-sm py-2 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-muted font-mono">#{entry.rank}</span>
                    <span className="font-medium text-deep">{entry.username}</span>
                    {entry.user_id === user?.id && <span className="text-xs text-primary">(you)</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-primary font-semibold">{entry.accuracy.toFixed(3)}%</span>
                    <span className="text-xs text-muted">{(entry.time_taken_ms / 1000).toFixed(1)}s</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
        <p className="text-center text-xs text-muted">Global average today: {globalAverage.toFixed(3)}%</p>
        <Button variant="secondary" onClick={handleGoHome} fullWidth><Home className="w-4 h-4 mr-2" />Go Home</Button>
      </div>
    )
  }

  if (gameActive) {
    const isReconstructPhase = phase === 'reconstruction'
    const isMemorizePhase = phase === 'memorization'
    const activeTimer = isMemorizePhase ? memTimer : reconTimer
    return (
      <div className="max-w-game mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={handleCancel} className="flex items-center gap-1 text-muted hover:text-deep transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Cancel</span>
          </button>
          <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full capitalize">{challenge.difficulty}</span>
        </div>
        {(isMemorizePhase || isReconstructPhase) && (
          <TimerBar
            timeRemaining={activeTimer.timeRemaining}
            totalTime={isMemorizePhase ? difficultyConfig.colorTime : difficultyConfig.roundTime}
            label={isMemorizePhase ? 'Memorize the color' : 'Reconstruct the color'}
            isUrgent={activeTimer.isUrgent}
          />
        )}
        {isMemorizePhase && currentColor && (
          <div className="space-y-6">
            <ColorDisplay color={currentColor} showControls={false} size="lg" />
            <p className="text-center text-sm text-muted">Memorize this color carefully!</p>
          </div>
        )}
        {isReconstructPhase && (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-sm text-muted mb-2">Recreate the color from memory</p>
              <p className="text-xs text-muted">Difficulty: <span className="capitalize">{challenge.difficulty}</span></p>
            </div>
            <ColorSliders color={userColor} onChange={handleColorChange} onSubmit={handleSubmit} disabled={isSubmitting} />
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-primary to-accent text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Guess'}
            </button>
          </div>
        )}
      </div>
    )
  }

  // Idle state
  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={handleGoHome} className="flex items-center gap-1 text-muted hover:text-deep transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>
      </div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="text-center p-6 space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-muted">Today's Challenge</span>
          </div>
          <div className="w-32 h-32 rounded-2xl mx-auto bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <Eye className="w-8 h-8 text-muted" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-semibold mb-2">Daily Color Challenge</h2>
            <p className="text-muted text-sm">Test your color memory against the community. The color will be revealed when you start.</p>
          </div>
          <div className="flex items-center justify-center gap-4 text-sm">
            <div className="flex items-center gap-1"><Clock className="w-4 h-4 text-muted" /><span>{difficultyConfig.colorTime}s to memorize</span></div>
            <div className="flex items-center gap-1"><Target className="w-4 h-4 text-muted" /><span>{difficultyConfig.roundTime}s to reconstruct</span></div>
          </div>
          <span className="inline-block capitalize px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">{challenge.difficulty}</span>
          {globalAverage > 0 && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted pt-2">
              <Users className="w-4 h-4" />
              <span>Global average: {globalAverage.toFixed(3)}%</span>
            </div>
          )}
          <div className="flex flex-col gap-3">
            <Button onClick={startChallenge} fullWidth><Target className="w-4 h-4 mr-2" />Start Challenge</Button>
            <Button variant="secondary" fullWidth onClick={() => document.getElementById('daily-leaderboard')?.scrollIntoView({ behavior: 'smooth' })}>
              <Trophy className="w-4 h-4 mr-2" />View Leaderboard
            </Button>
          </div>
        </Card>
      </motion.div>
      <div id="daily-leaderboard">
        {leaderboard.length > 0 ? (
          <Card>
            <h3 className="font-heading font-semibold text-sm text-muted uppercase tracking-wider mb-4 flex items-center gap-2"><Trophy className="w-4 h-4" />Today's Top Performers</h3>
            <div className="space-y-2">
              {leaderboard.slice(0, 5).map((entry) => (
                <div key={entry.user_id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3"><span className="w-6 text-muted font-mono">#{entry.rank}</span><span className="font-medium text-deep">{entry.username}</span></div>
                  <div className="flex items-center gap-3"><span className="text-primary font-semibold">{entry.accuracy.toFixed(3)}%</span><span className="text-xs text-muted">{(entry.time_taken_ms / 1000).toFixed(1)}s</span></div>
                </div>
              ))}
              {leaderboard.length > 5 && <p className="text-center text-xs text-muted mt-3">+{leaderboard.length - 5} more players</p>}
            </div>
          </Card>
        ) : (
          <Card className="text-center py-6"><p className="text-muted text-sm">No submissions yet. Be the first!</p></Card>
        )}
      </div>
      <div className="text-center text-xs text-muted space-y-1">
        <p>• One new challenge every day at midnight UTC</p>
        <p>• Compete with the community for the highest accuracy</p>
        <p>• Top performers get recognition on the leaderboard</p>
      </div>
    </div>
  )
}