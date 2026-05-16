/**
 * BSP node bounding-box visibility cull — Chocolate Doom 2.2.1
 * r_bsp.c `R_CheckBBox` and the `checkcoord[12][4]` table.
 *
 * `R_RenderBSPNode` recurses the near child unconditionally, then
 * calls `R_CheckBBox(bsp->bbox[side ^ 1])` before descending the far
 * child: if the far half-space's bounding box projects entirely
 * behind the already-accumulated solidsegs occlusion (or off the view
 * frustum), the whole far subtree is skipped.  `walkBspFromViewpoint`
 * currently omits this cull (a known parity gap); this module supplies
 * the exact test so the assembled sequencer visits the same subtrees
 * vanilla does.
 *
 * The two box corners that define the silhouette edges from the
 * viewpoint are chosen by `checkcoord` (indexed by the 3x3
 * viewpoint-vs-box quadrant `boxpos`).  The corner angles are then
 * frustum-clipped and projected through the I1 `viewangletox` table
 * exactly as `R_AddLine`, and the resulting `[sx1, sx2-1]` span is
 * tested against the I3 solidsegs clip list (read-only).
 *
 * The verbatim r_main.c `R_PointToAngle` is reused from the
 * coordinated {@link ./wallScaleMath.ts}; the clip list shape is the
 * I3 {@link ClipState}.  Pure: no mutation, no Win32 / framebuffer
 * side effects — returns `true` (recurse the far subtree) or `false`
 * (the subtree is fully occluded / off-frustum, skip it).
 */

import { type Fixed } from '../core/fixed.ts';
import { ANG90, ANG180, type Angle } from '../core/angle.ts';
import { ANGLETOFINESHIFT } from '../core/trig.ts';

import { BOXBOTTOM, BOXLEFT, BOXRIGHT, BOXTOP } from '../map/lineSectorGeometry.ts';
import type { ClipState } from './solidSegs.ts';
import { rPointToAngle } from './wallScaleMath.ts';

/** Coerce to an unsigned 32-bit int (C `angle_t` wraparound). */
function toAngle(value: number): Angle {
  return value >>> 0;
}

/**
 * r_bsp.c `int checkcoord[12][4]`.  C zero-fills the unlisted /
 * `{0}` rows (indices 3, 5, 7, 11) — they are never indexed because
 * `boxx in {0,1,2}` keeps `boxpos % 4 <= 2` and `boxpos == 5` short-
 * circuits before the lookup.  Preserved exactly for fidelity.
 */
export const CHECKCOORD: readonly (readonly [number, number, number, number])[] = Object.freeze([
  [3, 0, 2, 1],
  [3, 0, 2, 0],
  [3, 1, 2, 0],
  [0, 0, 0, 0],
  [2, 0, 2, 1],
  [0, 0, 0, 0],
  [3, 1, 3, 0],
  [0, 0, 0, 0],
  [2, 0, 3, 1],
  [2, 1, 3, 1],
  [2, 1, 3, 0],
  [0, 0, 0, 0],
]);

/** Live view state + I1 projection tables `R_CheckBBox` reads. */
export interface CheckBBoxView {
  readonly viewx: Fixed;
  readonly viewy: Fixed;
  readonly viewangle: Angle;
  /** r_main.c `clipangle` (== I1 `xtoviewangle[0]`). */
  readonly clipangle: Angle;
  /** I1 `viewangletox` table for the active viewport. */
  readonly viewangletox: Int32Array;
}

/**
 * r_bsp.c `R_CheckBBox` — `true` if the half-space whose bounding box
 * is `bspcoord` (`[BOXTOP, BOXBOTTOM, BOXLEFT, BOXRIGHT]`, the
 * `MapNode.bbox[side]` layout) is potentially visible and its subtree
 * must be recursed; `false` if it is entirely off-frustum or fully
 * occluded by the current solidsegs clip list.
 */
export function rCheckBBox(bspcoord: readonly [Fixed, Fixed, Fixed, Fixed], view: CheckBBoxView, state: ClipState): boolean {
  const { clipangle, viewangletox } = view;
  const twoClipangle = toAngle(2 * clipangle);

  // Find the corners of the box that define the edges from the
  // current viewpoint.
  let boxx: number;
  if (view.viewx <= bspcoord[BOXLEFT]) {
    boxx = 0;
  } else if (view.viewx < bspcoord[BOXRIGHT]) {
    boxx = 1;
  } else {
    boxx = 2;
  }

  let boxy: number;
  if (view.viewy >= bspcoord[BOXTOP]) {
    boxy = 0;
  } else if (view.viewy > bspcoord[BOXBOTTOM]) {
    boxy = 1;
  } else {
    boxy = 2;
  }

  const boxpos = (boxy << 2) + boxx;
  if (boxpos === 5) {
    return true;
  }

  const coord = CHECKCOORD[boxpos]!;
  const x1 = bspcoord[coord[0]]!;
  const y1 = bspcoord[coord[1]]!;
  const x2 = bspcoord[coord[2]]!;
  const y2 = bspcoord[coord[3]]!;

  // check clip list for an open space
  let angle1 = toAngle(rPointToAngle(view.viewx, view.viewy, x1, y1) - view.viewangle);
  let angle2 = toAngle(rPointToAngle(view.viewx, view.viewy, x2, y2) - view.viewangle);

  const span = toAngle(angle1 - angle2);

  // Sitting on a line?
  if (span >= ANG180) {
    return true;
  }

  let tspan = toAngle(angle1 + clipangle);
  if (tspan > twoClipangle) {
    tspan = toAngle(tspan - twoClipangle);

    // Totally off the left edge?
    if (tspan >= span) {
      return false;
    }
    angle1 = clipangle;
  }
  tspan = toAngle(clipangle - angle2);
  if (tspan > twoClipangle) {
    tspan = toAngle(tspan - twoClipangle);

    // Totally off the left edge?
    if (tspan >= span) {
      return false;
    }
    angle2 = toAngle(-clipangle);
  }

  // Find the first clippost that touches the source post
  // (adjacent pixels are touching).
  const fineAngle1 = toAngle(angle1 + ANG90) >>> ANGLETOFINESHIFT;
  const fineAngle2 = toAngle(angle2 + ANG90) >>> ANGLETOFINESHIFT;
  const sx1 = viewangletox[fineAngle1]!;
  let sx2 = viewangletox[fineAngle2]!;

  // Does not cross a pixel.
  if (sx1 === sx2) {
    return false;
  }
  sx2 -= 1;

  let start = 0;
  while (state.solidsegs[start]!.last < sx2) {
    start += 1;
  }

  if (sx1 >= state.solidsegs[start]!.first && sx2 <= state.solidsegs[start]!.last) {
    // The clippost contains the new span.
    return false;
  }

  return true;
}
