import { nextFloat, nextRange } from './rng';

/**
 * Enemy size tiers, expressed as a multiple of the player's current size, and
 * how both their spawn weights and their sizes shift as the player grows.
 *
 * Sizes are relative on purpose: a fish is not "big", it is bigger *than you*,
 * and the same tier means the same threat at every stage of a run.
 */
export const TIER_PREY_SMALL = 0;
export const TIER_PREY_MEDIUM = 1;
export const TIER_NEUTRAL = 2;
export const TIER_PREDATOR_SMALL = 3;
export const TIER_PREDATOR_LARGE = 4;
export const TIER_COUNT = 5;

/** The first tier that is always larger than the player. */
export const FIRST_PREDATOR_TIER = TIER_PREDATOR_SMALL;

/** Phase boundaries on the difficulty curve, in progress. */
export const TERROR_END = 1 / 3;
export const BALANCE_END = 2 / 3;

/**
 * Spawn weights at four points on the curve: the opening, each phase boundary,
 * and apex.
 *
 * Keyframing on the boundaries rather than on evenly spaced points is what lets
 * a phase start when it says it does. Predator weight reaches zero exactly at
 * BALANCE_END, so Leviathan is free of predators from its first second rather
 * than easing into safety somewhere in its second half.
 */
const WEIGHTS = [
  [10, 14, 16, 38, 22], // opening: most of the pond can eat you
  [25, 33, 26, 11, 5], // terror -> balance
  [28, 30, 42, 0, 0], // balance -> leviathan: nothing left that can
  [34, 34, 32, 0, 0], // apex
];

/**
 * The neutral band slides below 1.0 near the end of Balance.
 *
 * A fish at 0.95x to 1.05x is the one genuinely hard read in the game, and it
 * has to stay that way while it is the main source of risk. But it is also the
 * last thing that can kill a Leviathan, so leaving it straddling 1.0 would make
 * "nothing can eat you" false by a rounding error. Sliding the band to 0.86x to
 * 0.97x keeps the fish just as hard to judge and makes every one of them
 * edible: at apex the player unlearns a fear rather than losing the read, which
 * is a better version of the same moment.
 */
const NEUTRAL_SHIFT_START = 0.55;

/**
 * Size range of each tier at the opening and at the end of its shift.
 *
 * The predator bands narrow as the player grows, and they have to. A tier is a
 * multiple of the player, so a 4.5x predator against a mid-run player runs over
 * 700px long on a 393px screen: not a fish to dodge but a wall. Holding the
 * multiples fixed took the lethal share of the pond from 4% at the opening to
 * 35% by mid-run, which is not a difficulty curve, it is the screen filling up.
 * What matters is being bigger than you, and 1.5x is as fatal as 4x, so the
 * bands close toward the player and the pond stays navigable at every size.
 *
 * Prey bands do not move.
 */
const TIER_MIN_START = [0.34, 0.62, 0.95, 1.3, 3.0];
const TIER_MAX_START = [0.46, 0.78, 1.05, 1.55, 4.5];
const TIER_MIN_END = [0.34, 0.62, 0.86, 1.12, 1.45];
const TIER_MAX_END = [0.46, 0.78, 0.97, 1.28, 2.0];

/** When each tier's band starts and finishes moving, in curve progress. */
const SHIFT_FROM = [0, 0, NEUTRAL_SHIFT_START, 0, 0];
const SHIFT_TO = [1, 1, BALANCE_END, BALANCE_END, BALANCE_END];

function clamp01(v: number): number {
  'worklet';
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Weight of one tier at progress `t`. Computed on demand rather than into a
 * table, so picking a tier allocates nothing. */
export function tierWeight(tier: number, t: number): number {
  'worklet';
  const scaled = clamp01(t) * 3;
  const i = scaled >= 3 ? 2 : Math.floor(scaled);
  const k = scaled - i;
  return WEIGHTS[i][tier] + (WEIGHTS[i + 1][tier] - WEIGHTS[i][tier]) * k;
}

/** Choose a tier by weighted draw. Two passes over five numbers, no allocation. */
export function pickTier(rng: Uint32Array, t: number): number {
  'worklet';
  let total = 0;
  for (let i = 0; i < TIER_COUNT; i++) {
    total += tierWeight(i, t);
  }
  let target = nextFloat(rng) * total;
  for (let i = 0; i < TIER_COUNT; i++) {
    target -= tierWeight(i, t);
    if (target <= 0) {
      return i;
    }
  }
  return TIER_COUNT - 1;
}

/** Size for a fish of this tier, as a multiple of the player's size. */
export function tierSizeMultiplier(rng: Uint32Array, tier: number, t: number): number {
  'worklet';
  const span = SHIFT_TO[tier] - SHIFT_FROM[tier];
  const k = span <= 0 ? 1 : clamp01((t - SHIFT_FROM[tier]) / span);
  const min = TIER_MIN_START[tier] + (TIER_MIN_END[tier] - TIER_MIN_START[tier]) * k;
  const max = TIER_MAX_START[tier] + (TIER_MAX_END[tier] - TIER_MAX_START[tier]) * k;
  return nextRange(rng, min, max);
}
