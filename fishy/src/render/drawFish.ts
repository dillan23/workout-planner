import type { SkCanvas, SkPaint } from '@shopify/react-native-skia';

import { TAIL_PIVOT_X } from '../game/fishGeometry';
import type { FishPaths } from './fishPaths';
import type { FishSkin } from './palette';

const EYE_X = 0.33;
const EYE_Y = -0.055;
const EYE_R = 0.035;

/** Paints reused for every fish. Colours are set per draw, never allocated. */
export interface FishPaints {
  readonly fill: SkPaint;
  readonly eye: SkPaint;
}

/**
 * Draw one fish.
 *
 * Runs on the UI thread inside the picture callback. The unit-space paths are
 * scaled into place by the canvas matrix rather than rebuilt, and the two
 * paints are recoloured in place, so a full screen of fish costs zero
 * allocations per frame.
 *
 * @param facing  +1 swimming right, -1 swimming left. Applied as a negative
 *                x-scale, which mirrors the whole silhouette including its fins.
 * @param tailAngle Tail deflection in degrees, hinged at the body joint.
 */
export function drawFish(
  canvas: SkCanvas,
  paths: FishPaths,
  paints: FishPaints,
  skin: FishSkin,
  x: number,
  y: number,
  length: number,
  facing: number,
  tailAngle: number,
): void {
  'worklet';
  canvas.save();
  canvas.translate(x, y);
  canvas.scale(length * facing, length);

  const { fill } = paints;

  // Fins first, so the body overlaps them and hides the joins.
  fill.setColor(skin.fin);
  canvas.save();
  canvas.rotate(tailAngle, TAIL_PIVOT_X, 0);
  canvas.drawPath(paths.tail, fill);
  canvas.restore();
  canvas.drawPath(paths.dorsal, fill);
  canvas.drawPath(paths.pectoral, fill);

  fill.setColor(skin.body);
  canvas.drawPath(paths.body, fill);

  canvas.drawCircle(EYE_X, EYE_Y, EYE_R, paints.eye);

  canvas.restore();
}
