import { useEffect, useState } from 'react'
import { MessageCircle, ArrowUpRight, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { WHATSAPP_GROUP_URL, announcementIsDue, markAnnouncementSeen } from '../../lib/community'

/**
 * WhatsApp's own green, for recognition — this is the one place on the site where
 * looking like another product is the point.
 *
 * Two shades because the bright one is unreadable behind white text (about 2.4:1).
 * `brand` carries the icon on a light tint; `deep` is the only one text sits on.
 */
const WHATSAPP = {
  brand: '#25D366',
  deep: '#075E54',
} as const

/** Shared by both surfaces, so the modal and the banner can't drift apart. */
function JoinLink({ children, fullWidth = false }: { children: React.ReactNode; fullWidth?: boolean }) {
  return (
    <a
      href={WHATSAPP_GROUP_URL}
      target="_blank"
      // noreferrer as well as noopener: the target is a third-party site and has
      // no business knowing which page sent the player.
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-button px-5 py-2.5 font-heading text-sm font-medium text-white transition-opacity hover:opacity-90 ${
        fullWidth ? 'w-full' : ''
      }`}
      style={{ backgroundColor: WHATSAPP.deep }}
    >
      <MessageCircle className="w-4 h-4" />
      {children}
      <ArrowUpRight className="w-4 h-4" />
    </a>
  )
}

/**
 * Announces the community group once a month to signed-in players.
 *
 * Mounted app-wide rather than hooked onto the login call, so it also reaches
 * someone returning on a stored token — "upon login" in the sense that matters,
 * which is arriving signed in.
 */
export function CommunityAnnouncement() {
  const { isAuthenticated, isVerified } = useAuth()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Verified too, not just signed in. An unverified account is sitting on the
    // verification screen with one job to do, and the group is for people who can
    // actually play — interrupting them there would also burn the month's showing
    // on the worst possible moment.
    if (!isAuthenticated || !isVerified || !announcementIsDue()) return

    // A beat of delay so it doesn't land on top of the homepage's entrance
    // animation, and so a player who signed in to do something specific sees the
    // page they asked for first.
    const timer = window.setTimeout(() => {
      setOpen(true)
      // Stamped on show, not on dismiss. Closing the tab without answering is
      // still having been asked, and re-asking on the next page load would make
      // "once a month" mean "until you engage with it".
      markAnnouncementSeen()
    }, 900)

    return () => window.clearTimeout(timer)
  }, [isAuthenticated, isVerified])

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="There's a HueGuess group chat"
      subtitle="Once-a-month notice — you won't see this again for a while."
      size="sm"
      footer={
        <div className="space-y-2">
          <JoinLink fullWidth>Join the group chat</JoinLink>
          <Button variant="ghost" fullWidth onClick={() => setOpen(false)}>
            Maybe later
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${WHATSAPP.brand}1F` }}
        >
          <MessageCircle className="w-6 h-6" style={{ color: WHATSAPP.deep }} />
        </div>

        <p className="text-sm text-deep">
          Players organise rooms, compare scores and argue about difficulty settings in a WhatsApp
          group. It's the fastest way to find someone to play Challenge against.
        </p>

        <p className="flex items-start gap-2 text-xs text-muted">
          <Users className="mt-0.5 w-3.5 h-3.5 shrink-0" />
          The link is also on the homepage, any time you want it.
        </p>
      </div>
    </Modal>
  )
}

/**
 * The permanent version, on the homepage.
 *
 * Not dismissible: it is one strip, and it is the fallback for everyone who
 * closed the modal or whose browser can't remember having seen it.
 */
export function CommunityBanner() {
  return (
    <div
      className="flex flex-col items-start gap-3 rounded-card border border-border bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:gap-4"
      style={{ borderLeft: `3px solid ${WHATSAPP.brand}` }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${WHATSAPP.brand}1F` }}
      >
        <MessageCircle className="w-5 h-5" style={{ color: WHATSAPP.deep }} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-heading text-sm font-semibold text-deep">Find players to play against</p>
        <p className="text-xs text-muted">
          Join the HueGuess WhatsApp group — rooms get organised there.
        </p>
      </div>

      <div className="w-full shrink-0 sm:w-auto">
        <JoinLink fullWidth>Join</JoinLink>
      </div>
    </div>
  )
}
