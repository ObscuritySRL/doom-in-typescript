import { describe, expect, test } from 'bun:test';

import { VANILLA_DROP_WEAPON_PRIORITY, isWeaponSelectable, pickBestAutoSwitchWeapon } from '../../../src/player/implement-weapon-ownership-and-selection.ts';
import { VANILLA_WP_BFG, VANILLA_WP_CHAINGUN, VANILLA_WP_CHAINSAW, VANILLA_WP_FIST, VANILLA_WP_MISSILE, VANILLA_WP_PISTOL, VANILLA_WP_PLASMA, VANILLA_WP_SHOTGUN } from '../../../src/player/implement-weapon-pickups.ts';

const owns = (...indices: readonly number[]): readonly boolean[] => {
  const owned = Array.from({ length: 9 }, () => false);
  for (const index of indices) {
    owned[index] = true;
  }
  return owned;
};

describe('vanilla auto-switch priority order (P_DropWeapon)', () => {
  test('priority order matches vanilla: plasma, chaingun, shotgun, pistol, chainsaw, fist', () => {
    expect([...VANILLA_DROP_WEAPON_PRIORITY]).toEqual([VANILLA_WP_PLASMA, VANILLA_WP_CHAINGUN, VANILLA_WP_SHOTGUN, VANILLA_WP_PISTOL, VANILLA_WP_CHAINSAW, VANILLA_WP_FIST]);
  });
});

describe('isWeaponSelectable', () => {
  test('fist is always selectable when owned (no ammo)', () => {
    expect(isWeaponSelectable({ weaponType: VANILLA_WP_FIST, weaponowned: owns(VANILLA_WP_FIST), ammo: [0, 0, 0, 0] })).toBe(true);
  });

  test('chainsaw is always selectable when owned (no ammo)', () => {
    expect(isWeaponSelectable({ weaponType: VANILLA_WP_CHAINSAW, weaponowned: owns(VANILLA_WP_CHAINSAW), ammo: [0, 0, 0, 0] })).toBe(true);
  });

  test('pistol needs at least 1 clip ammo', () => {
    expect(isWeaponSelectable({ weaponType: VANILLA_WP_PISTOL, weaponowned: owns(VANILLA_WP_PISTOL), ammo: [0, 50, 50, 50] })).toBe(false);
    expect(isWeaponSelectable({ weaponType: VANILLA_WP_PISTOL, weaponowned: owns(VANILLA_WP_PISTOL), ammo: [1, 0, 0, 0] })).toBe(true);
  });

  test('shotgun needs shells', () => {
    expect(isWeaponSelectable({ weaponType: VANILLA_WP_SHOTGUN, weaponowned: owns(VANILLA_WP_SHOTGUN), ammo: [50, 0, 50, 50] })).toBe(false);
    expect(isWeaponSelectable({ weaponType: VANILLA_WP_SHOTGUN, weaponowned: owns(VANILLA_WP_SHOTGUN), ammo: [0, 1, 0, 0] })).toBe(true);
  });

  test('plasma needs cells', () => {
    expect(isWeaponSelectable({ weaponType: VANILLA_WP_PLASMA, weaponowned: owns(VANILLA_WP_PLASMA), ammo: [50, 50, 0, 50] })).toBe(false);
    expect(isWeaponSelectable({ weaponType: VANILLA_WP_PLASMA, weaponowned: owns(VANILLA_WP_PLASMA), ammo: [0, 0, 1, 0] })).toBe(true);
  });

  test('rocket launcher needs missiles', () => {
    expect(isWeaponSelectable({ weaponType: VANILLA_WP_MISSILE, weaponowned: owns(VANILLA_WP_MISSILE), ammo: [50, 50, 50, 0] })).toBe(false);
    expect(isWeaponSelectable({ weaponType: VANILLA_WP_MISSILE, weaponowned: owns(VANILLA_WP_MISSILE), ammo: [0, 0, 0, 1] })).toBe(true);
  });

  test('BFG needs cells', () => {
    expect(isWeaponSelectable({ weaponType: VANILLA_WP_BFG, weaponowned: owns(VANILLA_WP_BFG), ammo: [50, 50, 0, 50] })).toBe(false);
    expect(isWeaponSelectable({ weaponType: VANILLA_WP_BFG, weaponowned: owns(VANILLA_WP_BFG), ammo: [0, 0, 40, 0] })).toBe(true);
  });

  test('unowned weapon is never selectable', () => {
    expect(isWeaponSelectable({ weaponType: VANILLA_WP_PLASMA, weaponowned: owns(), ammo: [50, 50, 50, 50] })).toBe(false);
  });
});

describe('pickBestAutoSwitchWeapon', () => {
  test('plasma preferred when owned with cells', () => {
    expect(pickBestAutoSwitchWeapon({ weaponowned: owns(VANILLA_WP_FIST, VANILLA_WP_PISTOL, VANILLA_WP_SHOTGUN, VANILLA_WP_CHAINGUN, VANILLA_WP_PLASMA), ammo: [50, 20, 100, 0] })).toBe(VANILLA_WP_PLASMA);
  });

  test('falls back to chaingun if plasma out of ammo', () => {
    expect(pickBestAutoSwitchWeapon({ weaponowned: owns(VANILLA_WP_FIST, VANILLA_WP_PISTOL, VANILLA_WP_SHOTGUN, VANILLA_WP_CHAINGUN, VANILLA_WP_PLASMA), ammo: [50, 20, 0, 0] })).toBe(VANILLA_WP_CHAINGUN);
  });

  test('falls back to chainsaw when only fist+chainsaw owned (no ammo)', () => {
    expect(pickBestAutoSwitchWeapon({ weaponowned: owns(VANILLA_WP_FIST, VANILLA_WP_CHAINSAW), ammo: [0, 0, 0, 0] })).toBe(VANILLA_WP_CHAINSAW);
  });

  test('falls back to fist when only fist owned', () => {
    expect(pickBestAutoSwitchWeapon({ weaponowned: owns(VANILLA_WP_FIST), ammo: [0, 0, 0, 0] })).toBe(VANILLA_WP_FIST);
  });
});
