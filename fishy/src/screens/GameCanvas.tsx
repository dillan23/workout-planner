import { Canvas, Picture, createPicture } from '@shopify/react-native-skia';
import type { SkSize } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { PLAYER_BASE_LENGTH_PX, TAIL_WAG_DEG } from '../game/constants';
import { RUN_ATTRACT, type GameLoop } from '../game/useGameLoop';
import { usePlayerInput } from '../game/usePlayerInput';
import {
  CONTROL_JOYSTICK,
  E_FIELDS,
  E_PREV_X,
  E_SIZE,
  E_TAIL_PHASE,
  E_TIER,
  E_VX,
  E_X,
  E_Y,
  L_ALPHA,
  L_ENEMY_COUNT,
  P_FACING,
  P_PREV_X,
  P_PREV_Y,
  P_SIZE,
  P_SPAWNED,
  P_TAIL_PHASE,
  P_X,
  P_Y,
} from '../game/state';
import { drawOcean } from '../render/background';
import { drawFish } from '../render/drawFish';
import { drawJoystick } from '../render/drawJoystick';
import { useRenderAssets } from '../render/useRenderAssets';

/**
 * The pond, and the only thing on screen that never unmounts.
 *
 * Every screen in the game is an overlay above this canvas, which is what makes
 * Retry instant: a new run is a handful of buffer writes, so there is no scene
 * to rebuild and nothing flashes.
 *
 * The whole frame is one Skia picture rebuilt on the UI thread, derived from
 * the loop's tick, which is bumped only after the simulation has finished
 * advancing. No React state takes part.
 */
export function GameCanvas({
  game,
  size,
  screenHeight,
  scheme,
}: {
  game: GameLoop;
  size: SharedValue<SkSize>;
  screenHeight: number;
  scheme: number;
}) {
  const assets = useRenderAssets(screenHeight);
  const pan = usePlayerInput(game.input, scheme);

  const picture = useDerivedValue(() => {
    // Reanimated subscribes this picture to every shared value reachable from
    // the closure, and `tick` is the only one the loop ever assigns (the state
    // buffers are mutated in place, which fires no listeners). So bumping the
    // tick after the simulation settles is precisely what schedules a redraw.
    const { width: w, height: h } = size.value;
    const p = game.player.value;
    const pool = game.enemies.value;
    const input = game.input.value;
    const l = game.loop.value;
    const alpha = l[L_ALPHA];
    const enemyCount = l[L_ENEMY_COUNT];
    const attract = game.runState.value === RUN_ATTRACT;

    return createPicture((canvas) => {
      if (w <= 0 || h <= 0) {
        return;
      }
      drawOcean(canvas, assets.ocean);

      // Enemies first, so the player always reads on top of the shoal.
      for (let i = 0; i < enemyCount; i++) {
        const base = i * E_FIELDS;
        const ex = pool[base + E_PREV_X] + (pool[base + E_X] - pool[base + E_PREV_X]) * alpha;
        drawFish(
          canvas,
          assets.paths,
          assets.paints,
          assets.palette.tiers[pool[base + E_TIER]],
          ex,
          pool[base + E_Y],
          pool[base + E_SIZE] * PLAYER_BASE_LENGTH_PX,
          pool[base + E_VX] > 0 ? 1 : -1,
          Math.sin(pool[base + E_TAIL_PHASE]) * TAIL_WAG_DEG,
        );
      }

      // On the title and settings screens the pond swims on without a player.
      if (attract || p[P_SPAWNED] === 0) {
        return;
      }

      // Interpolate between the last two simulation steps so a fixed 120Hz
      // simulation reads as smooth at whatever rate the display runs.
      const x = p[P_PREV_X] + (p[P_X] - p[P_PREV_X]) * alpha;
      const y = p[P_PREV_Y] + (p[P_Y] - p[P_PREV_Y]) * alpha;

      drawFish(
        canvas,
        assets.paths,
        assets.paints,
        assets.palette.player,
        x,
        y,
        p[P_SIZE] * PLAYER_BASE_LENGTH_PX,
        p[P_FACING],
        Math.sin(p[P_TAIL_PHASE]) * TAIL_WAG_DEG,
      );

      if (scheme === CONTROL_JOYSTICK) {
        drawJoystick(canvas, assets.paints.fill, assets.palette, input);
      }
    }, size.value);
  });

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.root}>
        <Canvas style={styles.canvas} onSize={size} opaque>
          <Picture picture={picture} />
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  canvas: { flex: 1 },
});
