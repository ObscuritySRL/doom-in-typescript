/**
 * Vanilla DOOM 1.9 player weapon (psprite) rendering contract.
 *
 * From Chocolate Doom 2.2.1 r_things.c R_DrawPSprite and p_pspr.c:
 *   - psprites positioned at (sx, sy) in screen-space, both fixed.
 *   - WEAPONTOP = 32 << FRACBITS (default sy for weapon up).
 *   - WEAPONBOTTOM = 128 << FRACBITS (lowered).
 *   - PSpriteSY uses 100 (BASEYCENTER) as anchor.
 *   - Psprite renders at full bright when player has invulnerability or invuln
 *     fixedcolormap; otherwise uses spawnstate.frame & FF_FULLBRIGHT.
 *
 * NUMPSPRITES = 2 (ps_weapon, ps_flash slots).
 */

import { FRACBITS, type Fixed } from '../core/fixed.ts';

export const VANILLA_WEAPONTOP_FIXED: Fixed = (32 << FRACBITS) | 0;
export const VANILLA_WEAPONBOTTOM_FIXED: Fixed = (128 << FRACBITS) | 0;
export const VANILLA_NUMPSPRITES = 2;

export const PS_WEAPON = 0;
export const PS_FLASH = 1;
