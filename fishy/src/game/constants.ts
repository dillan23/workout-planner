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

// --- Enemies ----------------------------------------------------------------

/** Hard cap on fish in the pond at once, to protect the frame rate. */
export const MAX_FISH = 20;

/** How many fish the pond is stocked with before the first frame, so a run
 * opens on a living pond rather than an empty one. */
export const SEED_FISH = 9;

/**
 * Enemy speed as a fraction of the player's top speed, before the size term.
 * Keeping enemies relative to the player rather than to absolute pixels means
 * the pond stays as fast as it feels at every size, instead of turning into a
 * slideshow once the player is large.
 */
export const ENEMY_SPEED_FRACTION = 0.38;

/**
 * Speed falls off with relative size, so small fish dart and big ones lumber.
 * At these numbers the smallest prey crosses at about 66% of the player's top
 * speed and the largest predators at about 20%: nothing can ever run you down,
 * which is what keeps a death felt as a mistake rather than an ambush.
 */
export const ENEMY_SPEED_SIZE_EXPONENT = 0.6;

/**
 * Seconds between spawn attempts, drawn uniformly from this range.
 *
 * Attempts are frequent and gated on a population target rather than spaced to
 * meter the flow directly. A fixed interval does not survive growth: as the
 * player gets larger the fish are larger and faster relative to the screen, so
 * they clear the pond sooner, and a rate tuned for the opening leaves apex play
 * in nearly empty water.
 */
export const SPAWN_INTERVAL_MIN = 0.15;
export const SPAWN_INTERVAL_MAX = 0.3;

/**
 * How many fish the spawner tries to keep in the pond, at the start of a run
 * and at apex. It rises so that reaching Leviathan feels like being handed a
 * feast rather than an empty ocean. MAX_FISH remains the hard ceiling.
 */
export const SPAWN_TARGET_START = 11;
export const SPAWN_TARGET_APEX = 15;

/**
 * Fish one attempt may place. One per attempt is not enough to hold the target
 * at apex, where fish cross in under three seconds and sustaining the pond
 * needs more spawns per second than the interval allows on its own.
 */
export const SPAWN_MAX_PER_ATTEMPT = 2;

// --- Growth -----------------------------------------------------------------

/** Size the player tops out at, roughly 288px nose to tail. */
export const APEX_SIZE = 12;

/** Fish eaten to reach apex size. */
export const APEX_EATEN = 175;

/**
 * Shapes the growth curve: size = APEX_SIZE ^ (progress ^ GROWTH_EXPONENT).
 * Below 1 the curve is concave, so growth per fish falls away as the run goes
 * on. At 0.5 the first bite is worth about 21% of the player's size and the
 * last under 1%.
 */
export const GROWTH_EXPONENT = 0.5;

/**
 * Seconds for the player to visibly grow into a new size, near enough.
 *
 * Growth is eased rather than applied instantly for two reasons: a 21% pop on
 * the first bite is jarring, and instant growth can expand the player into a
 * predator that was a safe distance away a frame earlier, which is a death the
 * player could not have avoided. Easing gives them room to swim clear, and
 * because collision reads the same eased size, the hitbox never disagrees with
 * what is on screen.
 */
export const GROWTH_EASE_SECONDS = 0.25;

/** Points for eating a fish of exactly the player's size. Smaller fish score
 * proportionally less, so the risk of going after a big one is what pays.
 * Provisional: the HUD lands in phase 6. */
export const SCORE_PER_FISH = 100;

/** Clearance, in player body lengths, that a seeded predator must leave around
 * the player's starting position. Edge spawns cannot overlap the player by
 * construction; the opening stock is the only case that has to be checked. */
export const SEED_PREDATOR_CLEARANCE = 3.5;

/** Tail beat rate of an enemy relative to the player's, before the size term. */
export const ENEMY_TAIL_RATE = 0.9;
