import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Trophy, Check, Users, Loader2 } from 'lucide-react'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useMultiplayer } from '../hooks/useMultiplayer'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'
import { soundService } from '../services/soundService'
import { ColorSliders } from '../components/game/ColorSliders'
import { TimerBar } from '../components/game/TimerBar'
import { RoundResults } from '../components/multiplayer/RoundResults'
import { RoomLeaderboard } from '../components/multiplayer/RoomLeaderboard'
import { PlayerList } from '../components/multiplayer/PlayerList'
import { ChatPanel } from '../components/multiplayer/ChatPanel'
import { ConnectionBanner } from '../components/multiplayer/ConnectionBanner'
import { RoomTopBar } from '../components/multiplayer/RoomTopBar'
import { RoomSettings } from '../components/multiplayer/RoomSettings'
import { Button } from '../components/ui/Button'
import type { HSLColor } from '../types'

/** Floor for the auto-submit fallback — no real round is shorter than this. */
const MIN_ROUND_MS = 3_000

export default function Room() {
  const navigate = useNavigate()
  const { code } = useParams<{ code: string }>()
  const { user } = useAuth()
  const { getServerTime } = useSocket()
  const {
    currentRoom,
    players,
    phase,
    currentRound,
    totalRounds,
    roundResults,
    targetColor,
    leaderboard,
    chatMessages,
    countdown,
    currentColor,
    submittedCount,
    totalSubmitters,
    hasSubmitted,
    playAgainVotes,
    playAgainNeeded,
    timeRemaining,
    phaseEndsAt,
    isFinalRound,
    sessionEnded,
    isConnected,
    isOnline,
    isReconnecting,
    connectionMessage,
    retryConnection,
    submitColor,
    playAgain,
    endRoom,
    leaveRoom,
    sendMessage,
    sendTyping,
    typingUsers,
    setReady,
    joinRoom,
    updateRoomConfig,
  } = useMultiplayer()

  const [userColor, setUserColor] = useState<HSLColor>({ h: 0, s: 0, l: 0 })
  const autoSubmittedRef = useRef<number | null>(null)
  const enteredReconstructionRef = useRef<number | null>(null)
  const deepLinkTried = useRef(false)

  const canAct = isConnected && isOnline

  // ── Derived state ─────────────────────────────────────────────────────────
  const currentPlayer = useMemo(() => players.find(p => p.userId === user?.id), [players, user?.id])
  const isHost = currentPlayer?.isHost ?? false
  const isReady = currentPlayer?.status === 'ready'
  const connectedPlayers = useMemo(() => players.filter(p => p.status !== 'disconnected'), [players])

  const timeLeft = timeRemaining !== null ? Math.max(0, Math.ceil(timeRemaining)) : 0
  const totalTime =
    phase === 'memorization'
      ? currentRoom?.config.colorTimeSeconds ?? 0
      : currentRoom?.config.roundTimeSeconds ?? 0
  const isUrgent = timeLeft <= 5 && timeLeft > 0
  const timerLabel = phase === 'memorization' ? 'Memorize' : 'Reconstruct'

  // ── Deep link: /room/CODE with no room in state → try to join it once ──────
  useEffect(() => {
    if (currentRoom || !code || deepLinkTried.current || !canAct) return
    deepLinkTried.current = true
    joinRoom(code).catch(() => {
      navigate('/challenge', { replace: true, state: { message: 'That room is no longer available' } })
    })
  }, [currentRoom, code, canAct, joinRoom, navigate])

  // Host ended the session → everyone goes back to the lobby view.
  useEffect(() => {
    if (sessionEnded) navigate('/challenge', { replace: true })
  }, [sessionEnded, navigate])

  // Left the room entirely (kicked, dissolved) → leave the screen.
  useEffect(() => {
    if (!currentRoom && deepLinkTried.current) {
      navigate('/challenge', { replace: true })
    }
  }, [currentRoom, navigate])

  // ── Sounds ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'reconstruction' || timeRemaining === null) return
    const seconds = Math.ceil(timeRemaining)
    if (seconds <= 0) return
    if (seconds <= 5) soundService.playUrgentTick()
    else if (seconds === 10) soundService.playTick()
  }, [timeRemaining === null ? null : Math.ceil(timeRemaining), phase])

  useEffect(() => {
    if (countdown !== null && countdown > 0 && countdown <= 3) soundService.playCountdownTick(countdown)
  }, [countdown])

  useEffect(() => {
    if (phase === 'memorization') soundService.playRoundStart()
    if (phase === 'reconstruction') soundService.playMemorizationEnd()
  }, [phase])

  /**
   * Jump to the top whenever the phase turns over.
   *
   * On a phone each phase is taller than the viewport, so arriving mid-page meant
   * the colour, the sliders, or the round results could all start out scrolled off
   * screen — and during memorization the seconds spent scrolling are the round.
   * `auto` rather than `smooth`: a timed reveal shouldn't wait on an animation.
   */
  useEffect(() => {
    if (phase === 'waiting') return
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [phase, currentRound])

  // ── Round reset ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'memorization') {
      setUserColor({ h: 0, s: 0, l: 0 })
      autoSubmittedRef.current = null
    }
  }, [phase, currentRound])

  const handleSubmit = useCallback(() => {
    if (hasSubmitted || phase !== 'reconstruction') return
    submitColor(userColor)
    soundService.playSubmitDing()
  }, [hasSubmitted, phase, submitColor, userColor])

  // Latest slider position, read at auto-submit time. A ref rather than a dep so
  // dragging the sliders doesn't tear down and re-arm the timer below.
  const userColorRef = useRef(userColor)
  userColorRef.current = userColor

  // When this client actually reached the reconstruction phase. Declared above
  // the auto-submit effect so the stamp is already in place when it runs.
  useEffect(() => {
    enteredReconstructionRef.current = phase === 'reconstruction' ? Date.now() : null
  }, [phase, currentRound])

  // Auto-submit whatever is on the sliders when the round's clock runs out, once
  // per round. Scheduled against the server deadline rather than triggered by a
  // `timeRemaining` that read 0 — that value belongs to whichever phase was
  // active when it was computed, and acting on it fired the instant a round
  // opened on slower connections.
  useEffect(() => {
    if (phase !== 'reconstruction' || hasSubmitted) return
    if (phaseEndsAt === null) return
    if (autoSubmittedRef.current === currentRound) return

    const enteredAt = enteredReconstructionRef.current ?? Date.now()
    const untilDeadline = phaseEndsAt - getServerTime()
    // A deadline already in the past while we're only just arriving means the
    // clock estimate is off, not that the round is over — fall back to the
    // configured round length so a bad estimate can't eat the player's turn.
    const roundMs = Math.max((currentRoom?.config.roundTimeSeconds ?? 0) * 1000, MIN_ROUND_MS)
    const delay =
      untilDeadline > 0 ? untilDeadline : Math.max(0, enteredAt + roundMs - Date.now())

    const timer = window.setTimeout(() => {
      if (autoSubmittedRef.current === currentRound) return
      autoSubmittedRef.current = currentRound
      submitColor(userColorRef.current)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [
    phase,
    phaseEndsAt,
    hasSubmitted,
    currentRound,
    getServerTime,
    submitColor,
    currentRoom?.config.roundTimeSeconds,
  ])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

      if (phase === 'reconstruction' && !hasSubmitted && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        handleSubmit()
      }
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        soundService.toggleMute()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, hasSubmitted, handleSubmit])

  const handleLeaveRoom = () => {
    leaveRoom()
    navigate('/challenge', { replace: true })
  }

  // Shared by the lobby and the results screen so both toggles sound the same.
  const handleToggleReady = useCallback(() => {
    const next = !isReady
    setReady(next)
    if (next) soundService.playReady()
    else soundService.playUnready()
  }, [isReady, setReady])

  const banner = (
    <ConnectionBanner
      isOnline={isOnline}
      isConnected={isConnected}
      isReconnecting={isReconnecting}
      message={connectionMessage}
      onRetry={retryConnection}
    />
  )

  const chatPanel = (
    <ChatPanel
      messages={chatMessages}
      onSend={sendMessage}
      canSend={canAct}
      currentUserId={user?.id}
      typingUsers={typingUsers}
      onTyping={sendTyping}
    />
  )

  /**
   * Leaving lives here rather than beside Ready/Submit, and is confirmed first.
   * The wording changes with the phase because leaving a live round costs the
   * round, while leaving the lobby costs nothing.
   */
  const topBar = (subtitle: React.ReactNode, midGame = false) => (
    <RoomTopBar
      playerCount={connectedPlayers.length}
      maxPlayers={currentRoom?.config.maxPlayers ?? 0}
      onLeave={handleLeaveRoom}
      leaveTitle={midGame ? 'Leave the game?' : 'Leave this room?'}
      leaveMessage={
        midGame
          ? 'You will drop out mid-round and lose your score for this game. The others keep playing.'
          : 'You will drop out of this room. You can rejoin with the code while it is still open.'
      }
    >
      {subtitle}
    </RoomTopBar>
  )

  // ── Still resolving a deep link ───────────────────────────────────────────
  if (!currentRoom) {
    return (
      <div className="max-w-game mx-auto px-4 py-12 space-y-6 text-center">
        {banner}
        <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin" />
        <p className="text-sm text-muted">Joining room {code}…</p>
        <Button variant="ghost" onClick={() => navigate('/challenge', { replace: true })}>
          Back to lobby
        </Button>
      </div>
    )
  }

  // ── WAITING (lobby between rounds) ────────────────────────────────────────
  if (phase === 'waiting') {
    const showCountdown = countdown !== null && countdown > 0
    const allReady = connectedPlayers.length >= 2 && connectedPlayers.every(p => p.status === 'ready')
    const roundLabel = currentRound === 0 ? 'Get Ready' : `Round ${currentRound} of ${totalRounds ?? '∞'}`

    return (
      <div className="max-w-game lg:max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        {topBar(
          <span className="text-xs font-mono tracking-[0.15em] text-muted">{currentRoom.code}</span>
        )}

        {banner}

        <div className="text-center space-y-2">
          <p className="font-heading text-xl font-semibold">{roundLabel}</p>
          <p className="text-sm text-muted">
            {currentRound === 0 ? 'The game starts when everyone is ready' : 'Ready up for the next round'}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
          <div className="space-y-6">
            <PlayerList
              players={players}
              hostSocketId={currentRoom.hostSocketId}
              maxPlayers={currentRoom.config.maxPlayers}
              currentUserId={user?.id}
              showScores={currentRound > 0}
              allowFriendRequests
            />

            {/* Editable only before round 1 — the server enforces the same window,
                and mid-game these values are the rules already-scored rounds were
                played under. */}
            <RoomSettings
              config={currentRoom.config}
              canEdit={isHost && currentRound === 0}
              playerCount={players.length}
              onSave={updateRoomConfig}
              disabled={!canAct}
            />

            {showCountdown ? (
              <motion.div
                key={countdown}
                initial={{ scale: 1.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-6"
              >
                <span className="font-heading text-6xl sm:text-7xl font-bold text-primary">{countdown}</span>
                <p className="text-muted mt-3 text-sm">Starting…</p>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {connectedPlayers.length < 2 && (
                  <p className="text-center text-xs text-accent">Need at least 2 connected players</p>
                )}
                {connectedPlayers.length >= 2 && !allReady && (
                  <p className="text-center text-xs text-muted">Waiting for all players to ready up…</p>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    fullWidth
                    variant={isReady ? 'secondary' : 'primary'}
                    onClick={handleToggleReady}
                    disabled={!canAct}
                    icon={isReady ? <Check className="w-4 h-4" /> : undefined}
                  >
                    {isReady ? 'Unready' : 'Ready'}
                  </Button>
                  {isHost && (
                    <Button variant="ghost" onClick={endRoom} disabled={!canAct}>
                      End Session
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {chatPanel}
        </div>
      </div>
    )
  }

  // ── GAME OVER ─────────────────────────────────────────────────────────────
  if (phase === 'ended') {
    const votesNeeded = playAgainNeeded || connectedPlayers.length
    const hasVoted = leaderboard.some(e => e.socketId === currentPlayer?.socketId && e.playedAgain)

    return (
      <div className="max-w-game lg:max-w-4xl mx-auto px-4 py-6 sm:py-10 space-y-6">
        {topBar(
          <span className="text-xs font-mono tracking-[0.15em] text-muted">{currentRoom.code}</span>
        )}

        {banner}

        <div className="text-center space-y-3">
          <Trophy className="w-14 h-14 sm:w-16 sm:h-16 text-yellow-500 mx-auto" />
          <h2 className="font-heading text-2xl font-semibold">Game Over</h2>
        </div>

        {/* Chat stays available on the final screen — this is where people say
            "good game" and agree on another round. */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
          <div className="space-y-6">
            <RoomLeaderboard entries={leaderboard} rounds={currentRound} currentUserId={user?.id} showVotes />

            <PlayerList
              players={players}
              hostSocketId={currentRoom.hostSocketId}
              maxPlayers={currentRoom.config.maxPlayers}
              currentUserId={user?.id}
              allowFriendRequests
            />

            <div className="space-y-3">
              <Button
                fullWidth
                onClick={playAgain}
                disabled={!canAct || hasVoted}
                variant={hasVoted ? 'secondary' : 'primary'}
              >
                {hasVoted ? 'Waiting for others' : 'Play Again'} ({playAgainVotes}/{votesNeeded})
              </Button>
              {isHost && (
                <Button variant="ghost" fullWidth onClick={endRoom} disabled={!canAct}>
                  End Session
                </Button>
              )}
            </div>
          </div>

          {chatPanel}
        </div>
      </div>
    )
  }

  // ── RESULTS ───────────────────────────────────────────────────────────────
  if (phase === 'results') {
    const readyCount = connectedPlayers.filter(p => p.status === 'ready').length
    const enoughPlayers = connectedPlayers.length >= 2
    const waitingOn = connectedPlayers.length - readyCount

    return (
      <div className="max-w-game lg:max-w-4xl mx-auto px-4 py-6 space-y-6">
        {topBar(
          <span className="text-xs font-medium text-muted">
            Round {currentRound}
            {totalRounds ? ` of ${totalRounds}` : ''} · results
          </span>
        )}

        {banner}

        <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
          <div className="space-y-6">
            <RoundResults
              results={roundResults}
              targetColor={targetColor}
              currentUserId={user?.id}
              round={currentRound}
            />
            <RoomLeaderboard entries={leaderboard} rounds={currentRound} currentUserId={user?.id} />

            {isFinalRound ? (
              <p className="flex items-center justify-center gap-2 text-center text-sm text-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
                Final round — tallying up the results…
              </p>
            ) : (
              <div className="space-y-4">
                {/* Who still has to ready up before the next round can start. */}
                <div className="space-y-3 p-4 rounded-card bg-surface-alt border border-border">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Next round
                    </h3>
                    <span
                      className={`text-xs font-mono ${
                        enoughPlayers && waitingOn === 0 ? 'text-success' : 'text-muted'
                      }`}
                    >
                      {readyCount}/{connectedPlayers.length} ready
                    </span>
                  </div>

                  <PlayerList
                    players={players}
                    hostSocketId={currentRoom.hostSocketId}
                    maxPlayers={currentRoom.config.maxPlayers}
                    currentUserId={user?.id}
                    showScores
                    allowFriendRequests
                  />

                  <p className="text-center text-xs text-muted">
                    {!enoughPlayers
                      ? 'Need at least 2 connected players to continue'
                      : waitingOn > 0
                        ? `Waiting on ${waitingOn} ${waitingOn === 1 ? 'player' : 'players'} to ready up`
                        : 'Everyone is ready — starting…'}
                  </p>
                </div>

                <div className="space-y-3">
                  <Button
                    fullWidth
                    variant={isReady ? 'secondary' : 'primary'}
                    onClick={handleToggleReady}
                    disabled={!canAct}
                    icon={isReady ? <Check className="w-4 h-4" /> : undefined}
                  >
                    {isReady ? 'Unready' : 'Ready for Next Round'}
                  </Button>
                  {isHost && (
                    <Button variant="ghost" fullWidth onClick={endRoom} disabled={!canAct}>
                      End Session
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {chatPanel}
        </div>
      </div>
    )
  }

  // ── ACTIVE ROUND ──────────────────────────────────────────────────────────
  const showColor = phase === 'memorization' && currentColor

  return (
    <div className="max-w-game lg:max-w-5xl mx-auto px-4 py-6 space-y-5">
      {topBar(
        <span className="text-xs font-medium text-muted">
          Round {currentRound}
          {totalRounds ? ` of ${totalRounds}` : ''}
        </span>,
        true
      )}

      {banner}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
        <div className="space-y-5">
          <TimerBar timeRemaining={timeLeft} totalTime={totalTime} label={timerLabel} isUrgent={isUrgent} />

          {phase === 'reconstruction' && (
            <div className="flex items-center justify-end text-xs">
              <span className="inline-flex items-center gap-1.5 text-muted">
                <Users className="w-3.5 h-3.5" />
                {submittedCount}/{totalSubmitters || connectedPlayers.length} submitted
              </span>
            </div>
          )}

          <AnimatePresence mode="wait">
            {showColor && currentColor && (
              <motion.div
                key="memorize"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                // Opacity and scale only. Animating `filter: blur()` here promoted a
                // large element to its own layer mid-transition, and on phones that
                // showed up as the whole screen flashing once at the colour reveal.
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.4 }}
                className="space-y-4"
              >
                <div
                  className="w-full aspect-square max-w-[240px] sm:max-w-[280px] mx-auto rounded-2xl shadow-card"
                  style={{ backgroundColor: `hsl(${currentColor.h}, ${currentColor.s}%, ${currentColor.l}%)` }}
                />
                <p className="text-center text-sm text-muted">Memorize this color</p>
              </motion.div>
            )}

            {phase === 'reconstruction' && (
              <motion.div
                key="reconstruct"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <ColorSliders
                  color={userColor}
                  onChange={(channel, value) => setUserColor(prev => ({ ...prev, [channel]: value }))}
                  disabled={hasSubmitted}
                  onSubmit={handleSubmit}
                />
                <Button
                  fullWidth
                  onClick={handleSubmit}
                  disabled={hasSubmitted || !canAct}
                  icon={<Send className="w-4 h-4" />}
                >
                  {hasSubmitted ? 'Submitted ✓' : 'Submit Guess'}
                </Button>
                {hasSubmitted && (
                  <p className="text-center text-sm text-muted">
                    Waiting for the other players…
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-4">
          <PlayerList
            players={players}
            hostSocketId={currentRoom.hostSocketId}
            maxPlayers={currentRoom.config.maxPlayers}
            currentUserId={user?.id}
            showScores
          />
          {/* Rendered at every breakpoint — mid-game chat used to be desktop-only. */}
          <ChatPanel
            messages={chatMessages}
            onSend={sendMessage}
            canSend={canAct}
            currentUserId={user?.id}
            typingUsers={typingUsers}
            onTyping={sendTyping}
            compact
          />
        </div>
      </div>
    </div>
  )
}
