import { MAX_FISH } from './constants';

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
/** Fish eaten this run. Drives both the growth curve and the difficulty curve. */
export const P_EATEN = 10;
export const P_SCORE = 11;
/** 1 while the run is live. Death sets it to 0 and the player stops simulating. */
export const P_ALIVE = 12;
export const P_FIELDS = 13;

// --- Input ------------------------------------------------------------------

export const I_TARGET_X = 0;
export const I_TARGET_Y = 1;
/** 1 while a finger is down. */
export const I_ACTIVE = 2;
/** Finger velocity as the gesture reports it, in px/s. */
export const I_RAW_VX = 3;
export const I_RAW_VY = 4;
/** The same, smoothed by the simulation. Raw touch velocity is noisy, and this
 * is fed forward into the fish's desired velocity, so the noise would be felt. */
export const I_VX = 5;
export const I_VY = 6;
/** Which control scheme is driving: CONTROL_DRAG or CONTROL_JOYSTICK. */
export const I_MODE = 7;
/** Joystick deflection, as a direction times a magnitude from 0 to 1. */
export const I_VEC_X = 8;
export const I_VEC_Y = 9;
/** Where the floating joystick was placed, and where its knob currently sits.
 * Kept here so the renderer can draw it from the same buffer the simulation
 * reads, with no React state in between. */
export const I_ORIGIN_X = 10;
export const I_ORIGIN_Y = 11;
export const I_KNOB_X = 12;
export const I_KNOB_Y = 13;
export const I_FIELDS = 14;

/** Drag anywhere: the fish swims toward your finger. */
export const CONTROL_DRAG = 0;
/** A joystick that appears wherever you first touch. */
export const CONTROL_JOYSTICK = 1;

// --- Enemies ----------------------------------------------------------------

/**
 * The enemy pool: one flat buffer of MAX_FISH slots, of which the first
 * `L_ENEMY_COUNT` are alive. Despawning swaps the last live fish into the freed
 * slot and decrements the count, so live fish stay contiguous, iteration is a
 * straight walk, and there is no free list to maintain.
 */
export const E_X = 0;
export const E_PREV_X = 1;
/** Current vertical position. Fixed for a swimmer; a jellyfish bobs around
 * E_BASE_Y, so this still has to be tracked as real state rather than derived
 * only at render time, since collision needs the actual current position. */
export const E_Y = 2;
/** Signed: the sign is the direction of travel, and the heading is read from it. */
export const E_VX = 3;
/** Absolute size, in the same units as the player's, not a multiple of it. */
export const E_SIZE = 4;
export const E_TIER = 5;
/** For a swimmer, tail wag phase. For a jellyfish, which has no tail, the same
 * field carries its bob phase instead: one accumulator, read differently by
 * kind, rather than a field each kind would otherwise leave unused. */
export const E_TAIL_PHASE = 6;
/** KIND_SWIMMER or KIND_JELLYFISH. Independent of E_TIER: kind changes how a
 * fish moves and looks, tier changes how big and dangerous it is, and a
 * jellyfish is exactly as dangerous as any other fish its size. */
export const E_KIND = 7;
/** A jellyfish's still centre, set once at spawn; E_Y drifts above and below it. */
export const E_BASE_Y = 8;
export const E_FIELDS = 9;

/** Swims horizontally at a fixed depth. */
export const KIND_SWIMMER = 0;
/** Drifts horizontally while bobbing vertically around E_BASE_Y. */
export const KIND_JELLYFISH = 1;

// --- Loop -------------------------------------------------------------------

/** Leftover real time not yet consumed by a simulation step, in seconds. */
export const L_ACCUMULATOR = 0;
/** Fraction of the way from the previous step to the current one, for the renderer. */
export const L_ALPHA = 1;
/** Number of live fish at the front of the enemy pool. */
export const L_ENEMY_COUNT = 2;
/** Seconds until the next spawn attempt. */
export const L_SPAWN_TIMER = 3;
/**
 * The world, and the camera's position within it. Written by `world.ts`'s
 * functions rather than returned from them: screen size does not change after
 * launch, so the world's own size only needs computing once, but the camera
 * changes every simulation step, and a fresh object for that every step is
 * exactly the allocation this architecture exists to avoid.
 */
export const L_WORLD_WIDTH = 4;
export const L_WORLD_HEIGHT = 5;
/** Y where the swimmable water ends and the floor band begins; the player is
 * clamped here, not at L_WORLD_HEIGHT, so it never overlaps the seabed it is
 * drawn on top of. */
export const L_FLOOR_TOP_Y = 6;
export const L_CAMERA_X = 7;
export const L_CAMERA_Y = 8;
export const L_FIELDS = 9;

export function createPlayerState(): Float32Array {
  return new Float32Array(P_FIELDS);
}

export function createInputState(): Float32Array {
  return new Float32Array(I_FIELDS);
}

export function createLoopState(): Float32Array {
  return new Float32Array(L_FIELDS);
}

export function createEnemyPool(): Float32Array {
  return new Float32Array(MAX_FISH * E_FIELDS);
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
  p[P_EATEN] = 0;
  p[P_SCORE] = 0;
  p[P_ALIVE] = 1;
}
