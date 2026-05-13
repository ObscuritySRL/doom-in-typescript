import { describe, expect, test } from 'bun:test';

import { VANILLA_ARMOR_TYPE_BLUE, VANILLA_ARMOR_TYPE_GREEN, VANILLA_ARMOR_TYPE_NONE, VANILLA_SKILL_BABY, applyVanillaPlayerDamage } from '../../../src/player/implement-player-damage-and-armor.ts';

describe('vanilla armor and skill constants', () => {
  test('armor types: NONE=0, GREEN=1, BLUE=2', () => {
    expect(VANILLA_ARMOR_TYPE_NONE).toBe(0);
    expect(VANILLA_ARMOR_TYPE_GREEN).toBe(1);
    expect(VANILLA_ARMOR_TYPE_BLUE).toBe(2);
  });

  test('SKILL_BABY enum value is 1 (sk_baby)', () => {
    expect(VANILLA_SKILL_BABY).toBe(1);
  });
});

describe('applyVanillaPlayerDamage', () => {
  test('god mode forces damage to 0', () => {
    const result = applyVanillaPlayerDamage({ damage: 100, health: 100, armorPoints: 0, armorType: 0, godMode: true, babySkill: false });
    expect(result.health).toBe(100);
    expect(result.damageApplied).toBe(0);
  });

  test('baby skill halves damage before armor', () => {
    const result = applyVanillaPlayerDamage({ damage: 20, health: 100, armorPoints: 0, armorType: 0, godMode: false, babySkill: true });
    expect(result.damageApplied).toBe(10);
    expect(result.health).toBe(90);
  });

  test('green armor absorbs damage/3 with floor', () => {
    const result = applyVanillaPlayerDamage({ damage: 30, health: 100, armorPoints: 100, armorType: 1, godMode: false, babySkill: false });
    expect(result.damageAbsorbed).toBe(10);
    expect(result.armorPoints).toBe(90);
    expect(result.damageApplied).toBe(20);
    expect(result.health).toBe(80);
  });

  test('blue armor absorbs damage/2 with floor', () => {
    const result = applyVanillaPlayerDamage({ damage: 30, health: 100, armorPoints: 100, armorType: 2, godMode: false, babySkill: false });
    expect(result.damageAbsorbed).toBe(15);
    expect(result.armorPoints).toBe(85);
    expect(result.damageApplied).toBe(15);
    expect(result.health).toBe(85);
  });

  test('armor is consumed and armortype clears when armorpoints <= saved', () => {
    const result = applyVanillaPlayerDamage({ damage: 30, health: 100, armorPoints: 5, armorType: 1, godMode: false, babySkill: false });
    expect(result.damageAbsorbed).toBe(5);
    expect(result.armorPoints).toBe(0);
    expect(result.armorType).toBe(0);
    expect(result.health).toBe(75);
  });

  test('health clamps to 0 on lethal damage', () => {
    const result = applyVanillaPlayerDamage({ damage: 1000, health: 50, armorPoints: 0, armorType: 0, godMode: false, babySkill: false });
    expect(result.health).toBe(0);
  });

  test('zero damage leaves state untouched', () => {
    const result = applyVanillaPlayerDamage({ damage: 0, health: 100, armorPoints: 50, armorType: 2, godMode: false, babySkill: false });
    expect(result.health).toBe(100);
    expect(result.armorPoints).toBe(50);
    expect(result.armorType).toBe(2);
    expect(result.damageApplied).toBe(0);
    expect(result.damageAbsorbed).toBe(0);
  });
});
