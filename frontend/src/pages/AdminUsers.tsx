import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search, ChevronLeft, ChevronRight, Eye, ShieldAlert, ShieldCheck,
  BadgeCheck, BadgeX, Trash2, Ban,
} from 'lucide-react';
import { adminApi } from '../lib/adminApi';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { StatusBadge } from '../components/admin/StatusBadge';
import { RestrictDialog } from '../components/admin/RestrictDialog';
import { actionLabel, absolute, relative, restrictionLabel } from '../lib/adminFormat';
import type { AdminUser, AdminUserDetail } from '../types/admin';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUS_FILTERS = [
  { value: '', label: 'Everyone' },
  { value: 'restricted', label: 'Restricted' },
  { value: 'banned', label: 'Banned' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'unverified', label: 'Unverified' },
];

export default function AdminUsers() {
  // Seeded from the URL so a dashboard tile can land on a filtered list rather
  // than on the unfiltered one it just described.
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [offset, setOffset] = useState(0);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restricting, setRestricting] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const limit = 20;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getUsers({
        search: search || undefined,
        status: status || undefined,
        limit,
        offset,
      });
      setUsers(response.users);
      setTotal(response.total);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [search, status, offset]);

  // Open with the row we already have, then enrich from the detail endpoint —
  // the modal is usable immediately and gains streaks/history when the fetch lands.
  const openUser = async (user: AdminUser) => {
    setSelectedUser(user);
    setDetailLoading(true);
    try {
      const response = await adminApi.getUserDetails(user.id);
      // Guard against a stale response after the admin closed or switched rows.
      setSelectedUser(current =>
        current && current.id === user.id ? { ...current, ...response.user } : current
      );
    } catch {
      toast.error('Could not load full details for this user');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const refresh = async () => {
    await loadUsers();
    if (selectedUser) await openUser(selectedUser);
  };

  const handleRestrict = async (reason: string, durationHours: number | null) => {
    if (!restricting) return;
    setBusy(true);
    try {
      const response = await adminApi.restrictUser(restricting.id, reason, durationHours);
      toast.success(
        durationHours
          ? `${restricting.username} suspended — ${response.sessionsClosed} session(s) closed`
          : `${restricting.username} banned — ${response.sessionsClosed} session(s) closed`
      );
      setRestricting(null);
      await refresh();
    } catch {
      toast.error('Could not restrict that account');
    } finally {
      setBusy(false);
    }
  };

  const handleUnrestrict = async (user: AdminUser) => {
    setBusy(true);
    try {
      await adminApi.unrestrictUser(user.id);
      toast.success(`${user.username} can sign in again`);
      await refresh();
    } catch {
      toast.error('Could not lift the restriction');
    } finally {
      setBusy(false);
    }
  };

  const handleVerification = async (user: AdminUser, verified: boolean) => {
    setBusy(true);
    try {
      await adminApi.setVerification(user.id, verified);
      toast.success(verified ? `${user.username} verified` : `Verification removed`);
      await refresh();
    } catch {
      toast.error('Could not change verification');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    setBusy(true);
    try {
      await adminApi.deleteUser(selectedUser.id);
      toast.success(`${selectedUser.username} deleted`);
      setSelectedUser(null);
      setDeleting(false);
      setConfirmText('');
      await loadUsers();
    } catch {
      toast.error('Could not delete that account');
    } finally {
      setBusy(false);
    }
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold text-deep">User Management</h1>
        <p className="text-muted text-sm mt-1">
          Inspect accounts, restrict them, and fix verification problems.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search by username or email..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setOffset(0);
            }}
            className="w-full pl-11 pr-4 py-3 rounded-button bg-surface-alt border border-border text-deep placeholder:text-muted focus:outline-none focus:shadow-glow-primary transition-shadow"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(filter => (
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
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-alt border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted">User</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted hidden sm:table-cell">Email</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-muted">Status</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted hidden md:table-cell">HuePoints</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted hidden lg:table-cell">Games</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted hidden xl:table-cell">Joined</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user, index) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="border-b border-border hover:bg-surface-alt/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium shrink-0">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{user.username}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-sm text-muted">{user.email}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge
                        verified={user.is_verified}
                        restricted={user.is_restricted}
                        until={user.banned_until}
                      />
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">
                      <span className="font-mono font-semibold">{user.rating || 100}</span>
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      <span className="text-muted">{user.games_played || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-right hidden xl:table-cell">
                      <span className="text-xs text-muted">
                        {format(new Date(user.created_at), 'MMM d, yyyy')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openUser(user)}
                          title="View details"
                          className="cursor-pointer rounded-button p-2 text-muted transition-colors hover:bg-surface-alt hover:text-primary"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {user.is_restricted ? (
                          <button
                            onClick={() => handleUnrestrict(user)}
                            disabled={busy}
                            title="Lift restriction"
                            className="cursor-pointer rounded-button p-2 text-muted transition-colors hover:bg-surface-alt hover:text-success disabled:opacity-40"
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setRestricting(user)}
                            title="Restrict account"
                            className="cursor-pointer rounded-button p-2 text-muted transition-colors hover:bg-surface-alt hover:text-red-500"
                          >
                            <ShieldAlert className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4 border-t border-border">
            <div className="text-sm text-muted">
              Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} users
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
      </Card>

      {/* ── Detail ─────────────────────────────────────────────────────────── */}
      <Modal
        open={!!selectedUser}
        onClose={() => {
          setSelectedUser(null);
          setDeleting(false);
          setConfirmText('');
        }}
        title={selectedUser?.username}
        subtitle={selectedUser?.email}
        size="md"
        footer={
          selectedUser && (
            <div className="flex flex-wrap gap-2">
              {selectedUser.is_restricted ? (
                <Button
                  variant="secondary"
                  icon={<ShieldCheck className="w-4 h-4" />}
                  disabled={busy}
                  onClick={() => handleUnrestrict(selectedUser)}
                >
                  Lift restriction
                </Button>
              ) : (
                <Button
                  variant="danger"
                  icon={<Ban className="w-4 h-4" />}
                  onClick={() => {
                    setRestricting(selectedUser);
                  }}
                >
                  Restrict
                </Button>
              )}
              <Button
                variant="ghost"
                icon={selectedUser.is_verified ? <BadgeX className="w-4 h-4" /> : <BadgeCheck className="w-4 h-4" />}
                disabled={busy}
                onClick={() => handleVerification(selectedUser, !selectedUser.is_verified)}
              >
                {selectedUser.is_verified ? 'Unverify' : 'Verify'}
              </Button>
              <Button
                variant="ghost"
                icon={<Trash2 className="w-4 h-4" />}
                onClick={() => setDeleting(true)}
                className="ml-auto text-red-500"
              >
                Delete
              </Button>
            </div>
          )
        }
      >
        {selectedUser && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <StatusBadge
                verified={selectedUser.is_verified}
                restricted={selectedUser.is_restricted}
                until={selectedUser.banned_until}
              />
              {detailLoading && (
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {/* The terms of the restriction, when there is one — this is the
                thing an admin actually came to the modal to find out. */}
            {selectedUser.is_restricted && (
              <div className="rounded-card bg-red-500/5 p-4">
                <p className="text-sm font-medium text-deep">
                  {restrictionLabel(selectedUser)}
                </p>
                {selectedUser.ban_reason && (
                  <p className="mt-1 text-xs text-muted">“{selectedUser.ban_reason}”</p>
                )}
                <p className="mt-2 text-[11px] text-muted">
                  Applied {selectedUser.banned_at ? relative(selectedUser.banned_at) : '—'}
                  {selectedUser.banned_by ? ` by ${selectedUser.banned_by}` : ''}
                </p>
              </div>
            )}

            {deleting ? (
              <div className="rounded-card border border-red-500/20 p-4 space-y-3">
                <p className="text-sm font-medium text-deep">
                  Delete {selectedUser.username} for good?
                </p>
                <p className="text-xs text-muted">
                  Their rounds, stats and achievements go with them. This cannot be undone —
                  to lock them out reversibly, restrict the account instead.
                </p>
                <input
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder={`Type ${selectedUser.username} to confirm`}
                  className="w-full rounded-button border border-border bg-surface-alt px-4 py-2.5 text-sm text-deep placeholder:text-muted focus:outline-none"
                />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    fullWidth
                    onClick={() => {
                      setDeleting(false);
                      setConfirmText('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    fullWidth
                    loading={busy}
                    disabled={confirmText !== selectedUser.username}
                    onClick={handleDelete}
                  >
                    Delete account
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <Row label="HuePoints" value={String(selectedUser.rating || 100)} />
                {selectedUser.rank_tier && <Row label="Rank" value={selectedUser.rank_tier} />}
                <Row label="Games played" value={String(selectedUser.games_played || 0)} />
                {selectedUser.total_games != null && (
                  <Row label="Rounds recorded" value={String(Number(selectedUser.total_games))} />
                )}
                <Row label="Avg accuracy" value={`${Math.round(selectedUser.avg_accuracy || 0)}%`} />
                {selectedUser.current_streak != null && (
                  <Row
                    label="Streak"
                    value={`${selectedUser.current_streak} · best ${selectedUser.best_streak ?? 0}`}
                  />
                )}
                <Row label="Joined" value={absolute(selectedUser.created_at, 'PPP')} />
                <Row
                  label="Name changed"
                  value={
                    selectedUser.last_username_change
                      ? absolute(selectedUser.last_username_change, 'PPP')
                      : 'Never'
                  }
                />
                <Row label="User ID" value={selectedUser.id} mono />
              </div>
            )}

            {/* Everything a moderator ever did to this account, so the decision
                to lift a restriction is made with the history in view. */}
            {selectedUser.moderationHistory && selectedUser.moderationHistory.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
                  Moderation history
                </p>
                <div className="space-y-1.5">
                  {selectedUser.moderationHistory.map(entry => (
                    <div
                      key={entry.id}
                      className="flex items-baseline justify-between gap-3 rounded-xl bg-surface-alt px-3 py-2"
                    >
                      <span className="text-xs text-deep">{actionLabel(entry.action)}</span>
                      <span className="shrink-0 text-[11px] text-muted">
                        {relative(entry.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <RestrictDialog
        open={!!restricting}
        username={restricting?.username ?? ''}
        busy={busy}
        onClose={() => setRestricting(null)}
        onConfirm={handleRestrict}
      />
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border py-2 last:border-0">
      <span className="shrink-0 text-muted">{label}</span>
      <span className={`truncate ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}
