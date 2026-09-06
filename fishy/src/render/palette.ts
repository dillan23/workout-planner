import { Skia, type SkColor } from '@shopify/react-native-skia';

/**
 * Colours, resolved once into Skia colours so the frame loop never parses a
 * string. The background stays close to empty on purpose: the original game's
 * readability came from an almost bare pond, and every extra colour on screen
 * costs the player a fraction of a second deciding whether it can eat them.
 */
export interface FishSkin {
  readonly body: SkColor;
  readonly fin: SkColor;
}

export interface Palette {
  /** Ocean gradient, surface to seabed. */
  readonly ocean: readonly [SkColor, SkColor, SkColor];
  readonly player: FishSkin;
  readonly eye: SkColor;
}

export function makePalette(): Palette {
  return {
    ocean: [Skia.Color('#3AA6DC'), Skia.Color('#11618F'), Skia.Color('#04223B')],
    player: { body: Skia.Color('#FF9138'), fin: Skia.Color('#E86A1C') },
    eye: Skia.Color('#12222E'),
  };
}
