/**
 * Vanilla DOOM 1.9 P_DamageMobj player-side damage and armor contract.
 *
 * From Chocolate Doom 2.2.1 p_inter.c P_DamageMobj (player branch):
 *   - CF_GODMODE: damage = 0.
 *   - sk_baby skill: damage >>= 1 (half damage before armor).
 *   - Green armor (type 1): absorbs damage/3.
 *   - Blue armor (type 2): absorbs damage/2.
 *   - If armorpoints <= saved, armor is consumed and armortype clears to 0.
 *   - Remaining damage subtracts from player.health; clamped to >= 0.
 */

export const VANILLA_ARMOR_TYPE_NONE = 0;
export const VANILLA_ARMOR_TYPE_GREEN = 1;
export const VANILLA_ARMOR_TYPE_BLUE = 2;

export const VANILLA_SKILL_BABY = 1;

export interface PlayerDamageInput {
  readonly damage: number;
  readonly health: number;
  readonly armorPoints: number;
  readonly armorType: 0 | 1 | 2;
  readonly godMode: boolean;
  readonly babySkill: boolean;
}

export interface PlayerDamageOutput {
  readonly health: number;
  readonly armorPoints: number;
  readonly armorType: 0 | 1 | 2;
  readonly damageApplied: number;
  readonly damageAbsorbed: number;
}

export function applyVanillaPlayerDamage(input: PlayerDamageInput): PlayerDamageOutput {
  let damage = input.godMode ? 0 : input.damage;
  if (input.babySkill) {
    damage >>= 1;
  }
  let armorPoints = input.armorPoints;
  let armorType: 0 | 1 | 2 = input.armorType;
  let absorbed = 0;
  if (armorType !== 0 && damage > 0) {
    let saved = armorType === 1 ? Math.floor(damage / 3) : Math.floor(damage / 2);
    if (armorPoints <= saved) {
      saved = armorPoints;
      armorType = 0;
    }
    armorPoints -= saved;
    damage -= saved;
    absorbed = saved;
  }
  let health = input.health - damage;
  if (health < 0) {
    health = 0;
  }
  return {
    health,
    armorPoints,
    armorType,
    damageApplied: damage,
    damageAbsorbed: absorbed,
  };
}
