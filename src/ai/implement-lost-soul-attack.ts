/**
 * Vanilla DOOM 1.9 Lost Soul (MT_SKULL) attack contract.
 *
 * From Chocolate Doom 2.2.1 p_enemy.c A_SkullAttack:
 *   void A_SkullAttack (mobj_t* actor) {
 *     mobj_t* dest;
 *     angle_t an;
 *     int speed;
 *     if (!actor->target) return;
 *     dest = actor->target;
 *     actor->flags |= MF_SKULLFLY;
 *     S_StartSound (actor, sfx_sklatk);
 *     A_FaceTarget (actor);
 *     speed = SKULLSPEED;       // 20*FRACUNIT
 *     an = actor->angle >> ANGLETOFINESHIFT;
 *     actor->momx = FixedMul(speed, finecosine[an]);
 *     actor->momy = FixedMul(speed, finesine[an]);
 *     int dist = P_AproxDistance(dest->x - actor->x, dest->y - actor->y);
 *     dist = dist / SKULLSPEED;
 *     if (dist < 1) dist = 1;
 *     actor->momz = (dest->z + (dest->height>>1) - actor->z) / dist;
 *   }
 *
 * When the lost soul collides (via SKULLFLY MF_), A_SkullCollide does
 * damage = (P_Random()%8+1)*actor.info.damage = (1..8)*3 = 3..24.
 */

import { FRACBITS, type Fixed } from '../core/fixed.ts';

export const VANILLA_SKULL_SPEED_FIXED: Fixed = (20 << FRACBITS) | 0;
export const VANILLA_SKULL_INFO_DAMAGE = 3;
export const VANILLA_SKULL_DAMAGE_MULTIPLIER_MAX = 8;
export const VANILLA_MT_SKULL = 19;
export const VANILLA_SFX_SKLATK = 71;

export function computeLostSoulCollisionDamage(randomByte: number): number {
  return VANILLA_SKULL_INFO_DAMAGE * ((randomByte % VANILLA_SKULL_DAMAGE_MULTIPLIER_MAX) + 1);
}
