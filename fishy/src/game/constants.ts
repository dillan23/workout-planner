/**
 * Tuning constants shared by the simulation and the renderer.
 *
 * Sizes are expressed as a multiple of the player's *size* value, and lengths
 * in device-independent pixels. A fish of size 1.0 is PLAYER_BASE_LENGTH_PX
 * long from nose to tail tip.
 */

/** Player size at the start of a run. */
export const PLAYER_START_SIZE = 1.0;

/** Nose-to-tail length, in px, of a fish at size 1.0. */
export const PLAYER_BASE_LENGTH_PX = 24;

/** Tail wag cycles per second. Slow enough to read, fast enough to feel alive. */
export const TAIL_WAG_HZ = 2.2;

/** Peak tail deflection, in degrees, either side of centre. */
export const TAIL_WAG_DEG = 15;
