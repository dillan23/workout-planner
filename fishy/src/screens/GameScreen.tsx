import { Canvas, Picture, createPicture, useClock } from '@shopify/react-native-skia';
import type { SkSize } from '@shopify/react-native-skia';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';

import {
  PLAYER_BASE_LENGTH_PX,
  PLAYER_START_SIZE,
  TAIL_WAG_DEG,
  TAIL_WAG_HZ,
} from '../game/constants';
import { drawOcean } from '../render/background';
import { drawFish } from '../render/drawFish';
import { useRenderAssets } from '../render/useRenderAssets';

const TAU = Math.PI * 2;

/**
 * The pond.
 *
 * The entire frame is one Skia picture rebuilt on the UI thread from a
 * Reanimated derived value. No React state is involved, so nothing here can
 * trigger a re-render: the component mounts once and the canvas animates
 * independently of the JS thread from then on.
 */
export function GameScreen() {
  const { height } = useWindowDimensions();
  const assets = useRenderAssets(height);
  const clock = useClock();

  // Authoritative play-area size, written by Skia on the UI thread. `onLayout`
  // is deprecated on Fabric; `onSize` gives the same measurement without a
  // round trip through React.
  const size = useSharedValue<SkSize>({ width: 0, height: 0 });

  const picture = useDerivedValue(() => {
    const { width: w, height: h } = size.value;
    const seconds = clock.value / 1000;

    return createPicture((canvas) => {
      if (w <= 0 || h <= 0) {
        return;
      }
      drawOcean(canvas, assets.ocean);

      const tailAngle = Math.sin(seconds * TAIL_WAG_HZ * TAU) * TAIL_WAG_DEG;
      drawFish(
        canvas,
        assets.paths,
        assets.paints,
        assets.palette.player,
        w / 2,
        h / 2,
        PLAYER_START_SIZE * PLAYER_BASE_LENGTH_PX,
        1,
        tailAngle,
      );
    }, size.value);
  });

  return (
    <Canvas style={styles.canvas} onSize={size} opaque>
      <Picture picture={picture} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
});
