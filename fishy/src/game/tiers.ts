import { nextFloat, nextRange } from './rng';

/**
 * Enemy size tiers, expressed as a multiple of the player's current size, and
 * how their spawn weights shift as the player grows.
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

/** The first tier that can eat a player of matching size. */
export const FIRST_PREDATOR_TIER = TIER_PREDATOR_SMALL;

/**
 * Spawn weights at the three emotional phases of a run, keyed on how far the
 * player is toward apex size.
 *
 * Terror: almost everything can eat you. Balance: genuine risk and reward.
 * Leviathan: the predators are gone and the pond is yours.
 *
 * PROVISIONAL. Phase 5 tunes these; phase 3 only needs the mechanism that makes
 * them shift.
 */
const WEIGHTS_TERROR = [6, 10, 16, 40, 28];
const WEIGHTS_BALANCE = [16, 22, 30, 24, 8];
const WEIGHTS_LEVIATHAN = [44, 34, 22, 0, 0];

/** Size range of each tier, as a multiple of the player's size. */
const TIER_MIN = [0.34, 0.62, 0.95, 1.3, 3.0];
const TIER_MAX = [0.46, 0.78, 1.05, 1.55, 4.5];

/**
 * Weight of one tier at progress `t` (0 at the start of a run, 1 at apex),
 * interpolated between the three keyframes. Computed on demand rather than into
 * a table so that picking a tier allocates nothing.
 */
export function tierWeight(tier: number, t: number): number {
  'worklet';
  if (t < 0.5) {
    const k = t * 2;
    return WEIGHTS_TERROR[tier] + (WEIGHTS_BALANCE[tier] - WEIGHTS_TERROR[tier]) * k;
  }
  const k = (t - 0.5) * 2;
  return WEIGHTS_BALANCE[tier] + (WEIGHTS_LEVIATHAN[tier] - WEIGHTS_BALANCE[tier]) * k;
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
export function tierSizeMultiplier(rng: Uint32Array, tier: number): number {
  'worklet';
  return nextRange(rng, TIER_MIN[tier], TIER_MAX[tier]);
}
