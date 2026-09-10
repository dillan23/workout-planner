import type { SkCanvas, SkPaint } from '@shopify/react-native-skia';

import {
  JOYSTICK_HOME_BOTTOM_PX,
  JOYSTICK_HOME_X_FRACTION,
  JOYSTICK_RADIUS,
} from '../game/constants';
import { I_ACTIVE, I_KNOB_X, I_KNOB_Y, I_ORIGIN_X, I_ORIGIN_Y } from '../game/state';
import type { Palette } from './palette';

/**
 * The floating joystick, drawn into the game canvas rather than laid out as
 * views.
 *
 * It reads the same input buffer the simulation does, so what is on screen and
 * what the fish is obeying cannot disagree, and moving the stick costs no
 * React work at all.
 *
 * With no finger down it draws a faint stick at a resting position instead of
 * drawing nothing. A control that only exists on contact is invisible until you
 * have already guessed it is there, which is a poor thing to ask of somebody
 * who has just started a run; the resting stick is the hint. It is only a hint:
 * the real stick still materialises wherever the thumb actually lands, and the
 * resting position has no special power.
 */
export function drawJoystick(
  canvas: SkCanvas,
  paint: SkPaint,
  palette: Palette,
  input: Float32Array,
  width: number,
  height: number,
): void {
  'worklet';
  const active = input[I_ACTIVE] >= 0.5;
  const originX = active ? input[I_ORIGIN_X] : width * JOYSTICK_HOME_X_FRACTION;
  const originY = active ? input[I_ORIGIN_Y] : height - JOYSTICK_HOME_BOTTOM_PX;
  const knobX = active ? input[I_KNOB_X] : originX;
  const knobY = active ? input[I_KNOB_Y] : originY;

  paint.setColor(active ? palette.stickRing : palette.stickRingIdle);
  canvas.drawCircle(originX, originY, JOYSTICK_RADIUS, paint);
  paint.setColor(active ? palette.stickKnob : palette.stickKnobIdle);
  canvas.drawCircle(knobX, knobY, JOYSTICK_RADIUS * 0.42, paint);
}
