import {
  FLOOR_BAND_FRACTION,
  WORLD_HEIGHT_SCREENS,
  WORLD_WIDTH_SCREENS,
} from './constants';
import {
  L_CAMERA_X,
  L_CAMERA_Y,
  L_FLOOR_TOP_Y,
  L_WORLD_HEIGHT,
  L_WORLD_WIDTH,
} from './state';

/**
 * The world's size, and the camera's position within it.
 *
 * Two shapes of these live here, for two different callers, and the split is
 * not a style choice: it is what phase 7's verified zero-allocation
 * requirement demands.
 *
 *  - The simulation's camera has to persist (the spawner reads it, the input
 *    gesture reads it) and is recomputed every simulation step, so it is
 *    written into the loop buffer's own fields rather than returned, the same
 *    as everything else this codebase keeps across a step.
 *  - The renderer wants its *own* camera, tracking the interpolated position
 *    it draws with rather than the simulation's raw one, needed nowhere but
 *    inside the one picture being built. Giving that a buffer slot would
 *    imply a persistence it does not have, so it is plain scalar arithmetic
 *    instead: two numbers, computed and used immediately, never boxed.
 */

/** World width, as a scalar. Multiples of the screen rather than fixed pixels,
 * so the same proportions hold on any device. */
export function worldWidthFor(screenW: number): number {
  'worklet';
  return screenW * WORLD_WIDTH_SCREENS;
}

export function worldHeightFor(screenH: number): number {
  'worklet';
  return screenH * WORLD_HEIGHT_SCREENS;
}

/** Y where the swimmable water ends and the floor band begins. The player is
 * clamped here, not at the world's full height, so it never overlaps the
 * seabed it is drawn on top of. The camera clamps to the full height instead,
 * since scrolling down to reveal the floor is the point of having one. */
export function floorTopYFor(worldHeight: number): number {
  'worklet';
  return worldHeight * (1 - FLOOR_BAND_FRACTION);
}

/** Camera clamp for one axis: centred on `pos`, clamped so a `screenSpan`-wide
 * viewport never shows past a `worldSpan`-long world. */
export function clampCamera(pos: number, screenSpan: number, worldSpan: number): number {
  'worklet';
  const max = Math.max(0, worldSpan - screenSpan);
  const cam = pos - screenSpan * 0.5;
  return cam < 0 ? 0 : cam > max ? max : cam;
}

/**
 * Write the world's size into the loop buffer. Screen size does not change
 * after launch (portrait is locked), so in practice this only ever computes
 * one answer; it is cheap enough to call every frame regardless rather than
 * cache a "did it change" flag for.
 */
export function computeWorldSize(loop: Float32Array, screenW: number, screenH: number): void {
  'worklet';
  const width = worldWidthFor(screenW);
  const height = worldHeightFor(screenH);
  loop[L_WORLD_WIDTH] = width;
  loop[L_WORLD_HEIGHT] = height;
  loop[L_FLOOR_TOP_Y] = floorTopYFor(height);
}

/**
 * Write the simulation's camera position into the loop buffer, centred on
 * (x, y) and clamped to the world size `computeWorldSize` already wrote into
 * this same buffer, so the two can never be called with mismatched sizes.
 *
 * Takes a raw x, y rather than reading a position out of a state buffer
 * itself, so the caller decides whose position this is: the frame loop's own
 * exact position for spawn and despawn, or (from the render side) a
 * separately interpolated one, without those two ever having to agree on
 * anything beyond the point itself.
 */
export function computeCamera(
  loop: Float32Array,
  x: number,
  y: number,
  screenW: number,
  screenH: number,
): void {
  'worklet';
  loop[L_CAMERA_X] = clampCamera(x, screenW, loop[L_WORLD_WIDTH]);
  loop[L_CAMERA_Y] = clampCamera(y, screenH, loop[L_WORLD_HEIGHT]);
}
