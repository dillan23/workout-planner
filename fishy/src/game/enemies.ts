import {
  BASE_MAX_SPEED,
  ENEMY_SPEED_FRACTION,
  ENEMY_SPEED_SIZE_EXPONENT,
  ENEMY_TAIL_RATE,
  MAX_FISH,
  PLAYER_BASE_LENGTH_PX,
  SEED_FISH,
  SEED_PREDATOR_CLEARANCE,
  SPAWN_INTERVAL_MAX,
  SPAWN_INTERVAL_MIN,
  SPAWN_MAX_PER_ATTEMPT,
  SPAWN_TARGET_APEX,
  SPAWN_TARGET_START,
  SPEED_SIZE_EXPONENT,
  TAIL_WAG_HZ,
} from './constants';
import { SILHOUETTE_HALF_H, SILHOUETTE_HALF_W } from './fishGeometry';
import { curveProgress } from './growth';
import { nextFloat, nextRange } from './rng';
import {
  E_FIELDS,
  E_PREV_X,
  E_SIZE,
  E_TAIL_PHASE,
  E_TIER,
  E_VX,
  E_X,
  E_Y,
  L_ENEMY_COUNT,
  L_SPAWN_TIMER,
  P_EATEN,
  P_SIZE,
  P_X,
  P_Y,
} from './state';
import { FIRST_PREDATOR_TIER, pickTier, tierSizeMultiplier } from './tiers';

const TAU = Math.PI * 2;

/** Vertical band a fish of this length can occupy with its fins still on screen. */
function clampSpawnY(y: number, length: number, worldH: number): number {
  'worklet';
  const halfH = SILHOUETTE_HALF_H * length;
  if (halfH * 2 >= worldH) {
    return worldH * 0.5;
  }
  return y < halfH ? halfH : y > worldH - halfH ? worldH - halfH : y;
}

/**
 * Write one fish into a pool slot.
 *
 * Speed is derived from the player's top speed and the fish's size relative to
 * the player, so small fish are quick and large ones are slow, and neither ever
 * outruns the player.
 */
function writeFish(
  pool: Float32Array,
  slot: number,
  tier: number,
  size: number,
  playerSize: number,
  x: number,
  y: number,
  headingRight: boolean,
  rng: Uint32Array,
): void {
  'worklet';
  const base = slot * E_FIELDS;
  const playerMaxSpeed = BASE_MAX_SPEED * Math.pow(playerSize, SPEED_SIZE_EXPONENT);
  const relative = size / playerSize;
  const speed =
    (playerMaxSpeed * ENEMY_SPEED_FRACTION) / Math.pow(relative, ENEMY_SPEED_SIZE_EXPONENT);

  pool[base + E_X] = x;
  pool[base + E_PREV_X] = x;
  pool[base + E_Y] = y;
  pool[base + E_VX] = headingRight ? speed : -speed;
  pool[base + E_SIZE] = size;
  pool[base + E_TIER] = tier;
  // Random phase so a screen of fish does not beat in unison.
  pool[base + E_TAIL_PHASE] = nextFloat(rng) * TAU;
}

/**
 * Spawn one fish just off the left or right edge.
 *
 * A fish spawned fully off screen cannot overlap the player, who is clamped
 * inside the play area, so the "no predator ever spawns on top of you" rule is
 * structural here rather than a check that could be got wrong.
 */
export function spawnAtEdge(
  pool: Float32Array,
  loop: Float32Array,
  player: Float32Array,
  rng: Uint32Array,
  worldW: number,
  worldH: number,
): boolean {
  'worklet';
  const count = loop[L_ENEMY_COUNT];
  if (count >= MAX_FISH) {
    return false;
  }

  const playerSize = player[P_SIZE];
  const t = curveProgress(player[P_EATEN]);
  const tier = pickTier(rng, t);
  const size = playerSize * tierSizeMultiplier(rng, tier);
  const length = size * PLAYER_BASE_LENGTH_PX;
  const halfLength = SILHOUETTE_HALF_W * length;

  const headingRight = nextFloat(rng) < 0.5;
  const x = headingRight ? -halfLength : worldW + halfLength;
  const y = clampSpawnY(nextFloat(rng) * worldH, length, worldH);

  writeFish(pool, count, tier, size, playerSize, x, y, headingRight, rng);
  loop[L_ENEMY_COUNT] = count + 1;
  return true;
}

/**
 * Stock the pond before the first frame so a run does not open on empty water.
 *
 * These are the only fish placed inside the play area, and so the only ones that
 * could land on the player. Predators get a clearance check and are pushed to an
 * edge spawn if the pond is too crowded to place them fairly.
 */
