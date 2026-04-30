import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, TrendingDown } from 'lucide-react';
import { useCompetitiveStore } from '@/store/competitiveStore';
import { ColorDisplay } from '@/components/ui/ColorDisplay';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { RankTier } from '@/lib/competitive';

const rankTierColors: Record<RankTier, string> = {
  bronze: 'from-amber-700 to-amber-600 text-white',
  silver: 'from-gray-400 to-gray-300 text-white',
  gold: 'from-yellow-500 to-yellow-400 text-white',
  platinum: 'from-cyan-500 to-cyan-400 text-white',
  diamond: 'from-purple-500 to-pink-400 text-white',
};

interface CompetitiveResultScreenProps {
  onPlayAgain: () => void;
  onExit: () => void;
}

export function CompetitiveResultScreen({ onPlayAgain, onExit }: CompetitiveResultScreenProps) {
  const { result } = useCompetitiveStore();
  const [displayAccuracy, setDisplayAccuracy] = useState(0);
  const [displayRating, setDisplayRating] = useState(0);
  
  useEffect(() => {
    if (!result) return;
    
    const duration = 1500;
    const startTime = Date.now();
    const targetAccuracy = result.accuracy;
    const startRating = result.newRating - result.ratingChange;
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      
      setDisplayAccuracy(targetAccuracy * eased);
      setDisplayRating(startRating + result.ratingChange * eased);
      
      if (progress >= 1) {
        clearInterval(interval);
        setDisplayAccuracy(targetAccuracy);
        setDisplayRating(result.newRating);
      }
    }, 16);
    
    return () => clearInterval(interval);
  }, [result]);
  
  if (!result) return null;
  
  const isRatingUp = result.ratingChange > 0;
  
  const getRankEmoji = (accuracy: number) => {
    if (accuracy >= 98) return '👁️';
    if (accuracy >= 90) return '🔥';
    if (accuracy >= 75) return '👀';
    if (accuracy >= 50) return '🤔';
    return '🎨';
  };
  
  return (
    <div className="game-container min-h-screen flex flex-col items-center justify-center py-8">
      {/* Accuracy */}
      <motion.div
        className="text-center mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-6xl mb-4">{getRankEmoji(result.accuracy)}</div>
        <motion.p className="text-score">
          <span className={cn(
            result.accuracy >= 90 && 'text-success',
            result.accuracy < 50 && 'text-accent'
          )}>
            {displayAccuracy.toFixed(3)}%
          </span>
        </motion.p>
      </motion.div>
      
      {/* Rating Change */}
      <motion.div
        className="mb-8 text-center"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="inline-flex items-center gap-2 bg-surface-white rounded-card card-shadow px-6 py-3">
          <span className="text-text-muted">Rating:</span>
          <span className="text-xl font-heading font-bold">{Math.round(displayRating)}</span>
          <span className={cn(
            'inline-flex items-center gap-1 text-sm font-semibold',
            isRatingUp ? 'text-success' : 'text-accent'
          )}>
            {isRatingUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {isRatingUp ? '+' : ''}{result.ratingChange.toFixed(1)}
          </span>
        </div>
        
        <div className={cn(
          'inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r mt-4',
          rankTierColors[result.rankTier]
        )}>
          <Trophy className="w-4 h-4" />
          {result.rankTier}
        </div>
      </motion.div>
      
      {/* Color Comparison */}
      <motion.div
        className="flex items-center gap-8 mb-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <ColorDisplay color={result.original} size="md" label="Target" />
        <motion.div
          className="w-[1px] h-20 bg-gray-200"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.4, delay: 0.6 }}
        />
        <ColorDisplay color={result.user} size="md" label="Your guess" />
      </motion.div>
      
      {/* Actions */}
      <motion.div
        className="w-full space-y-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Button size="lg" className="w-full" onClick={onPlayAgain}>
          Play Again
        </Button>
        <Button variant="ghost" className="w-full" onClick={onExit}>
          Back to Dashboard
        </Button>
      </motion.div>
    </div>
  );
}