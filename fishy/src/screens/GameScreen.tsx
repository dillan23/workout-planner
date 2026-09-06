import { Canvas, Picture, createPicture } from '@shopify/react-native-skia';
import type { SkSize } from '@shopify/react-native-skia';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';

import { PLAYER_BASE_LENGTH_PX, TAIL_WAG_DEG } from '../game/constants';
import { useGameLoop } from '../game/useGameLoop';
import { usePlayerInput } from '../game/usePlayerInput';
import {
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
import { useRenderAssets } from '../render/useRenderAssets';

/**
 * The pond.
 *
 * The whole frame is one Skia picture rebuilt on the UI thread. It derives from
 * the loop's tick, which is bumped only after the simulation has finished
 * advancing, so a frame can never show a partly stepped world. No React state
 * takes part, so gameplay cannot trigger a re-render.
 */
export function GameScreen() {
  const { height } = useWindowDimensions();
  const assets = useRenderAssets(height);

  // Authoritative play-area size, written by Skia on the UI thread. `onLayout`
  // is deprecated on Fabric; `onSize` avoids the round trip through React.
  const size = useSharedValue<SkSize>({ width: 0, height: 0 });

  const game = useGameLoop(size);
  const pan = usePlayerInput(game.input);

  const picture = useDerivedValue(() => {
    // Reanimated subscribes this picture to every shared value reachable from
    // the closure, and `tick` is the only one the loop ever assigns (the state
    // buffers are mutated in place, which fires no listeners). So bumping the
    // tick after the simulation settles is precisely what schedules a redraw.
    const { width: w, height: h } = size.value;
    const p = game.player.value;
    const pool = game.enemies.value;
    const l = game.loop.value;
    const alpha = l[L_ALPHA];
    const enemyCount = l[L_ENEMY_COUNT];

    return createPicture((canvas) => {
      if (w <= 0 || h <= 0) {
        return;
      }
      drawOcean(canvas, assets.ocean);

      if (p[P_SPAWNED] === 0) {
        return;
      }

      // Enemies first, so the player always reads on top of the shoal.
      for (let i = 0; i < enemyCount; i++) {
        const base = i * E_FIELDS;
        const ex = pool[base + E_PREV_X] + (pool[base + E_X] - pool[base + E_PREV_X]) * alpha;
        const vx = pool[base + E_VX];
        drawFish(
          canvas,
          assets.paths,
          assets.paints,
          assets.palette.tiers[pool[base + E_TIER]],
          ex,
          pool[base + E_Y],
          pool[base + E_SIZE] * PLAYER_BASE_LENGTH_PX,
          vx > 0 ? 1 : -1,
          Math.sin(pool[base + E_TAIL_PHASE]) * TAIL_WAG_DEG,
        );
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
