import { PLAYER_BASE_LENGTH_PX, SCORE_PER_FISH } from './constants';
import { BODY_OFFSET_X, BODY_RX, BODY_RY } from './fishGeometry';
import {
  E_FIELDS,
  E_SIZE,
  E_VX,
  E_X,
  E_Y,
  L_ENEMY_COUNT,
  P_ALIVE,
  P_EATEN,
  P_FACING,
  P_SCORE,
  P_SIZE,
  P_X,
  P_Y,
} from './state';

/**
 * Do two fish bodies overlap?
 *
 * The test is against the body ellipse from `fishGeometry`, not a bounding box,
 * so a clipped tail or a brushed dorsal fin is the near miss it looks like.
 *
 * Summing the two ellipses' radii is usually only an approximation, but here it
 * is exact. Every fish in the game is the same silhouette scaled, so all body
 * ellipses share one aspect ratio; scale the plane by that ratio and both become
 * circles, whose Minkowski sum is a circle of the summed radii, which maps back
 * to precisely the ellipse this tests. Drawing every fish from one path buys
 * exact collision for four multiplies.
 */
export function bodiesOverlap(
  ax: number,
  ay: number,
  aLength: number,
  aFacing: number,
  bx: number,
  by: number,
  bLength: number,
  bFacing: number,
): boolean {
  'worklet';
  const acx = ax + aFacing * BODY_OFFSET_X * aLength;
  const bcx = bx + bFacing * BODY_OFFSET_X * bLength;
  const sum = aLength + bLength;
  const dx = (bcx - acx) / (BODY_RX * sum);
  const dy = (by - ay) / (BODY_RY * sum);
  return dx * dx + dy * dy <= 1;
}

/**
 * Settle everything the player is touching this step.
 *
 * Lethal contacts are resolved first, across the whole pool, before a single
 * fish is eaten. Order matters: eating grows the player, and a single pass
 * would let them swallow a minnow to outgrow the shark they were already inside
 * of. Checking death first against the size they actually had means contact
 * with something bigger is always fatal, whatever else they touched.
 *
 * Returns the number of fish eaten, so the caller can drive sound and haptics
 * without re-scanning.
 */
export function resolveCollisions(p: Float32Array, pool: Float32Array, loop: Float32Array): number {
  'worklet';
  if (p[P_ALIVE] === 0) {
    return 0;
  }

  const playerSize = p[P_SIZE];
  const playerLength = playerSize * PLAYER_BASE_LENGTH_PX;
  const px = p[P_X];
  const py = p[P_Y];
  const facing = p[P_FACING];

  for (let i = loop[L_ENEMY_COUNT] - 1; i >= 0; i--) {
    const base = i * E_FIELDS;
    const size = pool[base + E_SIZE];
    if (size < playerSize) {
      continue;
    }
    const length = size * PLAYER_BASE_LENGTH_PX;
    if (
      bodiesOverlap(
        px,
        py,
        playerLength,
        facing,
        pool[base + E_X],
        pool[base + E_Y],
        length,
        pool[base + E_VX] > 0 ? 1 : -1,
      )
    ) {
      p[P_ALIVE] = 0;
      return 0;
    }
  }

  let eaten = 0;
  for (let i = loop[L_ENEMY_COUNT] - 1; i >= 0; i--) {
    const base = i * E_FIELDS;
    const size = pool[base + E_SIZE];
    if (size >= playerSize) {
      continue;
    }
    const length = size * PLAYER_BASE_LENGTH_PX;
    if (
      !bodiesOverlap(
        px,
        py,
        playerLength,
        facing,
        pool[base + E_X],
        pool[base + E_Y],
        length,
        pool[base + E_VX] > 0 ? 1 : -1,
      )
    ) {
      continue;
    }

    // Worth more the closer it was to the player's own size, so the fish you
    // hesitated over is the one that pays.
    const relative = size / playerSize;
    p[P_SCORE] += Math.round(SCORE_PER_FISH * relative * relative);
    p[P_EATEN] += 1;
    eaten++;

    const last = loop[L_ENEMY_COUNT] - 1;
    if (i !== last) {
      const from = last * E_FIELDS;
      for (let f = 0; f < E_FIELDS; f++) {
        pool[base + f] = pool[from + f];
      }
    }
    loop[L_ENEMY_COUNT] = last;
  }

  return eaten;
}
