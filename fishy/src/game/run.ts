import { PLAYER_START_SIZE } from './constants';
import { seedPond } from './enemies';
import { L_ACCUMULATOR, L_ALPHA, L_ENEMY_COUNT, L_SPAWN_TIMER, resetPlayer } from './state';

/**
 * Start a run from scratch.
 *
 * Everything is a buffer write: the pool is emptied by zeroing a count, not by
 * freeing anything, and the player is rewritten in place. Nothing remounts and
 * nothing allocates, which is what lets Retry restart instantly rather than
 * rebuilding a scene.
 */
export function startRun(
  player: Float32Array,
  pool: Float32Array,
  loop: Float32Array,
  rng: Uint32Array,
  worldW: number,
  worldH: number,
): void {
  'worklet';
  loop[L_ENEMY_COUNT] = 0;
  loop[L_SPAWN_TIMER] = 0;
  loop[L_ACCUMULATOR] = 0;
  loop[L_ALPHA] = 0;
  resetPlayer(player, worldW * 0.5, worldH * 0.5, PLAYER_START_SIZE);
  seedPond(pool, loop, player, rng, worldW, worldH);
}
