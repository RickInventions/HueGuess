import { useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';

export function useGameRound() {
  const startRound = useGameStore((s) => s.startRound);
  const submitGuess = useGameStore((s) => s.submitGuess);
  const reset = useGameStore((s) => s.reset);
  const phase = useGameStore((s) => s.phase);
  
  const startGame = useCallback(() => {
    startRound();
  }, [startRound]);
  
  const handleSubmit = useCallback(() => {
    submitGuess();
  }, [submitGuess]);
  
  const playAgain = useCallback(() => {
    reset();
    // Small delay before starting new round
    setTimeout(() => {
      startRound();
    }, 100);
  }, [reset, startRound]);
  
  return {
    startGame,
    submitGuess: handleSubmit,
    playAgain,
    isSubmitting: phase === 'submitted',
  };
}