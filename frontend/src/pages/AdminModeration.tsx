import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ChevronLeft, ChevronRight, Ban, Clock } from 'lucide-react';
import { adminApi } from '../lib/adminApi';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { absolute, relative } from '../lib/adminFormat';
import type { AdminUser } from '../types/admin';
import { toast } from 'sonner';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'In force' },
  { value: 'expired', label: 'Lapsed' },
];

export default function AdminModeration() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getModerationList({
        status: status || undefined,
        limit,
        offset,
      });
      setUsers(response.users);
      setTotal(response.total);
    } catch {
      toast.error('Failed to load the moderation list');
    } finally {
      setLoading(false);
    }
  }, [status, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const lift = async (user: AdminUser) => {
    setBusyId(user.id);
    try {
      await adminApi.unrestrictUser(user.id);
      toast.success(`${user.username} can sign in again`);
      await load();
    } catch {
      toast.error('Could not lift the restriction');
    } finally {
      setBusyId(null);
    }
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold text-deep">Moderation</h1>
        <p className="text-muted text-sm mt-1">
          Every account that has been restricted, why, and by whom. Lapsed suspensions stay
          on the list as history.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(filter => (
          <button
            key={filter.value}
            onClick={() => {
              setStatus(filter.value);
              setOffset(0);
            }}
            className={`cursor-pointer rounded-button px-3 py-1.5 text-xs font-medium transition-colors ${
              status === filter.value
                ? 'bg-deep text-white'
                : 'bg-surface-alt text-muted hover:text-deep'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <Card className="p-12 text-center">
          <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-success" />
          <p className="font-heading text-lg font-semibold text-deep">Nothing to show</p>
          <p className="mt-1 text-sm text-muted">
            {status === 'active' || status === ''
              ? 'No accounts are currently restricted.'
              : 'No restrictions match this filter.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map((user, index) => {
            const permanent = !user.banned_until;
            return (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card className="p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                          user.is_restricted ? 'bg-red-500/10 text-red-500' : 'bg-surface-muted text-muted'
                        }`}
                      >
                        {user.is_restricted ? (
                          permanent ? <Ban className="h-5 w-5" /> : <Clock className="h-5 w-5" />
                        ) : (
                          <ShieldCheck className="h-5 w-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-deep">{user.username}</span>
                          {user.is_restricted ? (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                permanent
                                  ? 'bg-red-500/10 text-red-500'
                                  : 'bg-amber-500/10 text-amber-600'
                              }`}
                            >
                              {permanent ? 'Banned' : 'Suspended'}
                            </span>
                          ) : (
                            // Not hidden: a lapsed suspension is the reason the
                            // account is on this list at all.
                            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-muted">
                              Lapsed
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted">{user.email}</p>
                      </div>
                    </div>

                    <div className="min-w-0 sm:w-72">
                      <p className="text-xs text-deep">{user.ban_reason || 'No reason recorded'}</p>
                      <p className="mt-1 text-[11px] text-muted">
                        {permanent
                          ? `Banned ${relative(user.banned_at!)}`
                          : user.is_restricted
                            ? `Until ${absolute(user.banned_until!, 'd MMM yyyy, HH:mm')}`
                            : `Ended ${relative(user.banned_until!)}`}
                        {user.banned_by ? ` · ${user.banned_by}` : ''}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {user.is_restricted ? (
                        <Button
                          variant="secondary"
                          icon={<ShieldCheck className="w-4 h-4" />}
                          loading={busyId === user.id}
                          onClick={() => lift(user)}
                        >
                          Lift
                        </Button>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-muted">
                          <ShieldCheck className="w-4 h-4 text-success" />
                          Ended on its own
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

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
