import { describe, expect, test } from 'bun:test';

import { VANILLA_SCRIPTED_COMBAT_ORACLES } from '../../../src/player/compare-scripted-combat-oracle.ts';
import { applyVanillaPlayerDamage } from '../../../src/player/implement-player-damage-and-armor.ts';

describe('scripted combat oracles match P_DamageMobj player branch', () => {
  test('all oracle scenarios produce the pinned post-damage health and armor', () => {
    for (const scenario of VANILLA_SCRIPTED_COMBAT_ORACLES) {
      const result = applyVanillaPlayerDamage({
        damage: scenario.damage,
        health: scenario.preHealth,
        armorPoints: scenario.preArmorPoints,
        armorType: scenario.preArmorType,
        godMode: scenario.hasGodMode,
        babySkill: scenario.hasBabySkill,
      });
      expect(result.health).toBe(scenario.expectedHealth);
      expect(result.armorPoints).toBe(scenario.expectedArmorPoints);
      expect(result.armorType).toBe(scenario.expectedArmorType);
    }
  });

  test('oracle scenario ids are unique', () => {
    const ids = VANILLA_SCRIPTED_COMBAT_ORACLES.map((scenario) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every scenario has a non-empty description', () => {
    for (const scenario of VANILLA_SCRIPTED_COMBAT_ORACLES) {
      expect(scenario.description.length).toBeGreaterThan(0);
    }
  });
});
