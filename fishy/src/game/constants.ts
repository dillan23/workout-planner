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

// --- Simulation -------------------------------------------------------------

/** Simulation rate, in Hz. Fixed and independent of display refresh, so a 60Hz
 * phone and a 120Hz phone run identical physics. */
export const SIM_HZ = 120;

/** Length of one simulation step, in seconds. */
export const SIM_DT = 1 / SIM_HZ;

/** Longest real frame the loop will integrate, in seconds. A stall longer than
 * this (a debugger pause, a slow resume) is truncated rather than replayed, so
 * the fish never teleports across the pond to "catch up". */
export const MAX_FRAME_TIME = 0.25;

// --- Movement ---------------------------------------------------------------

/** Top speed in px/s at size 1.0. */
export const BASE_MAX_SPEED = 270;

/**
 * Speed grows sublinearly with size. A leviathan is faster in absolute terms
 * but slower in body lengths per second, which is what makes big fish read as
 * heavy and menacing rather than as a bigger, twitchier player.
 */
export const SPEED_SIZE_EXPONENT = 0.35;

/**
 * How far the fish coasts, in body lengths, after you lift your finger at full
 * speed. This single number is the game's floatiness: raise it for a looser,
 * more drifty fish, lower it for tighter control.
 */
export const COAST_BODY_LENGTHS = 1.5;

/**
 * Distance from the touch point, in body lengths, over which the fish eases off
 * so it settles under your finger instead of sailing past it.
 *
 * This is not a free parameter. Together with the coast distance it sets the
 * damping ratio of the approach:
 *
 *     zeta = 0.5 * sqrt(ARRIVE_BODY_LENGTHS / COAST_BODY_LENGTHS)
 *
 * Below zeta = 1 the fish overshoots; at 4x the coast distance it is critically
 * damped and never does. 4.0 puts zeta at 0.82, which overshoots by about 1.5%
 * of the approach: enough that the fish drifts onto the target like a fish
 * rather than a cursor, far too little to flip its heading or cost you a dodge.
 *
 * The cost of raising it is that the fish only reaches top speed once your
 * finger is roughly this far away. The floatiness you actually feel on release
 * is COAST_BODY_LENGTHS and is unaffected by this number.
 */
export const ARRIVE_BODY_LENGTHS = 4.0;

/** Below this fraction of top speed the fish keeps its current heading, so a
 * fish hovering almost still does not strobe between facings. */
export const FLIP_DEADZONE = 0.06;

/** How much horizontal or vertical speed survives a wall bounce. */
export const EDGE_RESTITUTION = 0.3;

/** Below this fraction of top speed, hitting a wall stops the fish instead of
 * bouncing it, so holding a finger past the edge does not buzz. */
export const EDGE_BOUNCE_MIN = 0.15;

/** Tail beat rate when drifting, as a fraction of the rate at full speed. */
export const TAIL_IDLE_RATE = 0.55;
