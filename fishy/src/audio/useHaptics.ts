import { useCallback, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';

/**
 * A light tap on every bite, a heavy knock on death.
 *
 * Bites are rate limited. At apex the player eats around twice a second and the
 * taps run together into a buzz that reads as a fault rather than as feedback;
 * spacing them keeps each one legible. Death is never suppressed.
 *
 * Every call is fire and forget: a device without a haptic engine rejects them,
 * and that is not worth a warning on every fish.
 */
const MIN_BITE_GAP_MS = 90;

export interface GameHaptics {
  readonly bite: () => void;
  readonly death: () => void;
}

export function useHaptics(enabled: boolean): GameHaptics {
  const enabledRef = useRef(enabled);
  const lastBiteRef = useRef(0);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const bite = useCallback(() => {
    if (!enabledRef.current) {
      return;
    }
    const now = Date.now();
    if (now - lastBiteRef.current < MIN_BITE_GAP_MS) {
      return;
    }
    lastBiteRef.current = now;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }, []);

  const death = useCallback(() => {
    if (!enabledRef.current) {
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
  }, []);

  return { bite, death };
}
