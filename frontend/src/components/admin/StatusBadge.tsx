import { Ban, Clock, CheckCircle, AlertCircle } from 'lucide-react';

/**
 * How moderator status reads on a row.
 *
 * Icon plus label rather than a tinted pill: the palette's `border` is
 * near-transparent and colour alone at this size is not something everyone
 * reads. The states are structural — a different glyph and a different word.
 */
export function StatusBadge({
  verified,
  restricted,
  until,
}: {
  verified: boolean;
  restricted?: boolean;
  until?: string | null;
}) {
  if (restricted) {
    const permanent = !until;
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
          permanent ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-600'
        }`}
        title={permanent ? 'Permanently banned' : `Suspended until ${until}`}
      >
        {permanent ? <Ban className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
        {permanent ? 'Banned' : 'Suspended'}
      </span>
    );
  }

  return verified ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
      <CheckCircle className="h-3 w-3" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-muted">
      <AlertCircle className="h-3 w-3" />
      Unverified
    </span>
  );
}
