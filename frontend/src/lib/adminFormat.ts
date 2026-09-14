import { formatDistanceToNow, format } from 'date-fns';

/**
 * Display strings for the audit trail.
 *
 * The admin log is read in three places (the dashboard's recent list, the
 * moderation history on a user, and the log page itself) and a raw
 * `suspend_user` in one of them and "Suspended a player" in another is how a
 * single trail starts looking like three different ones.
 */
const ACTION_LABELS: Record<string, string> = {
  ban_user: 'Banned a player',
  suspend_user: 'Suspended a player',
  unban_user: 'Lifted a restriction',
  verify_user: 'Verified an account',
  unverify_user: 'Removed verification',
  delete_user: 'Deleted an account',
  resolve_feedback: 'Resolved feedback',
  refresh_leaderboard: 'Refreshed rank labels',
};

export const actionLabel = (action: string): string =>
  ACTION_LABELS[action] ?? action.replace(/_/g, ' ');

/** Destructive actions read red, reversals green, everything else neutral. */
export const actionTone = (action: string): string => {
  if (action === 'delete_user' || action === 'ban_user') return 'text-red-500';
  if (action === 'suspend_user' || action === 'unverify_user') return 'text-amber-500';
  if (action === 'unban_user' || action === 'verify_user') return 'text-success';
  return 'text-muted';
};

/** The one-line summary of what an entry was about. */
export function actionSubject(details: Record<string, any> | null): string | null {
  if (!details) return null;
  if (details.username) return details.username;
  if (details.feedbackId) return `feedback ${String(details.feedbackId).slice(0, 8)}`;
  return null;
}

/**
 * Who performed an action.
 *
 * `admin_id` is a foreign key onto the accounts table and is null for every
 * entry made by the shared admin key — which is all of them, since admins are
 * not accounts. The name the caller supplied is kept in `details.actor` for
 * exactly this reason.
 */
export function actionActor(entry: {
  admin_id: string | null;
  details: Record<string, any> | null;
}): string {
  return entry.details?.actor ?? entry.admin_id ?? 'unknown';
}

export const relative = (iso: string): string =>
  formatDistanceToNow(new Date(iso), { addSuffix: true });

export const absolute = (iso: string, pattern = 'PPp'): string => format(new Date(iso), pattern);

/**
 * How a restriction reads in one phrase.
 *
 * An expired suspension is not a restriction — the server decides that with
 * `is_restricted`, and this only ever describes the terms.
 */
export function restrictionLabel(user: {
  banned_until?: string | null;
  is_restricted?: boolean;
}): string {
  if (!user.is_restricted) return 'Not restricted';
  if (!user.banned_until) return 'Permanently banned';
  return `Suspended until ${absolute(user.banned_until, 'd MMM yyyy, HH:mm')}`;
}
