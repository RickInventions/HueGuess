import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, UserCheck, Gamepad2, Activity, Star, MessageSquare, 
  RefreshCw, TrendingUp, AlertCircle, CheckCircle, XCircle 
} from 'lucide-react';
import { adminApi } from '../lib/adminApi';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { AdminStats } from '../types/admin';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      await adminApi.refreshLeaderboard();
      toast.success('Leaderboard refreshed successfully');
    } catch (error) {
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

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers || 0,
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'Verified Users',
      value: stats?.verifiedUsers || 0,
      icon: UserCheck,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
    {
      title: 'Competitive Games',
      value: stats?.totalCompetitiveGames || 0,
      icon: Gamepad2,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
    {
      title: 'Casual Games',
      value: stats?.totalCasualGames || 0,
      icon: Activity,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
    },
    {
      title: 'Active (24h)',
      value: stats?.activeUsers24h || 0,
      icon: TrendingUp,
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
    },
    {
      title: 'Avg Rating',
      value: stats?.averageRating || 0,
      icon: Star,
      color: 'text-pink-500',
      bg: 'bg-pink-500/10',
    },
    {
      title: 'Pending Feedback',
      value: stats?.pendingFeedback || 0,
      icon: MessageSquare,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-deep">Admin Dashboard</h1>
          <p className="text-muted text-sm mt-1">Manage users, feedback, and system settings</p>
        </div>
        <Button 
        //   variant="outline" 
          icon={<RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />}
          onClick={handleRefreshLeaderboard}
          disabled={refreshing}
        >
          Refresh Leaderboard
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted text-sm">{stat.title}</p>
                  <p className="font-heading text-3xl font-bold text-deep mt-1">
                    {stat.value.toLocaleString()}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-6">
            <h2 className="font-heading text-xl font-semibold text-deep mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button 
                onClick={() => window.location.href = '/admin/users'}
                className="w-full text-left px-4 py-3 rounded-xl bg-surface-alt hover:bg-surface-alt/70 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">View All Users</span>
                  <span className="text-muted text-sm">Manage accounts →</span>
                </div>
              </button>
              <button 
                onClick={() => window.location.href = '/admin/feedback'}
                className="w-full text-left px-4 py-3 rounded-xl bg-surface-alt hover:bg-surface-alt/70 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">Review Feedback</span>
                  <span className="text-muted text-sm">
                    {stats?.pendingFeedback} pending →
                  </span>
                </div>
              </button>
            </div>
          </Card>
        </motion.div>

        {/* System Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card className="p-6">
            <h2 className="font-heading text-xl font-semibold text-deep mb-4">System Info</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted">Verification Rate</span>
                <span className="font-medium">
                  {stats?.totalUsers ? Math.round((stats.verifiedUsers / stats.totalUsers) * 100) : 0}%
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted">Active Ratio (24h)</span>
                <span className="font-medium">
                  {stats?.totalUsers ? Math.round((stats.activeUsers24h / stats.totalUsers) * 100) : 0}%
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted">Competitive vs Casual</span>
                <span className="font-medium">
                  {stats?.totalCompetitiveGames && stats?.totalCasualGames
                    ? Math.round((stats.totalCompetitiveGames / (stats.totalCompetitiveGames + stats.totalCasualGames)) * 100)
                    : 0}% Comp
                </span>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}