/**
 * Vanilla DOOM 1.9 A_Punch and A_Saw damage contracts.
 *
 * From Chocolate Doom 2.2.1 p_pspr.c A_Punch:
 *   damage = (P_Random() % 10 + 1) << 1;       // 2..20
 *   if (player->powers[pw_strength]) damage *= 10;
 *   angle = player->mo->angle + (P_SubRandom() << 18);
 *   P_LineAttack(player->mo, angle, MELEERANGE, slope, damage);
 *
 * From p_pspr.c A_Saw:
 *   damage = 2 * (P_Random() % 10 + 1);        // 2..20 (no berserk bonus)
 *   range  = MELEERANGE + 1;                   // boundary inclusive
 *   angle  = player->mo->angle + (P_SubRandom() << 18);
 *   On miss: sfx_sawful. On hit: sfx_sawhit + face-snap + MF_JUSTATTACKED.
 *
 * MELEERANGE is 64 * FRACUNIT (defined in p_local.h).
 */

import type { Fixed } from '../core/fixed.ts';

export const VANILLA_PUNCH_DAMAGE_MIN = 2;
export const VANILLA_PUNCH_DAMAGE_MAX = 20;
export const VANILLA_PUNCH_BERSERK_MULTIPLIER = 10;
export const VANILLA_SAW_DAMAGE_MIN = 2;
export const VANILLA_SAW_DAMAGE_MAX = 20;
export const VANILLA_MELEERANGE: Fixed = 64 * 0x1_0000;
export const VANILLA_SAW_RANGE_DELTA = 1;

export interface PunchDamageInput {
  readonly randomByte: number;
  readonly hasBerserk: boolean;
}

export function computeVanillaPunchDamage(input: PunchDamageInput): number {
  let damage = ((input.randomByte % 10) + 1) << 1;
  if (input.hasBerserk) {
    damage *= VANILLA_PUNCH_BERSERK_MULTIPLIER;
  }
  return damage;
}

export interface SawDamageInput {
  readonly randomByte: number;
}

export function computeVanillaSawDamage(input: SawDamageInput): number {
  return 2 * ((input.randomByte % 10) + 1);
}
