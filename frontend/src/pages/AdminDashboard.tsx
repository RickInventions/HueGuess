import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users, UserCheck, Gamepad2, Star, MessageSquare, RefreshCw, TrendingUp,
  ShieldAlert, Activity, Trophy, ArrowRight, ScrollText,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../lib/adminApi';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/admin/StatusBadge';
import { actionLabel, actionSubject, actionTone, actionActor, relative } from '../lib/adminFormat';
import type { AdminStats } from '../types/admin';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  const loadStats = async () => {
    try {
      const response = await adminApi.getStats();
      setStats(response.stats);
    } catch (error: any) {
      if (error.response?.status === 401) {
        toast.error('Invalid admin key');
      } else {
        toast.error('Failed to load stats');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshLeaderboard = async () => {
    setRefreshing(true);
    try {
      const response = await adminApi.refreshLeaderboard();
      toast.success(response.message || 'Rank labels refreshed');
      loadStats();
    } catch {
      toast.error('Failed to refresh leaderboard');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100dvh-3.5rem)]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tiles = [
    { title: 'Total users', value: stats?.totalUsers ?? 0, icon: Users, tone: 'text-blue-500', bg: 'bg-blue-500/10', to: '/admin/users' },
    { title: 'Verified', value: stats?.verifiedUsers ?? 0, icon: UserCheck, tone: 'text-green-500', bg: 'bg-green-500/10', to: '/admin/users?status=unverified', hint: 'Tap to see unverified' },
    { title: 'Online now', value: stats?.onlineNow ?? 0, icon: Activity, tone: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Restricted', value: (stats?.bannedUsers ?? 0) + (stats?.suspendedUsers ?? 0), icon: ShieldAlert, tone: 'text-red-500', bg: 'bg-red-500/10', to: '/admin/moderation', hint: `${stats?.bannedUsers ?? 0} banned · ${stats?.suspendedUsers ?? 0} suspended` },
    { title: 'Rounds recorded', value: stats?.totalRounds ?? 0, icon: Gamepad2, tone: 'text-purple-500', bg: 'bg-purple-500/10' },
    { title: 'Avg HuePoints', value: stats?.averageRating ?? 0, icon: Star, tone: 'text-pink-500', bg: 'bg-pink-500/10' },
    { title: 'Pending feedback', value: stats?.pendingFeedback ?? 0, icon: MessageSquare, tone: 'text-amber-500', bg: 'bg-amber-500/10', to: '/admin/feedback' },
    { title: 'New (30d)', value: stats?.signups30d ?? 0, icon: TrendingUp, tone: 'text-sky-500', bg: 'bg-sky-500/10', hint: `${stats?.signups7d ?? 0} in the last 7 days` },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-deep">Admin Dashboard</h1>
          <p className="text-muted text-sm mt-1">
            Everything at a glance. Counts are live, not cached.
          </p>
        </div>
        <Button
          icon={<RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />}
          onClick={handleRefreshLeaderboard}
          disabled={refreshing}
        >
          Refresh rank labels
        </Button>
      </div>

      {/* ── Tiles ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((tile, index) => (
          <motion.div
            key={tile.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
          >
            <Card
              className="h-full p-5"
              hover={!!tile.to}
              onClick={tile.to ? () => navigate(tile.to!) : undefined}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted">{tile.title}</p>
                  <p className="mt-1 font-heading text-2xl font-bold text-deep sm:text-3xl">
                    {tile.value.toLocaleString()}
                  </p>
                  {tile.hint && (
                    <p className="mt-1 truncate text-[11px] text-muted">{tile.hint}</p>
                  )}
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tile.bg}`}>
                  <tile.icon className={`h-5 w-5 ${tile.tone}`} />
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Top players ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="h-full p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-deep">
                <Trophy className="h-4 w-4 text-amber-500" />
                Top players
              </h2>
              <button
                onClick={() => navigate('/leaderboard')}
                className="flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Leaderboard <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            {stats?.topPlayers?.length ? (
              <div className="space-y-2">
                {stats.topPlayers.map((player, index) => (
                  <div key={player.id} className="flex items-center gap-3">
                    <span className="w-5 shrink-0 font-mono text-xs text-muted">{index + 1}</span>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {player.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-deep">{player.username}</p>
                      <p className="text-[11px] text-muted">
                        {player.rank_tier ?? 'Unranked'} · {player.games_played} games
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-semibold text-deep">
                      {player.rating}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted">
                Nobody has played five competitive games yet.
              </p>
            )}
          </Card>
        </motion.div>

        {/* ── Recent signups ───────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34 }}
        >
          <Card className="h-full p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-deep">Newest accounts</h2>
              <button
                onClick={() => navigate('/admin/users')}
                className="flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                All users <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            {stats?.recentSignups?.length ? (
              <div className="space-y-2">
                {stats.recentSignups.map(user => (
                  <div key={user.id} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-alt text-xs font-medium text-deep">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-deep">{user.username}</p>
                      <p className="truncate text-[11px] text-muted">{user.email}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <StatusBadge
                        verified={user.is_verified}
                        restricted={user.is_restricted}
                        until={user.banned_until}
                      />
                      <p className="mt-1 text-[11px] text-muted">{relative(user.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted">No accounts yet.</p>
            )}
          </Card>
        </motion.div>
      </div>

      {/* ── Recent admin activity ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.38 }}
      >
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-deep">
              <ScrollText className="h-4 w-4 text-muted" />
              Recent admin activity
            </h2>
            <button
              onClick={() => navigate('/admin/logs')}
              className="flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Full audit log <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {stats?.recentActions?.length ? (
            <div className="space-y-2">
              {stats.recentActions.map(entry => {
                const subject = actionSubject(entry.details);
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-surface-alt px-3 py-2"
                  >
                    <p className="min-w-0 truncate text-sm">
                      <span className={`font-medium ${actionTone(entry.action)}`}>
                        {actionLabel(entry.action)}
                      </span>
                      {subject && <span className="text-deep"> · {subject}</span>}
                    </p>
                    <span className="shrink-0 text-[11px] text-muted">
                      {actionActor(entry)} · {relative(entry.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted">
              Nothing has been recorded yet.
            </p>
          )}
        </Card>
      </motion.div>

      {/* ── System ratios ──────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42 }}
      >
        <Card className="p-6">
          <h2 className="mb-4 font-heading text-lg font-semibold text-deep">System</h2>
          <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            <Stat
              label="Verification rate"
              value={stats?.totalUsers ? Math.round((stats.verifiedUsers / stats.totalUsers) * 100) : 0}
            />
            <Stat
              label="Active in last 24h"
              value={stats?.totalUsers ? Math.round((stats.activeUsers24h / stats.totalUsers) * 100) : 0}
            />
            <Stat
              label="Competitive rounds"
              value={stats?.totalCompetitiveGames ?? 0}
              raw
            />
            <Stat label="Casual rounds" value={stats?.totalCasualGames ?? 0} raw />
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

function Stat({ label, value, raw = false }: { label: string; value: number; raw?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-3 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="font-mono text-sm font-medium text-deep">
        {value.toLocaleString()}
        {!raw && '%'}
      </span>
    </div>
  );
}
