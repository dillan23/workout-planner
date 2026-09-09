import { Skia, type SkCanvas, type SkPaint, type SkPath } from '@shopify/react-native-skia';

import type { Palette } from './palette';

/** Fixed, evenly-spread positions for the floor's decoration, as fractions of
 * world width. The floor never animates, so there is nothing to randomise. */
const ROCK_AT = [0.06, 0.34, 0.61, 0.9];
const BLADE_AT = [0.16, 0.22, 0.46, 0.73, 0.79, 0.95];

export interface OceanFloorPaths {
  /** The sand itself: a wavy ridge line, unit space (0..1, 0..1), filled down. */
  readonly sand: SkPath;
  /** One reusable blade of seaweed, unit space, rooted at (0, 0) and rising to
   * (0, -1). Placed at several positions and scales rather than built per spot. */
  readonly blade: SkPath;
}

export function makeOceanFloorPaths(): OceanFloorPaths {
  const sand = Skia.PathBuilder.Make()
    .moveTo(0, 0.16)
    .quadTo(0.1, 0.34, 0.2, 0.13)
    .quadTo(0.32, 0.32, 0.43, 0.11)
    .quadTo(0.55, 0.32, 0.66, 0.15)
    .quadTo(0.78, 0.32, 0.89, 0.11)
    .quadTo(0.96, 0.24, 1, 0.16)
    .lineTo(1, 1)
    .lineTo(0, 1)
    .close()
    .detach();

  const blade = Skia.PathBuilder.Make()
    .moveTo(0, 0)
    .quadTo(0.09, -0.55, 0, -1)
    .quadTo(-0.09, -0.55, 0, 0)
    .close()
    .detach();

  return { sand, blade };
}

/**
 * The seabed at the bottom of the world, and the reason the world has a
 * bottom at all rather than just an arbitrary wall.
 *
 * Drawn from one static ridge path and one reusable blade, scaled and placed
 * rather than rebuilt, so it costs a fixed, small number of draw calls
 * regardless of how wide the world turns out to be on a given device.
 */
export function drawOceanFloor(
  canvas: SkCanvas,
  paint: SkPaint,
  paths: OceanFloorPaths,
  palette: Palette,
  worldWidth: number,
  worldHeight: number,
  floorTopY: number,
): void {
  'worklet';
  const bandHeight = worldHeight - floorTopY;

  paint.setColor(palette.sand);
  canvas.save();
  canvas.translate(0, floorTopY);
  canvas.scale(worldWidth, bandHeight);
  canvas.drawPath(paths.sand, paint);
  canvas.restore();

  // A shadow along the ridge, so the sand reads as a solid form rather than a
  // flat stripe. Reuses the same path, sunk and squashed slightly.
  paint.setColor(palette.sandShadow);
  canvas.save();
  canvas.translate(0, floorTopY + bandHeight * 0.1);
  canvas.scale(worldWidth, bandHeight * 0.5);
  canvas.drawPath(paths.sand, paint);
  canvas.restore();

  const rockRadius = bandHeight * 0.22;
  paint.setColor(palette.rock);
  for (const at of ROCK_AT) {
    const cx = at * worldWidth;
    const cy = floorTopY + bandHeight * 0.22;
    canvas.save();
    canvas.translate(cx, cy);
    canvas.scale(1, 0.7);
    canvas.drawCircle(0, 0, rockRadius, paint);
    canvas.restore();
  }

  paint.setColor(palette.plant);
  const bladeHeight = bandHeight * 1.8;
  for (let i = 0; i < BLADE_AT.length; i++) {
    const cx = BLADE_AT[i] * worldWidth;
    const cy = floorTopY + bandHeight * 0.2;
    const lean = i % 2 === 0 ? 10 : -10;
    canvas.save();
    canvas.translate(cx, cy);
    canvas.rotate(lean, 0, 0);
    canvas.scale(bladeHeight * 0.22, bladeHeight);
    canvas.drawPath(paths.blade, paint);
    canvas.restore();
  }
}
