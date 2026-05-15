/**
 * Vanilla DOOM 1.9 player-damage / armor wiring facade.
 *
 * Plan_final step `09-008` (lane: player-weapons-items) wires the
 * player-damage path — armor absorption, the baby-skill halving,
 * god-mode/invulnerability nullification, and the death floor — over
 * the read-only `src/player/implement-player-damage-and-armor.ts`
 * (`P_DamageMobj` player branch) and the `src/ai/attacks.ts`
 * damage-source amounts.
 *
 * Those modules already implement the byte-exact p_inter.c
 * `P_DamageMobj` armor/skill math and the p_enemy.c attack damage
 * constants, and are SHA-pinned by the inventory; this module does
 * NOT modify them.  It is a pure re-export barrel (value/type split
 * for `verbatimModuleSyntax`, no `const enum`s) plus a frozen
 * invariants manifest.
 *
 * Five parity invariants this step pins:
 *
 *   1. Green armor (`VANILLA_ARMOR_TYPE_GREEN` = 1) absorbs ⌊d/3⌋
 *      and blue (`_BLUE` = 2) absorbs ⌊d/2⌋ of incoming damage.
 *   2. On baby skill (`VANILLA_SKILL_BABY`) incoming damage is
 *      right-shifted by one (halved) before armor.
 *   3. When the armor pool can't cover the saved amount the save is
 *      clamped to the remaining points and the armor type resets to
 *      `VANILLA_ARMOR_TYPE_NONE` (0).
 *   4. God mode / invulnerability nullifies the damage entirely
 *      (applied = 0, health unchanged).
 *   5. Health floors at 0 (death); it never goes negative.
 *
 * @example
 * ```ts
 * import { applyVanillaPlayerDamage, VANILLA_PLAYER_DAMAGE_INVARIANTS } from './wirePlayerDamage.ts';
 * applyVanillaPlayerDamage({ damage: 30, health: 100, armorPoints: 100, armorType: 1, godMode: false, babySkill: false }).damageAbsorbed; // 10
 * VANILLA_PLAYER_DAMAGE_INVARIANTS.length;                                                                                                // 5
 * ```
 */

export { VANILLA_ARMOR_TYPE_BLUE, VANILLA_ARMOR_TYPE_GREEN, VANILLA_ARMOR_TYPE_NONE, VANILLA_SKILL_BABY, applyVanillaPlayerDamage } from '../player/implement-player-damage-and-armor.ts';
export type { PlayerDamageInput, PlayerDamageOutput } from '../player/implement-player-damage-and-armor.ts';
export { MAX_SKULLS_PER_LEVEL, MELEERANGE, MISSILERANGE, VILE_ATTACK_DAMAGE, VILE_RADIUS_ATTACK_DAMAGE } from '../ai/attacks.ts';

/**
 * One pinned player-damage / armor parity invariant.
 */
export interface VanillaPlayerDamageInvariant {
  readonly id: 'ARMOR_ABSORBS_THIRD_GREEN_HALF_BLUE' | 'BABY_SKILL_HALVES_INCOMING_DAMAGE' | 'DEPLETED_ARMOR_RESETS_TYPE_TO_NONE' | 'GOD_MODE_NULLIFIES_ALL_DAMAGE' | 'HEALTH_FLOORS_AT_ZERO_ON_DEATH';
  readonly rule: string;
}

/**
 * Frozen manifest of the five player-damage / armor parity
 * invariants this step pins.  A later step that wires the live
 * P_DamageMobj player path must preserve all five.
 */
export const VANILLA_PLAYER_DAMAGE_INVARIANTS: readonly VanillaPlayerDamageInvariant[] = Object.freeze([
  Object.freeze({
    id: 'ARMOR_ABSORBS_THIRD_GREEN_HALF_BLUE',
    rule: 'Green armor (VANILLA_ARMOR_TYPE_GREEN 1) absorbs floor(damage/3); blue armor (VANILLA_ARMOR_TYPE_BLUE 2) absorbs floor(damage/2); the absorbed amount is deducted from both armorPoints and the damage, matching p_inter.c.',
  } satisfies VanillaPlayerDamageInvariant),
  Object.freeze({
    id: 'BABY_SKILL_HALVES_INCOMING_DAMAGE',
    rule: 'On baby skill (VANILLA_SKILL_BABY) the incoming damage is right-shifted by one (integer halved) before armor absorption, matching the sk_baby branch of P_DamageMobj.',
  } satisfies VanillaPlayerDamageInvariant),
  Object.freeze({
    id: 'DEPLETED_ARMOR_RESETS_TYPE_TO_NONE',
    rule: 'When armorPoints cannot cover the computed save, the save is clamped to the remaining armorPoints and armorType resets to VANILLA_ARMOR_TYPE_NONE (0), matching the armor-runs-out branch of P_DamageMobj.',
  } satisfies VanillaPlayerDamageInvariant),
  Object.freeze({
    id: 'GOD_MODE_NULLIFIES_ALL_DAMAGE',
    rule: 'God mode / invulnerability zeroes the incoming damage before any armor/health math, so damageApplied is 0 and health is unchanged, matching the CF_GODMODE / invulnerability branch.',
  } satisfies VanillaPlayerDamageInvariant),
  Object.freeze({
    id: 'HEALTH_FLOORS_AT_ZERO_ON_DEATH',
    rule: 'Resulting health is clamped at 0 (death); it never goes negative, matching the player.health < 0 -> 0 clamp in P_DamageMobj.',
  } satisfies VanillaPlayerDamageInvariant),
]);
