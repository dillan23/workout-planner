/**
 * The fish body as a collision volume.
 *
 * Every fish is drawn from the same unit-space silhouette (see
 * `src/render/fishPaths.ts`), where the nose sits at x = +0.5 and the tail tip
 * at x = -0.5, so the whole fish is exactly 1.0 long. These constants describe
 * the *fleshy body* inside that silhouette, deliberately excluding the tail,
 * the dorsal fin and the pectoral fin, so that clipping a fin never counts as
 * a hit.
 *
 * Render and collision read the same numbers on purpose: if the drawn body
 * changes shape, the hitbox follows it, and the two can never drift apart.
 */

/** Centre of the body ellipse along the fish's forward axis, in unit space. */
export const BODY_OFFSET_X = 0.125;

/** Body ellipse semi-axis along the forward axis, in unit space. */
export const BODY_RX = 0.375;

/** Body ellipse semi-axis across the fish, in unit space. Slightly inside the
 * drawn outline so a graze along the back reads as a near miss, not a death. */
export const BODY_RY = 0.19;

/** Where the tail hinges onto the body, in unit space. */
export const TAIL_PIVOT_X = -0.25;

/** Half-extents of the whole silhouette, fins and tail included, in unit space.
 * Used to keep the player inside the pond; the vertical figure is set by the
 * dorsal fin, which is the tallest thing on the fish. */
export const SILHOUETTE_HALF_W = 0.5;
export const SILHOUETTE_HALF_H = 0.34;
