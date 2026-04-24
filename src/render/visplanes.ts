/**
 * Visplane pool and build helpers — r_plane.c `R_ClearPlanes`,
 * `R_FindPlane`, and `R_CheckPlane`.
 *
 * A visplane is a floor or ceiling plane: every flat-rendered area of the
 * frame shares one visplane per (height, picnum, lightlevel) triple.  BSP
 * traversal (`R_Subsector`) and the wall renderer call {@link findPlane}
 * to obtain the active floor / ceiling plane for the current subsector,
 * then the wall paths (`renderSolidWall` / `renderTwoSidedWall`) call
 * {@link checkPlane} each time they widen or split the per-column top /
 * bottom writes across an x range.
 *
 * Parity invariants locked here:
 *
 * - Sky collapse: `picnum === skyflatnum` forces the lookup and allocator
 *   to use `height = 0` and `lightlevel = 0`, so every sky-tagged plane
 *   merges into one visplane regardless of the source sector's height or
 *   lightlevel.  Vanilla's `r_plane.c` reassigns the local parameters
 *   before the scan loop; we reproduce that exactly.
 * - Linear scan: {@link findPlane} walks the pool from index 0 up to
 *   `count - 1` and returns the first match.  New plane allocation uses
 *   the entry at index `count` and post-increments `count` (vanilla
 *   `lastvisplane++`).
 * - Pool overflow: both {@link findPlane} and {@link checkPlane} throw
 *   `RangeError` on pool exhaustion (`count === MAXVISPLANES`), mirroring
 *   vanilla's `I_Error("R_FindPlane: no more visplanes")` and
 *   `I_Error("R_CheckPlane: no more visplanes")` fatal paths.
 * - Empty-plane markers: a freshly-initialized (or freshly-cleared) plane
 *   has `minx = screenWidth` and `maxx = -1`, so `minx > maxx` means
 *   untouched.  `R_DrawPlanes` uses the same predicate to skip empty
 *   planes.
 * - Top-array fencepost: every newly-assigned plane has its `top`
 *   Uint8Array filled with {@link VISPLANE_TOP_UNFILLED} = `0xff`.  The
 *   `bottom` array is NOT reset — vanilla relies on `top[x] === 0xff`
 *   as the untouched-column sentinel and never reads `bottom[x]` for
 *   columns where `top[x]` is the sentinel.
 * - `checkPlane` extend vs split logic mirrors vanilla's
 *   intersection/union walker: if the `[start, stop]` range overlaps
 *   `[minx, maxx]` AND at least one column in the intersection has been
 *   touched (`top[x] !== 0xff`), the plane is SPLIT into a new pool
 *   entry with the same (height, picnum, lightlevel) but `minx = start`
 *   and `maxx = stop` (NOT the union).  Otherwise the plane is
 *   EXTENDED in place: `minx = min(start, minx)` and `maxx = max(stop,
 *   maxx)`.
 * - Disjoint-range quirk: when `[start, stop]` does not overlap
 *   `[minx, maxx]` (for example, a freshly-found plane with
 *   `minx = screenWidth, maxx = -1`), the intersection range walker
 *   produces `intrl > intrh` and the loop never executes, so the
 *   "extend" branch runs and the plane is extended to cover the new
 *   range.  This is how the first `checkPlane` call after
 *   `findPlane` populates the plane's `minx`/`maxx`.
 *
 * This module is pure state manipulation with no Win32 or runtime
 * dependencies.  The {@link VisplanePool} owns the preallocated
 * {@link Visplane} records; `count` tracks the vanilla `lastvisplane -
 * visplanes` pointer offset.
 *
 * @example
 * ```ts
 * import { checkPlane, clearPlanes, createVisplanePool, findPlane } from "../src/render/visplanes.ts";
 *
 * const pool = createVisplanePool();
 * clearPlanes(pool);
 * const ceil = findPlane(pool, 128 << 16, 1, 200, 2);
 * const extended = checkPlane(pool, ceil, 20, 40);
 * ```
 */

