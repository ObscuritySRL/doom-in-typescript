/**
 * Front-to-back BSP render walk with back-side culling — Chocolate
 * Doom 2.2.1 r_bsp.c `R_RenderBSPNode`.
 *
 * `walkBspFromViewpoint` (src/vanilla) returns the front-to-back
 * subsector order but OMITS the `R_CheckBBox` back-side cull (a known
 * parity gap).  The assembled renderer needs the faithful walk: at
 * each internal node, recurse the near child unconditionally, then
 * recurse the far child ONLY when {@link rCheckBBox} (I4b) says its
 * bounding box is still potentially visible against the solidsegs
 * clip list the near subtree just extended.  That ordering — near
 * subtree fully processed (mutating the I3 clip state) BEFORE the far
 * box is tested — is why this is a recursive transcription, not a
 * flattened stack walk.
 *
 * Verbatim r_bsp.c contract:
 *
 *   void R_RenderBSPNode (int bspnum)
 *   {
 *       if (bspnum & NF_SUBSECTOR) {
 *           if (bspnum == -1) R_Subsector (0);
 *           else              R_Subsector (bspnum & (~NF_SUBSECTOR));
 *           return;
 *       }
 *       bsp  = &nodes[bspnum];
 *       side = R_PointOnSide (viewx, viewy, bsp);
 *       R_RenderBSPNode (bsp->children[side]);
 *       if (R_CheckBBox (bsp->bbox[side^1]))
 *           R_RenderBSPNode (bsp->children[side^1]);
 *   }
 *
 * `R_Subsector` is supplied as the `onSubsector` callback (the
 * sequencer wires it to I4c {@link rSubsector}, which mutates the
 * shared {@link ClipState} the next `rCheckBBox` reads).  `NF_SUBSECTOR`
 * / `R_PointOnSide` reuse the committed map primitives.  Pure with
 * respect to its own state: the only effects are the `onSubsector`
 * callbacks (in exact vanilla order) and whatever they mutate.
 */

import type { Fixed } from '../core/fixed.ts';
import { NF_SUBSECTOR } from '../map/bspStructs.ts';
import type { MapNode } from '../map/bspStructs.ts';
import { pointOnSide } from '../map/nodeTraversal.ts';

import type { CheckBBoxView } from './checkBBox.ts';
import { rCheckBBox } from './checkBBox.ts';
import type { ClipState } from './solidSegs.ts';

/** `R_Subsector` callback — invoked once per visible subsector, in vanilla front-to-back order. */
export type SubsectorVisitor = (subsectorIndex: number) => void;

/** The BSP slice + view + clip state `R_RenderBSPNode` reads. */
export interface RenderBspScene {
  readonly nodes: readonly MapNode[];
  /** Count of subsectors (only consulted for the degenerate empty-`nodes` map). */
  readonly subsectorCount: number;
}

/**
 * `bspnum & NF_SUBSECTOR` decode.  In vanilla the child index is a
 * `short`; `-1` (0xFFFF with the 0x8000 bit set) means "subsector 0"
 * (degenerate single-leaf maps).
 */
function descend(bspnum: number, scene: RenderBspScene, view: CheckBBoxView, state: ClipState, onSubsector: SubsectorVisitor): void {
  if ((bspnum & NF_SUBSECTOR) !== 0) {
    if (bspnum === -1) {
      onSubsector(0);
    } else {
      onSubsector(bspnum & ~NF_SUBSECTOR);
    }
    return;
  }

  const bsp = scene.nodes[bspnum]!;
  const side = pointOnSide(view.viewx, view.viewy, bsp);
  const farSide = (side ^ 1) as 0 | 1;

  // Recurse the near side first (it extends the solidsegs clip list).
  descend(bsp.children[side]!, scene, view, state, onSubsector);

  // Only recurse the far side if its bounding box survives the cull
  // against the clip list the near subtree just produced.
  const farBox = bsp.bbox[farSide] as readonly [Fixed, Fixed, Fixed, Fixed];
  if (rCheckBBox(farBox, view, state)) {
    descend(bsp.children[farSide]!, scene, view, state, onSubsector);
  }
}

/**
 * r_bsp.c `R_RenderBSPNode` entry — walk the BSP tree front-to-back
 * from `view`, applying the {@link rCheckBBox} back-side cull, and
 * invoke `onSubsector` for every visible subsector in vanilla order.
 *
 * Mirrors the engine entry `R_RenderBSPNode(numnodes - 1)`.  For the
 * degenerate empty-`nodes` map (single subsector, no tree) it visits
 * subsector 0 when one exists, matching `walkBspFromViewpoint`.
 */
export function renderBspNode(scene: RenderBspScene, view: CheckBBoxView, state: ClipState, onSubsector: SubsectorVisitor): void {
  if (scene.nodes.length === 0) {
    if (scene.subsectorCount > 0) {
      onSubsector(0);
    }
    return;
  }
  descend(scene.nodes.length - 1, scene, view, state, onSubsector);
}
