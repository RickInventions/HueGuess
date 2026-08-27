import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Copy, Check, AlertTriangle, Share2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useMultiplayer } from '../hooks/useMultiplayer'
import { soundService } from '../services/soundService'
import { RoomSetup } from '../components/multiplayer/RoomSetup'
import { JoinForm } from '../components/multiplayer/JoinForm'
import { PlayerList } from '../components/multiplayer/PlayerList'
import { ChatPanel } from '../components/multiplayer/ChatPanel'
import { ConnectionBanner } from '../components/multiplayer/ConnectionBanner'
import { RoomTopBar } from '../components/multiplayer/RoomTopBar'
import { FriendsLauncher } from '../components/multiplayer/FriendsModal'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import type { RoomConfig } from '../types/multiplayer'
import { RoomSettings } from '../components/multiplayer/RoomSettings'

type View = 'choose' | 'create' | 'join' | 'waiting'

export default function Challenge() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const {
    currentRoom,
    players,
    phase,
    countdown,
    chatMessages,
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    sendMessage,
    sendTyping,
    typingUsers,
    isCreating,
    isJoining,
    isConnected,
    isOnline,
    isReconnecting,
    connectionMessage,
    retryConnection,
    updateRoomConfig,
    error: mpError,
  } = useMultiplayer()

  const [view, setView] = useState<View>('choose')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(
    (location.state as { message?: string } | null)?.message ?? null
  )

  const canAct = isConnected && isOnline

  // Keep the view in step with whether we actually hold a room.
  useEffect(() => {
    if (currentRoom) setView('waiting')
    else setView(prev => (prev === 'waiting' ? 'choose' : prev))
  }, [currentRoom])

  useEffect(() => {
    if (currentRoom) setError(null)
  }, [currentRoom])

  useEffect(() => {
    if (!mpError) return
    setError(mpError)
    const timer = setTimeout(() => setError(null), 6000)
    return () => clearTimeout(timer)
  }, [mpError])

  // Hand off to the game screen once a round is live.
  useEffect(() => {
    if (!currentRoom) return
    if (['memorization', 'reconstruction', 'results', 'ended'].includes(phase)) {
      navigate(`/room/${currentRoom.code}`, { replace: true })
    }
  }, [phase, currentRoom, navigate])

  // The 3-2-1 before the first round happens here, in the lobby.
  useEffect(() => {
    if (countdown !== null && countdown > 0 && countdown <= 3) soundService.playCountdownTick(countdown)
  }, [countdown])

  const connectedPlayers = useMemo(() => players.filter(p => p.status !== 'disconnected'), [players])
  const currentPlayer = players.find(p => p.userId === user?.id)
  const isReady = currentPlayer?.status === 'ready'
  const allReady = connectedPlayers.length >= 2 && connectedPlayers.every(p => p.status === 'ready')
  const showCountdown = countdown !== null && countdown > 0

  if (!user) {
    return (
      <div className="max-w-game mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-muted">Please log in to play multiplayer.</p>
        <Button onClick={() => navigate('/login')}>Log in</Button>
      </div>
    )
  }

  const handleCreate = (config: RoomConfig) => {
    setError(null)
    createRoom(config).catch(err => setError(err.message))
  }

  const handleJoin = (code: string) => {
    setError(null)
    joinRoom(code).catch(err => setError(err.message))
  }

  const handleToggleReady = () => {
    const next = !isReady
    setReady(next)
    if (next) soundService.playReady()
    else soundService.playUnready()
  }

  const handleCopyCode = async () => {
    if (!currentRoom?.code) return
    try {
      await navigator.clipboard.writeText(currentRoom.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy — select the code manually')
    }
  }

  const handleShare = async () => {
    if (!currentRoom?.code) return
    const url = `${window.location.origin}/room/${currentRoom.code}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'HueGuess Challenge', text: `Join my room: ${currentRoom.code}`, url })
        return
      } catch {
        /* share sheet dismissed */
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const handleLeave = () => {
    leaveRoom()
    setView('choose')
    setError(null)
  }

  const handleBack = () => {
    if (view === 'create' || view === 'join') {
      setView('choose')
      return
    }
    if (currentRoom) leaveRoom()
    navigate('/')
  }

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

  const backLink = (
    <button
      onClick={handleBack}
      className="flex items-center gap-1 text-muted hover:text-deep transition-colors cursor-pointer"
    >
      <ArrowLeft className="w-4 h-4" />
      <span className="text-sm">Back</span>
    </button>
  )

  return (
    <div
      className={`mx-auto px-4 py-6 space-y-6 ${
        view === 'waiting' ? 'max-w-game lg:max-w-4xl' : 'max-w-game'
      }`}
    >
      {/* In a room, leaving is an icon up here rather than a button stacked under
          Ready. Outside one there is nothing to leave, so it's just the back link
          plus a way into friend management. */}
      {currentRoom ? (
        <RoomTopBar
          playerCount={connectedPlayers.length}
          maxPlayers={currentRoom.config.maxPlayers}
          onLeave={handleLeave}
          leaveTitle="Leave this room?"
          leaveMessage="You will drop out of this room. You can rejoin with the code while it is still open."
        >
          {backLink}
        </RoomTopBar>
      ) : (
        <div className="flex items-center justify-between gap-3">
          {backLink}
          <FriendsLauncher />
        </div>
      )}

      <ConnectionBanner
        isOnline={isOnline}
        isConnected={isConnected}
        isReconnecting={isReconnecting}
        message={connectionMessage}
        onRetry={retryConnection}
      />

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="flex items-start gap-2 p-4 rounded-card bg-accent/10 border border-accent/20 text-sm text-accent"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="min-w-0 flex-1 break-words">{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss" className="text-accent/60 hover:text-accent">
            ✕
          </button>
        </motion.div>
      )}

      {view === 'choose' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <h2 className="font-heading text-section text-center">Challenge</h2>
          <p className="text-center text-sm text-muted">Play against friends in real time</p>
          <Button fullWidth onClick={() => setView('create')} disabled={!canAct}>
            Create Room
          </Button>
          <Button fullWidth variant="secondary" onClick={() => setView('join')} disabled={!canAct}>
            Join Room
          </Button>
          {!canAct && (
            <p className="text-center text-xs text-muted">
              Waiting for a connection to the game server…
            </p>
          )}
        </motion.div>
      )}

      {view === 'create' && <RoomSetup onCreate={handleCreate} loading={isCreating} disabled={!canAct} />}

      {view === 'join' && <JoinForm onJoin={handleJoin} loading={isJoining} disabled={!canAct} />}

      {view === 'waiting' && currentRoom && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card className="text-center space-y-3">
            <p className="text-xs text-muted uppercase tracking-wider">Room Code</p>
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              <span className="font-heading text-xl sm:text-2xl font-bold tracking-[0.15em] break-all">
                {currentRoom.code}
              </span>
              <button
                onClick={handleCopyCode}
                aria-label="Copy room code"
                className="p-2 rounded-button hover:bg-surface-alt transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-muted" />}
              </button>
              <button
                onClick={handleShare}
                aria-label="Share room link"
                className="p-2 rounded-button hover:bg-surface-alt transition-colors"
              >
                <Share2 className="w-4 h-4 text-muted" />
              </button>
            </div>
            <p className="text-xs text-muted">Share this code with friends to join</p>
          </Card>

            <RoomSettings
              config={currentRoom.config}
              canEdit={currentPlayer?.isHost && currentRoom.phase === 'waiting'}
              playerCount={players.length}
              onSave={updateRoomConfig}
              disabled={!canAct}
            />

          <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
            <div className="space-y-6">
              <PlayerList
                players={players}
                hostSocketId={currentRoom.hostSocketId}
                maxPlayers={currentRoom.config.maxPlayers}
                currentUserId={user.id}
                allowFriendRequests
              />

              {showCountdown ? (
                <motion.div
                  key={countdown}
                  initial={{ scale: 1.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center py-6"
                >
                  <span className="font-heading text-6xl sm:text-7xl font-bold text-primary">{countdown}</span>
                  <p className="text-muted mt-3 text-sm">Game starting…</p>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  {connectedPlayers.length < 2 && (
                    <p className="text-center text-xs text-accent">Need at least 2 players to start</p>
                  )}
                  {connectedPlayers.length >= 2 && !allReady && (
                    <p className="text-center text-xs text-muted">Waiting for all players to ready up…</p>
                  )}

                  <Button
                    fullWidth
                    variant={isReady ? 'secondary' : 'primary'}
                    onClick={handleToggleReady}
                    disabled={!canAct}
                    icon={isReady ? <Check className="w-4 h-4" /> : undefined}
                  >
                    {isReady ? 'Unready' : 'Ready'}
                  </Button>

                  {connectedPlayers.length >= 2 && (
                    <p className="text-center text-xs text-muted">
                      The game starts automatically when everyone is ready
                    </p>
                  )}
                </div>
              )}
            </div>

            {chatPanel}
          </div>
        </motion.div>
      )}
    </div>
  )
}
