/**
 * Vanilla DOOM 1.9 P_SlideMove contract.
 *
 * When P_TryMove fails, the player slides along the blocking wall. Vanilla
 * iterates up to 3 times, clipping the remaining movement against the
 * blocking line via P_HitSlideLine. Each iteration: try the remaining
 * vector; if blocked, clip to the line normal direction; if no movement
 * remains, stop.
 */

export const VANILLA_SLIDE_MAX_ITERATIONS = 3;

export interface SlideMoveInput {
  readonly remainingDx: number;
  readonly remainingDy: number;
  readonly lineNormalUnitX: number;
  readonly lineNormalUnitY: number;
}

export interface SlideMoveOutput {
  readonly slideDx: number;
  readonly slideDy: number;
  readonly remainingAfter: number;
}

/**
 * Projects the remaining movement vector onto the wall (eliminates the
 * component along the wall normal). The wall normal is the perpendicular to
 * the line's direction; the line tangent is the direction it points.
 */
export function projectSlideOntoWall(input: SlideMoveInput): SlideMoveOutput {
  const dotWithNormal = input.remainingDx * input.lineNormalUnitX + input.remainingDy * input.lineNormalUnitY;
  const slideDx = input.remainingDx - dotWithNormal * input.lineNormalUnitX;
  const slideDy = input.remainingDy - dotWithNormal * input.lineNormalUnitY;
  const remainingAfter = Math.hypot(slideDx, slideDy);
  return Object.freeze({ slideDx, slideDy, remainingAfter });
}
