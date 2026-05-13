/**
 * Vanilla DOOM 1.9 BSP render walk contract.
 *
 * From Chocolate Doom 2.2.1 r_bsp.c R_RenderBSPNode and r_defs.h:
 *
 *   #define NF_SUBSECTOR 0x8000
 *
 *   void R_RenderBSPNode(int bspnum)
 *   {
 *       node_t *bsp;
 *       int     side;
 *
 *       if (bspnum & NF_SUBSECTOR)
 *       {
 *           if (bspnum == -1)
 *               R_Subsector(0);
 *           else
 *               R_Subsector(bspnum & (~NF_SUBSECTOR));
 *           return;
 *       }
 *
 *       bsp = &nodes[bspnum];
 *       side = R_PointOnSide(viewx, viewy, bsp);
 *
 *       R_RenderBSPNode(bsp->children[side]);
 *
 *       if (R_CheckBBox(bsp->bbox[side ^ 1]))
 *           R_RenderBSPNode(bsp->children[side ^ 1]);
 *   }
 *
 * Notes for parity:
 *   - NF_SUBSECTOR = 0x8000 marks a child index as referring to a subsector
 *     (rather than another BSP node).
 *   - The special value -1 (which has bit 0x8000 set when bitmasked unsigned)
 *     means "subsector 0" — used for empty levels.
 *   - Children[0] is the FRONT half-space; children[1] is the BACK half-space.
 *   - R_PointOnSide returns 0 if (viewx, viewy) is on the front side, 1 if back.
 *   - The render walk goes FRONT first (recursion on children[side]), then
 *     checks back-side bbox visibility before recursing into back half.
 *   - This front-to-back order is critical for correct draw order in the
 *     painter's-algorithm-free vanilla renderer.
 */

export const VANILLA_NF_SUBSECTOR = 0x8000;
export const VANILLA_BSP_EMPTY_SENTINEL_INT16 = -1;

export interface BspChildInput {
  readonly bspnum: number;
}

export function vanillaBspChildIsSubsector(input: BspChildInput): boolean {
  return (input.bspnum & VANILLA_NF_SUBSECTOR) !== 0;
}

export function decodeVanillaBspSubsectorIndex(bspnum: number): number {
  if (bspnum === VANILLA_BSP_EMPTY_SENTINEL_INT16) {
    return 0;
  }
  if ((bspnum & VANILLA_NF_SUBSECTOR) === 0) {
    throw new RangeError(`bspnum ${bspnum} is not a subsector reference (bit 0x8000 not set)`);
  }
  return bspnum & ~VANILLA_NF_SUBSECTOR;
}

export type VanillaBspSide = 0 | 1;

export function vanillaBspOppositeSide(side: VanillaBspSide): VanillaBspSide {
  return (side ^ 1) as VanillaBspSide;
}

export interface BspRenderOrderInput {
  readonly side: VanillaBspSide;
}

export interface BspRenderOrderResult {
  readonly firstChildIndex: 0 | 1;
  readonly secondChildIndex: 0 | 1;
}

export function getVanillaBspRenderOrder(input: BspRenderOrderInput): BspRenderOrderResult {
  return Object.freeze({
    firstChildIndex: input.side,
    secondChildIndex: vanillaBspOppositeSide(input.side),
  });
}
