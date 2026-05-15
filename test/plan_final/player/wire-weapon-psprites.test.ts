import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  VANILLA_WEAPON_PSPRITE_ENTRY_POINTS,
  aCheckReload,
  aGunFlash,
  aLower,
  aRaise,
  aReFire,
  aWeaponReady,
  checkAmmo,
  dropWeapon,
  fireWeapon,
  getWeaponStateContext,
  giveAmmo,
  giveBackpack,
  giveWeapon,
  setWeaponStateContext,
} from '../../../src/vanilla/wireWeaponPsprites.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireWeaponPsprites.ts');

describe('plan_final player: wire-weapon-psprites', () => {
  test('src/vanilla/wireWeaponPsprites.ts exists, is a regular file, and cites plan_final step 09-004', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('09-004');
    expect(fileText).toContain('VANILLA_WEAPON_PSPRITE_ENTRY_POINTS');
  });

  test('the facade re-exports from the read-only weapons + weaponStates modules without modifying them', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain("from '../player/weapons.ts'");
    expect(fileText).toContain("from '../player/weaponStates.ts'");
  });

  test('VANILLA_WEAPON_PSPRITE_ENTRY_POINTS pins the eleven canonical entry points and is frozen', () => {
    expect(VANILLA_WEAPON_PSPRITE_ENTRY_POINTS).toEqual(['aCheckReload', 'aGunFlash', 'aLower', 'aRaise', 'aReFire', 'aWeaponReady', 'checkAmmo', 'dropWeapon', 'fireWeapon', 'giveAmmo', 'giveWeapon']);
    expect(Object.isFrozen(VANILLA_WEAPON_PSPRITE_ENTRY_POINTS)).toBe(true);
  });

  test('every wired weapon + psprite-state function is re-exported as a callable function', () => {
    expect(typeof giveAmmo).toBe('function');
    expect(typeof giveWeapon).toBe('function');
    expect(typeof giveBackpack).toBe('function');
    expect(typeof checkAmmo).toBe('function');
    expect(typeof fireWeapon).toBe('function');
    expect(typeof dropWeapon).toBe('function');
    expect(typeof aWeaponReady).toBe('function');
    expect(typeof aLower).toBe('function');
    expect(typeof aRaise).toBe('function');
    expect(typeof aReFire).toBe('function');
    expect(typeof aCheckReload).toBe('function');
    expect(typeof aGunFlash).toBe('function');
    expect(typeof setWeaponStateContext).toBe('function');
    expect(typeof getWeaponStateContext).toBe('function');
  });

  test('the re-exported functions are the SAME references as the read-only source modules export', async () => {
    const weaponsSource = await import('../../../src/player/weapons.ts');
    const weaponStatesSource = await import('../../../src/player/weaponStates.ts');
    expect(giveWeapon).toBe(weaponsSource.giveWeapon);
    expect(checkAmmo).toBe(weaponsSource.checkAmmo);
    expect(fireWeapon).toBe(weaponStatesSource.fireWeapon);
    expect(aWeaponReady).toBe(weaponStatesSource.aWeaponReady);
  });
});