import { MAXVISPLANES, SCREENWIDTH } from './projection.ts';
import type { Visplane } from './renderLimits.ts';
import { VISPLANE_TOP_UNFILLED } from './renderLimits.ts';

export { MAXVISPLANES } from './projection.ts';
export { VISPLANE_TOP_UNFILLED } from './renderLimits.ts';

/**
 * Preallocated visplane ring mirroring vanilla `visplane_t
 * visplanes[MAXVISPLANES]` in r_plane.c.  The {@link VisplanePool.count}
 * field plays the role of `lastvisplane - visplanes`: entries
 * `planes[0..count)` are active for the current frame and entries
 * `planes[count..MAXVISPLANES)` are available for the next
 * allocation.
 */
export interface VisplanePool {
  /** Fixed-capacity visplane array.  Never reallocated. */
  readonly planes: readonly Visplane[];
  /** Number of active visplanes (vanilla `lastvisplane - visplanes`). */
  count: number;
  /**
   * Framebuffer row stride the pool was sized for.  Matches
   * {@link Visplane.top} / {@link Visplane.bottom} length and the
   * `minx = screenWidth` empty-plane marker.
   */
  readonly screenWidth: number;
}

/**
 * Allocate a new {@link VisplanePool} with {@link MAXVISPLANES} frozen
 * slots, each sized to the supplied framebuffer width (defaults to
 * {@link SCREENWIDTH}).  Every slot starts in the empty-plane state:
 * `height = 0`, `picnum = 0`, `lightlevel = 0`, `minx = screenWidth`,
 * `maxx = -1`, `top` and `bottom` are zero-filled Uint8Arrays.
 *
 * The pool owns its {@link Visplane} records; callers never construct
 * their own.  {@link findPlane} and {@link checkPlane} return
 * references into the pool's `planes` array.
 */
export function createVisplanePool(options: { readonly screenWidth?: number } = {}): VisplanePool {
  const screenWidth = options.screenWidth ?? SCREENWIDTH;
  const planes: Visplane[] = [];
  for (let i = 0; i < MAXVISPLANES; i += 1) {
    planes.push({
      height: 0,
      picnum: 0,
      lightlevel: 0,
      minx: screenWidth,
      maxx: -1,
      top: new Uint8Array(screenWidth),
      bottom: new Uint8Array(screenWidth),
    });
  }
  return { planes, count: 0, screenWidth };
}

/**
 * Reset the visplane pool for a new frame (the visplane half of
 * `R_ClearPlanes`).  Sets `count` back to 0 so the next
 * {@link findPlane} allocation reuses pool slot 0.  Entries that were
 * active on the previous frame retain their stale `top` / `bottom`
 * data; {@link findPlane} refills `top` with
 * {@link VISPLANE_TOP_UNFILLED} on reallocation, matching vanilla.
 *
 * This function does NOT reset the per-column clip arrays — vanilla's
 * `R_ClearPlanes` also writes `ceilingclip[] = -1` and `floorclip[] =
 * viewheight`, but those live in the render context owned by
 * {@link renderSolidWall} / {@link renderTwoSidedWall}.  Callers that
 * want the full `R_ClearPlanes` behavior invoke this function plus the
 * `Int16Array.fill` calls using {@link CEILINGCLIP_DEFAULT} and
 * {@link floorclipDefault}.
 */
export function clearPlanes(pool: VisplanePool): void {
  pool.count = 0;
}

/**
 * `R_FindPlane` — look up or allocate a visplane for the given
 * `(height, picnum, lightlevel)` triple.  When `picnum === skyFlatNum`
 * the height and lightlevel are collapsed to `0` before the scan, so
 * every sky-tagged visplane merges into one pool entry regardless of
 * the source sector values.
 *
 * Returns a reference into {@link VisplanePool.planes}.  On first
 * allocation, `minx` is set to `screenWidth`, `maxx` to `-1`, and
 * `top` is filled with {@link VISPLANE_TOP_UNFILLED}; the subsequent
 * {@link checkPlane} call is expected to populate `minx` and `maxx`
 * with the first covered column range.  Throws `RangeError` when the
 * pool is full.
 */
