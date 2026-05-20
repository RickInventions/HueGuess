import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, ChevronLeft, ChevronRight, Eye, Shield, CheckCircle, XCircle } from 'lucide-react';
import { adminApi } from '../lib/adminApi';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { AdminUser } from '../types/admin';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const limit = 20;

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getUsers({ search: search || undefined, limit, offset });
      setUsers(response.users);
      setTotal(response.total);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [search, offset]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-deep">User Management</h1>
          <p className="text-muted text-sm mt-1">View and manage all registered users</p>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search by username or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
            className="w-full pl-11 pr-4 py-3 rounded-button bg-surface-alt border border-border text-deep placeholder:text-muted focus:outline-none focus:shadow-glow-primary transition-shadow"
          />
        </div>
      </Card>

      {/* Users Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-alt border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted">User</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted hidden sm:table-cell">Email</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-muted">Verified</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted hidden md:table-cell">Rating</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted hidden lg:table-cell">Games</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted">Joined</th>
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
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{user.username}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-sm text-muted">{user.email}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {user.is_verified ? (
                        <CheckCircle className="w-5 h-5 text-success mx-auto" />
                      ) : (
                        <XCircle className="w-5 h-5 text-accent mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">
                      <span className="font-mono font-semibold">{user.rating || 100}</span>
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      <span className="text-muted">{user.games_played || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs text-muted">
                        {format(new Date(user.created_at), 'MMM d, yyyy')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="text-muted hover:text-primary transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4 border-t border-border">
            <div className="text-sm text-muted">
              Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} users
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
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
                onClick={() => setOffset(Math.min(total - limit, offset + limit))}
                disabled={offset + limit >= total}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedUser(null)}>
          <div className="bg-surface rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
                {selectedUser.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-heading text-xl font-semibold">{selectedUser.username}</h3>
                <p className="text-muted text-sm">{selectedUser.email}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted">User ID</span>
                <span className="font-mono text-xs">{selectedUser.id}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted">Verified</span>
                <span>{selectedUser.is_verified ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted">HuePoints</span>
                <span className="font-semibold">{selectedUser.rating || 100}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted">Games Played</span>
                <span>{selectedUser.games_played || 0}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted">Avg Accuracy</span>
                <span>{Math.round(selectedUser.avg_accuracy || 0)}%</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted">Joined</span>
                <span>{format(new Date(selectedUser.created_at), 'PPP')}</span>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="ghost" onClick={() => setSelectedUser(null)} fullWidth>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}