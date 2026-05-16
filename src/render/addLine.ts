/**
 * Per-seg view projection and solid/pass classification — Chocolate
 * Doom 2.2.1 r_bsp.c `R_AddLine`.
 *
 * `R_Subsector` visits each subsector's segs front-to-back and hands
 * every seg to `R_AddLine`, which: rejects back-facing segs, frustum-
 * clips the seg's view-relative angle span to `[-clipangle,
 * clipangle]`, projects the clipped endpoints to screen columns via
 * the I1 `viewangletox` table, rejects degenerate (`x1 == x2`) segs,
 * classifies the seg as solid / pass / skip, and dispatches to
 * `R_ClipSolidWallSegment` / `R_ClipPassWallSegment` (the I3
 * {@link clipSolidWallSegment} / {@link clipPassWallSegment}) with
 * `(x1, x2 - 1)`, having set the `rw_angle1` global the I2
 * {@link storeWallRange} coordinator consumes.
 *
 * This module is the pure projection/classification half: it returns
 * the dispatch decision (`'solid'` / `'pass'` range + `rwAngle1`, or
 * `null` for a rejected/empty seg).  The sequencer (a later increment)
 * threads the result through the I3 clip list and I2 coordinator.  The
 * verbatim r_main.c `R_PointToAngle` it needs is reused from the
 * coordinated {@link ./wallScaleMath.ts} (single source of truth); the
 * angle arithmetic is bit-exact `angle_t` (unsigned 32-bit) with the
 * `span >= ANG180` backface cull and the `2*clipangle` frustum span.
 *
 * Pure arithmetic; no Win32 or runtime dependencies.
 */

import { type Fixed } from '../core/fixed.ts';
import { ANG90, ANG180, type Angle } from '../core/angle.ts';
import { ANGLETOFINESHIFT } from '../core/trig.ts';

import { rPointToAngle } from './wallScaleMath.ts';

/** Coerce to an unsigned 32-bit int (C `angle_t` wraparound). */
function toAngle(value: number): Angle {
  return value >>> 0;
}

/** A seg vertex (`v1` / `v2`): map-unit fixed-point coordinates. */
export interface AddLineVertex {
  readonly x: Fixed;
  readonly y: Fixed;
}

/** The sector fields `R_AddLine` reads for window / closed / trigger classification. */
export interface AddLineSector {
  readonly ceilingheight: Fixed;
  readonly floorheight: Fixed;
  readonly ceilingpic: number;
  readonly floorpic: number;
  readonly lightlevel: number;
}

/** The seg under consideration plus its back sector and midtexture. */
export interface AddLineSeg {
  readonly v1: AddLineVertex;
  readonly v2: AddLineVertex;
  /** `line->backsector` — `null` for a one-sided line. */
  readonly backsector: AddLineSector | null;
  /** `curline->sidedef->midtexture` (texture number; `0` = none). */
  readonly sidedefMidtexture: number;
}

/** Live view state + the I1 projection tables `R_AddLine` reads. */
export interface AddLineView {
  readonly viewx: Fixed;
  readonly viewy: Fixed;
  readonly viewangle: Angle;
  /** r_main.c `clipangle` (== I1 `xtoviewangle[0]`). */
  readonly clipangle: Angle;
  /** I1 `viewangletox` table for the active viewport. */
  readonly viewangletox: Int32Array;
}

/** `'solid'` → `R_ClipSolidWallSegment`; `'pass'` → `R_ClipPassWallSegment`. */
export type AddLineKind = 'solid' | 'pass';

/**
 * The dispatch the sequencer feeds to I3 / I2: the screen-column range
 * `[x1, last]` (vanilla passes `x1, x2 - 1`) and the `rw_angle1`
 * global (the pre-`viewangle` `angle1`) the coordinator consumes.
 */
export interface AddLineResult {
  readonly kind: AddLineKind;
  readonly x1: number;
  /** `x2 - 1` — the inclusive `last` column vanilla passes to the clip routine. */
  readonly last: number;
  readonly rwAngle1: Angle;
}

/**
 * r_bsp.c `R_AddLine` — project / frustum-clip / classify one seg.
 * Returns the solid|pass dispatch range, or `null` when the seg is
 * rejected (back-facing, fully off an edge, sub-pixel, or an
 * empty trigger line with identical sectors and no midtexture).
 */
export function addLine(line: AddLineSeg, frontsector: AddLineSector, view: AddLineView): AddLineResult | null {
  const { clipangle, viewangletox } = view;
  const twoClipangle = toAngle(2 * clipangle);

  // OPTIMIZE: quickly reject orthogonal back sides.
  let angle1 = rPointToAngle(view.viewx, view.viewy, line.v1.x, line.v1.y);
  let angle2 = rPointToAngle(view.viewx, view.viewy, line.v2.x, line.v2.y);

  // Clip to view edges.
  const span = toAngle(angle1 - angle2);

  // Back side? I.e. backface culling?
  if (span >= ANG180) {
    return null;
  }

  // Global angle needed by segcalc.
  const rwAngle1 = angle1;
  angle1 = toAngle(angle1 - view.viewangle);
  angle2 = toAngle(angle2 - view.viewangle);

  let tspan = toAngle(angle1 + clipangle);
  if (tspan > twoClipangle) {
    tspan = toAngle(tspan - twoClipangle);

    // Totally off the left edge?
    if (tspan >= span) {
      return null;
    }
    angle1 = clipangle;
  }
  tspan = toAngle(clipangle - angle2);
  if (tspan > twoClipangle) {
    tspan = toAngle(tspan - twoClipangle);

    // Totally off the left edge?
    if (tspan >= span) {
      return null;
    }
    angle2 = toAngle(-clipangle);
  }

  // The seg is in the view range, but not necessarily visible.
  const fineAngle1 = toAngle(angle1 + ANG90) >>> ANGLETOFINESHIFT;
  const fineAngle2 = toAngle(angle2 + ANG90) >>> ANGLETOFINESHIFT;
  const x1 = viewangletox[fineAngle1]!;
  const x2 = viewangletox[fineAngle2]!;

  // Does not cross a pixel?
  if (x1 === x2) {
    return null;
  }

  const backsector = line.backsector;

  // Single sided line?
  if (!backsector) {
    return { kind: 'solid', x1, last: x2 - 1, rwAngle1 };
  }

  // Closed door.
  if (backsector.ceilingheight <= frontsector.floorheight || backsector.floorheight >= frontsector.ceilingheight) {
    return { kind: 'solid', x1, last: x2 - 1, rwAngle1 };
  }

  // Window.
  if (backsector.ceilingheight !== frontsector.ceilingheight || backsector.floorheight !== frontsector.floorheight) {
    return { kind: 'pass', x1, last: x2 - 1, rwAngle1 };
  }

  // Reject empty lines used for triggers and special events:
  // identical floor / ceiling / light on both sides and no midtexture.
  if (backsector.ceilingpic === frontsector.ceilingpic && backsector.floorpic === frontsector.floorpic && backsector.lightlevel === frontsector.lightlevel && line.sidedefMidtexture === 0) {
    return null;
  }

  return { kind: 'pass', x1, last: x2 - 1, rwAngle1 };
}
