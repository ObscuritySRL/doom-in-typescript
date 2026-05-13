import { describe, expect, test } from 'bun:test';

import { VANILLA_SCRIPTED_PICKUP_ORACLES } from '../../../src/player/compare-scripted-pickup-oracle.ts';

describe('vanilla scripted pickup oracle', () => {
  test('oracle has at least 5 scenarios covering health, armor, and backpack', () => {
    expect(VANILLA_SCRIPTED_PICKUP_ORACLES.length).toBeGreaterThanOrEqual(5);
  });

  test('every scenario has unique id', () => {
    const ids = VANILLA_SCRIPTED_PICKUP_ORACLES.map((scenario) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every scenario object is frozen', () => {
    for (const scenario of VANILLA_SCRIPTED_PICKUP_ORACLES) {
      expect(Object.isFrozen(scenario)).toBe(true);
    }
  });

  test('stimpack at full health does not change state (vanilla quirk)', () => {
    const scenario = VANILLA_SCRIPTED_PICKUP_ORACLES.find((s) => s.id === 'stimpack-from-100');
    expect(scenario).toBeDefined();
    expect(scenario?.expectedHealth).toBe(scenario?.preHealth);
  });

  test('soulsphere bumps health to 200 (deh_max_soulsphere)', () => {
    const scenario = VANILLA_SCRIPTED_PICKUP_ORACLES.find((s) => s.id === 'soulsphere-from-100');
    expect(scenario?.expectedHealth).toBe(200);
  });

  test('green armor sets armorpoints=100 type=1 from zero', () => {
    const scenario = VANILLA_SCRIPTED_PICKUP_ORACLES.find((s) => s.id === 'green-armor-from-zero');
    expect(scenario?.expectedArmorPoints).toBe(100);
    expect(scenario?.expectedArmorType).toBe(1);
  });

  test('backpack doubles maxammo and grants 10 bullets', () => {
    const scenario = VANILLA_SCRIPTED_PICKUP_ORACLES.find((s) => s.id === 'backpack-fresh');
    expect(scenario?.expectedBackpack).toBe(true);
    expect(scenario?.expectedMaxBullets).toBe(400);
    expect(scenario?.expectedBullets).toBe(60);
  });
});
