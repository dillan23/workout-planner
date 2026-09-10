import { Skia, type SkPath } from '@shopify/react-native-skia';

import { TAIL_PIVOT_X } from '../game/fishGeometry';

/**
 * The fish silhouette, as Skia paths in unit space.
 *
 * Unit space runs from x = -0.5 (tail tip) to x = +0.5 (nose), with y = 0 along
 * the spine, so a fish of any size is drawn by scaling this one set of paths.
 * Because they are real paths rather than raster art, a leviathan at 40x is as
 * crisp as a minnow at 1x, and there is exactly one silhouette to maintain.
 *
 * Built once and reused for every fish on screen; nothing here allocates
 * per frame.
 */
export interface FishPaths {
  readonly body: SkPath;
  readonly tail: SkPath;
  readonly dorsal: SkPath;
  readonly pectoral: SkPath;
}

export function makeFishPaths(): FishPaths {
  // Body: a teardrop, blunt at the nose and tapering to the tail joint.
  const body = Skia.PathBuilder.Make()
    .moveTo(0.5, 0)
    .cubicTo(0.34, -0.19, 0.06, -0.22, TAIL_PIVOT_X, -0.1)
    .lineTo(TAIL_PIVOT_X, 0.1)
    .cubicTo(0.06, 0.22, 0.34, 0.19, 0.5, 0)
    .close()
    .detach();

  // Caudal fin, hinged at TAIL_PIVOT_X with a concave trailing edge.
  const tail = Skia.PathBuilder.Make()
    .moveTo(TAIL_PIVOT_X, -0.08)
    .lineTo(-0.5, -0.23)
    .quadTo(-0.38, 0, -0.5, 0.23)
    .lineTo(TAIL_PIVOT_X, 0.08)
    .close()
    .detach();

  // Dorsal fin, swept back along the top of the body.
  const dorsal = Skia.PathBuilder.Make()
    .moveTo(0.1, -0.17)
    .quadTo(0.0, -0.34, -0.18, -0.29)
    .quadTo(-0.14, -0.19, -0.12, -0.15)
    .close()
    .detach();

  // Pectoral fin, low on the flank, gives the profile a sense of depth.
  const pectoral = Skia.PathBuilder.Make()
    .moveTo(0.16, 0.06)
    .quadTo(0.02, 0.26, -0.1, 0.18)
    .quadTo(-0.02, 0.12, 0.02, 0.07)
    .close()
    .detach();

  return { body, tail, dorsal, pectoral };
}
