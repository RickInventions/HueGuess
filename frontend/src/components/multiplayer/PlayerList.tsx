import { motion, AnimatePresence } from 'framer-motion'
import { Crown, Check, User } from 'lucide-react'
import type { RoomPlayer } from '../../types'

interface PlayerListProps {
  players: RoomPlayer[]
  hostSocketId: string
  maxPlayers?: number
}

export function PlayerList({ players, maxPlayers = 4 }: PlayerListProps) {
  const slots: (RoomPlayer | null)[] = Array.from({ length: maxPlayers }, (_, i) => players[i] || null)

  return (
    <div className="grid grid-cols-2 gap-3">
      <AnimatePresence>
        {slots.map((player, i) => (
          <motion.div
            key={player?.socketId || `empty-${i}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`rounded-xl border-2 p-4 text-center transition-colors ${
              player
                ? player.isReady
                  ? 'border-success bg-success/5'
                  : 'border-border bg-surface'
                : 'border-dashed border-muted/20 bg-transparent'
            }`}
          >
            {player ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-1.5">
                  {player.isHost && <Crown className="w-3.5 h-3.5 text-yellow-500" />}
                  <span className="font-medium text-sm truncate">{player.username}</span>
                </div>
                {player.isReady ? (
                  <span className="inline-flex items-center gap-1 text-xs text-success font-medium">
                    <Check className="w-3 h-3" />
                    Ready
                  </span>
                ) : (
                  <span className="text-xs text-muted">Not ready</span>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 py-3 text-muted/30">
                <User className="w-6 h-6" />
                <span className="text-xs">Empty slot</span>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}