export function findPlane(pool: VisplanePool, height: number, picnum: number, lightlevel: number, skyFlatNum: number): Visplane {
  let effectiveHeight = height | 0;
  let effectiveLight = lightlevel | 0;
  if (picnum === skyFlatNum) {
    effectiveHeight = 0;
    effectiveLight = 0;
  }

  const planes = pool.planes;
  const count = pool.count;
  for (let i = 0; i < count; i += 1) {
    const check = planes[i]!;
    if (check.height === effectiveHeight && check.picnum === picnum && check.lightlevel === effectiveLight) {
      return check;
    }
  }

  if (count === MAXVISPLANES) {
    throw new RangeError('R_FindPlane: no more visplanes');
  }

  const plane = planes[count]!;
  pool.count = count + 1;
  plane.height = effectiveHeight;
  plane.picnum = picnum;
  plane.lightlevel = effectiveLight;
  plane.minx = pool.screenWidth;
  plane.maxx = -1;
  plane.top.fill(VISPLANE_TOP_UNFILLED);
  return plane;
}

/**
 * `R_CheckPlane` — decide whether an existing visplane can be extended
 * to also cover `[start, stop]` or whether a new visplane must be
 * split off for the disjoint column range.
 *
 * The logic mirrors vanilla's two-stage walk:
 *
 * 1. Compute the intersection `[intrl, intrh]` and union `[unionl,
 *    unionh]` of `[start, stop]` with `[plane.minx, plane.maxx]`.
 * 2. Walk columns `intrl..intrh` and look for any column whose
 *    `top[x]` is NOT {@link VISPLANE_TOP_UNFILLED} (i.e., has already
 *    been touched by a previous `checkPlane` + wall-renderer pass).
 * 3. If no touched column is found in the intersection (including the
 *    degenerate `intrl > intrh` empty-intersection case), the plane is
 *    extended: `minx = unionl`, `maxx = unionh`, and the same plane
 *    reference is returned.
 * 4. Otherwise, a new visplane is allocated with the same
 *    `(height, picnum, lightlevel)` triple.  Its range is set to
 *    `[start, stop]` — NOT the union — and its `top` is refilled with
 *    the fencepost sentinel.  Throws `RangeError` on pool overflow.
 */
export function checkPlane(pool: VisplanePool, plane: Visplane, start: number, stop: number): Visplane {
  let intrl: number;
  let intrh: number;
  let unionl: number;
  let unionh: number;

  if (start < plane.minx) {
    intrl = plane.minx;
    unionl = start;
  } else {
    unionl = plane.minx;
    intrl = start;
  }

  if (stop > plane.maxx) {
    intrh = plane.maxx;
    unionh = stop;
  } else {
    unionh = plane.maxx;
    intrh = stop;
  }

  const top = plane.top;
  let x = intrl;
  while (x <= intrh && top[x] === VISPLANE_TOP_UNFILLED) {
    x += 1;
  }

  if (x > intrh) {
    plane.minx = unionl;
    plane.maxx = unionh;
    return plane;
  }

  const count = pool.count;
  if (count === MAXVISPLANES) {
    throw new RangeError('R_CheckPlane: no more visplanes');
  }

  const newPlane = pool.planes[count]!;
  pool.count = count + 1;
  newPlane.height = plane.height;
  newPlane.picnum = plane.picnum;
  newPlane.lightlevel = plane.lightlevel;
  newPlane.minx = start;
  newPlane.maxx = stop;
  newPlane.top.fill(VISPLANE_TOP_UNFILLED);
  return newPlane;
}
