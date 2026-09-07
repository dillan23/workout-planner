import type { SkCanvas, SkPaint } from '@shopify/react-native-skia';

import { JOYSTICK_RADIUS } from '../game/constants';
import { I_ACTIVE, I_KNOB_X, I_KNOB_Y, I_ORIGIN_X, I_ORIGIN_Y } from '../game/state';
import type { Palette } from './palette';

/**
 * The floating joystick, drawn into the game canvas rather than laid out as
 * views.
 *
 * It reads the same input buffer the simulation does, so what is on screen and
 * what the fish is obeying cannot disagree, and moving the stick costs no
 * React work at all.
 */
export function drawJoystick(
  canvas: SkCanvas,
  paint: SkPaint,
  palette: Palette,
  input: Float32Array,
): void {
  'worklet';
  if (input[I_ACTIVE] < 0.5) {
    return;
  }
  paint.setColor(palette.stickRing);
  canvas.drawCircle(input[I_ORIGIN_X], input[I_ORIGIN_Y], JOYSTICK_RADIUS, paint);
  paint.setColor(palette.stickKnob);
  canvas.drawCircle(input[I_KNOB_X], input[I_KNOB_Y], JOYSTICK_RADIUS * 0.42, paint);
}
