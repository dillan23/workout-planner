import { useCallback, useEffect, useRef, useState } from 'react';

import {
  DEFAULT_SETTINGS,
  NO_HIGH_SCORE,
  loadHighScore,
  loadSettings,
  saveHighScore,
  saveSettings,
  type HighScore,
  type PersistedSettings,
} from './storage';

export interface Persistence {
  readonly settings: PersistedSettings;
  readonly highScore: HighScore;
  /** True once storage has been read, so the UI never flashes a zero high score
   * that is about to be replaced. */
  readonly ready: boolean;
  readonly setSetting: <K extends keyof PersistedSettings>(
    key: K,
    value: PersistedSettings[K],
  ) => void;
  /** Records a finished run, returning whether it beat the stored best. */
  readonly submitRun: (run: HighScore) => boolean;
  readonly resetHighScore: () => void;
}

export function usePersistence(): Persistence {
  const [settings, setSettings] = useState<PersistedSettings>(DEFAULT_SETTINGS);
  const [highScore, setHighScore] = useState<HighScore>(NO_HIGH_SCORE);
  const [ready, setReady] = useState(false);

  // submitRun is called from a death, where re-reading state through the render
  // cycle would race the write. The ref always holds the current best.
  const bestRef = useRef<HighScore>(NO_HIGH_SCORE);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [storedSettings, storedHigh] = await Promise.all([loadSettings(), loadHighScore()]);
      if (cancelled) {
        return;
      }
      setSettings(storedSettings);
      setHighScore(storedHigh);
      bestRef.current = storedHigh;
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setSetting = useCallback(
    <K extends keyof PersistedSettings>(key: K, value: PersistedSettings[K]) => {
      setSettings((current) => {
        const next = { ...current, [key]: value };
        void saveSettings(next);
        return next;
      });
    },
    [],
  );

  const submitRun = useCallback((run: HighScore) => {
    if (run.score <= bestRef.current.score) {
      return false;
    }
    bestRef.current = run;
    setHighScore(run);
    void saveHighScore(run);
    return true;
  }, []);

  const resetHighScore = useCallback(() => {
    bestRef.current = NO_HIGH_SCORE;
    setHighScore(NO_HIGH_SCORE);
    void saveHighScore(NO_HIGH_SCORE);
  }, []);

  return { settings, highScore, ready, setSetting, submitRun, resetHighScore };
}
