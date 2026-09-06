import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import type { SkSize } from '@shopify/react-native-skia';
import {
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { MAX_FRAME_TIME, PLAYER_START_SIZE, SIM_DT } from './constants';
import { seedPond, stepEnemies, stepSpawner } from './enemies';
import { stepPlayer } from './physics';
import { createRng } from './rng';
import {
  createEnemyPool,
  createInputState,
  createLoopState,
  createPlayerState,
  L_ACCUMULATOR,
  L_ALPHA,
  P_SIZE,
  P_SPAWNED,
  resetPlayer,
} from './state';

export interface GameLoop {
  readonly player: SharedValue<Float32Array>;
  readonly enemies: SharedValue<Float32Array>;
  readonly input: SharedValue<Float32Array>;
  readonly loop: SharedValue<Float32Array>;
  /** Bumped once per rendered frame, after the simulation has advanced. The
   * renderer derives from this, which guarantees it never draws a half-stepped
   * world. */
  readonly tick: SharedValue<number>;
}

/**
 * The frame loop: fixed timestep simulation, interpolated rendering.
 *
 * Real elapsed time goes into an accumulator and is drained in whole SIM_DT
 * steps, so the physics sees an identical dt on a 60Hz phone, a 120Hz phone and
 * a phone dropping frames. Whatever time is left over becomes `alpha`, and the
 * renderer interpolates between the last two steps with it, so a fixed 120Hz
 * simulation still looks perfectly smooth at any refresh rate.
 *
 * Everything here runs on the UI thread. The JS thread is not involved in a
 * frame at all.
 */
export function useGameLoop(size: SharedValue<SkSize>): GameLoop {
  const player = useSharedValue(useMemo(createPlayerState, []));
  const enemies = useSharedValue(useMemo(createEnemyPool, []));
  const input = useSharedValue(useMemo(createInputState, []));
  const loop = useSharedValue(useMemo(createLoopState, []));
  const rng = useSharedValue(useMemo(() => createRng(0x5eed_f15e), []));
  const tick = useSharedValue(0);

  // Scalar, because a typed array handed to the UI thread is a *copy*: writing
  // to `loop.value[...]` from here would change the JS-side array and the
  // simulation would never see it. Scalars propagate both ways.
  const timingReset = useSharedValue(0);

  const frameCallback = useFrameCallback((frameInfo) => {
    'worklet';
    const { width, height } = size.value;
    if (width <= 0 || height <= 0) {
      return;
    }

    const p = player.value;
    const l = loop.value;
    const pool = enemies.value;
    const seed = rng.value;

    if (p[P_SPAWNED] === 0) {
      resetPlayer(p, width * 0.5, height * 0.5, PLAYER_START_SIZE);
      seedPond(pool, l, p, seed, width, height);
    }

    let dt = (frameInfo.timeSincePreviousFrame ?? 0) / 1000;

    // First frame after resuming from the background reports the whole time the
    // app spent away. Swallow it so the fish picks up exactly where it left off.
    if (timingReset.value === 1) {
      dt = 0;
      timingReset.value = 0;
    }
    if (dt > MAX_FRAME_TIME) {
      dt = MAX_FRAME_TIME;
    }

    let accumulator = l[L_ACCUMULATOR] + dt;
    while (accumulator >= SIM_DT) {
      stepPlayer(p, input.value, SIM_DT, width, height);
      stepEnemies(pool, l, p[P_SIZE], SIM_DT, width);
      stepSpawner(pool, l, p, seed, SIM_DT, width, height);
      accumulator -= SIM_DT;
    }
    l[L_ACCUMULATOR] = accumulator;
    l[L_ALPHA] = accumulator / SIM_DT;

    tick.value = frameInfo.timeSinceFirstFrame;
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        timingReset.value = 1;
        frameCallback.setActive(true);
      } else {
        // Stop the loop outright rather than letting it free-run unseen. State
        // is untouched, so resuming continues the same run.
        frameCallback.setActive(false);
      }
    });
    return () => subscription.remove();
  }, [frameCallback, timingReset]);

  return { player, enemies, input, loop, tick };
}
