import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  MELEERANGE,
  MISSILERANGE,
  VANILLA_ARMOR_TYPE_BLUE,
  VANILLA_ARMOR_TYPE_GREEN,
  VANILLA_ARMOR_TYPE_NONE,
  VANILLA_PLAYER_DAMAGE_INVARIANTS,
  VANILLA_SKILL_BABY,
  VILE_ATTACK_DAMAGE,
  VILE_RADIUS_ATTACK_DAMAGE,
  applyVanillaPlayerDamage,
} from '../../../src/vanilla/wirePlayerDamage.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wirePlayerDamage.ts');
const FRACUNIT = 0x1_0000;

describe('plan_final player: wire-player-damage', () => {
  test('src/vanilla/wirePlayerDamage.ts exists, is a regular file, and cites plan_final step 09-008', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('09-008');
    expect(fileText).toContain('VANILLA_PLAYER_DAMAGE_INVARIANTS');
  });

  test('the facade re-exports only from the read-only player-damage + attacks modules', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('../'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../ai/attacks.ts', '../player/implement-player-damage-and-armor.ts']);
  });

  test('VANILLA_PLAYER_DAMAGE_INVARIANTS pins the five parity rules and is frozen', () => {
    expect(VANILLA_PLAYER_DAMAGE_INVARIANTS.length).toBe(5);
    expect(Object.isFrozen(VANILLA_PLAYER_DAMAGE_INVARIANTS)).toBe(true);
    const ids = VANILLA_PLAYER_DAMAGE_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual(['ARMOR_ABSORBS_THIRD_GREEN_HALF_BLUE', 'BABY_SKILL_HALVES_INCOMING_DAMAGE', 'DEPLETED_ARMOR_RESETS_TYPE_TO_NONE', 'GOD_MODE_NULLIFIES_ALL_DAMAGE', 'HEALTH_FLOORS_AT_ZERO_ON_DEATH']);
    for (const invariant of VANILLA_PLAYER_DAMAGE_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('the armor/skill + attack-damage constants match vanilla', () => {
    expect(VANILLA_ARMOR_TYPE_NONE).toBe(0);
    expect(VANILLA_ARMOR_TYPE_GREEN).toBe(1);
    expect(VANILLA_ARMOR_TYPE_BLUE).toBe(2);
    expect(VANILLA_SKILL_BABY).toBe(1);
    expect(VILE_ATTACK_DAMAGE).toBe(20);
    expect(VILE_RADIUS_ATTACK_DAMAGE).toBe(70);
    expect(MELEERANGE).toBe(64 * FRACUNIT);
    expect(MISSILERANGE).toBe(32 * 64 * FRACUNIT);
  });

  test('god mode nullifies all damage and leaves health unchanged', () => {
    const result = applyVanillaPlayerDamage({ damage: 100, health: 75, armorPoints: 0, armorType: 0, godMode: true, babySkill: false });
    expect(result.damageApplied).toBe(0);
    expect(result.health).toBe(75);
  });

  test('green absorbs a third, blue a half, and baby skill halves first', () => {
    const green = applyVanillaPlayerDamage({ damage: 30, health: 100, armorPoints: 100, armorType: 1, godMode: false, babySkill: false });
    expect(green).toEqual({ health: 80, armorPoints: 90, armorType: 1, damageApplied: 20, damageAbsorbed: 10 });

    const blue = applyVanillaPlayerDamage({ damage: 30, health: 100, armorPoints: 100, armorType: 2, godMode: false, babySkill: false });
    expect(blue).toEqual({ health: 85, armorPoints: 85, armorType: 2, damageApplied: 15, damageAbsorbed: 15 });

    const baby = applyVanillaPlayerDamage({ damage: 40, health: 100, armorPoints: 0, armorType: 0, godMode: false, babySkill: true });
    expect(baby.damageApplied).toBe(20);
    expect(baby.health).toBe(80);
  });

  test('depleted armor resets the type to none and health floors at zero on death', () => {
    const depleted = applyVanillaPlayerDamage({ damage: 30, health: 100, armorPoints: 5, armorType: 1, godMode: false, babySkill: false });
    expect(depleted.armorType).toBe(VANILLA_ARMOR_TYPE_NONE);
    expect(depleted.armorPoints).toBe(0);
    expect(depleted.damageAbsorbed).toBe(5);

    const dead = applyVanillaPlayerDamage({ damage: 250, health: 20, armorPoints: 0, armorType: 0, godMode: false, babySkill: false });
    expect(dead.health).toBe(0);
  });

  test('the re-exported symbols are the SAME references as the read-only source modules', async () => {
    const damageSource = await import('../../../src/player/implement-player-damage-and-armor.ts');
    const attacksSource = await import('../../../src/ai/attacks.ts');
    expect(applyVanillaPlayerDamage).toBe(damageSource.applyVanillaPlayerDamage);
    expect(VANILLA_ARMOR_TYPE_BLUE).toBe(damageSource.VANILLA_ARMOR_TYPE_BLUE);
    expect(VILE_ATTACK_DAMAGE).toBe(attacksSource.VILE_ATTACK_DAMAGE);
  });
});
