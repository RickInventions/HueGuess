import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useGameRound } from '@/hooks/useGameRound';
import { ColorDisplay } from '@/components/ui/ColorDisplay';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export function ResultScreen() {
  const { result } = useGameStore();
  const { playAgain } = useGameRound();
  const [displayAccuracy, setDisplayAccuracy] = useState(0);
  
  useEffect(() => {
    if (!result) return;
    
    const duration = 1500;
    const startTime = Date.now();
    const target = result.accuracy;
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayAccuracy(target * eased);
      
      if (progress >= 1) {
        clearInterval(interval);
        setDisplayAccuracy(target);
      }
    }, 16);
    
    return () => clearInterval(interval);
  }, [result]);
  
  if (!result) return null;
  
  const getRankEmoji = (accuracy: number) => {
    if (accuracy >= 98) return '👁️';
    if (accuracy >= 90) return '🔥';
    if (accuracy >= 75) return '👀';
    if (accuracy >= 50) return '🤔';
    return '🎨';
  };
  
  const getMessage = (accuracy: number) => {
    if (accuracy >= 99) return 'Incredible! Nearly perfect.';
    if (accuracy >= 95) return 'Your eyes are dangerous.';
    if (accuracy >= 90) return 'Almost identical.';
    if (accuracy >= 75) return 'Pretty close!';
    if (accuracy >= 50) return 'Getting there.';
    return 'Keep practicing!';
  };
  
  return (
    <div className="game-container min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
      {/* Accuracy Score */}
      <motion.div
        className="text-center mb-6 sm:mb-8 lg:mb-10 w-full"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4">
          {getRankEmoji(result.accuracy)}
        </div>
        <motion.p
          className="text-5xl sm:text-6xl md:text-7xl lg:text-score font-heading font-bold"
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <motion.span
            className={cn(
              result.accuracy >= 90 && 'text-success',
              result.accuracy < 50 && 'text-accent'
            )}
          >
            {displayAccuracy.toFixed(1)}%
          </motion.span>
        </motion.p>
        <motion.p
          className="text-base sm:text-lg lg:text-xl text-text-muted mt-2 sm:mt-3 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          {getMessage(result.accuracy)}
        </motion.p>
      </motion.div>
      
      {/* Color Comparison */}
      <motion.div
        className="flex items-center gap-4 sm:gap-6 lg:gap-8 mb-8 sm:mb-10 lg:mb-12 flex-wrap justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <ColorDisplay
          color={result.original}
          size="sm"
          label="Target"
        />
        
        {/* Divider - hidden on very small screens, shown differently on mobile */}
        <motion.div
          className="hidden sm:block w-[1px] h-16 sm:h-20 bg-gray-200"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.4, delay: 0.6 }}
        />
        
        {/* Mobile divider alternative */}
        <motion.div
          className="sm:hidden text-text-muted text-sm font-medium px-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.6 }}
        >
          VS
        </motion.div>
        
        <ColorDisplay
          color={result.user}
          size="sm"
          label="Your guess"
        />
      </motion.div>
      
      {/* Actions */}
      <motion.div
        className="w-full max-w-sm sm:max-w-md space-y-2 sm:space-y-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Button 
          size="lg" 
          className="w-full py-3 sm:py-4 text-base sm:text-lg font-semibold" 
          onClick={playAgain}
        >
          Play Again
        </Button>
        <Button
          variant="ghost"
          size="lg"
          className="w-full py-3 sm:py-4 text-sm sm:text-base"
          onClick={() => window.location.href = '/'}
        >
          Back to Home
        </Button>
      </motion.div>
      
      {/* Stats Summary - Optional addition for desktop */}
      <motion.div
        className="hidden sm:grid grid-cols-3 gap-4 sm:gap-6 mt-8 sm:mt-10 max-w-md w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <div className="text-center">
          <p className="text-2xl sm:text-3xl font-heading font-bold text-text-deep">
            {result.original.h}°
          </p>
          <p className="text-xs sm:text-sm text-text-muted mt-1">Target Hue</p>
        </div>
        <div className="text-center">
          <p className="text-2xl sm:text-3xl font-heading font-bold text-text-deep">
            {result.original.s}%
          </p>
          <p className="text-xs sm:text-sm text-text-muted mt-1">Saturation</p>
        </div>
        <div className="text-center">
          <p className="text-2xl sm:text-3xl font-heading font-bold text-text-deep">
            {result.original.l}%
          </p>
          <p className="text-xs sm:text-sm text-text-muted mt-1">Lightness</p>
        </div>
      </motion.div>
    </div>
  );
}