/**
 * Vanilla DOOM 1.9 imp (MT_TROOP) attack contract.
 *
 * From Chocolate Doom 2.2.1 p_enemy.c A_TroopAttack:
 *   void A_TroopAttack (mobj_t* actor) {
 *     if (!actor->target) return;
 *     A_FaceTarget (actor);
 *     if (P_CheckMeleeRange (actor)) {
 *       S_StartSound (actor, sfx_claw);
 *       damage = (P_Random()%8+1)*3;
 *       P_DamageMobj (actor->target, actor, actor, damage);
 *       return;
 *     }
 *     // launch a missile
 *     P_SpawnMissile (actor, actor->target, MT_TROOPSHOT);
 *   }
 *
 * Notes for parity:
 *   - Imp melee damage = 3 * (1..8) = 3..24, mean ~13.5.
 *   - sfx_claw = 32 (sounds.h sfxenum_t).
 *   - MT_TROOPSHOT = 23 (mobjinfo[].mobjtype).
 *   - Imps always attempt melee first; missile is the fallback when
 *     P_CheckMeleeRange fails. There is no probability gate.
 */

export const VANILLA_IMP_MELEE_DAMAGE_BASE = 3;
export const VANILLA_IMP_MELEE_DAMAGE_MULTIPLIER_MAX = 8;
export const VANILLA_SFX_CLAW = 32;
export const VANILLA_MT_TROOPSHOT = 23;

export interface ImpAttackInput {
  readonly inMeleeRange: boolean;
  readonly randomByte: number;
}

export interface ImpAttackResult {
  readonly attackKind: 'melee' | 'missile';
  readonly damage: number;
  readonly soundId: number | null;
  readonly missileType: number | null;
}

export function applyVanillaImpAttack(input: ImpAttackInput): ImpAttackResult {
  if (input.inMeleeRange) {
    const damage = VANILLA_IMP_MELEE_DAMAGE_BASE * ((input.randomByte % VANILLA_IMP_MELEE_DAMAGE_MULTIPLIER_MAX) + 1);
    return Object.freeze({ attackKind: 'melee', damage, soundId: VANILLA_SFX_CLAW, missileType: null });
  }
  return Object.freeze({ attackKind: 'missile', damage: 0, soundId: null, missileType: VANILLA_MT_TROOPSHOT });
}
