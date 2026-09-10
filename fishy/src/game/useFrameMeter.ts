import { useSharedValue, type SharedValue } from 'react-native-reanimated';

/**
 * A rolling frame-rate readout, for the performance pass.
 *
 * Averaging over a window rather than reporting instantaneous frame time, and
 * carrying the worst frame in that window alongside it, because a mean of 60
 * hides the dropped frame that is actually worth finding. Both are shared
 * values written from the frame callback, so measuring costs the game two
 * writes a second and no renders at all.
 */
export interface FrameMeter {
  readonly fps: SharedValue<number>;
  /** Longest frame in the last window, in milliseconds. */
  readonly worstMs: SharedValue<number>;
  readonly sample: (frameMs: number) => void;
}

const WINDOW_SECONDS = 0.5;

export function useFrameMeter(): FrameMeter {
  const fps = useSharedValue(0);
  const worstMs = useSharedValue(0);
  const elapsed = useSharedValue(0);
  const frames = useSharedValue(0);
  const worstInWindow = useSharedValue(0);

  const sample = (frameMs: number) => {
    'worklet';
    if (frameMs <= 0) {
      return;
    }
    elapsed.value += frameMs / 1000;
    frames.value += 1;
    if (frameMs > worstInWindow.value) {
      worstInWindow.value = frameMs;
    }
    if (elapsed.value >= WINDOW_SECONDS) {
      fps.value = frames.value / elapsed.value;
      worstMs.value = worstInWindow.value;
      elapsed.value = 0;
      frames.value = 0;
      worstInWindow.value = 0;
    }
  };

  return { fps, worstMs, sample };
}
