import { useState, useCallback, useRef, useEffect } from 'react';
import { game } from '../lib/api';
import { Difficulty, GameMode, HSLColor, RoundResult, Achievement } from '../types';
import { soundService } from '../services/soundService';

interface UseGameOptions {
  mode: 'casual' | 'competitive';
  onGameComplete?: (result: RoundResult, huePoints?: any, achievements?: Achievement[]) => void;
}

export function useGame({ mode, onGameComplete }: UseGameOptions) {
  const [phase, setPhase] = useState<'memorization' | 'reconstruction' | 'result'>('memorization');
  const [currentColor, setCurrentColor] = useState<HSLColor | null>(null);
  // ✅ FIX 2: Start with 0 values for all channels
  const [userColor, setUserColor] = useState<HSLColor>({ h: 0, s: 0, l: 0 });
  const [result, setResult] = useState<RoundResult | null>(null);
  const [huePointsUpdate, setHuePointsUpdate] = useState<any>(null);
  const [newlyUnlocked, setNewlyUnlocked] = useState<Achievement[]>([]);
  const [config, setConfig] = useState<{
    multiplier: number;
    negThreshold: number;
    colorTimeSeconds: number;
    roundTimeSeconds: number;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentDifficulty, setCurrentDifficulty] = useState<Difficulty | null>(null);
  
  const startTimeRef = useRef<number>(0);
  const reloadHandledRef = useRef<boolean>(false);

  const generateRound = useCallback(async (difficulty: Difficulty) => {
    try {
      const response = await game.generateRound(difficulty);
      const data = response.data;
      
      setCurrentColor(data.color);
      setConfig(data.config);
      setCurrentDifficulty(difficulty);
      setPhase('memorization');
      setResult(null);
      setHuePointsUpdate(null);
      setNewlyUnlocked([]);
      // ✅ FIX 2: Reset to 0 when new round starts
      setUserColor({ h: 0, s: 0, l: 0 });
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
    setHuePointsUpdate(null);
    setNewlyUnlocked([]);
    setCurrentColor(null);
    setConfig(null);
    setCurrentDifficulty(null);
    setUserColor({ h: 0, s: 0, l: 0 });
  }, []);

  // Handle page reload during active round
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if ((phase === 'memorization' || phase === 'reconstruction') && currentColor && currentDifficulty) {
        const memorizationSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
        
        const payload = JSON.stringify({
          mode,
          difficulty: currentDifficulty,
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
  }, [phase, currentColor, config, mode, currentDifficulty]);

  return {
    phase,
    setPhase,
    currentColor,
    userColor,
    setUserColor,
    result,
    huePointsUpdate,
    newlyUnlocked,
    config,
    isSubmitting,
    currentDifficulty,
    generateRound,
    submitGuess,
    registerReloadPenalty,
    resetGame,
  };
}