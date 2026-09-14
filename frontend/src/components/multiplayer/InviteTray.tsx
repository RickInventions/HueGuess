import { AnimatePresence, motion } from 'framer-motion'
import { Clock, LogIn, X } from 'lucide-react'
import { useFriends } from '../../context/FriendsContext'
import { useMultiplayer } from '../../hooks/useMultiplayer'
import type { PendingInvite } from '../../types/friends'

/**
 * Room invites, floating over whatever you are doing.
 *
 * A room invite is only good for a couple of minutes and asking someone to open a
 * modal to answer one is asking them to miss it — so the invite comes to them and
 * stays there until it is answered, dismissed, or expires. This is the whole
 * surface: there is no second place to look.
 *
 * One card per room. Two friends inviting you to the same code is one decision
 * about one place to go, so it stays one card naming both of them.
 */

/** Avatar backgrounds for the inviter stack. Cycled, so two people differ. */
const INVITE_TONES = ['bg-primary', 'bg-accent', 'bg-success']

export function InviteTray() {
  const { pendingInvites, acceptInvite, dismissInvite } = useFriends()
  const { currentRoom } = useMultiplayer()

  // Nothing to say, so it says nothing — no wrapper, no strip of dead screen.
  if (pendingInvites.length === 0) return null

  return (
    <div
      // Bottom-right once there is room for it; along the top on a phone, where
      // the bottom belongs to the sliders and to the toasts.
      className="pointer-events-none fixed inset-x-3 top-16 z-40 flex flex-col items-end gap-2 sm:inset-x-auto sm:top-auto sm:bottom-5 sm:right-5 sm:w-[340px]"
      role="region"
      aria-label="Room invites"
    >
      {pendingInvites.length > 1 && (
        <p className="pointer-events-auto rounded-full bg-deep/90 px-3 py-1 text-[11px] font-medium text-white backdrop-blur">
          {pendingInvites.length} room invites waiting
        </p>
      )}

      {/* Capped and scrollable: a stack of three on a phone would otherwise run
          most of the way down the screen. */}
      <div className="pointer-events-auto flex max-h-[min(60vh,460px)] w-full flex-col gap-2 overflow-y-auto overscroll-contain">
        <AnimatePresence initial={false}>
          {pendingInvites.map(invite => (
            <InviteTrayCard
              key={invite.code}
              invite={invite}
              currentRoomCode={currentRoom?.code}
              onAccept={() => void acceptInvite(invite)}
              onDismiss={() => dismissInvite(invite.code)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

function InviteTrayCard({
  invite,
  currentRoomCode,
  onAccept,
  onDismiss,
}: {
  invite: PendingInvite
  currentRoomCode?: string
  onAccept: () => void
  onDismiss: () => void
}) {
  const names = invite.fromUsernames.length ? invite.fromUsernames : [invite.fromUsername]
  const extra = names.length - 1
  const switching = !!currentRoomCode && currentRoomCode !== invite.code

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      className="w-full overflow-hidden rounded-card bg-deep p-3 text-white shadow-card-hover ring-1 ring-white/10"
    >
      <div className="flex items-start gap-2.5">
        <span className="flex shrink-0 -space-x-1.5 pt-0.5" aria-hidden="true">
          {names.map((name, index) => (
            <span
              key={name}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-deep ${
                INVITE_TONES[index % INVITE_TONES.length]
              }`}
            >
              {name.charAt(0).toUpperCase()}
            </span>
          ))}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {names[0]}
            {extra > 0 && <span className="font-normal text-white/70"> +{extra}</span>}
          </p>
          <p className="text-xs text-white/70">invited you to a room</p>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label={`Dismiss the invite to room ${invite.code}`}
          title="Dismiss"
          className="-mr-1 -mt-1 shrink-0 cursor-pointer rounded-button p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        {/* Monospace and widely tracked: the code is the one thing here someone
            might read out loud, and 0/O and 1/I have to be tellable apart. */}
        <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-xs font-semibold tracking-[0.2em]">
          {invite.code}
        </span>
        <span className="text-xs text-white/70">
          {invite.playerCount}/{invite.maxPlayers}
        </span>
        <span className="text-white/30" aria-hidden="true">
          ·
        </span>
        <span className="text-xs capitalize text-white/70">{invite.difficulty}</span>
      </div>

      {invite.inProgress && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-300">
          <Clock className="h-3 w-3 shrink-0" />
          Round in progress — joins when it ends
        </p>
      )}

      {switching && <p className="mt-1.5 text-xs text-amber-300">Leaves room {currentRoomCode}</p>}

      <button
        type="button"
        onClick={onAccept}
        className="mt-2.5 inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-button bg-white px-3 py-2.5 text-xs font-semibold text-deep transition-colors hover:bg-white/90"
      >
        <LogIn className="h-3.5 w-3.5" />
        {switching ? 'Switch room' : 'Join room'}
      </button>
    </motion.div>
  )
}
