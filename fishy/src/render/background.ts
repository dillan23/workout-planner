import { Skia, TileMode, type SkCanvas, type SkPaint } from '@shopify/react-native-skia';

import type { Palette } from './palette';

/**
 * The ocean: a vertical gradient, brightest at the surface and nearly black at
 * the seabed. Built once per screen size, then replayed every frame.
 */
export function makeOceanPaint(height: number, palette: Palette): SkPaint {
  const paint = Skia.Paint();
  paint.setShader(
    Skia.Shader.MakeLinearGradient(
      { x: 0, y: 0 },
      { x: 0, y: height },
      [...palette.ocean],
      [0, 0.45, 1],
      // Clamp so the gradient holds its end colours if the shader is ever asked
      // to paint beyond the screen.
      TileMode.Clamp,
    ),
  );
  return paint;
}

/**
 * Fill the frame with the ocean. `drawPaint` covers the current clip, which the
 * host view bounds to the canvas, so this needs no rectangle and allocates
 * nothing.
 */
export function drawOcean(canvas: SkCanvas, paint: SkPaint): void {
  'worklet';
  canvas.drawPaint(paint);
}
