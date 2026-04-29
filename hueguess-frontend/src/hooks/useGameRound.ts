/* eslint-disable react-hooks/refs */
import { useCallback, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import * as gameApi from '@/lib/game';

export function useGameRound() {
  const { setPhase, startMemorizing, setResult, reset } = useGameStore();
  const isSubmitting = useRef(false);
  
  const startGame = useCallback(async () => {
    try {
      reset();
      const data = await gameApi.startRound('medium');
      startMemorizing(data.roundId, data.color, data.memorizationTime);
    } catch (error) {
      console.error('Failed to start game:', error);
    }
  }, [startMemorizing, reset]);
  
  const submitGuess = useCallback(async (h: number, s: number, l: number) => {
    const currentRoundId = useGameStore.getState().roundId;
    if (!currentRoundId || isSubmitting.current) return;
    
    isSubmitting.current = true;
    setPhase('submitted');
    
    try {
      const result = await gameApi.submitColor(currentRoundId, h, s, l);
      setResult(result);
    } catch (error) {
      console.error('Failed to submit:', error);
      setPhase('adjusting');
    } finally {
      isSubmitting.current = false;
    }
  }, [setPhase, setResult]);
  
  const playAgain = useCallback(() => {
    reset();
    startGame();
  }, [reset, startGame]);
  
  return {
    startGame,
    submitGuess,
    playAgain,
    isSubmitting: isSubmitting.current,
  };
}