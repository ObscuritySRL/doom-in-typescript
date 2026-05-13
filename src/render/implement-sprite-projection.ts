/**
 * Vanilla DOOM 1.9 sprite projection contract.
 *
 * From Chocolate Doom 2.2.1 r_things.c R_ProjectSprite:
 *   - Transform mobj world position into view space: tr_x = x - viewx, etc.
 *   - tz = tr_x * viewcos + tr_y * viewsin (depth).
 *   - If tz < MINZ (= 4 << FRACBITS = 4 fixed): reject (too close to view).
 *   - tx = -(tr_y * viewcos - tr_x * viewsin) (lateral).
 *   - xscale = projection / tz (sprite scale).
 *   - Sprite x screen position: x1 = centerxfrac + tx * xscale.
 *   - If sprite x1 > viewwidth or x1+xscale*width < 0: cull.
 *
 * MINZ = 4 fixed (minimum depth to render sprite).
 * BASEYCENTER = 100 (logical screen center row).
 */

import { FRACBITS, type Fixed } from '../core/fixed.ts';

export const VANILLA_SPRITE_MINZ_FIXED: Fixed = (4 << FRACBITS) | 0;
export const VANILLA_SPRITE_BASEYCENTER = 100;
export const VANILLA_SCREENWIDTH = 320;
export const VANILLA_SCREENHEIGHT = 200;

export function isSpriteTooCloseToReject(viewDepthFixed: Fixed): boolean {
  return viewDepthFixed < VANILLA_SPRITE_MINZ_FIXED;
}
