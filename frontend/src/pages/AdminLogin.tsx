import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Key, AlertCircle } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export default function AdminLogin() {
  const { adminLogin } = useAdmin();
  const navigate = useNavigate();
  const [adminKey, setAdminKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Simple validation - in production, you'd validate with backend
    if (!adminKey || adminKey.length < 8) {
      setError('Invalid admin key');
      setLoading(false);
      return;
    }

    // Store key - actual validation happens on API calls
    adminLogin(adminKey);
    navigate('/admin');
  };

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <Card className="p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-heading text-2xl font-semibold text-deep">Admin Access</h2>
            <p className="text-muted text-sm mt-1">Enter your admin key to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="password"
                placeholder="Admin Key"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-3 rounded-button bg-surface-alt border border-border text-deep placeholder:text-muted focus:outline-none focus:shadow-glow-primary transition-shadow"
              />
            </div>

            <Button type="submit" fullWidth loading={loading}>
              Access Dashboard
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}