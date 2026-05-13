/**
 * Vanilla DOOM 1.9 sprite clipping against drawsegs contract.
 *
 * From Chocolate Doom 2.2.1 r_things.c R_DrawSprite:
 *   For each vissprite, iterate ds_p in reverse from ds_p-1 down to drawsegs[]:
 *     - Skip drawsegs entirely above or below the sprite's screen X range.
 *     - For each drawseg in the sprite's X range, clip the sprite to the
 *       drawseg's silhouette.
 *
 *   Silhouette mask: SIL_NONE=0, SIL_BOTTOM=1, SIL_TOP=2, SIL_BOTH=3.
 *   The drawseg's scale1/scale2 + silhouette determines clip ceiling/floor.
 *
 * MAXDRAWSEGS = 256 (vanilla limit on drawsegs per frame).
 */

export const VANILLA_MAXDRAWSEGS = 256;

export const SIL_NONE = 0;
export const SIL_BOTTOM = 1;
export const SIL_TOP = 2;
export const SIL_BOTH = 3;

export type SilhouetteMask = typeof SIL_NONE | typeof SIL_BOTTOM | typeof SIL_TOP | typeof SIL_BOTH;

export function hasBottomSilhouette(mask: number): boolean {
  return (mask & SIL_BOTTOM) !== 0;
}

export function hasTopSilhouette(mask: number): boolean {
  return (mask & SIL_TOP) !== 0;
}
