import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { HSLColor } from '@/lib/game';

interface ColorDisplayProps {
  color: HSLColor | null;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  animate?: boolean;
  ghost?: boolean;
}

export function ColorDisplay({ color, size = 'lg', label, animate, ghost }: ColorDisplayProps) {
  const sizeClasses = {
    sm: 'w-24 h-24',
    md: 'w-40 h-40',
    lg: 'w-64 h-64',
  };
  
  if (!color) {
    return (
      <div className={cn(
        sizeClasses[size],
        'rounded-card bg-[#F1EEE7] flex items-center justify-center'
      )}>
        <span className="text-text-muted text-sm">No color</span>
      </div>
    );
  }
  
  const bgColor = `hsl(${Math.round(color.h)}, ${Math.round(color.s)}%, ${Math.round(color.l)}%)`;
  
  return (
    <div className="flex flex-col items-center gap-3">
      {label && (
        <p className="text-sm font-medium text-text-muted">{label}</p>
      )}
      <motion.div
        className={cn(
          sizeClasses[size],
          'rounded-card card-shadow relative overflow-hidden'
        )}
        style={{ backgroundColor: bgColor }}
        initial={animate ? { opacity: 0, scale: 0.9 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {ghost && (
          <motion.div
            className="absolute inset-0 bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
          />
        )}
        {/* Subtle inner highlight */}
        <div className="absolute inset-0 rounded-card bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
      </motion.div>
    </div>
  );
}