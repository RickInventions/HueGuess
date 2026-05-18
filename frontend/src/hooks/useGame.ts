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
  const roundIdRef = useRef<string | null>(null);

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
      setUserColor({ h: 0, s: 0, l: 0 });
      startTimeRef.current = Date.now();
      reloadHandledRef.current = false;
      roundIdRef.current = null;
      
      return data;
    } catch (error) {
      console.error('Failed to generate round:', error);
      throw error;
    }
  }, []);

  // ✅ FIX 4: Submit 0,0,0 on timeout
  const submitTimeout = useCallback(async () => {
    if (!currentDifficulty || !currentColor || isSubmitting) return;
    if (roundIdRef.current) return; // Already submitted
    
    const memorizationSeconds = config?.colorTimeSeconds || 6;
    
    setIsSubmitting(true);
    try {
      const response = await game.submitGuess(
        mode,
        currentDifficulty,
        currentColor,
        { h: 0, s: 0, l: 0 }, // ✅ Submit black color for timeout
        memorizationSeconds
      );
      
      const data = response.data;
      roundIdRef.current = data.roundId;
      setResult(data.result);
      setHuePointsUpdate(data.huePoints || null);
      setNewlyUnlocked(data.newlyUnlocked || []);
      setPhase('result');
      soundService.playExpired();
      
      onGameComplete?.(data.result, data.huePoints, data.newlyUnlocked);
    } catch (error) {
      console.error('Failed to submit timeout:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [currentDifficulty, currentColor, config, mode, isSubmitting, onGameComplete]);

  const submitGuess = useCallback(async (
    difficulty: Difficulty,
    originalColor: HSLColor,
    userGuess: HSLColor,
    memorizationSeconds: number
  ) => {
    if (isSubmitting) return;
    if (roundIdRef.current) return; // Already submitted
    
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
      roundIdRef.current = data.roundId;
      setResult(data.result);
      setHuePointsUpdate(data.huePoints || null);
      setNewlyUnlocked(data.newlyUnlocked || []);
      setPhase('result');
      
      if (data.result.isNegative) {
        soundService.playNegativeTone();
      } else {
        soundService.playSubmitDing();
      }
      
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
    roundIdRef.current = null;
    reloadHandledRef.current = false;
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
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [phase, currentColor, currentDifficulty, mode]);

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
    submitTimeout,
    registerReloadPenalty,
    resetGame,
  };
}