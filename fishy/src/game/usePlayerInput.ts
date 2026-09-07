import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

import { JOYSTICK_DEADZONE, JOYSTICK_RADIUS } from './constants';
import {
  CONTROL_DRAG,
  CONTROL_JOYSTICK,
  I_ACTIVE,
  I_KNOB_X,
  I_KNOB_Y,
  I_MODE,
  I_ORIGIN_X,
  I_ORIGIN_Y,
  I_RAW_VX,
  I_RAW_VY,
  I_TARGET_X,
  I_TARGET_Y,
  I_VEC_X,
  I_VEC_Y,
  I_VX,
  I_VY,
} from './state';

/**
 * Touch, in both control schemes.
 *
 * Neither puts anything in a fixed corner: drag works anywhere on the screen,
 * and the joystick materialises wherever the thumb lands. The gesture only ever
 * records what the finger is doing; turning that into movement is the
 * simulation's job.
 *
 * These callbacks are worklets, so a touch never crosses to the JS thread.
 */
export function usePlayerInput(input: SharedValue<Float32Array>, scheme: number) {
  return useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((event) => {
          'worklet';
          const i = input.value;
          i[I_MODE] = scheme;
          i[I_ACTIVE] = 1;
          // A new touch inherits nothing from the last one.
          i[I_RAW_VX] = 0;
          i[I_RAW_VY] = 0;
          i[I_VX] = 0;
          i[I_VY] = 0;
          i[I_VEC_X] = 0;
          i[I_VEC_Y] = 0;
          i[I_TARGET_X] = event.x;
          i[I_TARGET_Y] = event.y;
          i[I_ORIGIN_X] = event.x;
          i[I_ORIGIN_Y] = event.y;
          i[I_KNOB_X] = event.x;
          i[I_KNOB_Y] = event.y;
        })
        .onUpdate((event) => {
          'worklet';
          const i = input.value;
          if (scheme === CONTROL_JOYSTICK) {
            let dx = event.x - i[I_ORIGIN_X];
            let dy = event.y - i[I_ORIGIN_Y];
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > JOYSTICK_RADIUS) {
              const scale = JOYSTICK_RADIUS / distance;
              dx *= scale;
              dy *= scale;
            }
            i[I_KNOB_X] = i[I_ORIGIN_X] + dx;
            i[I_KNOB_Y] = i[I_ORIGIN_Y] + dy;

            const magnitude = Math.min(distance, JOYSTICK_RADIUS) / JOYSTICK_RADIUS;
            if (magnitude < JOYSTICK_DEADZONE || distance < 1e-4) {
              i[I_VEC_X] = 0;
              i[I_VEC_Y] = 0;
            } else {
              // Rescale past the deadzone so the throttle still reaches 1.
              const throttle = (magnitude - JOYSTICK_DEADZONE) / (1 - JOYSTICK_DEADZONE);
              i[I_VEC_X] = (dx / distance) * throttle;
              i[I_VEC_Y] = (dy / distance) * throttle;
            }
            return;
          }
          i[I_TARGET_X] = event.x;
          i[I_TARGET_Y] = event.y;
          i[I_RAW_VX] = event.velocityX;
          i[I_RAW_VY] = event.velocityY;
        })
        .onFinalize(() => {
          'worklet';
          const i = input.value;
          i[I_ACTIVE] = 0;
          i[I_RAW_VX] = 0;
          i[I_RAW_VY] = 0;
          i[I_VEC_X] = 0;
          i[I_VEC_Y] = 0;
        }),
    [input, scheme],
  );
}

export { CONTROL_DRAG, CONTROL_JOYSTICK };
