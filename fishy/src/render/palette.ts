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
  /** The same stick at rest, before anything has been touched. Fainter, because
   * it is a hint that the control exists rather than a control being used. */
  readonly stickRingIdle: SkColor;
  readonly stickKnobIdle: SkColor;
  /** Background layers. Barely there on purpose: the original's readability
   * came from an almost empty pond, and anything that reads as a fish silhouette
   * costs the player a moment deciding whether it can eat them. */
  readonly bubbleNear: SkColor;
  readonly bubbleFar: SkColor;
  readonly lightRay: SkColor;
  /** The seabed at the bottom of the world: sand, a shadow under its ridge line
   * so it reads as solid rather than a flat stripe, and a couple of silhouette
   * accents scattered along it. */
  readonly sand: SkColor;
  readonly sandShadow: SkColor;
  readonly rock: SkColor;
  readonly plant: SkColor;
  /** Jellyfish are their own family of colour, independent of tier: the tier
   * palette signals danger by relative size, and a jellyfish is recognised by
   * silhouette and this translucent colour instead. */
  readonly jelly: SkColor;
  readonly jellyDark: SkColor;
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
    stickRingIdle: Skia.Color('rgba(234, 244, 251, 0.10)'),
    stickKnobIdle: Skia.Color('rgba(234, 244, 251, 0.24)'),
    bubbleNear: Skia.Color('rgba(226, 244, 255, 0.14)'),
    bubbleFar: Skia.Color('rgba(226, 244, 255, 0.07)'),
    lightRay: Skia.Color('rgba(186, 226, 255, 0.05)'),
    sand: Skia.Color('#B79A6B'),
    sandShadow: Skia.Color('#8C7248'),
    rock: Skia.Color('#5B5A5E'),
    plant: Skia.Color('#2F6E4E'),
    jelly: Skia.Color('rgba(232, 200, 226, 0.68)'),
    jellyDark: Skia.Color('rgba(190, 150, 186, 0.68)'),
  };
}
