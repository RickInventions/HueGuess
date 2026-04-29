/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/refs */
import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useGameRound } from '@/hooks/useGameRound';
import { TimerBar } from '@/components/ui/TimerBar';
import { ColorDisplay } from '@/components/ui/ColorDisplay';
import { HueSlider } from '@/components/ui/HueSlider';
import { SaturationSlider } from '@/components/ui/SaturationSlider';
import { LightnessSlider } from '@/components/ui/LightnessSlider';
import { Button } from '@/components/ui/Button';
import { ResultScreen } from './ResultScreen';

export function GameScreen() {
  const { phase, targetColor, userColor, memorizationTime, result } = useGameStore();
  const { startGame, submitGuess, isSubmitting } = useGameRound();
  const [showColor, setShowColor] = useState(true);
  const roundKeyRef = useRef(0);
  
  // Reset when phase changes to memorizing (new round)
  useEffect(() => {
    if (phase === 'memorizing') {
      setShowColor(true);
      roundKeyRef.current += 1;
    }
  }, [phase]);
  
  useEffect(() => {
    startGame();
    setShowColor(true);
    roundKeyRef.current += 1;
  }, [startGame]);
  
  const handleMemorizeComplete = useCallback(() => {
    const currentRoundKey = roundKeyRef.current;
    setShowColor(false);
    setTimeout(() => {
      // Only switch to adjusting if we're still on the same round
      if (currentRoundKey === roundKeyRef.current) {
        useGameStore.getState().setPhase('adjusting');
      }
    }, 600);
  }, []);
  
  const handleSubmit = () => {
    submitGuess();
  };
  
  if (phase === 'results' && result) {
    return <ResultScreen />;
  }
  
  return (
    <div className="game-container min-h-screen flex flex-col px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      {/* Timer */}
      <div className="mb-4 sm:mb-6 lg:mb-8">
        {phase === 'memorizing' && (
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex justify-between text-xs sm:text-sm text-text-muted">
              <span>Memorize this color</span>
              <span>{Math.ceil(memorizationTime+1)}s</span>
            </div>
            <TimerBar
              key={roundKeyRef.current}
              duration={memorizationTime}
              onComplete={handleMemorizeComplete}
              variant="memorize"
              running={phase === 'memorizing'}
            />
          </div>
        )}
      </div>
      
      {/* Color Display */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <AnimatePresence mode="wait">
          {(phase === 'memorizing' || phase === 'adjusting') && (
            <motion.div
              key={`color-${roundKeyRef.current}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="flex flex-col items-center w-full max-w-md mx-auto"
            >
              {phase === 'memorizing' ? (
                <>
                  <ColorDisplay color={targetColor} size="lg" ghost={!showColor} />
                  <p className="mt-3 sm:mt-4 text-text-muted text-xs sm:text-sm text-center">
                    Remember this color...
                  </p>
                </>
              ) : (
                <div className="text-center w-full">
                  <p className="text-xl sm:text-2xl lg:text-3xl font-heading font-semibold text-text-deep mb-6 sm:mb-8">
                    Recreate the color
                  </p>
                  <ColorDisplay
                    color={userColor}
                    size="md"
                    label="Your guess"
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Sliders */}
      {phase === 'adjusting' && (
        <motion.div
          className="space-y-4 sm:space-y-6 mt-6 sm:mt-8 lg:mt-10 w-full max-w-lg mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="bg-surface-white rounded-lg sm:rounded-card card-shadow p-4 sm:p-6 space-y-4 sm:space-y-5 lg:space-y-6">
            <HueSlider
              value={userColor.h}
              onChange={(h) => useGameStore.getState().setUserColor({ h })}
            />
            <SaturationSlider
              value={userColor.s}
              hue={userColor.h}
              lightness={userColor.l}
              onChange={(s) => useGameStore.getState().setUserColor({ s })}
            />
            <LightnessSlider
              value={userColor.l}
              hue={userColor.h}
              saturation={userColor.s}
              onChange={(l) => useGameStore.getState().setUserColor({ l })}
            />
          </div>
          
          <Button
            size="lg"
            className="w-full py-3 sm:py-4 text-base sm:text-lg"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Checking...' : 'Submit Guess'}
          </Button>
        </motion.div>
      )}
    </div>
  );
}