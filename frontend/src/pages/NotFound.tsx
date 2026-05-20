import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Palette, Home } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export default function NotFound() {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        <Card className="p-8">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Palette className="w-10 h-10 text-primary" />
          </div>
          <h1 className="font-heading text-6xl font-bold text-deep mb-2">404</h1>
          <h2 className="font-heading text-xl font-semibold text-deep mb-2">Page not found</h2>
          <p className="text-muted mb-6">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Link to="/">
            <Button icon={<Home className="w-4 h-4" />}>
              Back to Home
            </Button>
          </Link>
        </Card>
      </motion.div>
    </div>
  );
}