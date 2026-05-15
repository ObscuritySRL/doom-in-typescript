import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  BFG_SPRAY_DAMAGE_MASK,
  BFG_SPRAY_DAMAGE_ROLLS,
  BFG_SPRAY_RAY_COUNT,
  MISSILE_SPAWN_Z_OFFSET,
  MISSILE_TIC_JITTER_MASK,
  PLASMA_FLASH_JITTER_MASK,
  PROJECTILE_ACTION_COUNT,
  PROJECTILE_AIM_NUDGE,
  PROJECTILE_AIM_RANGE,
  VANILLA_PROJECTILE_WEAPON_INVARIANTS,
  aBFGSpray,
  aFireBFG,
  aFireMissile,
  aFirePlasma,
  explodeMissile,
  radiusAttack,
  wireProjectileActions,
} from '../../../src/vanilla/wireProjectileWeapons.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireProjectileWeapons.ts');
const FRACUNIT = 0x1_0000;

describe('plan_final player: wire-projectile-weapons', () => {
  test('src/vanilla/wireProjectileWeapons.ts exists, is a regular file, and cites plan_final step 09-006', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('09-006');
    expect(fileText).toContain('VANILLA_PROJECTILE_WEAPON_INVARIANTS');
  });

  test('the facade re-exports only from the read-only projectiles + radiusAttack modules', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('../'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../player/projectiles.ts', '../world/radiusAttack.ts']);
  });

  test('VANILLA_PROJECTILE_WEAPON_INVARIANTS pins the five parity rules and is frozen', () => {
    expect(VANILLA_PROJECTILE_WEAPON_INVARIANTS.length).toBe(5);
    expect(Object.isFrozen(VANILLA_PROJECTILE_WEAPON_INVARIANTS)).toBe(true);
    const ids = VANILLA_PROJECTILE_WEAPON_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual([
      'BFG_SPRAY_IS_40_RAYS_OVER_ANG90_HALF_ARC',
      'EXPLODE_MISSILE_APPLIES_RADIUS_ATTACK',
      'MISSILE_SPAWN_USES_FIXED_Z_OFFSET_AND_JITTER',
      'PROJECTILE_AUTOAIM_USES_AIM_RANGE_AND_NUDGE',
      'WIRE_REGISTERS_FOUR_PROJECTILE_ACTIONS',
    ]);
    for (const invariant of VANILLA_PROJECTILE_WEAPON_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('the projectile constants match vanilla p_pspr.c / p_mobj.c', () => {
    expect(PROJECTILE_ACTION_COUNT).toBe(4);
    expect(PROJECTILE_AIM_RANGE).toBe(16 * 64 * FRACUNIT);
    expect(PROJECTILE_AIM_NUDGE).toBe(1 << 26);
    expect(MISSILE_SPAWN_Z_OFFSET).toBe(4 * 8 * FRACUNIT);
    expect(MISSILE_TIC_JITTER_MASK).toBe(3);
    expect(PLASMA_FLASH_JITTER_MASK).toBe(1);
    expect(BFG_SPRAY_RAY_COUNT).toBe(40);
    expect(BFG_SPRAY_DAMAGE_ROLLS).toBe(15);
    expect(BFG_SPRAY_DAMAGE_MASK).toBe(7);
  });

  test('all four projectile fire actions are re-exported as callable functions', () => {
    expect(typeof aFireMissile).toBe('function');
    expect(typeof aFirePlasma).toBe('function');
    expect(typeof aFireBFG).toBe('function');
    expect(typeof aBFGSpray).toBe('function');
    expect(typeof explodeMissile).toBe('function');
    expect(typeof radiusAttack).toBe('function');
    expect(typeof wireProjectileActions).toBe('function');
  });

  test('the re-exported symbols are the SAME references as the read-only source modules', async () => {
    const projectilesSource = await import('../../../src/player/projectiles.ts');
    const radiusSource = await import('../../../src/world/radiusAttack.ts');
    expect(aFireBFG).toBe(projectilesSource.aFireBFG);
    expect(aBFGSpray).toBe(projectilesSource.aBFGSpray);
    expect(PROJECTILE_ACTION_COUNT).toBe(projectilesSource.PROJECTILE_ACTION_COUNT);
    expect(radiusAttack).toBe(radiusSource.radiusAttack);
  });
});
