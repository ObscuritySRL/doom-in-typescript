import { describe, expect, test } from 'bun:test';

import {
  VANILLA_AM_CELL,
  VANILLA_AM_CLIP,
  VANILLA_AM_MISL,
  VANILLA_AM_NOAMMO,
  VANILLA_AM_SHELL,
  VANILLA_DROPPED_WEAPON_CLIPS,
  VANILLA_NORMAL_WEAPON_CLIPS,
  VANILLA_WEAPON_AMMO_TABLE,
  VANILLA_WP_BFG,
  VANILLA_WP_CHAINGUN,
  VANILLA_WP_CHAINSAW,
  VANILLA_WP_FIST,
  VANILLA_WP_MISSILE,
  VANILLA_WP_PISTOL,
  VANILLA_WP_PLASMA,
  VANILLA_WP_SHOTGUN,
  VANILLA_WP_SUPERSHOTGUN,
  applyVanillaWeaponPickup,
} from '../../../src/player/implement-weapon-pickups.ts';

describe('vanilla weapon ordinal table (p_pspr.c weapontype_t)', () => {
  test('weapon ordinals 0..8 follow vanilla weapontype_t enum', () => {
    expect(VANILLA_WP_FIST).toBe(0);
    expect(VANILLA_WP_PISTOL).toBe(1);
    expect(VANILLA_WP_SHOTGUN).toBe(2);
    expect(VANILLA_WP_CHAINGUN).toBe(3);
    expect(VANILLA_WP_MISSILE).toBe(4);
    expect(VANILLA_WP_PLASMA).toBe(5);
    expect(VANILLA_WP_BFG).toBe(6);
    expect(VANILLA_WP_CHAINSAW).toBe(7);
    expect(VANILLA_WP_SUPERSHOTGUN).toBe(8);
  });
});

describe('vanilla weaponinfo[].ammo table', () => {
  test('fist and chainsaw use am_noammo', () => {
    expect(VANILLA_WEAPON_AMMO_TABLE[VANILLA_WP_FIST]).toBe(VANILLA_AM_NOAMMO);
    expect(VANILLA_WEAPON_AMMO_TABLE[VANILLA_WP_CHAINSAW]).toBe(VANILLA_AM_NOAMMO);
  });

  test('pistol and chaingun consume am_clip (bullets)', () => {
    expect(VANILLA_WEAPON_AMMO_TABLE[VANILLA_WP_PISTOL]).toBe(VANILLA_AM_CLIP);
    expect(VANILLA_WEAPON_AMMO_TABLE[VANILLA_WP_CHAINGUN]).toBe(VANILLA_AM_CLIP);
  });

  test('shotgun and supershotgun consume am_shell', () => {
    expect(VANILLA_WEAPON_AMMO_TABLE[VANILLA_WP_SHOTGUN]).toBe(VANILLA_AM_SHELL);
    expect(VANILLA_WEAPON_AMMO_TABLE[VANILLA_WP_SUPERSHOTGUN]).toBe(VANILLA_AM_SHELL);
  });

  test('rocket launcher consumes am_misl', () => {
    expect(VANILLA_WEAPON_AMMO_TABLE[VANILLA_WP_MISSILE]).toBe(VANILLA_AM_MISL);
  });

  test('plasma rifle and BFG consume am_cell', () => {
    expect(VANILLA_WEAPON_AMMO_TABLE[VANILLA_WP_PLASMA]).toBe(VANILLA_AM_CELL);
    expect(VANILLA_WEAPON_AMMO_TABLE[VANILLA_WP_BFG]).toBe(VANILLA_AM_CELL);
  });
});

describe('applyVanillaWeaponPickup', () => {
  test('normal (non-dropped) weapon pickup gives 2 clips', () => {
    expect(VANILLA_NORMAL_WEAPON_CLIPS).toBe(2);
    const result = applyVanillaWeaponPickup({ weaponType: VANILLA_WP_SHOTGUN, currentlyOwned: false, dropped: false });
    expect(result.clipsToGive).toBe(2);
    expect(result.ammoType).toBe(VANILLA_AM_SHELL);
  });

  test('dropped weapon pickup gives 1 clip', () => {
    expect(VANILLA_DROPPED_WEAPON_CLIPS).toBe(1);
    const result = applyVanillaWeaponPickup({ weaponType: VANILLA_WP_SHOTGUN, currentlyOwned: false, dropped: true });
    expect(result.clipsToGive).toBe(1);
  });

  test('first pickup sets gaveWeapon=true and pendingWeapon to weapon type', () => {
    const result = applyVanillaWeaponPickup({ weaponType: VANILLA_WP_CHAINGUN, currentlyOwned: false, dropped: false });
    expect(result.gaveWeapon).toBe(true);
    expect(result.pendingWeapon).toBe(VANILLA_WP_CHAINGUN);
  });

  test('pickup of already-owned weapon does not set pendingweapon', () => {
    const result = applyVanillaWeaponPickup({ weaponType: VANILLA_WP_CHAINGUN, currentlyOwned: true, dropped: false });
    expect(result.gaveWeapon).toBe(false);
    expect(result.pendingWeapon).toBeNull();
  });

  test('am_noammo weapons (chainsaw/fist) give zero clips', () => {
    const result = applyVanillaWeaponPickup({ weaponType: VANILLA_WP_CHAINSAW, currentlyOwned: false, dropped: false });
    expect(result.clipsToGive).toBe(0);
    expect(result.ammoType).toBe(VANILLA_AM_NOAMMO);
  });
});
