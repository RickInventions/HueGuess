import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, hover, onClick }: CardProps) {
  return (
    <motion.div
      className={cn(
        'bg-surface-white rounded-card card-shadow p-6',
        hover && 'cursor-pointer',
        className
      )}
      whileHover={hover ? { y: -4, boxShadow: '0 12px 40px rgba(0,0,0,0.06)' } : undefined}
      whileTap={hover ? { y: 0 } : undefined}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}