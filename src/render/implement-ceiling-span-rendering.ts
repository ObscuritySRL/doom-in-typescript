/**
 * Vanilla DOOM 1.9 ceiling visplane / span rendering contract.
 *
 * From Chocolate Doom 2.2.1 r_plane.c R_DrawPlanes / R_MapPlane:
 *
 *   // Ceilings and floors both pass through R_MapPlane.  The only practical
 *   // difference is which plane heights are above viewz (ceiling) vs below (floor).
 *   //
 *   // R_DrawPlanes walks every visplane, and per-visplane walks columns from
 *   // minx-1 to maxx+1 to flush the column spans.  For ceiling planes, the top
 *   // of each column comes from pl->top[x] and bottom from pl->bottom[x], same
 *   // as floors -- the planeheight just happens to be > viewz.
 *
 *   // Sky special case (R_DrawPlanes):
 *   if (pl->picnum == skyflatnum)
 *   {
 *       dc_iscale = pspriteiscale >> detailshift;
 *       dc_colormap = colormaps;
 *       dc_texturemid = skytexturemid;
 *       for (x = pl->minx; x <= pl->maxx; x++)
 *       {
 *           dc_yl = pl->top[x];
 *           dc_yh = pl->bottom[x];
 *           if (dc_yl <= dc_yh)
 *           {
 *               angle = (viewangle + xtoviewangle[x]) >> ANGLETOSKYSHIFT;
 *               dc_x = x;
 *               dc_source = R_GetColumn(skytexture, angle);
 *               colfunc();
 *           }
 *       }
 *       continue;
 *   }
 *
 * Notes for parity:
 *   - Sky picnum routes through R_DrawColumn (not R_DrawSpan).
 *   - Sky uses ANGLETOSKYSHIFT=22 (not ANGLETOFINESHIFT=19) — sky moves slower
 *     than world textures with respect to view angle.
 *   - dc_iscale = pspriteiscale >> detailshift (sky texture is at fixed projection scale).
 *   - dc_colormap = colormaps (raw colormap base, no distance fade).
 *   - dc_texturemid = skytexturemid (precomputed in R_InitSkyMap as 100 << FRACBITS for vanilla).
 *   - The non-sky ceiling path is identical to the floor path (R_MapPlane).
 *   - The ceiling/floor distinction is purely the planeheight sign relative to viewz.
 */

export const VANILLA_ANGLETOSKYSHIFT = 22;
export const VANILLA_SKYTEXTUREMID_FRAC = 100 * 0x10000;
export const VANILLA_SKY_PIC_FLAT_SENTINEL_VALUE = -1;

export interface CeilingPlaneClassifyInput {
  readonly planeHeight: number;
  readonly viewZ: number;
}

export type VanillaCeilingClassification = 'ceiling' | 'floor' | 'in-plane';

export function classifyVanillaPlaneAsCeilingOrFloor(input: CeilingPlaneClassifyInput): VanillaCeilingClassification {
  if (input.planeHeight > input.viewZ) {
    return 'ceiling';
  }
  if (input.planeHeight < input.viewZ) {
    return 'floor';
  }
  return 'in-plane';
}

export interface SkyColumnAngleIndexInput {
  readonly viewangle: number;
  readonly xtoviewangleAtX: number;
}

export function computeVanillaSkyColumnAngleIndex(input: SkyColumnAngleIndexInput): number {
  const sum = (input.viewangle + input.xtoviewangleAtX) >>> 0;
  return sum >>> VANILLA_ANGLETOSKYSHIFT;
}

export function vanillaSkyPlaneTakesColumnPath(picnum: number, skyflatnum: number): boolean {
  return picnum === skyflatnum;
}
