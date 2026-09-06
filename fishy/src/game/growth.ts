import { APEX_EATEN, APEX_SIZE, GROWTH_EXPONENT, PLAYER_START_SIZE } from './constants';

/**
 * Size the player has earned after eating `eaten` fish.
 *
 * Growth is concave in the number of fish eaten, so the first bite is worth
 * about 21% of the player's size and the last is worth well under 1%: early
 * bites are an event, late ones are barely perceptible, which is the shape the
 * original had.
 *
 * Written as APEX_SIZE raised to a power of progress so the two ends are exact
 * by construction. Size is 1.0 at zero fish and exactly APEX_SIZE at
 * APEX_EATEN, with no drift to tune out.
 */
export function sizeForEaten(eaten: number): number {
  'worklet';
  if (eaten <= 0) {
    return PLAYER_START_SIZE;
  }
  if (eaten >= APEX_EATEN) {
    return APEX_SIZE;
  }
  return Math.pow(APEX_SIZE, Math.pow(eaten / APEX_EATEN, GROWTH_EXPONENT));
}

/**
 * How far the run is along the difficulty curve: 0 at the first fish, 1 at
 * apex.
 *
 * Deliberately measured in fish eaten rather than in size. Size is a concave
 * function of fish eaten, so pinning the curve to it would race the player
 * through Terror and Balance in the first handful of bites and leave the rest
 * of the run in Leviathan. Counting fish gives the three phases roughly equal
 * thirds of a run, which is what makes them read as phases at all.
 */
export function curveProgress(eaten: number): number {
  'worklet';
  const t = eaten / APEX_EATEN;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
