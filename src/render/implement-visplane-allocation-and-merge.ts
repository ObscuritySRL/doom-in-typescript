/**
 * Vanilla DOOM 1.9 R_FindPlane / R_CheckPlane visplane allocation contract.
 *
 * From Chocolate Doom 2.2.1 r_plane.c R_FindPlane / R_CheckPlane:
 *
 *   #define MAXVISPLANES 128
 *
 *   visplane_t* R_FindPlane(fixed_t height, int picnum, int lightlevel)
 *   {
 *       visplane_t* check;
 *
 *       if (picnum == skyflatnum)
 *       {
 *           height = 0;
 *           lightlevel = 0;
 *       }
 *
 *       for (check = visplanes; check < lastvisplane; check++)
 *       {
 *           if (height == check->height
 *               && picnum == check->picnum
 *               && lightlevel == check->lightlevel)
 *           {
 *               break;
 *           }
 *       }
 *
 *       if (check < lastvisplane)
 *           return check;
 *
 *       if (lastvisplane - visplanes == MAXVISPLANES)
 *           I_Error("R_FindPlane: no more visplanes");
 *
 *       lastvisplane++;
 *       check->height = height;
 *       check->picnum = picnum;
 *       check->lightlevel = lightlevel;
 *       check->minx = SCREENWIDTH;
 *       check->maxx = -1;
 *       memset(check->top, 0xff, sizeof(check->top));
 *       return check;
 *   }
 *
 *   visplane_t* R_CheckPlane(visplane_t* pl, int start, int stop)
 *   {
 *       // If [start, stop] does not overlap pl's existing extent OR pl's
 *       // top array is 0xff in the overlapping range, extend pl in-place.
 *       // Otherwise, allocate a new visplane that shares pl's metadata.
 *   }
 *
 * Notes for parity:
 *   - MAXVISPLANES = 128. Exceeding triggers "R_FindPlane: no more visplanes" hard error.
 *   - Sky (picnum == skyflatnum) collapses to height=0, lightlevel=0 so all sky
 *     surfaces share one visplane.
 *   - Match key for reuse is the (height, picnum, lightlevel) triple.
 *   - top[] is sentinel-initialized to 0xff (all bits set) on first allocation;
 *     0xff in top[x] means "no plane here for column x".
 *   - minx/maxx start as { SCREENWIDTH, -1 } (an empty inverted range that any
 *     real column will widen).
 */

export const VANILLA_MAXVISPLANES = 128;
export const VANILLA_VISPLANE_TOP_SENTINEL = 0xff;
export const VANILLA_VISPLANE_INITIAL_MINX = 320;
export const VANILLA_VISPLANE_INITIAL_MAXX = -1;

export interface VisplaneMatchKey {
  readonly height: number;
  readonly picnum: number;
  readonly lightlevel: number;
}

export interface VisplaneSkyCollapseInput extends VisplaneMatchKey {
  readonly skyflatnum: number;
}

export function collapseVanillaVisplaneSky(input: VisplaneSkyCollapseInput): VisplaneMatchKey {
  if (input.picnum === input.skyflatnum) {
    return Object.freeze({ height: 0, picnum: input.picnum, lightlevel: 0 });
  }
  return Object.freeze({ height: input.height, picnum: input.picnum, lightlevel: input.lightlevel });
}

export function vanillaVisplaneMatches(a: VisplaneMatchKey, b: VisplaneMatchKey): boolean {
  return a.height === b.height && a.picnum === b.picnum && a.lightlevel === b.lightlevel;
}

export interface VisplaneCheckOverlapInput {
  readonly plMinx: number;
  readonly plMaxx: number;
  readonly start: number;
  readonly stop: number;
}

export type VanillaVisplaneCheckResult = 'extend-in-place' | 'allocate-new';

export function classifyVanillaVisplaneCheck(input: VisplaneCheckOverlapInput): VanillaVisplaneCheckResult {
  // If [start,stop] is disjoint from [plMinx, plMaxx], the range extends without conflict.
  if (input.stop < input.plMinx || input.start > input.plMaxx) {
    return 'extend-in-place';
  }
  // Overlap requires checking top[] sentinels at runtime; this contract reports
  // the conservative case where overlap exists and must be checked further.
  return 'allocate-new';
}

export function vanillaVisplaneTopInitialValue(): number {
  return VANILLA_VISPLANE_TOP_SENTINEL;
}
