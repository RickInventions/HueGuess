import { useState, type ReactNode } from 'react'
import { LogOut, Users } from 'lucide-react'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { FriendsLauncher } from './FriendsModal'

interface RoomTopBarProps {
  /** Left-hand slot — a back link in the lobby, a round label mid-game. */
  children?: ReactNode
  /** Connected players, shown over capacity. Omit to hide the chip. */
  playerCount?: number
  maxPlayers?: number
  /** Runs once the user confirms. */
  onLeave: () => void
  /** Confirm-dialog wording, which differs between the lobby and a live round. */
  leaveTitle?: string
  leaveMessage?: string
  leaveConfirmLabel?: string
  /** True while you hold a room, which is what makes Invite possible. */
  inRoom?: boolean
}

/**
 * The row above every room view: context on the left, destructive and secondary
 * actions as icons on the right.
 *
 * Leaving lives up here, away from Ready and Submit, and behind a confirmation.
 * As a full-width button stacked under those two it was a single mis-tap from
 * dropping someone out of a live game on a phone.
 */
export function RoomTopBar({
  children,
  playerCount,
  maxPlayers,
  onLeave,
  leaveTitle = 'Leave this room?',
  leaveMessage = 'You will drop out of the room. If a game is running, your score for it is lost.',
  leaveConfirmLabel = 'Leave room',
  inRoom = true,
}: RoomTopBarProps) {
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">{children}</div>

        <div className="flex shrink-0 items-center gap-1">
          {playerCount !== undefined && maxPlayers !== undefined && (
            <span className="inline-flex items-center gap-1.5 px-2 text-xs font-medium text-muted">
              <Users className="w-3.5 h-3.5" />
              {playerCount}/{maxPlayers}
            </span>
          )}

          <FriendsLauncher inRoom={inRoom} />

          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label="Leave room"
            title="Leave room"
            className="p-2 rounded-button text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={onLeave}
        title={leaveTitle}
        message={leaveMessage}
        confirmLabel={leaveConfirmLabel}
        destructive
      />
    </>
  )
}
