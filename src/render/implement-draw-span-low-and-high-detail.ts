/**
 * Vanilla DOOM 1.9 R_DrawSpan / R_DrawSpanLow contract.
 *
 * From Chocolate Doom 2.2.1 r_draw.c:
 *
 *   void R_DrawSpan(void)
 *   {
 *       fixed_t  xfrac, yfrac;
 *       byte    *dest;
 *       int      count;
 *       int      spot;
 *
 *       xfrac = ds_xfrac;
 *       yfrac = ds_yfrac;
 *       dest = ylookup[ds_y] + columnofs[ds_x1];
 *       count = ds_x2 - ds_x1;
 *
 *       do {
 *           spot = ((yfrac >> (16 - 6)) & (63 * 64))
 *                | ((xfrac >> 16) & 63);
 *           *dest++ = ds_colormap[ds_source[spot]];
 *           xfrac += ds_xstep;
 *           yfrac += ds_ystep;
 *       } while (count--);
 *   }
 *
 *   void R_DrawSpanLow(void)
 *   {
 *       // Same as above but writes 2 pixels per step:
 *       //   *dest++ = *dest++ = pixel;
 *       // and ds_x1/ds_x2 are halved for low-detail.
 *   }
 *
 * Notes for parity:
 *   - Flat textures are 64x64 = 4096 bytes. The index `((yfrac >> 10) & 0x3F00) | ((xfrac >> 16) & 0x3F)`
 *     extracts 6 bits of y at positions 6..11 (giving y * 64) and 6 bits of x at positions 0..5.
 *   - 0x3F00 is the y-mask after the >> 10 shift; 0x3F is the x-mask after the >> 16 shift.
 *   - Span pixel count is `ds_x2 - ds_x1 + 1` (do/while runs count+1 times).
 *   - Low-detail mode writes 2 pixels per step.
 */

export const VANILLA_FLAT_TEXTURE_DIMENSION = 64;
export const VANILLA_FLAT_TEXTURE_SIZE = 64 * 64;
export const VANILLA_DRAW_SPAN_Y_MASK = 63 * 64;
export const VANILLA_DRAW_SPAN_X_MASK = 0x3f;
export const VANILLA_DRAW_SPAN_Y_SHIFT = 10;
export const VANILLA_DRAW_SPAN_X_SHIFT = 16;

export interface SpanRangeInput {
  readonly ds_x1: number;
  readonly ds_x2: number;
}

export function vanillaDrawSpanPixelCount(input: SpanRangeInput): number {
  const count = input.ds_x2 - input.ds_x1 + 1;
  return count > 0 ? count : 0;
}

export interface SpanFlatSampleInput {
  readonly xfrac: number;
  readonly yfrac: number;
}

export function vanillaDrawSpanFlatIndex(input: SpanFlatSampleInput): number {
  return ((input.yfrac >> VANILLA_DRAW_SPAN_Y_SHIFT) & VANILLA_DRAW_SPAN_Y_MASK) | ((input.xfrac >> VANILLA_DRAW_SPAN_X_SHIFT) & VANILLA_DRAW_SPAN_X_MASK);
}

export type VanillaDrawSpanDetailMode = 'high' | 'low';

export function vanillaDrawSpanPixelStride(mode: VanillaDrawSpanDetailMode): number {
  return mode === 'low' ? 2 : 1;
}
