import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Crown,
  Check,
  User,
  WifiOff,
  RefreshCw,
  UserPlus,
  Clock,
  UserCheck,
  UserX,
  Skull,
} from 'lucide-react'
import type { Player } from '../../types/multiplayer'
import { useFriends } from '../../context/FriendsContext'
import { useAuth } from '../../context/AuthContext'
import { ConfirmDialog } from '../ui/ConfirmDialog'

interface PlayerListProps {
  players: Player[]
  hostSocketId: string | null
  maxPlayers?: number
  /** Highlights which card is you. */
  currentUserId?: string
  /** Show each player's running average — used mid-game. */
  showScores?: boolean
  /** Duel mode: show rounds won instead of average accuracy. */
  showPoints?: boolean
  /**
   * Show the add-friend corner button on each card. Off mid-game, where the
   * cards are a scoreboard and a stray tap shouldn't send a request.
   */
  allowFriendRequests?: boolean
  /**
   * Host only: eject another player. Passing it turns on the corner kick button,
   * so the caller decides where kicking is allowed (lobby and final results).
   */
  onKick?: (socketId: string) => void
}

/**
 * Corner button that reflects how you already relate to this player: add when
 * they're a stranger, waiting when a request is out, accept when they asked
 * first, nothing at all once you're friends.
 */
function FriendButton({ userId, username }: { userId: string; username: string }) {
  const { relationshipFor, sendRequest, acceptRequest } = useFriends()
  const relationship = relationshipFor(userId)

  if (relationship === 'self' || relationship === 'friends') return null

  const config = {
    none: {
      icon: <UserPlus className="w-3.5 h-3.5" />,
      label: `Add ${username} as a friend`,
      tone: 'text-muted hover:text-primary hover:bg-primary/10',
      action: () => void sendRequest(userId, username),
    },
    request_sent: {
      icon: <Clock className="w-3.5 h-3.5" />,
      label: `Friend request pending with ${username}`,
      tone: 'text-muted',
      action: undefined,
    },
    request_received: {
      icon: <UserCheck className="w-3.5 h-3.5" />,
      label: `Accept ${username}'s friend request`,
      tone: 'text-success hover:bg-success/10',
      action: () => void acceptRequest(userId),
    },
  }[relationship]

  return (
    <button
      type="button"
      onClick={config.action}
      disabled={!config.action}
      aria-label={config.label}
      title={config.label}
      className={`absolute top-1.5 right-1.5 rounded-full p-1.5 transition-colors disabled:cursor-default ${config.tone} ${
        config.action ? 'cursor-pointer' : ''
      }`}
    >
      {config.icon}
    </button>
  )
}

export function PlayerList({
  players,
  hostSocketId,
  maxPlayers = 8,
  currentUserId,
  showScores = false,
  showPoints = false,
  allowFriendRequests = false,
  onKick,
}: PlayerListProps) {
  const { isAuthenticated } = useAuth()
  // Removing someone is not undoable, and the button sits on a card the host is
  // also tapping to read scores — so it goes through a confirm.
  const [pendingKick, setPendingKick] = useState<{ socketId: string; username: string } | null>(null)

  const slotCount = Math.max(maxPlayers, players.length)
  const slots: (Player | null)[] = Array.from({ length: slotCount }, (_, i) => players[i] ?? null)

  // Two columns on a phone whatever the capacity; a third and fourth appear on
  // wider screens so an 8-player room stays two rows instead of four.
  const columns =
    slotCount > 6
      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
      : slotCount > 4
        ? 'grid-cols-2 sm:grid-cols-3'
        : 'grid-cols-2'

  return (
    <>
      <div className={`grid ${columns} gap-2.5 sm:gap-3`}>
        <AnimatePresence initial={false}>
          {slots.map((player, i) => {
            const isYou = !!player && !!currentUserId && player.userId === currentUserId
            const average =
              player && player.roundsPlayed > 0 ? player.totalAccuracy / player.roundsPlayed : null
            // Not offered on a disconnected card: they may be about to be dropped
            // from the room, and the request would be aimed at a stale entry.
            const canBefriend =
              allowFriendRequests &&
              isAuthenticated &&
              !!player?.userId &&
              !isYou &&
              player.status !== 'disconnected'
            const canKick = !!onKick && !!player && !isYou

            return (
              <motion.div
                key={player?.socketId ?? `empty-${i}`}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`relative rounded-card border-2 p-3 sm:p-4 text-center transition-colors ${
                  player
                    ? player.eliminated
                      ? 'border-muted/30 bg-surface-muted'
                      : player.status === 'ready'
                        ? 'border-success bg-success/5'
                        : player.status === 'disconnected'
                          ? 'border-accent/50 bg-accent/5 opacity-70'
                          : isYou
                            ? 'border-primary/60 bg-primary/5'
                            : 'border-border bg-surface'
                    : 'border-dashed border-muted/20 bg-transparent'
                }`}
              >
                {player ? (
                  <div className="space-y-1.5">
                    {canBefriend && <FriendButton userId={player.userId} username={player.username} />}
                    {canKick && (
                      <button
                        type="button"
                        onClick={() =>
                          setPendingKick({ socketId: player.socketId, username: player.username })
                        }
                        aria-label={`Remove ${player.username} from the room`}
                        title={`Remove ${player.username} from the room`}
                        className="absolute top-1.5 left-1.5 rounded-full p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500 cursor-pointer"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <div className="flex items-center justify-center gap-1.5 min-w-0">
                      {player.socketId === hostSocketId && (
                        <Crown className="w-3.5 h-3.5 shrink-0 text-yellow-500" aria-label="Host" />
                      )}
                      <span className="font-medium text-xs sm:text-sm truncate">{player.username}</span>
                      {player.status === 'disconnected' && (
                        <WifiOff className="w-3 h-3 shrink-0 text-accent" aria-label="Disconnected" />
                      )}
                    </div>

                    {isYou && <span className="block text-[10px] uppercase tracking-wide text-primary">You</span>}

                    {/* Eliminated outranks every other status: they're a spectator
                        now, so "Not ready" would be misleading. Said with an icon
                        and a badge rather than by fading the card out. */}
                    {player.eliminated ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-deep px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        <Skull className="w-3 h-3" />
                        Out
                      </span>
                    ) : player.status === 'ready' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success font-medium">
                        <Check className="w-3 h-3" />
                        Ready
                      </span>
                    ) : player.status === 'disconnected' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-accent">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Reconnecting…
                      </span>
                    ) : player.status === 'playing' ? (
                      <span className="text-xs text-muted">Playing</span>
                    ) : (
                      <span className="text-xs text-muted">Not ready</span>
                    )}

                    {showPoints ? (
                      <span className="block text-xs font-mono text-muted">
                        {player.points} {player.points === 1 ? 'pt' : 'pts'}
                      </span>
                    ) : (
                      showScores &&
                      average !== null && (
                        <span className="block text-xs font-mono text-muted">{average.toFixed(1)}% avg</span>
                      )
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 py-3 text-muted">
                    <User className="w-5 h-5 sm:w-6 sm:h-6 opacity-60" />
                    <span className="text-xs">Empty slot</span>
                  </div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      <ConfirmDialog
        open={!!pendingKick}
        onClose={() => setPendingKick(null)}
        onConfirm={() => {
          if (pendingKick) onKick?.(pendingKick.socketId)
        }}
        title="Remove player?"
        message={
          pendingKick
            ? `${pendingKick.username} will be removed from the room. They can rejoin with the code unless you change it.`
            : ''
        }
        confirmLabel="Remove"
        destructive
      />
    </>
  )
}
