/**
 * Full-pipeline per-subsector orchestration — the completed Chocolate
 * Doom 2.2.1 r_bsp.c `R_Subsector`, with the per-seg `curline` store
 * wired.
 *
 * The committed I4c {@link rSubsector} models the same r_bsp.c contract
 * but takes a single stub `store` (the `R_StoreWallRange` binding was
 * not yet assembled at that step). Vanilla `R_AddLine` sets the
 * per-seg `curline` / `rw_angle1` globals before the clip call, and
 * `R_StoreWallRange` reads *those*; a shared store cannot carry that.
 * This is `R_Subsector` with that resolved: each seg gets its own
 * `curline`-bound store from the I4d {@link makeSegStoreFactory} (built
 * from the `rw_angle1` {@link addLine} yields), exactly mirroring
 * vanilla's per-`curline` `R_StoreWallRange`.
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
 *           floorplane = R_FindPlane (...floorheight, floorpic, lightlevel);
 *       else floorplane = NULL;
 *       if (frontsector->ceilingheight > viewz
 *           || frontsector->ceilingpic == skyflatnum)
 *           ceilingplane = R_FindPlane (...ceilingheight, ceilingpic, lightlevel);
 *       else ceilingplane = NULL;
 *       R_AddSprites (frontsector);
 *       while (count--) { R_AddLine (line); line++; }
 *   }
 *
 * `sscount` is a debug counter with no frame-pixel effect (not
 * modelled). `R_AddSprites` is deferred to the sprite increment (I6);
 * its omission does not affect the wall / visplane output. A seg
 * `R_AddLine` rejects (back-facing / off-edge / sub-pixel / empty
 * trigger) produces no clip call — vanilla `R_AddLine` just `return`s —
 * while still advancing `line`, so iterating by absolute seg index is
 * equivalent. Pure orchestrator: mutates only the caller-owned
 * visplane pool and clip state (vanilla globals); returns the selected
 * planes for the wall renderer's visplane-marking step.
 */

import type { AddLineSeg, AddLineSector, AddLineView } from './addLine.ts';
import { addLine } from './addLine.ts';
import type { Visplane } from './renderLimits.ts';
import type { SegStore } from './segStoreFactory.ts';
import type { ClipState } from './solidSegs.ts';
import { clipPassWallSegment, clipSolidWallSegment } from './solidSegs.ts';
import type { VisplanePool } from './visplanes.ts';
import { findPlane } from './visplanes.ts';

/** One subsector: its front sector plus addressable segs (`sub->sector` / `firstline` / `numlines`). */
export interface RenderSubsectorScene {
  /**
   * `sub->sector` — `floorheight` / `ceilingheight` / `floorpic` /
   * `ceilingpic` / `lightlevel` for plane selection and the
   * `frontsector` every contained seg classifies against.
   */
  readonly frontsector: AddLineSector;
  /** `sub->firstline` — absolute index of this subsector's first seg. */
  readonly firstseg: number;
  /** `sub->numlines` — seg count. */
  readonly numsegs: number;
  /**
   * `&segs[segIndex]` as an {@link AddLineSeg}. `segIndex` is absolute
   * (`firstseg + k`); the same index is handed to the {@link SegStore}
   * so its `segRenderModel` resolves the identical `curline`.
   */
  readonly addLineSegAt: (segIndex: number) => AddLineSeg;
}

/** View state `R_Subsector` reads (the I4a view plus `viewz` / `skyflatnum`). */
export interface RenderSubsectorView extends AddLineView {
  readonly viewz: number;
  /** Flat number that means "sky" (`skyflatnum`). */
  readonly skyflatnum: number;
}

/** The floor / ceiling visplanes `R_Subsector` selected (or `null`). */
export interface RenderSubsectorResult {
  readonly floorplane: Visplane | null;
  readonly ceilingplane: Visplane | null;
}

/**
 * r_bsp.c `R_Subsector` (completed) — select the subsector's floor /
 * ceiling visplanes and route every seg through `R_AddLine` →
 * `R_ClipSolidWallSegment` / `R_ClipPassWallSegment` with that seg's
 * own `curline`-bound `R_StoreWallRange`.
 *
 * @param segStore - The I4d per-seg store factory; called `segStore(segIndex, d.rwAngle1)` after `R_AddLine`.
 * @returns The selected planes for the wall renderer's visplane-marking step.
 *
 * @example
 * ```ts
 * const segStore = makeSegStoreFactory(scene, flatNum, texNum, view, textures, resolve, drawSolid, drawTwoSided);
 * const { floorplane, ceilingplane } = renderSubsector(subScene, view, pool, state, segStore);
 * ```
 */
export function renderSubsector(scene: RenderSubsectorScene, view: RenderSubsectorView, pool: VisplanePool, state: ClipState, segStore: SegStore): RenderSubsectorResult {
  const fs = scene.frontsector;

  const floorplane = fs.floorheight < view.viewz ? findPlane(pool, fs.floorheight, fs.floorpic, fs.lightlevel, view.skyflatnum) : null;

  const ceilingplane = fs.ceilingheight > view.viewz || fs.ceilingpic === view.skyflatnum ? findPlane(pool, fs.ceilingheight, fs.ceilingpic, fs.lightlevel, view.skyflatnum) : null;

  // R_AddSprites(frontsector) — deferred to the sprite increment (I6).

  for (let k = 0; k < scene.numsegs; k += 1) {
    const segIndex = scene.firstseg + k;
    const dispatch = addLine(scene.addLineSegAt(segIndex), fs, view);
    if (dispatch === null) {
      continue;
    }
    const store = segStore(segIndex, dispatch.rwAngle1);
    if (dispatch.kind === 'solid') {
      clipSolidWallSegment(state, dispatch.x1, dispatch.last, store);
    } else {
      clipPassWallSegment(state, dispatch.x1, dispatch.last, store);
    }
  }

  return { floorplane, ceilingplane };
}
