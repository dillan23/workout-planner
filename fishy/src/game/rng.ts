/**
 * A seeded xorshift32 generator, with its state in a Uint32Array so it can live
 * on the UI thread and be advanced without allocating.
 *
 * The spawner is the one system whose behaviour is hard to reason about by
 * reading it: whether the pond stays populated, whether it ever fills with
 * nothing but predators, whether the mix really shifts as you grow. Seeding the
 * randomness makes all of that reproducible, so `npm run verify:physics` can
 * measure a thousand spawns and get the same answer every time.
 */
export function createRng(seed: number): Uint32Array {
  const state = new Uint32Array(1);
  // 0 is a fixed point of xorshift, so it must never be the seed.
  state[0] = seed >>> 0 || 0x9e3779b9;
  return state;
}

/** Next value in [0, 1). */
export function nextFloat(rng: Uint32Array): number {
  'worklet';
  let x = rng[0];
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;
  x >>>= 0;
  rng[0] = x;
  return x / 4294967296;
}

/** Next value in [min, max). */
export function nextRange(rng: Uint32Array, min: number, max: number): number {
  'worklet';
  return min + nextFloat(rng) * (max - min);
}
