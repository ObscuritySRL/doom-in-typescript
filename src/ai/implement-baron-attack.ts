/**
 * Vanilla DOOM 1.9 Baron of Hell (MT_BRUISER) and Hell Knight (MT_KNIGHT) attack contract.
 *
 * From Chocolate Doom 2.2.1 p_enemy.c A_BruisAttack:
 *   void A_BruisAttack (mobj_t* actor) {
 *     if (!actor->target) return;
 *     if (P_CheckMeleeRange (actor)) {
 *       S_StartSound (actor, sfx_claw);
 *       damage = (P_Random()%8+1)*10;
 *       P_DamageMobj (actor->target, actor, actor, damage);
 *       return;
 *     }
 *     P_SpawnMissile (actor, actor->target, MT_BRUISERSHOT);
 *   }
 *
 * Notes:
 *   - Bruiser claw damage = 10 * (1..8) = 10..80.
 *   - Both Baron (MT_BRUISER=15) and Hell Knight (MT_KNIGHT=14) share A_BruisAttack.
 *   - MT_BRUISERSHOT = 22 (green plasma fireball, info.damage = 8).
 */

export const VANILLA_BRUIS_CLAW_DAMAGE_BASE = 10;
export const VANILLA_BRUIS_CLAW_DAMAGE_MULTIPLIER_MAX = 8;
export const VANILLA_MT_BRUISER = 15;
export const VANILLA_MT_KNIGHT = 14;
export const VANILLA_MT_BRUISERSHOT = 22;
export const VANILLA_BRUISERSHOT_INFO_DAMAGE = 8;

export function applyVanillaBaronAttack(inMeleeRange: boolean, randomByte: number): { readonly attackKind: 'melee' | 'missile'; readonly damage: number; readonly missileType: number | null } {
  if (inMeleeRange) {
    const damage = VANILLA_BRUIS_CLAW_DAMAGE_BASE * ((randomByte % VANILLA_BRUIS_CLAW_DAMAGE_MULTIPLIER_MAX) + 1);
    return Object.freeze({ attackKind: 'melee', damage, missileType: null });
  }
  return Object.freeze({ attackKind: 'missile', damage: 0, missileType: VANILLA_MT_BRUISERSHOT });
}
