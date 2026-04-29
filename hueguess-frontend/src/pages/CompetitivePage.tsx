import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export function CompetitivePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-section text-text-deep mb-4">Competitive Mode</h2>
        <p className="text-text-muted mb-8">Coming in Phase 2</p>
        <Link to="/" className="text-primary hover:underline font-medium">
          Back to Home
        </Link>
      </motion.div>
    </div>
  );
}