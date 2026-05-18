import { useState, useCallback, useRef, useEffect } from 'react';
import { game } from '../lib/api';
import { Difficulty, GameMode, HSLColor, RoundResult, Achievement } from '../types';
import { soundService } from '../services/soundService';

const RELOAD_KEY = 'hue_pending_round';

interface PendingRound {
  mode: 'casual' | 'competitive';
  difficulty: Difficulty;
  color: HSLColor;
  memorizationSeconds: number;
}

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
  // Penalty result from a reload that happened mid-round
  const [reloadPenaltyResult, setReloadPenaltyResult] = useState<{
    result: RoundResult;
    huePoints?: any;
    difficulty: Difficulty;
  } | null>(null);

  const startTimeRef = useRef<number>(0);
  const reloadHandledRef = useRef<boolean>(false);
  const roundIdRef = useRef<string | null>(null);

  // On mount: check if the user reloaded mid-round and fetch the penalty result
  useEffect(() => {
    const raw = sessionStorage.getItem(RELOAD_KEY);
    if (!raw) return;
    sessionStorage.removeItem(RELOAD_KEY);

    let pending: PendingRound;
    try {
      pending = JSON.parse(raw);
    } catch {
      return;
    }

    // Only handle if the mode matches (e.g. don't show competitive penalty on casual page)
    if (pending.mode !== mode) return;

    setIsSubmitting(true);
    game
      .submitGuess(
        pending.mode,
        pending.difficulty,
        pending.color,
        { h: 0, s: 0, l: 0 }, // reload = no guess
        pending.memorizationSeconds
      )
      .then((response) => {
        const data = response.data;
        roundIdRef.current = data.roundId;
        setResult(data.result);
        setHuePointsUpdate(data.huePoints || null);
        setNewlyUnlocked(data.newlyUnlocked || []);
        setCurrentColor(pending.color);
        setCurrentDifficulty(pending.difficulty);
        setReloadPenaltyResult({
          result: data.result,
          huePoints: data.huePoints || null,
          difficulty: pending.difficulty,
        });
        setPhase('result');
        soundService.playExpired();
        onGameComplete?.(data.result, data.huePoints, data.newlyUnlocked);
      })
      .catch((err) => {
        console.error('Failed to submit reload penalty:', err);
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only

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
      setReloadPenaltyResult(null);
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

  const submitTimeout = useCallback(async () => {
    if (!currentDifficulty || !currentColor || isSubmitting) return;
    if (roundIdRef.current) return;

    const memorizationSeconds = config?.colorTimeSeconds || 6;

    setIsSubmitting(true);
    try {
      const response = await game.submitGuess(
        mode,
        currentDifficulty,
        currentColor,
        { h: 0, s: 0, l: 0 },
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
    if (roundIdRef.current) return;

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
    setReloadPenaltyResult(null);
    roundIdRef.current = null;
    reloadHandledRef.current = false;
  }, []);

  // Before unload: save round state to sessionStorage so the next page load
  // can detect the reload and show a penalty result screen.
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (
        (phase === 'memorization' || phase === 'reconstruction') &&
        currentColor &&
        currentDifficulty
      ) {
        const memorizationSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const pending: PendingRound = {
          mode,
          difficulty: currentDifficulty,
          color: currentColor,
          memorizationSeconds,
        };
        sessionStorage.setItem(RELOAD_KEY, JSON.stringify(pending));

        // Also fire the beacon as a fallback for server-side logging
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
    reloadPenaltyResult,
    generateRound,
    submitGuess,
    submitTimeout,
    registerReloadPenalty,
    resetGame,
  };
}