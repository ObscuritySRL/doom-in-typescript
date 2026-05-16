/**
 * Vanilla wall scale / distance / angle primitives (Chocolate Doom
 * 2.2.1 r_main.c `R_PointToAngle` / `R_PointToAngle2` / `R_PointToDist`
 * / `R_ScaleFromGlobalAngle`).
 *
 * These are the side-effect-free arithmetic core the `R_StoreWallRange`
 * seg coordinator needs to derive `rw_distance` / `rw_scale` /
 * `rw_scalestep` before handing a seg to the existing bit-exact
 * {@link renderSolidWall} / {@link renderTwoSidedWall} loops. They are
 * transcribed character-faithfully from the upstream source (the same
 * `R_ScaleFromGlobalAngle` body is independently pinned by
 * `src/render/implement-wall-column-scale-math.ts`), over the shared
 * fixed-point primitives (`fixedMul` / `fixedDiv` / `slopeDiv` /
 * `tantoangle` / `finesine`), so every value matches what vanilla DOOM
 * 1.9 computed.
 *
 * Vanilla's `R_PointToAngle` / `R_PointToDist` read the file-scope
 * `viewx` / `viewy`; here the view origin is passed explicitly so these
 * stay pure. `R_PointToAngle2(x1,y1,x2,y2)` is exactly
 * `R_PointToAngle` measured from `(x1,y1)`.
 *
 * Pure arithmetic; no Win32 or runtime dependencies.
 *
 * @example
 * ```ts
 * import { rPointToDist } from './wallScaleMath.ts';
 * const distance = rPointToDist(viewX, viewY, vertexX, vertexY);
 * ```
 */

import { FRACUNIT, fixedDiv, fixedMul } from '../core/fixed.ts';
import { ANGLETOFINESHIFT, DBITS, finesine, slopeDiv, tantoangle } from '../core/trig.ts';

import type { Angle } from '../core/angle.ts';
import { ANG90, ANG180, ANG270 } from '../core/angle.ts';

/** Maximum `R_ScaleFromGlobalAngle` scale (`64 * FRACUNIT`). */
export const WALL_SCALE_MAX = 64 * FRACUNIT;

/** Minimum `R_ScaleFromGlobalAngle` scale (the raw value `256`, not `FRACUNIT`). */
export const WALL_SCALE_MIN = 256;

function absInt(value: number): number {
  return (value < 0 ? -value : value) | 0;
}

/**
 * `R_PointToAngle` (r_main.c) measured from an explicit view origin:
 * the BAM angle from `(viewX,viewY)` to `(x,y)`, via the vanilla
 * eight-octant `tantoangle[SlopeDiv(...)]` decomposition. Returns an
 * `angle_t` (unsigned 32-bit).
 */
export function rPointToAngle(viewX: number, viewY: number, x: number, y: number): Angle {
  let deltaX = (x - viewX) | 0;
  let deltaY = (y - viewY) | 0;

  if (deltaX === 0 && deltaY === 0) {
    return 0;
  }

  if (deltaX >= 0) {
    if (deltaY >= 0) {
      if (deltaX > deltaY) {
        return tantoangle[slopeDiv(deltaY, deltaX)]! >>> 0; // octant 0
      }
      return (ANG90 - 1 - tantoangle[slopeDiv(deltaX, deltaY)]!) >>> 0; // octant 1
    }
    deltaY = -deltaY | 0;
    if (deltaX > deltaY) {
      return -tantoangle[slopeDiv(deltaY, deltaX)]! >>> 0; // octant 8
    }
    return (ANG270 + tantoangle[slopeDiv(deltaX, deltaY)]!) >>> 0; // octant 7
  }

  deltaX = -deltaX | 0;
  if (deltaY >= 0) {
    if (deltaX > deltaY) {
      return (ANG180 - 1 - tantoangle[slopeDiv(deltaY, deltaX)]!) >>> 0; // octant 3
    }
    return (ANG90 + tantoangle[slopeDiv(deltaX, deltaY)]!) >>> 0; // octant 2
  }
  deltaY = -deltaY | 0;
  if (deltaX > deltaY) {
    return (ANG180 + tantoangle[slopeDiv(deltaY, deltaX)]!) >>> 0; // octant 4
  }
  return (ANG270 - 1 - tantoangle[slopeDiv(deltaX, deltaY)]!) >>> 0; // octant 5
}

/** `R_PointToAngle2` (r_main.c): `R_PointToAngle` measured from `(x1,y1)`. */
export function rPointToAngle2(x1: number, y1: number, x2: number, y2: number): Angle {
  return rPointToAngle(x1, y1, x2, y2);
}

/**
 * `R_PointToDist` (r_main.c): the fixed-point distance from
 * `(viewX,viewY)` to `(x,y)`, including the vanilla `dx>=dy` swap and
 * the udm1.wad `dx==0` crash guard.
 */
export function rPointToDist(viewX: number, viewY: number, x: number, y: number): number {
  let dx = absInt((x - viewX) | 0);
  let dy = absInt((y - viewY) | 0);

  if (dy > dx) {
    const swap = dx;
    dx = dy;
    dy = swap;
  }

  const frac = dx !== 0 ? fixedDiv(dy, dx) : 0;
  const angle = ((tantoangle[frac >> DBITS]! + ANG90) >>> 0) >>> ANGLETOFINESHIFT;
  return fixedDiv(dx, finesine[angle]!);
}

/**
 * `R_ScaleFromGlobalAngle` (r_main.c): the inverse-perspective wall
 * scale for `visangle`, given the current `viewAngle` /
 * `rwNormalangle` / `rwDistance` and the viewport `projection` /
 * `detailShift`. Includes the `den > num>>16` divide/overflow guard and
 * the `[256, 64*FRACUNIT]` clamp.
 */
export function rScaleFromGlobalAngle(visangle: Angle, viewAngle: Angle, rwNormalangle: Angle, rwDistance: number, projection: number, detailShift: number): number {
  const anglea = (ANG90 + visangle - viewAngle) >>> 0;
  const angleb = (ANG90 + visangle - rwNormalangle) >>> 0;
  const sinea = finesine[anglea >>> ANGLETOFINESHIFT]!;
  const sineb = finesine[angleb >>> ANGLETOFINESHIFT]!;
  const num = (fixedMul(projection, sineb) << detailShift) | 0;
  const den = fixedMul(rwDistance, sinea);

  if (den > num >> 16) {
    let scale = fixedDiv(num, den);
    if (scale > WALL_SCALE_MAX) {
      scale = WALL_SCALE_MAX;
    } else if (scale < WALL_SCALE_MIN) {
      scale = WALL_SCALE_MIN;
    }
    return scale;
  }
  return WALL_SCALE_MAX;
}
