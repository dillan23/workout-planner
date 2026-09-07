import { useMemo } from 'react';
import { Skia } from '@shopify/react-native-skia';

import { makeOceanPaint } from './background';
import { makeRayPath } from './parallax';
import { makeFishPaths, type FishPaths } from './fishPaths';
import type { FishPaints } from './drawFish';
import { makePalette, type Palette } from './palette';
import type { SkPath } from '@shopify/react-native-skia';

export interface RenderAssets {
  readonly paths: FishPaths;
  readonly paints: FishPaints;
  readonly palette: Palette;
  readonly ocean: ReturnType<typeof makeOceanPaint>;
  /** Reused by the light shafts, which rewind it each frame rather than
   * building a new path. */
  readonly rayPath: SkPath;
}

/**
 * Every Skia object the renderer will ever need, built once.
 *
 * Nothing in here is rebuilt while a run is in progress, so the frame loop only
 * ever reads and mutates these; it never constructs. The ocean paint is the
 * one exception, and it is rebuilt only when the screen height changes, which
 * in a portrait-locked app means once.
 */
export function useRenderAssets(height: number): RenderAssets {
  const palette = useMemo(makePalette, []);
  const paths = useMemo(makeFishPaths, []);
  const paints = useMemo<FishPaints>(() => {
    const fill = Skia.Paint();
    fill.setAntiAlias(true);
    const eye = Skia.Paint();
    eye.setAntiAlias(true);
    eye.setColor(palette.eye);
    return { fill, eye };
  }, [palette]);
  const ocean = useMemo(() => makeOceanPaint(height, palette), [height, palette]);
  const rayPath = useMemo(makeRayPath, []);

  return { paths, paints, palette, ocean, rayPath };
}
