import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

import { I_ACTIVE, I_RAW_VX, I_RAW_VY, I_TARGET_X, I_TARGET_Y, I_VX, I_VY } from './state';

/**
 * Drag anywhere to swim.
 *
 * The gesture records where your finger is and nothing else; turning that into
 * movement is the simulation's job. `minDistance(0)` makes the fish respond to
 * a touch immediately rather than waiting for the pan to be recognised, so a
 * quick tap-and-hold steers just like a drag.
 *
 * These callbacks are worklets, so a touch never crosses to the JS thread.
 */
export function usePlayerInput(input: SharedValue<Float32Array>) {
  return useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((event) => {
          'worklet';
          const i = input.value;
          i[I_TARGET_X] = event.x;
          i[I_TARGET_Y] = event.y;
          // A new touch inherits nothing from the last one.
          i[I_RAW_VX] = 0;
          i[I_RAW_VY] = 0;
          i[I_VX] = 0;
          i[I_VY] = 0;
          i[I_ACTIVE] = 1;
        })
        .onUpdate((event) => {
          'worklet';
          const i = input.value;
          i[I_TARGET_X] = event.x;
          i[I_TARGET_Y] = event.y;
          i[I_RAW_VX] = event.velocityX;
          i[I_RAW_VY] = event.velocityY;
          i[I_ACTIVE] = 1;
        })
        .onFinalize(() => {
          'worklet';
          const i = input.value;
          i[I_ACTIVE] = 0;
          i[I_RAW_VX] = 0;
          i[I_RAW_VY] = 0;
        }),
    [input],
  );
}
