/**
 * Game state, laid out as flat Float32Arrays.
 *
 * These buffers are created once on the JS thread, handed to the UI thread
 * through a shared value, and mutated in place from then on. Nothing in the
 * frame loop constructs an object, so there is nothing for the collector to
 * take back mid-run.
 *
 * Two properties of Reanimated make this work, and both are load-bearing:
 *
 *  - A shared value's getter returns a closure-held reference. Deserialization
 *    happens on cross-runtime *assignment*, never on read, so once a buffer has
 *    been handed over, every UI-thread read returns the same object and
 *    in-place writes persist across frames.
 *  - That handover is a copy, not shared memory. The JS thread keeps its own
 *    array, and mutating it there is invisible to the UI thread. Anything the
 *    JS thread needs to tell the simulation goes through a scalar shared value
 *    instead (see `timingReset` in `useGameLoop`).
 */

// --- Player -----------------------------------------------------------------

export const P_X = 0;
export const P_Y = 1;
/** Position at the end of the previous simulation step, for render interpolation. */
export const P_PREV_X = 2;
export const P_PREV_Y = 3;
export const P_VX = 4;
export const P_VY = 5;
export const P_SIZE = 6;
/** +1 facing right, -1 facing left. */
export const P_FACING = 7;
/** Tail wag phase, in radians, accumulated rather than derived from a clock so
 * the beat rate can change without the tail jumping. */
export const P_TAIL_PHASE = 8;
/** 0 until the player has been placed, which needs a screen size and so cannot
 * happen until the first frame on the UI thread. */
export const P_SPAWNED = 9;
export const P_FIELDS = 10;

// --- Input ------------------------------------------------------------------

export const I_TARGET_X = 0;
export const I_TARGET_Y = 1;
/** 1 while a finger is down. */
export const I_ACTIVE = 2;
export const I_FIELDS = 3;

// --- Loop -------------------------------------------------------------------

/** Leftover real time not yet consumed by a simulation step, in seconds. */
export const L_ACCUMULATOR = 0;
/** Fraction of the way from the previous step to the current one, for the renderer. */
export const L_ALPHA = 1;
export const L_FIELDS = 2;

export function createPlayerState(): Float32Array {
  return new Float32Array(P_FIELDS);
}

export function createInputState(): Float32Array {
  return new Float32Array(I_FIELDS);
}

export function createLoopState(): Float32Array {
  return new Float32Array(L_FIELDS);
}

/**
 * Put the player back at the start of a run. Runs on the UI thread so a retry
 * costs one buffer write rather than a remount.
 */
export function resetPlayer(p: Float32Array, x: number, y: number, size: number): void {
  'worklet';
  p[P_X] = x;
  p[P_Y] = y;
  p[P_PREV_X] = x;
  p[P_PREV_Y] = y;
  p[P_VX] = 0;
  p[P_VY] = 0;
  p[P_SIZE] = size;
  p[P_FACING] = 1;
  p[P_TAIL_PHASE] = 0;
  p[P_SPAWNED] = 1;
}
