import { PLAYER_START_SIZE } from './constants';
import { seedPond } from './enemies';
import {
  L_ACCUMULATOR,
  L_ALPHA,
  L_CAMERA_X,
  L_CAMERA_Y,
  L_ENEMY_COUNT,
  L_FLOOR_TOP_Y,
  L_SPAWN_TIMER,
  L_WORLD_WIDTH,
  resetPlayer,
} from './state';
import { computeCamera, computeWorldSize } from './world';

/**
 * Start a run from scratch.
 *
 * Everything is a buffer write: the pool is emptied by zeroing a count, not by
 * freeing anything, and the player is rewritten in place. Nothing remounts and
 * nothing allocates, which is what lets Retry restart instantly rather than
 * rebuilding a scene.
 *
 * The player starts at the centre of the swimmable world, and the pond is
 * stocked within the viewport that centring implies, not across the whole
 * (now much larger) world: fish outside what the camera can show at the start
 * would just be wasted pool slots until the player swims far enough to reach
 * them.
 */
export function startRun(
  player: Float32Array,
  pool: Float32Array,
  loop: Float32Array,
  rng: Uint32Array,
  screenW: number,
  screenH: number,
): void {
  'worklet';
  loop[L_ENEMY_COUNT] = 0;
  loop[L_SPAWN_TIMER] = 0;
  loop[L_ACCUMULATOR] = 0;
  loop[L_ALPHA] = 0;

  computeWorldSize(loop, screenW, screenH);
  const startX = loop[L_WORLD_WIDTH] * 0.5;
  const startY = loop[L_FLOOR_TOP_Y] * 0.5;
  resetPlayer(player, startX, startY, PLAYER_START_SIZE);

  computeCamera(loop, startX, startY, screenW, screenH);
  const camX = loop[L_CAMERA_X];
  const camY = loop[L_CAMERA_Y];
  seedPond(pool, loop, player, rng, camX, camX + screenW, camY, camY + screenH);
}
