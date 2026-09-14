import { useState } from 'react';
import { ShieldAlert, Clock, Ban } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

/**
 * The term options, in the order they get used.
 *
 * `null` is a permanent ban. Everything else is a suspension whose expiry is a
 * timestamp on the row, so it lapses by itself — which is why the dialog can
 * honestly say the account comes back without anyone doing anything.
 */
const DURATIONS = [
  { label: '1 hour', hours: 1 },
  { label: '24 hours', hours: 24 },
  { label: '7 days', hours: 24 * 7 },
  { label: '30 days', hours: 24 * 30 },
  { label: 'Permanent', hours: null },
] as const;

interface RestrictDialogProps {
  open: boolean;
  username: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (reason: string, durationHours: number | null) => void;
}

/**
 * Restricting an account, with the terms chosen explicitly.
 *
 * The reason is not required but is strongly nudged for: a restriction with no
 * recorded reason is unanswerable six months later when the same player asks why
 * they cannot get in, and the log is the only place that answer could have lived.
 */
export function RestrictDialog({
  open,
  username,
  busy = false,
  onClose,
  onConfirm,
}: RestrictDialogProps) {
  const [reason, setReason] = useState('');
  const [hours, setHours] = useState<number | null>(24);

  const permanent = hours === null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Restrict ${username}`}
      subtitle="They are signed out immediately and cannot sign back in until this lapses."
      size="md"
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" fullWidth onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            fullWidth
            loading={busy}
            icon={permanent ? <Ban className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
            onClick={() => onConfirm(reason.trim(), hours)}
          >
            {permanent ? 'Ban permanently' : 'Suspend'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-card bg-surface-alt p-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-xs text-muted">
            Any tab they have open is closed straight away, and their room seat is freed.
            This can be reversed at any time from the Moderation page.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
            For how long
          </label>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map(option => (
              <button
                key={option.label}
                type="button"
                onClick={() => setHours(option.hours)}
                className={`cursor-pointer rounded-button px-3 py-2 text-sm font-medium transition-colors ${
                  hours === option.hours
                    ? option.hours === null
                      ? 'bg-red-500 text-white'
                      : 'bg-deep text-white'
                    : 'bg-surface-alt text-muted hover:text-deep'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            {permanent
              ? 'The account stays locked until an admin lifts it by hand.'
              : 'The account unlocks on its own when the time is up — nothing to remember.'}
          </p>
        </div>

        <div>
          <label
            htmlFor="restrict-reason"
            className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted"
          >
            Reason <span className="normal-case tracking-normal">(recommended)</span>
          </label>
          <textarea
            id="restrict-reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Shown to them when they try to sign in, and kept on the account."
            className="w-full resize-none rounded-button border border-border bg-surface-alt px-4 py-3 text-sm text-deep placeholder:text-muted focus:outline-none focus:shadow-glow-primary"
          />
          <p className="mt-1 text-right font-mono text-[10px] text-muted">{reason.length}/500</p>
        </div>
      </div>
    </Modal>
  );
}
