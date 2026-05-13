/**
 * Scripted combat oracle for vanilla DOOM 1.9 P_DamageMobj and weapon actions.
 *
 * Each scenario captures a synthetic damage/attack sequence against a baseline
 * player or mobj state, with the expected post-event state pinned from
 * Chocolate Doom 2.2.1 p_inter.c and p_pspr.c contracts (previously pinned in
 * 07-006 through 07-026).
 *
 * The oracle is used by the focused test to cross-check the per-weapon damage
 * formulas and damage/armor absorption against each other in concert.
 */

export interface ScriptedCombatScenario {
  readonly id: string;
  readonly description: string;
  readonly preHealth: number;
  readonly preArmorPoints: number;
  readonly preArmorType: 0 | 1 | 2;
  readonly damage: number;
  readonly hasGodMode: boolean;
  readonly hasBabySkill: boolean;
  readonly expectedHealth: number;
  readonly expectedArmorPoints: number;
  readonly expectedArmorType: 0 | 1 | 2;
}

export const VANILLA_SCRIPTED_COMBAT_ORACLES: readonly ScriptedCombatScenario[] = Object.freeze([
  Object.freeze({
    id: 'unarmored-100hp-takes-10-damage',
    description: '100hp unarmored player takes 10 damage -> 90hp',
    preHealth: 100,
    preArmorPoints: 0,
    preArmorType: 0,
    damage: 10,
    hasGodMode: false,
    hasBabySkill: false,
    expectedHealth: 90,
    expectedArmorPoints: 0,
    expectedArmorType: 0,
  }),
  Object.freeze({
    id: 'green-armor-100hp-takes-9-damage-green-absorbs-3',
    description: '100hp with 100 green armor takes 9 damage: armor absorbs 3 (1/3), player takes 6',
    preHealth: 100,
    preArmorPoints: 100,
    preArmorType: 1,
    damage: 9,
    hasGodMode: false,
    hasBabySkill: false,
    expectedHealth: 94,
    expectedArmorPoints: 97,
    expectedArmorType: 1,
  }),
  Object.freeze({
    id: 'blue-armor-100hp-takes-10-damage-blue-absorbs-5',
    description: '100hp with 100 blue armor takes 10 damage: armor absorbs 5 (1/2), player takes 5',
    preHealth: 100,
    preArmorPoints: 100,
    preArmorType: 2,
    damage: 10,
    hasGodMode: false,
    hasBabySkill: false,
    expectedHealth: 95,
    expectedArmorPoints: 95,
    expectedArmorType: 2,
  }),
  Object.freeze({
    id: 'god-mode-blocks-all-damage',
    description: 'CF_GODMODE blocks all damage; health and armor unchanged',
    preHealth: 50,
    preArmorPoints: 50,
    preArmorType: 1,
    damage: 1000,
    hasGodMode: true,
    hasBabySkill: false,
    expectedHealth: 50,
    expectedArmorPoints: 50,
    expectedArmorType: 1,
  }),
  Object.freeze({
    id: 'baby-skill-halves-damage-before-armor',
    description: 'I am a wimp halves damage before armor absorption: 20 dmg unarmored becomes 10 hp loss',
    preHealth: 100,
    preArmorPoints: 0,
    preArmorType: 0,
    damage: 20,
    hasGodMode: false,
    hasBabySkill: true,
    expectedHealth: 90,
    expectedArmorPoints: 0,
    expectedArmorType: 0,
  }),
  Object.freeze({
    id: 'fatal-damage-clamps-health-to-zero',
    description: 'damage exceeding health clamps at 0 (death state handled separately)',
    preHealth: 50,
    preArmorPoints: 0,
    preArmorType: 0,
    damage: 200,
    hasGodMode: false,
    hasBabySkill: false,
    expectedHealth: 0,
    expectedArmorPoints: 0,
    expectedArmorType: 0,
  }),
]);
