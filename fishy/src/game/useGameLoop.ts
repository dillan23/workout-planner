import { useCallback, useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import type { SkSize } from '@shopify/react-native-skia';
import {
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { MAX_FRAME_TIME, SIM_DT } from './constants';
import { resolveCollisions } from './collision';
import { stepEnemies, stepSpawner } from './enemies';
import { stepPlayer } from './physics';
import { createRng } from './rng';
import { startRun } from './run';
import { useFrameMeter, type FrameMeter } from './useFrameMeter';
import {
  createEnemyPool,
  createInputState,
  createLoopState,
  createPlayerState,
  L_ACCUMULATOR,
  L_ALPHA,
  P_ALIVE,
  P_EATEN,
  P_SCORE,
  P_SIZE,
  P_SPAWNED,
} from './state';

/** The pond is alive but nobody is playing: the attract state behind the title
 * and settings screens. */
export const RUN_ATTRACT = 0;
export const RUN_PLAYING = 1;
export const RUN_DEAD = 2;

export interface GameLoop {
  readonly player: SharedValue<Float32Array>;
  readonly enemies: SharedValue<Float32Array>;
  readonly input: SharedValue<Float32Array>;
  readonly loop: SharedValue<Float32Array>;
  /** Bumped once per rendered frame, after the simulation has advanced. The
   * renderer derives from this, which guarantees it never draws a half-stepped
   * world. */
  readonly tick: SharedValue<number>;
  /** RUN_ATTRACT, RUN_PLAYING or RUN_DEAD. */
  readonly runState: SharedValue<number>;
  /** Mirrors of the run's counters, written only when they change, so the HUD
   * updates without the frame loop touching React. */
  readonly eaten: SharedValue<number>;
  readonly score: SharedValue<number>;
  /** Begin a fresh run. Buffer writes only: nothing remounts. */
  readonly begin: () => void;
  /** Pause and resume the simulation without disturbing it. */
  readonly setPaused: (paused: boolean) => void;
  /** Rolling frame rate and worst frame, for the performance pass. */
  readonly meter: FrameMeter;
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
  const runState = useSharedValue(RUN_ATTRACT);
  const eaten = useSharedValue(0);
  const score = useSharedValue(0);
  const paused = useSharedValue(0);
  const restartRequested = useSharedValue(0);
  const meter = useFrameMeter();

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
    if (paused.value === 1) {
      return;
    }

    const p = player.value;
    const l = loop.value;
    const pool = enemies.value;
    const seed = rng.value;

    if (p[P_SPAWNED] === 0 || restartRequested.value === 1) {
      restartRequested.value = 0;
      startRun(p, pool, l, seed, width, height);
      eaten.value = 0;
      score.value = 0;
    }

    const frameMs = frameInfo.timeSincePreviousFrame ?? 0;
    meter.sample(frameMs);

    let dt = frameMs / 1000;

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
      // The pond keeps swimming after a death, so the game over screen has a
      // living backdrop rather than a frozen frame.
      const live = runState.value === RUN_PLAYING && p[P_ALIVE] === 1;
      if (live) {
        stepPlayer(p, input.value, SIM_DT, width, height);
      }
      stepEnemies(pool, l, p[P_SIZE], SIM_DT, width);
      stepSpawner(pool, l, p, seed, SIM_DT, width, height);
      if (live) {
        // Counters are mirrored into shared values only when they move, so the
        // HUD costs nothing on the frames where nothing was eaten.
        if (resolveCollisions(p, pool, l) > 0) {
          eaten.value = p[P_EATEN];
          score.value = p[P_SCORE];
        }
        if (p[P_ALIVE] === 0) {
          runState.value = RUN_DEAD;
        }
      }
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

  const begin = useCallback(() => {
    restartRequested.value = 1;
    runState.value = RUN_PLAYING;
  }, [restartRequested, runState]);

  const setPaused = useCallback(
    (next: boolean) => {
      // Swallow the gap on resume, exactly as backgrounding does, so a paused
      // game picks up where it left off instead of stepping through the pause.
      if (!next) {
        timingReset.value = 1;
      }
      paused.value = next ? 1 : 0;
    },
    [paused, timingReset],
  );

  return {
    player,
    enemies,
    input,
    loop,
    tick,
    runState,
    eaten,
    score,
    begin,
    setPaused,
    meter,
  };
}
