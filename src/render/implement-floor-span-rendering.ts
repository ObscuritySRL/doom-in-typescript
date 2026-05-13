/**
 * Vanilla DOOM 1.9 R_MapPlane / R_MakeSpans floor span rendering contract.
 *
 * From Chocolate Doom 2.2.1 r_plane.c R_MapPlane and R_MakeSpans:
 *
 *   void R_MapPlane(int y, int x1, int x2)
 *   {
 *       angle_t  angle;
 *       fixed_t  distance;
 *       fixed_t  length;
 *       unsigned index;
 *
 *       distance = FixedMul(planeheight, yslope[y]);
 *       ds_xstep = FixedMul(distance, basexscale);
 *       ds_ystep = FixedMul(distance, baseyscale);
 *
 *       length = FixedMul(distance, distscale[x1]);
 *       angle = (viewangle + xtoviewangle[x1]) >> ANGLETOFINESHIFT;
 *       ds_xfrac = viewx + FixedMul(finecosine[angle], length);
 *       ds_yfrac = -viewy - FixedMul(finesine[angle], length);
 *
 *       if (fixedcolormap)
 *           ds_colormap = fixedcolormap;
 *       else
 *       {
 *           index = distance >> LIGHTZSHIFT;
 *           if (index >= MAXLIGHTZ) index = MAXLIGHTZ - 1;
 *           ds_colormap = planezlight[index];
 *       }
 *
 *       ds_y = y;
 *       ds_x1 = x1;
 *       ds_x2 = x2;
 *
 *       R_DrawSpan();
 *   }
 *
 *   #define LIGHTZSHIFT  20
 *   #define MAXLIGHTZ    128
 *
 * Notes for parity:
 *   - LIGHTZSHIFT=20 shifts the fixed-point distance into the light-z lookup index space.
 *   - MAXLIGHTZ=128 caps the distance-light table; anything farther uses the dimmest entry.
 *   - The clamp uses `>=` so MAXLIGHTZ-1 is the dimmest valid entry (index 127).
 *   - ds_yfrac uses NEGATIVE viewy (`-viewy - ...`) — y-axis is inverted in the
 *     flat coordinate system relative to world coordinates.
 *   - fixedcolormap takes precedence over the distance-lit table (used during the
 *     invulnerability inverse colormap or the goggles infrared).
 */

export const VANILLA_LIGHTZSHIFT = 20;
export const VANILLA_MAXLIGHTZ = 128;

export interface PlaneDistanceLightInput {
  readonly distance: number;
}

export function vanillaPlaneDistanceLightIndex(input: PlaneDistanceLightInput): number {
  let index = input.distance >> VANILLA_LIGHTZSHIFT;
  if (index >= VANILLA_MAXLIGHTZ) {
    index = VANILLA_MAXLIGHTZ - 1;
  }
  if (index < 0) {
    index = 0;
  }
  return index;
}

export interface SpanYfracInput {
  readonly viewy: number;
  readonly sineAtAngle: number;
  readonly length: number;
}

export function computeVanillaSpanYfrac(input: SpanYfracInput): number {
  // Upstream: ds_yfrac = -viewy - FixedMul(finesine[angle], length)
  return (-input.viewy - ((input.sineAtAngle * input.length) | 0)) | 0;
}

export interface SpanColormapSelectInput {
  readonly fixedcolormap: number | null;
  readonly distance: number;
  readonly planezlightAtIndex: (index: number) => number;
}

export function selectVanillaSpanColormap(input: SpanColormapSelectInput): number {
  if (input.fixedcolormap !== null) {
    return input.fixedcolormap;
  }
  return input.planezlightAtIndex(vanillaPlaneDistanceLightIndex({ distance: input.distance }));
}
