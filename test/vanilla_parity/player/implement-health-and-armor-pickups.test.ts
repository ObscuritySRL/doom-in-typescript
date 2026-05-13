import { describe, expect, test } from 'bun:test';

import {
  VANILLA_BLUE_ARMOR_POINTS,
  VANILLA_DEH_MAX_HEALTH,
  VANILLA_GREEN_ARMOR_POINTS,
  VANILLA_MAXARMOR,
  VANILLA_MAXHEALTH,
  applyArmorPickup,
  applyBonusPickup,
  applyHealthPickup,
} from '../../../src/player/implement-health-and-armor-pickups.ts';

describe('vanilla pickup constants', () => {
  test('MAXHEALTH=100, MAXARMOR=200, DEH_MAX_HEALTH=200', () => {
    expect(VANILLA_MAXHEALTH).toBe(100);
    expect(VANILLA_MAXARMOR).toBe(200);
    expect(VANILLA_DEH_MAX_HEALTH).toBe(200);
  });

  test('green armor: 100 points, blue armor: 200 points', () => {
    expect(VANILLA_GREEN_ARMOR_POINTS).toBe(100);
    expect(VANILLA_BLUE_ARMOR_POINTS).toBe(200);
  });
});

describe('applyHealthPickup', () => {
  test('stimpack +10 caps at MAXHEALTH', () => {
    const r = applyHealthPickup({ currentHealth: 95, amount: 10, cap: VANILLA_MAXHEALTH });
    expect(r.newHealth).toBe(100);
    expect(r.gave).toBe(true);
  });

  test('does not give when at cap', () => {
    const r = applyHealthPickup({ currentHealth: 100, amount: 10, cap: VANILLA_MAXHEALTH });
    expect(r.gave).toBe(false);
  });

  test('medikit +25 within MAXHEALTH', () => {
    const r = applyHealthPickup({ currentHealth: 50, amount: 25, cap: VANILLA_MAXHEALTH });
    expect(r.newHealth).toBe(75);
  });

  test('soulsphere caps at DEH_MAX_HEALTH=200', () => {
    const r = applyHealthPickup({ currentHealth: 150, amount: 100, cap: VANILLA_DEH_MAX_HEALTH });
    expect(r.newHealth).toBe(200);
  });
});

describe('applyArmorPickup', () => {
  test('green armor sets to 100 when below', () => {
    const r = applyArmorPickup({ currentArmorPoints: 50, currentArmorType: 1, newArmorType: 1 });
    expect(r.newArmorPoints).toBe(100);
    expect(r.newArmorType).toBe(1);
    expect(r.gave).toBe(true);
  });

  test('blue armor sets to 200 when below', () => {
    const r = applyArmorPickup({ currentArmorPoints: 100, currentArmorType: 1, newArmorType: 2 });
    expect(r.newArmorPoints).toBe(200);
    expect(r.newArmorType).toBe(2);
    expect(r.gave).toBe(true);
  });

  test('does not give green armor when armorpoints >= 100', () => {
    const r = applyArmorPickup({ currentArmorPoints: 100, currentArmorType: 1, newArmorType: 1 });
    expect(r.gave).toBe(false);
  });
});

describe('applyBonusPickup', () => {
  test('adds 1 within range', () => {
    const r = applyBonusPickup(100);
    expect(r.newValue).toBe(101);
    expect(r.gave).toBe(true);
  });

  test('does not give at cap 200', () => {
    const r = applyBonusPickup(200);
    expect(r.gave).toBe(false);
  });
});
