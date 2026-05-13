/**
 * Vanilla DOOM 1.9 cacodemon (MT_HEAD) attack contract.
 *
 * From Chocolate Doom 2.2.1 p_enemy.c A_HeadAttack:
 *   void A_HeadAttack (mobj_t* actor) {
 *     if (!actor->target) return;
 *     A_FaceTarget (actor);
 *     if (P_CheckMeleeRange (actor)) {
 *       damage = (P_Random()%6+1)*10;
 *       P_DamageMobj (actor->target, actor, actor, damage);
 *       return;
 *     }
 *     P_SpawnMissile (actor, actor->target, MT_HEADSHOT);
 *   }
 *
 * Notes for parity:
 *   - Cacodemon bite damage = 10 * (1..6) = 10..60.
 *   - MT_HEAD = 26, MT_HEADSHOT = 24.
 *   - No probability gate. Always attacks when target present.
 */

export const VANILLA_CACO_BITE_DAMAGE_BASE = 10;
export const VANILLA_CACO_BITE_DAMAGE_MULTIPLIER_MAX = 6;
export const VANILLA_MT_HEAD = 26;
export const VANILLA_MT_HEADSHOT = 24;

export interface CacoAttackInput {
  readonly inMeleeRange: boolean;
  readonly randomByte: number;
}

export interface CacoAttackResult {
  readonly attackKind: 'melee' | 'missile';
  readonly damage: number;
  readonly missileType: number | null;
}

export function applyVanillaCacoAttack(input: CacoAttackInput): CacoAttackResult {
  if (input.inMeleeRange) {
    const damage = VANILLA_CACO_BITE_DAMAGE_BASE * ((input.randomByte % VANILLA_CACO_BITE_DAMAGE_MULTIPLIER_MAX) + 1);
    return Object.freeze({ attackKind: 'melee', damage, missileType: null });
  }
  return Object.freeze({ attackKind: 'missile', damage: 0, missileType: VANILLA_MT_HEADSHOT });
}