export function seedPond(
  pool: Float32Array,
  loop: Float32Array,
  player: Float32Array,
  rng: Uint32Array,
  worldW: number,
  worldH: number,
): void {
  'worklet';
  const playerSize = player[P_SIZE];
  const playerLength = playerSize * PLAYER_BASE_LENGTH_PX;
  const t = curveProgress(player[P_EATEN]);

  for (let n = 0; n < SEED_FISH; n++) {
    const count = loop[L_ENEMY_COUNT];
    if (count >= MAX_FISH) {
      return;
    }

    const tier = pickTier(rng, t);
    const size = playerSize * tierSizeMultiplier(rng, tier);
    const length = size * PLAYER_BASE_LENGTH_PX;
    const y = clampSpawnY(nextFloat(rng) * worldH, length, worldH);

    let x = nextFloat(rng) * worldW;
    if (tier >= FIRST_PREDATOR_TIER) {
      // Keep a predator's body clear of where the player starts. Measured
      // between the two bodies, not their centres, so a long fish needs more
      // room than a short one.
      const clearance =
        (SILHOUETTE_HALF_W * length +
          SILHOUETTE_HALF_W * playerLength +
          SEED_PREDATOR_CLEARANCE * playerLength);
      let placed = false;
      for (let attempt = 0; attempt < 8 && !placed; attempt++) {
        if (Math.abs(x - player[P_X]) >= clearance || Math.abs(y - player[P_Y]) >= clearance) {
          placed = true;
        } else {
          x = nextFloat(rng) * worldW;
        }
      }
      if (!placed) {
        spawnAtEdge(pool, loop, player, rng, worldW, worldH);
        continue;
      }
    }

    writeFish(pool, count, tier, size, playerSize, x, y, nextFloat(rng) < 0.5, rng);
    loop[L_ENEMY_COUNT] = count + 1;
  }
}

/**
 * Advance every live fish by one step, retiring any that have crossed the pond.
 *
 * Despawning swaps the last live fish into the vacated slot, so the walk runs
 * backwards: a fish moved down into slot `i` has already been stepped this
 * frame and must not be stepped twice.
 */
export function stepEnemies(
  pool: Float32Array,
  loop: Float32Array,
  playerSize: number,
  dt: number,
  worldW: number,
): void {
  'worklet';
  const playerMaxSpeed = BASE_MAX_SPEED * Math.pow(playerSize, SPEED_SIZE_EXPONENT);

  for (let i = loop[L_ENEMY_COUNT] - 1; i >= 0; i--) {
    const base = i * E_FIELDS;
    const x = pool[base + E_X];
    const vx = pool[base + E_VX];

    pool[base + E_PREV_X] = x;
    const nextX = x + vx * dt;
    pool[base + E_X] = nextX;

    const halfLength = SILHOUETTE_HALF_W * pool[base + E_SIZE] * PLAYER_BASE_LENGTH_PX;
    const gone = vx > 0 ? nextX - halfLength > worldW : nextX + halfLength < 0;
    if (gone) {
      const last = loop[L_ENEMY_COUNT] - 1;
      if (i !== last) {
        const from = last * E_FIELDS;
        for (let f = 0; f < E_FIELDS; f++) {
          pool[base + f] = pool[from + f];
        }
      }
      loop[L_ENEMY_COUNT] = last;
      continue;
    }

    // Smaller fish beat their tails faster, which is most of what sells the
    // difference between a minnow and something that wants to eat you.
    const speedFraction = Math.abs(vx) / playerMaxSpeed;
    const beatRate = TAIL_WAG_HZ * ENEMY_TAIL_RATE * (0.5 + speedFraction);
    let phase = pool[base + E_TAIL_PHASE] + beatRate * TAU * dt;
    if (phase > TAU) {
      phase -= TAU;
    }
    pool[base + E_TAIL_PHASE] = phase;
  }
}

/** How many fish the pond should be holding at this point on the curve. */
export function spawnTarget(eaten: number): number {
  'worklet';
  const t = curveProgress(eaten);
  return SPAWN_TARGET_START + (SPAWN_TARGET_APEX - SPAWN_TARGET_START) * t;
}

/**
 * Run the spawn clock, topping the pond up toward its target population.
 *
 * Aiming at a population rather than metering a rate is what keeps the pond
 * equally busy at every size: it self-corrects for the fact that fish cross the
 * screen faster the larger the player gets.
 */
export function stepSpawner(
  pool: Float32Array,
  loop: Float32Array,
  player: Float32Array,
  rng: Uint32Array,
  dt: number,
  worldW: number,
  worldH: number,
): void {
  'worklet';
  loop[L_SPAWN_TIMER] -= dt;
  if (loop[L_SPAWN_TIMER] > 0) {
    return;
  }
  loop[L_SPAWN_TIMER] = nextRange(rng, SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX);

  const target = spawnTarget(player[P_EATEN]);
  for (let n = 0; n < SPAWN_MAX_PER_ATTEMPT; n++) {
    if (loop[L_ENEMY_COUNT] >= target) {
      return;
    }
    spawnAtEdge(pool, loop, player, rng, worldW, worldH);
  }
}
