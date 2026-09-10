import { Skia, type SkPath } from '@shopify/react-native-skia';

/** Where each tentacle attaches to the bell, in unit space (its x, at the
 * bell's underside). Shared with drawJellyfish, which rotates each tentacle
 * about this exact point rather than about its own centre. */
export const TENTACLE_ATTACH_X: readonly number[] = [-0.16, 0, 0.16];
export const TENTACLE_ATTACH_Y = 0.06;

export interface JellyfishPaths {
  readonly bell: SkPath;
  readonly tentacles: readonly SkPath[];
}

/**
 * The jellyfish silhouette, as Skia paths in unit space, built once and reused
 * exactly like the fish paths in `fishPaths.ts`.
 *
 * Unlike a fish, a jellyfish has no facing: it is drawn the same whichever way
 * it happens to be drifting, and the only motion is the gentle sway added to
 * its tentacles at draw time.
 */
export function makeJellyfishPaths(): JellyfishPaths {
  const bell = Skia.PathBuilder.Make()
    .moveTo(-0.42, 0.06)
    .quadTo(-0.46, -0.32, 0, -0.4)
    .quadTo(0.46, -0.32, 0.42, 0.06)
    .quadTo(0.24, -0.02, 0.14, 0.08)
    .quadTo(0.05, -0.02, -0.05, 0.08)
    .quadTo(-0.14, -0.02, -0.24, 0.08)
    .quadTo(-0.34, -0.02, -0.42, 0.06)
    .close()
    .detach();

  const tentacles = TENTACLE_ATTACH_X.map((x) =>
    Skia.PathBuilder.Make()
      .moveTo(x - 0.025, TENTACLE_ATTACH_Y)
      .quadTo(x + 0.07, 0.3, x - 0.03, 0.55)
      .lineTo(x + 0.02, 0.55)
      .quadTo(x - 0.06, 0.3, x + 0.025, TENTACLE_ATTACH_Y)
      .close()
      .detach(),
  );

  return { bell, tentacles };
}
