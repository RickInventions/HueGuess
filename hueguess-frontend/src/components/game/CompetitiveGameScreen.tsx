/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCompetitiveStore } from '@/store/competitiveStore';
import { startCompetitiveRound, submitCompetitiveRound } from '@/lib/competitive';
import { TimerBar } from '@/components/ui/TimerBar';
import { ColorDisplay } from '@/components/ui/ColorDisplay';
import { HueSlider } from '@/components/ui/HueSlider';
import { SaturationSlider } from '@/components/ui/SaturationSlider';
import { LightnessSlider } from '@/components/ui/LightnessSlider';
import { Button } from '@/components/ui/Button';
import { CompetitiveResultScreen } from './CompetitiveResultScreen';

interface CompetitiveGameScreenProps {
  onExit: () => void;
}

export function CompetitiveGameScreen({ onExit }: CompetitiveGameScreenProps) {
  const {
    phase, targetColor, userColor, memorizationTime, result, error,
    startMemorizing, startAdjusting, setResult, setError, reset,
  } = useCompetitiveStore();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showColor, setShowColor] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  const startNewRound = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await startCompetitiveRound();
      startMemorizing(data.roundId, data.color, data.memorizationTime);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start round');
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    startNewRound();
  }, []);
  
  
  const handleMemorizeComplete = useCallback(() => {
    setShowColor(false);
    setTimeout(() => startAdjusting(), 600);
  }, [startAdjusting]);
  
  const handleSubmit = async () => {
    const { roundId, userColor: color } = useCompetitiveStore.getState();
    if (!roundId) return;
    
    try {
      const result = await submitCompetitiveRound(
        roundId,
        color.h,
        color.s,
        color.l,
        memorizationTime
      );
      setResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    }
  };
  
  if (phase === 'results' && result) {
    return (
      <CompetitiveResultScreen
        onPlayAgain={() => { reset(); startNewRound(); }}
        onExit={onExit}
      />
    );
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  
  if (error && phase === 'idle') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <p className="text-accent mb-4">{error}</p>
        <Button onClick={startNewRound}>Try Again</Button>
        <button onClick={onExit} className="mt-4 text-text-muted hover:text-text-deep">
          Back to Dashboard
        </button>
      </div>
    );
  }
  
  return (
    <div className="game-container min-h-screen flex flex-col py-8">
      {/* Timer */}
      <div className="mb-8">
        {phase === 'memorizing' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-text-muted">
              <span>Memorize this color</span>
              <span>{Math.ceil(memorizationTime)}s</span>
            </div>
            <TimerBar
              duration={memorizationTime}
              onComplete={handleMemorizeComplete}
              variant="memorize"
              running={phase === 'memorizing'}
            />
          </div>
        )}
      </div>
      
      {/* Color Display */}
      <div className="flex-1 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {(phase === 'memorizing' || phase === 'adjusting') && (
            <motion.div
              key="target-color"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="flex flex-col items-center"
            >
              {phase === 'memorizing' ? (
                <>
                  <ColorDisplay color={targetColor} size="lg" />
                  <p className="mt-4 text-text-muted text-sm">
                    Remember this color...
                  </p>
                </>
              ) : (
                <div className="text-center">
                  <p className="text-2xl font-heading font-semibold text-text-deep mb-8">
                    Recreate the color
                  </p>
                  <ColorDisplay color={userColor} size="md" label="Your guess" />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Sliders */}
      {phase === 'adjusting' && (
        <motion.div
          className="space-y-6 mt-8"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="bg-surface-white rounded-card card-shadow p-6 space-y-6">
            <HueSlider
              value={userColor.h}
              onChange={(h) => useCompetitiveStore.getState().setUserColor({ h })}
            />
            <SaturationSlider
              value={userColor.s}
              hue={userColor.h}
              lightness={userColor.l}
              onChange={(s) => useCompetitiveStore.getState().setUserColor({ s })}
            />
            <LightnessSlider
              value={userColor.l}
              hue={userColor.h}
              saturation={userColor.s}
              onChange={(l) => useCompetitiveStore.getState().setUserColor({ l })}
            />
          </div>
          
          <Button size="lg" className="w-full" onClick={handleSubmit}>
            Submit Guess
          </Button>
        </motion.div>
      )}
    </div>
  );
}