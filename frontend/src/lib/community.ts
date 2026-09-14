/**
 * The player community lives in a WhatsApp group, which the site has no other way
 * of telling anyone about.
 *
 * Two surfaces share this module: a modal shown once a month on signing in, and a
 * permanent banner on the homepage. The banner exists precisely because the modal
 * is rare — dismissing it used to mean waiting out the rest of the month for
 * another chance at the link.
 */

export const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/DnppHHPlSor2z1YAaG6XFR'

/**
 * How long the announcement stays quiet after being shown.
 *
 * Thirty days rather than a calendar-month key: with a month key, signing in on
 * the 31st and again on the 1st shows it twice inside two days, which is the one
 * thing "once a month" is meant to rule out.
 */
const QUIET_PERIOD_MS = 30 * 24 * 60 * 60 * 1000

const SEEN_KEY = 'hg:community-announced-at'

/**
 * Whether the announcement is due.
 *
 * A browser that can't read or write localStorage (private mode, blocked site
 * data) gets `false`: we would have no way to remember having shown it, and an
 * announcement on every single sign-in is worse than none. Those sessions still
 * see the homepage banner.
 */
export function announcementIsDue(): boolean {
  try {
    const seenAt = Number(window.localStorage.getItem(SEEN_KEY) ?? 0)
    // A stamp from the future means a clock that was wound back, or a garbled
    // value; treat either as "no usable stamp" and show it.
    if (!Number.isFinite(seenAt) || seenAt > Date.now()) return true
    return Date.now() - seenAt >= QUIET_PERIOD_MS
  } catch {
    return false
  }
}

export function markAnnouncementSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, String(Date.now()))
  } catch {
    /* nothing to do — announcementIsDue() already returns false here */
  }
}
