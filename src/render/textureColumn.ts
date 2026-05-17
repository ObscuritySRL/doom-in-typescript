/**
 * Per-column wall-texture U resolver — Chocolate Doom 2.2.1 r_segs.c
 * `R_RenderSegLoop` texture-column calculation.
 *
 * Verbatim r_segs.c (per screen column `rw_x`):
 *
 *   angle = (rw_centerangle + xtoviewangle[rw_x]) >> ANGLETOFINESHIFT;
 *   texturecolumn = rw_offset - FixedMul(finetangent[angle], rw_distance);
 *   texturecolumn >>= FRACBITS;
 *
 * The committed bit-exact {@link renderSolidWall} / {@link renderTwoSidedWall}
 * loops accept this as the injected `textureColumnFor(x)` closure (and
 * `renderTwoSidedWall` records it as `maskedtexturecol[x]`). This
 * module is the bridge from the I2 {@link storeWallRange} outputs
 * (`rwCenterangle` / `rwOffset` / `rwDistance`) plus the I1
 * `xtoviewangle` table to that closure.
 *
 * `rw_centerangle + xtoviewangle[x]` is `angle_t` (unsigned 32-bit)
 * addition with wraparound; the `>> ANGLETOFINESHIFT` is the unsigned
 * shift to a `finetangent` index; the final `>> FRACBITS` is the
 * signed fixed-point truncation. `getWallColumn` later masks the
 * returned integer through the texture width mask.
 *
 * Pure arithmetic; no Win32 or runtime dependencies.
 */

import type { Angle } from '../core/angle.ts';
import { FRACBITS, fixedMul } from '../core/fixed.ts';
import type { Fixed } from '../core/fixed.ts';
import { ANGLETOFINESHIFT, finetangent } from '../core/trig.ts';

/**
 * Build the `textureColumnFor(x)` closure for one seg, reproducing
 * r_segs.c `R_RenderSegLoop`'s texture-column math. `xtoviewangle` is
 * the I1 projection table; `rwCenterangle` / `rwOffset` / `rwDistance`
 * are I2 {@link storeWallRange} per-seg outputs.
 *
 * @example
 * ```ts
 * const textureColumnFor = makeTextureColumnFor(stored.rwCenterangle, stored.rwOffset, stored.rwDistance, angles.xtoviewangle);
 * renderSolidWall({ ...seg, textureColumnFor }, ctx);
 * ```
 */
export function makeTextureColumnFor(rwCenterangle: Angle, rwOffset: Fixed, rwDistance: Fixed, xtoviewangle: Uint32Array): (x: number) => number {
  return (x: number): number => {
    const angle = ((rwCenterangle + xtoviewangle[x]!) >>> 0) >>> ANGLETOFINESHIFT;
    return ((rwOffset - fixedMul(finetangent[angle]!, rwDistance)) | 0) >> FRACBITS;
  };
}
