import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Filter, CheckCircle, XCircle, Bug, Lightbulb, Star, MessageSquare, 
  ChevronLeft, ChevronRight, ExternalLink 
} from 'lucide-react';
import { adminApi } from '../lib/adminApi';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { FeedbackItem, FeedbackStats } from '../types/admin';
import { format } from 'date-fns';
import { toast } from 'sonner';

const typeIcons = {
  bug: Bug,
  feature: Lightbulb,
  review: Star,
  other: MessageSquare,
};

const typeColors = {
  bug: 'text-red-500 bg-red-500/10',
  feature: 'text-purple-500 bg-purple-500/10',
  review: 'text-yellow-500 bg-yellow-500/10',
  other: 'text-muted bg-muted/10',
};

export default function AdminFeedback() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [offset, setOffset] = useState(0);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const limit = 20;

  const loadFeedback = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getFeedback({ 
        resolved: showResolved || undefined, 
        type: typeFilter || undefined, 
        limit, 
        offset 
      });
      setFeedback(response.feedback);
      setTotal(response.total);
      setStats(response.stats);
    } catch (error) {
      toast.error('Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await adminApi.resolveFeedback(id);
      toast.success('Feedback resolved');
      loadFeedback();
    } catch (error) {
      toast.error('Failed to resolve feedback');
    }
  };

  useEffect(() => {
    loadFeedback();
  }, [showResolved, typeFilter, offset]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-bold text-deep">Feedback Management</h1>
        <p className="text-muted text-sm mt-1">Review and manage user feedback</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-deep">{stats.total}</p>
            <p className="text-xs text-muted">Total</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-accent">{stats.pending}</p>
            <p className="text-xs text-muted">Pending</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{stats.bugs}</p>
            <p className="text-xs text-muted">Bugs</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-500">{stats.features}</p>
            <p className="text-xs text-muted">Features</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-500">{stats.reviews}</p>
            <p className="text-xs text-muted">Reviews</p>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Button
          variant={!showResolved ? 'primary' : 'ghost'}
          onClick={() => setShowResolved(false)}
        >
          Pending
        </Button>
        <Button
          variant={showResolved ? 'primary' : 'ghost'}
          onClick={() => setShowResolved(true)}
        >
          Resolved
        </Button>
        <div className="w-px h-8 bg-border mx-2" />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 rounded-button bg-surface-alt border border-border text-deep text-sm focus:outline-none focus:shadow-glow-primary"
        >
          <option value="">All Types</option>
          <option value="bug">Bugs</option>
          <option value="feature">Features</option>
          <option value="review">Reviews</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Feedback List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : feedback.length === 0 ? (
          <Card className="p-12 text-center text-muted">
            No feedback found
          </Card>
        ) : (
          feedback.map((item, index) => {
            const Icon = typeIcons[item.type];
            const colorClass = typeColors[item.type];
            
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card className="p-4 hover:shadow-lg transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl ${colorClass} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-deep">{item.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${colorClass}`}>
                          {item.type}
                        </span>
                        {item.resolved && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">
                            Resolved
                          </span>
                        )}
                      </div>
                      
                      <p className="text-muted text-sm mb-2">{item.description}</p>
                      
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
                        <span>From: {item.username || 'Anonymous'}</span>
                        <span>{format(new Date(item.created_at), 'MMM d, yyyy h:mm a')}</span>
                        {item.contact_email && (
                          <a href={`mailto:${item.contact_email}`} className="text-primary hover:underline">
                            {item.contact_email}
                          </a>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedFeedback(item)}
                        className="p-2 rounded-lg hover:bg-surface-alt transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 text-muted" />
                      </button>
                      {!item.resolved && (
                        <button
                          onClick={() => handleResolve(item.id)}
                          className="p-2 rounded-lg hover:bg-success/10 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4 text-success" />
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted">
            Showing {offset + 1} to {Math.min(offset + limit, total)} of {total}
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

      {/* Feedback Detail Modal */}
      {selectedFeedback && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedFeedback(null)}>
          <div className="bg-surface rounded-2xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-xl ${typeColors[selectedFeedback.type]} flex items-center justify-center`}>
                {(() => {
                  const Icon = typeIcons[selectedFeedback.type];
                  return <Icon className="w-6 h-6" />;
                })()}
              </div>
              <div>
                <h3 className="font-heading text-xl font-semibold">{selectedFeedback.title}</h3>
                <p className="text-muted text-sm capitalize">{selectedFeedback.type}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted mb-1">Description</p>
                <p className="text-deep">{selectedFeedback.description}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted">Submitted by</p>
                  <p className="text-sm font-medium">{selectedFeedback.username || 'Anonymous'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Submitted on</p>
                  <p className="text-sm">{format(new Date(selectedFeedback.created_at), 'PPP')}</p>
                </div>
                {selectedFeedback.contact_email && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted">Contact</p>
                    <a href={`mailto:${selectedFeedback.contact_email}`} className="text-sm text-primary hover:underline">
                      {selectedFeedback.contact_email}
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="ghost" onClick={() => setSelectedFeedback(null)} fullWidth>
                Close
              </Button>
              {!selectedFeedback.resolved && (
                <Button onClick={() => {
                  handleResolve(selectedFeedback.id);
                  setSelectedFeedback(null);
                }}>
                  Mark Resolved
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}