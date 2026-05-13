/**
 * Vanilla DOOM 1.9 demon (MT_SERGEANT) and spectre (MT_SHADOWS) attack contract.
 *
 * From Chocolate Doom 2.2.1 p_enemy.c A_SargAttack:
 *   void A_SargAttack (mobj_t* actor) {
 *     if (!actor->target) return;
 *     A_FaceTarget (actor);
 *     if (P_CheckMeleeRange (actor)) {
 *       damage = ((P_Random()%10)+1)*4;
 *       P_DamageMobj (actor->target, actor, actor, damage);
 *     }
 *   }
 *
 * Notes for parity:
 *   - Demon melee damage = 4 * (1..10) = 4..40, mean ~22.
 *   - No sound effect plays on attack (the demon roar is on idle/wake).
 *   - Demons and spectres share A_SargAttack via mobjinfo[].meleestate;
 *     the spectre is a partial-invisibility variant (MF_SHADOW) with
 *     identical damage and reach. No projectile fallback.
 *   - No probability gate: always attacks when in melee range.
 */

export const VANILLA_DEMON_MELEE_DAMAGE_BASE = 4;
export const VANILLA_DEMON_MELEE_DAMAGE_MULTIPLIER_MAX = 10;
export const VANILLA_MT_SERGEANT = 8;
export const VANILLA_MT_SHADOWS = 9;

export interface DemonAttackInput {
  readonly inMeleeRange: boolean;
  readonly randomByte: number;
}

export interface DemonAttackResult {
  readonly attackKind: 'melee' | 'no-op';
  readonly damage: number;
}

export function applyVanillaDemonAttack(input: DemonAttackInput): DemonAttackResult {
  if (!input.inMeleeRange) {
    return Object.freeze({ attackKind: 'no-op', damage: 0 });
  }
  const damage = VANILLA_DEMON_MELEE_DAMAGE_BASE * ((input.randomByte % VANILLA_DEMON_MELEE_DAMAGE_MULTIPLIER_MAX) + 1);
  return Object.freeze({ attackKind: 'melee', damage });
}
