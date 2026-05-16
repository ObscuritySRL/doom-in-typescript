/**
 * Per-subsector render orchestration — Chocolate Doom 2.2.1 r_bsp.c
 * `R_Subsector`.
 *
 * The BSP walk (`R_RenderBSPNode` order via `walkBspFromViewpoint`,
 * back-side-culled by I4b {@link rCheckBBox}) reaches each visible
 * subsector and calls `R_Subsector`, which: sets the front sector,
 * selects (or allocates) the floor / ceiling visplanes via
 * `R_FindPlane` (the existing bit-exact {@link findPlane}), and
 * iterates the subsector's segs through I4a {@link addLine} →
 * the I3 {@link clipSolidWallSegment} / {@link clipPassWallSegment}
 * clip list (whose `store` callback is the I2
 * {@link storeWallRange} → wall-draw pipeline the final sequencer
 * wires).
 *
 * Verbatim r_bsp.c contract:
 *
 *   void R_Subsector (int num)
 *   {
 *       sscount++;
 *       sub = &subsectors[num];
 *       frontsector = sub->sector;
 *       count = sub->numlines;
 *       line = &segs[sub->firstline];
 *       if (frontsector->floorheight < viewz)
 *           floorplane = R_FindPlane (frontsector->floorheight,
 *                                     frontsector->floorpic,
 *                                     frontsector->lightlevel);
 *       else
 *           floorplane = NULL;
 *       if (frontsector->ceilingheight > viewz
 *           || frontsector->ceilingpic == skyflatnum)
 *           ceilingplane = R_FindPlane (frontsector->ceilingheight,
 *                                       frontsector->ceilingpic,
 *                                       frontsector->lightlevel);
 *       else
 *           ceilingplane = NULL;
 *       R_AddSprites (frontsector);
 *       while (count--) { R_AddLine (line); line++; }
 *   }
 *
 * `sscount` is a debug counter with no frame-pixel effect and is not
 * modelled.  `R_AddSprites` is deferred to the sprite increment (I6);
 * its omission does not affect the wall / visplane output this
 * increment targets.  This module is a pure orchestrator: it mutates
 * only the caller-owned visplane pool and clip state (vanilla's
 * globals) and returns the selected planes.
 */

import type { Visplane } from './renderLimits.ts';
import type { AddLineSeg, AddLineSector, AddLineView } from './addLine.ts';
import { addLine } from './addLine.ts';
import type { ClipState, StoreWallRangeFn } from './solidSegs.ts';
import { clipPassWallSegment, clipSolidWallSegment } from './solidSegs.ts';
import type { VisplanePool } from './visplanes.ts';
import { findPlane } from './visplanes.ts';

/** One subsector: its front sector plus the segs that bound it. */
export interface RSubsectorScene {
  /**
   * `sub->sector` — supplies `floorheight` / `ceilingheight` /
   * `floorpic` / `ceilingpic` / `lightlevel` for plane selection and
   * is the `frontsector` every contained seg classifies against.
   */
  readonly frontsector: AddLineSector;
  /** `&segs[sub->firstline]` … `firstline + numlines`, in order. */
  readonly segs: readonly AddLineSeg[];
}

/** View state `R_Subsector` reads (the I4a view plus `viewz` / `skyflatnum`). */
export interface RSubsectorView extends AddLineView {
  readonly viewz: number;
  /** Flat number that means "sky" (`skyflatnum`). */
  readonly skyflatnum: number;
}

/** The floor / ceiling visplanes `R_Subsector` selected (or `null`). */
export interface RSubsectorResult {
  readonly floorplane: Visplane | null;
  readonly ceilingplane: Visplane | null;
}

/**
 * r_bsp.c `R_Subsector` — select the subsector's floor / ceiling
 * visplanes and route every seg through `R_AddLine` →
 * `R_ClipSolidWallSegment` / `R_ClipPassWallSegment`.
 *
 * `store` is the per-fragment `R_StoreWallRange` callback (the I2
 * coordinator → wall-draw pipeline); it is invoked once per visible
 * screen-column fragment in vanilla order.  Returns the selected
 * planes for the wall renderer's visplane-marking step.
 */
export function rSubsector(scene: RSubsectorScene, view: RSubsectorView, pool: VisplanePool, state: ClipState, store: StoreWallRangeFn): RSubsectorResult {
  const { frontsector } = scene;

  const floorplane = frontsector.floorheight < view.viewz ? findPlane(pool, frontsector.floorheight, frontsector.floorpic, frontsector.lightlevel, view.skyflatnum) : null;

  const ceilingplane = frontsector.ceilingheight > view.viewz || frontsector.ceilingpic === view.skyflatnum ? findPlane(pool, frontsector.ceilingheight, frontsector.ceilingpic, frontsector.lightlevel, view.skyflatnum) : null;

  // R_AddSprites(frontsector) — deferred to the sprite increment (I6).

  for (const seg of scene.segs) {
    const dispatch = addLine(seg, frontsector, view);
    if (dispatch === null) {
      continue;
    }
    if (dispatch.kind === 'solid') {
      clipSolidWallSegment(state, dispatch.x1, dispatch.last, store);
    } else {
      clipPassWallSegment(state, dispatch.x1, dispatch.last, store);
    }
  }

  return { floorplane, ceilingplane };
}
