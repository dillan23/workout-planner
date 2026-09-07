import { Skia, type SkCanvas, type SkPaint, type SkPath } from '@shopify/react-native-skia';

import type { Palette } from './palette';

/**
 * The two background layers: drifting bubbles and slow shafts of light.
 *
 * Both are pure functions of the clock. A bubble's position is computed from
 * its index and the time, so there is no pool to update, nothing to spawn or
 * retire, and not a single allocation per frame. It also means the background
 * costs nothing when the game is paused and resumes in exactly the right place.
 *
 * Kept deliberately faint. The original's readability came from a nearly empty
 * pond, and every extra shape on screen is a moment the player spends deciding
 * whether it can eat them.
 */
const NEAR_BUBBLES = 9;
const FAR_BUBBLES = 14;

/** Rise time, in seconds, for one bubble to cross the screen. Far bubbles take
 * longer, which is the whole of the parallax. */
const NEAR_RISE = 9;
const FAR_RISE = 17;

const RAYS = 3;
/** Seconds for one full sway of the light shafts. */
const RAY_SWAY = 26;

/**
 * Deterministic spread in [0, 1) from an index. Cheap hash rather than a seeded
 * generator: it has to give the same answer every frame, for the same bubble,
 * without storing anything.
 */
function spread(i: number, salt: number): number {
  'worklet';
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function drawBubbleLayer(
  canvas: SkCanvas,
  paint: SkPaint,
  count: number,
  rise: number,
  salt: number,
  radiusMin: number,
  radiusSpan: number,
  seconds: number,
  width: number,
  height: number,
): void {
  'worklet';
  for (let i = 0; i < count; i++) {
    const lane = spread(i, salt);
    const phase = spread(i, salt + 1);
    const wobble = spread(i, salt + 2);

    // Rise from below the bottom edge to above the top, wrapping seamlessly.
    const progress = (seconds / rise + phase) % 1;
    const y = height + radiusMin - progress * (height + radiusMin * 4);
    // A gentle sideways drift, so they do not read as falling straight up.
    const x = lane * width + Math.sin(seconds * 0.6 + wobble * 6.283) * 9;
    canvas.drawCircle(x, y, radiusMin + wobble * radiusSpan, paint);
  }
}

/**
 * A light shaft as one unit trapezoid: the top edge spans x = 0 to 1 at y = 0,
 * and it widens and leans as it descends to y = 1.
 *
 * Built once and placed with canvas transforms, exactly as the fish are. The
 * earlier version rewound and refilled a path every frame, which both used a
 * deprecated API and did per-frame work for a shape that never actually
 * changes.
 */
export function makeRayPath(): SkPath {
  return Skia.PathBuilder.Make()
    .moveTo(0, 0)
    .lineTo(1, 0)
    .lineTo(3.2, 1)
    .lineTo(1.6, 1)
    .close()
    .detach();
}

export function drawParallax(
  canvas: SkCanvas,
  paint: SkPaint,
  rayPath: SkPath,
  palette: Palette,
  seconds: number,
  width: number,
  height: number,
): void {
  'worklet';
  paint.setColor(palette.lightRay);
  for (let i = 0; i < RAYS; i++) {
    const base = spread(i, 31) * width;
    const sway = Math.sin((seconds / RAY_SWAY + spread(i, 32)) * 6.283) * width * 0.09;
    const topWidth = width * (0.06 + spread(i, 33) * 0.05);
    canvas.save();
    canvas.translate(base + sway, -10);
    canvas.scale(topWidth, height + 20);
    canvas.drawPath(rayPath, paint);
    canvas.restore();
  }

  paint.setColor(palette.bubbleFar);
  drawBubbleLayer(canvas, paint, FAR_BUBBLES, FAR_RISE, 7, 1.4, 1.6, seconds, width, height);
  paint.setColor(palette.bubbleNear);
  drawBubbleLayer(canvas, paint, NEAR_BUBBLES, NEAR_RISE, 3, 2.4, 3.2, seconds, width, height);
}
