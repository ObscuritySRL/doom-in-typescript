/**
 * `subsectorIndex` → completed `R_Subsector` adapter — the
 * {@link SubsectorVisitor} the I4 {@link renderBspNode} /
 * {@link renderPlayerViewWalls} BSP walk invokes per visible subsector.
 *
 * `renderBspNode` decodes the BSP tree and calls
 * `onSubsector(subsectorIndex)` front-to-back (vanilla
 * `R_RenderBSPNode` → `R_Subsector(num)`). The completed
 * {@link renderSubsector} needs that subsector resolved to its
 * `sub->sector` front sector and `sub->firstline` / `numlines` seg
 * span. This adapter is exactly that resolution, then the
 * `renderSubsector` call with the per-subsector store factory threaded
 * through (the factory is constructed once per subsector, after plane
 * selection, by `renderSubsector` itself — see its contract).
 *
 * The map-side accessors (`subsectorAt`, `frontsectorOf`,
 * `addLineSegAt`) and the bound render context (`view`, `pool`,
 * `state`, `makeSegStore`) are caller-injected, keeping this pure
 * composition glue with no map-format or runtime coupling.  The
 * vanilla `R_Subsector` return is `void`; the selected planes are
 * consumed via the per-seg resolve targets `makeSegStore` binds (and
 * live in the caller's `pool`), so this visitor discards the result —
 * matching {@link SubsectorVisitor}.
 *
 * Pure; no Win32 or runtime dependencies.
 */

import type { MapSubsector } from '../map/bspStructs.ts';

import type { AddLineSeg, AddLineSector } from './addLine.ts';
import type { SubsectorVisitor } from './renderBspNode.ts';
import { renderSubsector } from './renderSubsector.ts';
import type { RenderSubsectorResult, RenderSubsectorScene, RenderSubsectorView } from './renderSubsector.ts';
import type { SegStore } from './segStoreFactory.ts';
import type { ClipState } from './solidSegs.ts';
import type { VisplanePool } from './visplanes.ts';

/** The map accessors + bound render context the visitor closes over. */
export interface SubsectorVisitorDeps {
  /** `&subsectors[subsectorIndex]` — its `firstseg` / `numsegs`. */
  readonly subsectorAt: (subsectorIndex: number) => MapSubsector;
  /** `sub->sector` as an {@link AddLineSector} (the subsector's front sector). */
  readonly frontsectorOf: (subsectorIndex: number) => AddLineSector;
  /** `&segs[segIndex]` as an {@link AddLineSeg} (absolute index). */
  readonly addLineSegAt: (segIndex: number) => AddLineSeg;
  /** The frame view state `R_Subsector` reads (`viewz` / `skyflatnum` + I4a view). */
  readonly view: RenderSubsectorView;
  /** Caller-owned visplane pool (vanilla `visplanes`). */
  readonly pool: VisplanePool;
  /** Caller-owned clip list (vanilla `solidsegs`). */
  readonly state: ClipState;
  /** Builds the per-seg store factory from the subsector's selected planes (invoked once per subsector). */
  readonly makeSegStore: (planes: RenderSubsectorResult) => SegStore;
}

/**
 * Build the {@link SubsectorVisitor} for one frame's render context.
 * Each invocation resolves `subsectorIndex` to its
 * {@link RenderSubsectorScene} and runs the completed `R_Subsector`.
 *
 * @example
 * ```ts
 * const onSubsector = makeSubsectorVisitor({ subsectorAt, frontsectorOf, addLineSegAt, view, pool, state, makeSegStore });
 * renderBspNode(bspScene, checkBBoxView, state, onSubsector);
 * ```
 */
export function makeSubsectorVisitor(deps: SubsectorVisitorDeps): SubsectorVisitor {
  return (subsectorIndex: number): void => {
    const sub = deps.subsectorAt(subsectorIndex);
    const scene: RenderSubsectorScene = {
      frontsector: deps.frontsectorOf(subsectorIndex),
      firstseg: sub.firstseg,
      numsegs: sub.numsegs,
      addLineSegAt: deps.addLineSegAt,
    };
    renderSubsector(scene, deps.view, deps.pool, deps.state, deps.makeSegStore);
  };
}
