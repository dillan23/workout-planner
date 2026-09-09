import type { SkCanvas, SkPaint } from '@shopify/react-native-skia';

import { TENTACLE_ATTACH_X, TENTACLE_ATTACH_Y, type JellyfishPaths } from './jellyfishPaths';
import type { Palette } from './palette';

/** Peak sway of a tentacle, in degrees either side of hanging straight. */
const TENTACLE_SWAY_DEG = 9;

/**
 * Draw one jellyfish.
 *
 * There is no facing and no flip: the bell and its tentacles are symmetric, so
 * unlike `drawFish` this never mirrors its x-scale. The only motion beyond the
 * entity's own bob is a slow, per-tentacle rotation about its attachment point
 * on the bell, offset so the three do not swing in lockstep.
 */
export function drawJellyfish(
  canvas: SkCanvas,
  paths: JellyfishPaths,
  paint: SkPaint,
  palette: Palette,
  x: number,
  y: number,
  length: number,
  phase: number,
): void {
  'worklet';
  canvas.save();
  canvas.translate(x, y);
  canvas.scale(length, length);

  paint.setColor(palette.jellyDark);
  for (let i = 0; i < paths.tentacles.length; i++) {
    canvas.save();
    canvas.rotate(
      Math.sin(phase * 1.3 + i * 2.1) * TENTACLE_SWAY_DEG,
      TENTACLE_ATTACH_X[i],
      TENTACLE_ATTACH_Y,
    );
    canvas.drawPath(paths.tentacles[i], paint);
    canvas.restore();
  }

  paint.setColor(palette.jelly);
  canvas.drawPath(paths.bell, paint);

  canvas.restore();
}
