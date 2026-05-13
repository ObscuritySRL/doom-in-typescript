/**
 * Vanilla DOOM 1.9 visplane-overflow limit behavior.
 *
 * From Chocolate Doom 2.2.1 r_plane.c R_FindPlane:
 *
 *   if (lastvisplane - visplanes == MAXVISPLANES)
 *       I_Error("R_FindPlane: no more visplanes");
 *
 * Notes for parity:
 *   - MAXVISPLANES = 128 is a hard limit; the engine cannot allocate beyond this.
 *   - On overflow, vanilla calls I_Error which prints to stderr and exits with a
 *     non-zero code.  No graceful recovery is attempted.
 *   - The check is "lastvisplane - visplanes == MAXVISPLANES" (strict equality
 *     against the count, NOT >=), so the 128th allocation succeeds and the 129th
 *     errors.
 *   - Visplane indices in the active range are [0, lastvisplane - visplanes),
 *     so the valid set has at most 128 entries.
 *   - Custom (high-detail) maps with many independent floor heights or lighting
 *     levels reliably hit this limit; modern source ports raise it to ~16k.
 */

export const VANILLA_MAXVISPLANES = 128;
export const VANILLA_VISPLANE_OVERFLOW_ERROR_MESSAGE = 'R_FindPlane: no more visplanes';

export interface VisplaneOverflowInput {
  readonly activeVisplaneCount: number;
}

export function vanillaVisplaneOverflowWouldFire(input: VisplaneOverflowInput): boolean {
  return input.activeVisplaneCount === VANILLA_MAXVISPLANES;
}

export function vanillaVisplaneCountIsValid(input: VisplaneOverflowInput): boolean {
  return input.activeVisplaneCount >= 0 && input.activeVisplaneCount <= VANILLA_MAXVISPLANES;
}

export function vanillaVisplaneRemainingCapacity(input: VisplaneOverflowInput): number {
  if (input.activeVisplaneCount < 0) {
    throw new RangeError(`activeVisplaneCount must be non-negative, got ${input.activeVisplaneCount}`);
  }
  return Math.max(0, VANILLA_MAXVISPLANES - input.activeVisplaneCount);
}
