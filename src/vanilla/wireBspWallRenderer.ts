/**
 * Vanilla DOOM 1.9 BSP-walk + wall-rendering wiring.
 *
 * Plan_final step `06-002` (lane: render) wires the BSP
 * front-to-back walk + solidsegs + wall clipping + wall column
 * drawing primitives into a single bridge that consumes a runtime
 * {@link MapData} snapshot (from `08-001`) and a viewpoint.  The
 * read-only primitives already exist in `src/render/` and
 * `src/map/nodeTraversal.ts`; this step pins the canonical
 * front-to-back traversal order without modifying those modules.
 *
 * Vanilla `R_RenderBSPNode` recursively descends the BSP tree.  At
 * each internal node, the side the viewpoint lies on is rendered
 * first; the opposite side is rendered second.  When a leaf
 * (subsector, flagged by `NF_SUBSECTOR` in the child index) is
 * reached, the subsector's segs are emitted to the solidsegs /
 * wall renderer.  The result is a front-to-back ordered subsector
 * sequence the wall-rendering pass walks once per frame.
 *
 * This step exposes the traversal as a pure function that returns
 * the subsector index list.  Later render-lane steps consume the
 * list and route each subsector through the wall renderer.  The
 * function is deterministic — same MapData + same viewpoint
 * produces the same subsector sequence.
 *
 * @example
 * ```ts
 * import { walkBspFromViewpoint } from './wireBspWallRenderer.ts';
 * const subsectorOrder = walkBspFromViewpoint(mapData, viewX, viewY);
 * subsectorOrder.length;        // number of visible subsectors in front-to-back order
 * subsectorOrder[0];            // first subsector to render (closest to viewpoint)
 * ```
 */

import type { Fixed } from '../core/fixed.ts';
import { NF_SUBSECTOR } from '../map/bspStructs.ts';
import type { MapData } from '../map/mapSetup.ts';
import { pointOnSide } from '../map/nodeTraversal.ts';

/**
 * Walk the BSP tree front-to-back from the supplied viewpoint and
 * return the ordered subsector index list.  Matches the
 * `R_RenderBSPNode` recursive traversal in Chocolate Doom 2.2.1
 * `r_bsp.c`: at each internal node, the side the viewpoint lies on
 * is emitted first, then the opposite side; leaves (subsectors)
 * append their index to the result.
 *
 * Returns an empty array when `mapData.nodes` is empty (degenerate
 * maps with a single subsector and no BSP tree).  The function
 * does NOT consult the visplane budget, solidsegs limit, or
 * drawseg cap — those guards are applied per-subsector by the
 * wall-rendering pass that consumes this list.
 *
 * @param mapData The frozen MapData snapshot from
 *                {@link wireLevelSetup}.
 * @param viewX   Viewpoint X in 16.16 fixed-point.
 * @param viewY   Viewpoint Y in 16.16 fixed-point.
 * @returns A frozen array of subsector indices in front-to-back
 *          order.
 */
export function walkBspFromViewpoint(mapData: MapData, viewX: Fixed, viewY: Fixed): readonly number[] {
  if (mapData.nodes.length === 0) {
    if (mapData.subsectors.length > 0) {
      return Object.freeze([0]);
    }
    return Object.freeze<number[]>([]);
  }

  const visitOrder: number[] = [];
  const stack: number[] = [mapData.nodes.length - 1];

  while (stack.length > 0) {
    const nodeNumber = stack.pop()!;
    if ((nodeNumber & NF_SUBSECTOR) !== 0) {
      visitOrder.push(nodeNumber & ~NF_SUBSECTOR);
      continue;
    }
    const node = mapData.nodes[nodeNumber]!;
    const side = pointOnSide(viewX, viewY, node);
    const oppositeSide = (1 - side) as 0 | 1;
    stack.push(node.children[oppositeSide]);
    stack.push(node.children[side]);
  }

  return Object.freeze(visitOrder);
}
