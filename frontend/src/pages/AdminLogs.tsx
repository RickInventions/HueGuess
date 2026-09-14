import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminApi } from '../lib/adminApi';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { actionLabel, actionTone, actionSubject, actionActor, absolute, relative } from '../lib/adminFormat';
import type { AdminLog } from '../types/admin';
import { toast } from 'sonner';

/** The actions worth filtering by — the union of what the server writes. */
const ACTIONS = [
  { value: '', label: 'Everything' },
  { value: 'ban_user', label: 'Bans' },
  { value: 'suspend_user', label: 'Suspensions' },
  { value: 'unban_user', label: 'Lifted' },
  { value: 'delete_user', label: 'Deletions' },
  { value: 'verify_user', label: 'Verifications' },
  { value: 'resolve_feedback', label: 'Feedback' },
  { value: 'refresh_leaderboard', label: 'Leaderboard' },
];

export default function AdminLogs() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getLogs({
        action: action || undefined,
        limit,
        offset,
      });
      setLogs(response.logs);
      setTotal(response.total);
    } catch {
      toast.error('Failed to load the audit log');
    } finally {
      setLoading(false);
    }
  }, [action, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold text-deep">Audit log</h1>
        <p className="text-muted text-sm mt-1">
          Every write an admin has made, newest first. Read-only.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {ACTIONS.map(option => (
          <button
            key={option.value}
            onClick={() => {
              setAction(option.value);
              setOffset(0);
            }}
            className={`cursor-pointer rounded-button px-3 py-1.5 text-xs font-medium transition-colors ${
              action === option.value
                ? 'bg-deep text-white'
                : 'bg-surface-alt text-muted hover:text-deep'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <Card className="divide-y divide-border">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <ScrollText className="mx-auto mb-3 h-10 w-10 text-muted" />
            <p className="font-heading text-lg font-semibold text-deep">No entries</p>
            <p className="mt-1 text-sm text-muted">Nothing has been recorded for this filter.</p>
          </div>
        ) : (
          logs.map((entry, index) => {
            const subject = actionSubject(entry.details);
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.015, 0.3) }}
                className="flex items-start gap-3 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className={`font-medium ${actionTone(entry.action)}`}>
                      {actionLabel(entry.action)}
                    </span>
                    {subject && <span className="text-deep"> · {subject}</span>}
                  </p>

                  {/* The reason for a restriction is the single most useful thing
                      in this table, so it is shown rather than left in the JSON. */}
                  {entry.details?.reason && (
                    <p className="mt-1 text-xs text-muted">“{entry.details.reason}”</p>
                  )}
                  {entry.details?.until && (
                    <p className="mt-0.5 text-[11px] text-muted">
                      Until {absolute(entry.details.until, 'd MMM yyyy, HH:mm')}
                    </p>
                  )}

                  <p className="mt-1 text-[11px] text-muted">{actionActor(entry)}</p>
                </div>

                <span
                  className="shrink-0 whitespace-nowrap text-[11px] text-muted"
                  title={absolute(entry.created_at)}
                >
                  {relative(entry.created_at)}
                </span>
              </motion.div>
            );
          })
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted">
            Showing {offset + 1} to {Math.min(offset + limit, total)} of {total}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              title="Previous"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-3 py-2 text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="ghost"
              title="Next"
              onClick={() => setOffset(Math.min(total - limit, offset + limit))}
              disabled={offset + limit >= total}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
