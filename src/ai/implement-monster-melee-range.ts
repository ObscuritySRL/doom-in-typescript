/**
 * Vanilla DOOM 1.9 P_CheckMeleeRange contract.
 *
 * From Chocolate Doom 2.2.1 p_enemy.c P_CheckMeleeRange:
 *   boolean P_CheckMeleeRange (mobj_t* actor) {
 *     mobj_t*  pl;
 *     fixed_t  dist;
 *     if (!actor->target) return false;
 *     pl = actor->target;
 *     dist = P_AproxDistance(pl->x - actor->x, pl->y - actor->y);
 *     if (dist >= MELEERANGE - 20*FRACUNIT + pl->info->radius) return false;
 *     if (!P_CheckSight(actor, actor->target)) return false;
 *     return true;
 *   }
 *
 * Parity-critical:
 *   - MELEERANGE = 64 * FRACUNIT (same as USERANGE).
 *   - The -20*FRACUNIT slack and +target->info->radius tunes the actual melee
 *     check to "approach within 44 units + target radius" not full 64.
 *   - Sight check is required (P_CheckSight using LOS through BSP).
 *   - If actor->target is null, return false (no melee target).
 */

import { FRACUNIT } from '../core/fixed.ts';

export const VANILLA_MELEERANGE_FIXED = 64 * FRACUNIT;
export const VANILLA_MELEE_RANGE_SLACK_FIXED = 20 * FRACUNIT;

export function computeMeleeRangeThreshold(targetRadiusFixed: number): number {
  return VANILLA_MELEERANGE_FIXED - VANILLA_MELEE_RANGE_SLACK_FIXED + targetRadiusFixed;
}

export interface MeleeRangeInput {
  readonly distanceFixed: number;
  readonly targetRadiusFixed: number;
  readonly sightLineClear: boolean;
  readonly hasTarget: boolean;
}

export function isInVanillaMeleeRange(input: MeleeRangeInput): boolean {
  if (!input.hasTarget) {
    return false;
  }
  if (input.distanceFixed >= computeMeleeRangeThreshold(input.targetRadiusFixed)) {
    return false;
  }
  return input.sightLineClear;
}
