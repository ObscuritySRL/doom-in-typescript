/**
 * Vanilla DOOM 1.9 hitscan aim and damage contract.
 *
 * From Chocolate Doom 2.2.1 p_map.c:
 *   #define MISSILERANGE  (32*64*FRACUNIT)  // 2048 map units
 *   #define MELEERANGE    (64*FRACUNIT)     // 64 map units
 *
 *   P_BulletSlope autoaim cascade:
 *     - First try +/- 1/32 angle nudge for autoaim
 *     - If no target, fall through to player's view direction
 *   P_GunShot bullet damage: damage = 5*((P_Random()%3)+1)
 *     - same formula as shotgun pellets
 */

import { FRACBITS, type Fixed } from '../core/fixed.ts';

export const VANILLA_MISSILERANGE_FIXED: Fixed = (32 * 64) << FRACBITS;
export const VANILLA_MELEERANGE_FIXED: Fixed = 64 << FRACBITS;
export const VANILLA_BULLET_BASE_DAMAGE = 5;
export const VANILLA_BULLET_DAMAGE_MAX_MUL = 3;

export const VANILLA_BULLET_AUTOAIM_ANGLE_NUDGE = (1 << 26) | 0; // 1/64 of 32-bit angle = ~5.6deg

export function computeBulletDamage(randomByte: number): number {
  return VANILLA_BULLET_BASE_DAMAGE * ((randomByte % VANILLA_BULLET_DAMAGE_MAX_MUL) + 1);
}
