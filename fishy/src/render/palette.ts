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
  /** Indexed by tier. Prey are bright, predators darker and cooler, and the
   * neutral tier is a flat silver that commits to neither: at 0.95x to 1.05x
   * the only honest cue is size, and colouring it would give the read away. */
  readonly tiers: readonly FishSkin[];
  readonly eye: SkColor;
  /** Floating joystick: a ring where the thumb landed, a knob where it is now. */
  readonly stickRing: SkColor;
  readonly stickKnob: SkColor;
  /** Background layers. Barely there on purpose: the original's readability
   * came from an almost empty pond, and anything that reads as a fish silhouette
   * costs the player a moment deciding whether it can eat them. */
  readonly bubbleNear: SkColor;
  readonly bubbleFar: SkColor;
  readonly lightRay: SkColor;
}

export function makePalette(): Palette {
  return {
    ocean: [Skia.Color('#3AA6DC'), Skia.Color('#11618F'), Skia.Color('#04223B')],
    player: { body: Skia.Color('#FF9138'), fin: Skia.Color('#E86A1C') },
    tiers: [
      { body: Skia.Color('#8FE04A'), fin: Skia.Color('#63B82E') }, // prey, small
      { body: Skia.Color('#FFD24A'), fin: Skia.Color('#E0A81E') }, // prey, medium
      { body: Skia.Color('#B9C6CF'), fin: Skia.Color('#8FA2AE') }, // neutral
      { body: Skia.Color('#3E7FA8'), fin: Skia.Color('#2A5B7C') }, // predator, small
      { body: Skia.Color('#233C63'), fin: Skia.Color('#16294A') }, // predator, large
    ],
    eye: Skia.Color('#12222E'),
    stickRing: Skia.Color('rgba(234, 244, 251, 0.22)'),
    stickKnob: Skia.Color('rgba(234, 244, 251, 0.55)'),
    bubbleNear: Skia.Color('rgba(226, 244, 255, 0.14)'),
    bubbleFar: Skia.Color('rgba(226, 244, 255, 0.07)'),
    lightRay: Skia.Color('rgba(186, 226, 255, 0.05)'),
  };
}
