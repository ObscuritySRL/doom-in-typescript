/**
 * Vanilla DOOM 1.9 R_DrawColumn / R_DrawColumnLow contract.
 *
 * From Chocolate Doom 2.2.1 r_draw.c:
 *
 *   void R_DrawColumn(void)
 *   {
 *       int  count;
 *       byte *dest;
 *       fixed_t frac;
 *       fixed_t fracstep;
 *
 *       count = dc_yh - dc_yl;
 *       if (count < 0) return;
 *
 *       dest = ylookup[dc_yl] + columnofs[dc_x];
 *       fracstep = dc_iscale;
 *       frac = dc_texturemid + (dc_yl - centery) * fracstep;
 *
 *       do {
 *           *dest = dc_colormap[dc_source[(frac >> FRACBITS) & 127]];
 *           dest += SCREENWIDTH;
 *           frac += fracstep;
 *       } while (count--);
 *   }
 *
 *   void R_DrawColumnLow(void)
 *   {
 *       // Same as above but writes 2 pixels per column (low-detail mode):
 *       //   *dest = pixel; *(dest+1) = pixel; dest += SCREENWIDTH;
 *       // Effectively halves horizontal resolution.
 *   }
 *
 * Notes for parity:
 *   - Texture column source array is 128 pixels tall (vanilla wall texture height limit).
 *     The mask `(frac >> FRACBITS) & 127` enforces this; taller textures wrap.
 *   - The pixel count drawn is `(dc_yh - dc_yl + 1)`; count<0 means no work to do.
 *   - frac starts at dc_texturemid + (dc_yl - centery) * fracstep (sub-pixel positioning).
 *   - fracstep = dc_iscale (inverse of scale; smaller means larger texture).
 *   - SCREENWIDTH stride applies in high-detail mode (320). Low-detail writes 2 pixels then advances.
 *   - dc_colormap[N] is the palette-indexed remap for distance fade and light-level.
 */

import { FRACBITS } from '../core/fixed.ts';

export const VANILLA_DRAW_COLUMN_TEXTURE_MASK = 127;
export const VANILLA_DRAW_COLUMN_TEXTURE_HEIGHT = 128;

export interface DrawColumnRangeInput {
  readonly dc_yl: number;
  readonly dc_yh: number;
}

export function vanillaDrawColumnPixelCount(input: DrawColumnRangeInput): number {
  const count = input.dc_yh - input.dc_yl + 1;
  return count > 0 ? count : 0;
}

export interface DrawColumnFracInput {
  readonly dc_texturemid: number;
  readonly dc_yl: number;
  readonly centery: number;
  readonly dc_iscale: number;
}

export function computeVanillaDrawColumnInitialFrac(input: DrawColumnFracInput): number {
  // frac = dc_texturemid + (dc_yl - centery) * fracstep
  return (input.dc_texturemid + (input.dc_yl - input.centery) * input.dc_iscale) | 0;
}

export interface DrawColumnTextureSampleInput {
  readonly frac: number;
}

export function vanillaDrawColumnTextureIndex(input: DrawColumnTextureSampleInput): number {
  return (input.frac >> FRACBITS) & VANILLA_DRAW_COLUMN_TEXTURE_MASK;
}

export type VanillaDrawColumnDetailMode = 'high' | 'low';

export function vanillaDrawColumnPixelStride(mode: VanillaDrawColumnDetailMode): number {
  return mode === 'low' ? 2 : 1;
}
