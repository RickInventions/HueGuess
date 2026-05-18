import { useState, useCallback, useRef, useEffect } from 'react';
import { game } from '../lib/api';
import { Difficulty, GameMode, HSLColor, RoundResult, Achievement } from '../types';
import { soundService } from '../services/soundService';

interface UseGameOptions {
  mode: GameMode;
  onGameComplete?: (result: RoundResult, huePoints?: any, achievements?: Achievement[]) => void;
}

export function useGame({ mode, onGameComplete }: UseGameOptions) {
  const [phase, setPhase] = useState<'memorization' | 'reconstruction' | 'result'>('memorization');
  const [currentColor, setCurrentColor] = useState<HSLColor | null>(null);
  const [userColor, setUserColor] = useState<HSLColor>({ h: 0, s: 50, l: 50 });
  const [result, setResult] = useState<RoundResult | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [huePointsUpdate, setHuePointsUpdate] = useState<any>(null);
  const [newlyUnlocked, setNewlyUnlocked] = useState<Achievement[]>([]);
  const [config, setConfig] = useState<{
    multiplier: number;
    negThreshold: number;
    colorTimeSeconds: number;
    roundTimeSeconds: number;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const startTimeRef = useRef<number>(0);
  const reloadHandledRef = useRef<boolean>(false);

  const generateRound = useCallback(async (difficulty: Difficulty) => {
    try {
      const response = await game.generateRound(difficulty);
      const data = response.data;
      
      setCurrentColor(data.color);
      setConfig(data.config);
      setPhase('memorization');
      setResult(null);
      setScore(null);
      setHuePointsUpdate(null);
      setNewlyUnlocked([]);
      setUserColor({ h: data.color.h, s: data.color.s, l: data.color.l });
      startTimeRef.current = Date.now();
      reloadHandledRef.current = false;
      
      return data;
    } catch (error) {
      console.error('Failed to generate round:', error);
      throw error;
    }
  }, []);

  const submitGuess = useCallback(async (
    difficulty: Difficulty,
    originalColor: HSLColor,
    userGuess: HSLColor,
    memorizationSeconds: number
  ) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      const response = await game.submitGuess(
        mode,
        difficulty,
        originalColor,
        userGuess,
        memorizationSeconds
      );
      
      const data = response.data;
      setResult(data.result);
      setScore(data.result.accuracy);
      setHuePointsUpdate(data.huePoints || null);
      setNewlyUnlocked(data.newlyUnlocked || []);
      setPhase('result');
      
      // Play sound effects
      if (data.result.isNegative) {
        soundService.playNegativeTone();
      } else {
        soundService.playSubmitDing();
      }
      
      // Play achievement sound
      if (data.newlyUnlocked && data.newlyUnlocked.length > 0) {
        soundService.playAchievementUnlock();
      }
      
      onGameComplete?.(data.result, data.huePoints, data.newlyUnlocked);
      
      return data;
    } catch (error) {
      console.error('Failed to submit guess:', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [mode, isSubmitting, onGameComplete]);

  const registerReloadPenalty = useCallback(async (
    difficulty: Difficulty,
    originalColor: HSLColor,
    memorizationSeconds: number
  ) => {
    if (reloadHandledRef.current) return;
    reloadHandledRef.current = true;
    
    try {
      await game.registerReloadPenalty(mode, difficulty, originalColor, memorizationSeconds);
      soundService.playExpired();
    } catch (error) {
      console.error('Failed to register reload penalty:', error);
    }
  }, [mode]);

  const resetGame = useCallback(() => {
    setPhase('memorization');
    setResult(null);
    setScore(null);
    setHuePointsUpdate(null);
    setNewlyUnlocked([]);
  }, []);

  // Handle page reload during active round
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if ((phase === 'memorization' || phase === 'reconstruction') && currentColor && config) {
        const memorizationSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
        
        // Use sendBeacon for reliable delivery during page unload
        const payload = JSON.stringify({
          mode,
          difficulty: 'medium', // You'd need to track current difficulty
          originalH: currentColor.h,
          originalS: currentColor.s,
          originalL: currentColor.l,
          memorizationSeconds,
        });
        
        navigator.sendBeacon(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/game/reload-penalty`,
          new Blob([payload], { type: 'application/json' })
        );
        
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [phase, currentColor, config, mode]);

  return {
    phase,
    currentColor,
    userColor,
    setUserColor,
    result,
    score,
    huePointsUpdate,
    newlyUnlocked,
    config,
    isSubmitting,
    generateRound,
    submitGuess,
    registerReloadPenalty,
    resetGame,
    setPhase,
  };
}