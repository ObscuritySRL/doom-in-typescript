import { describe, expect, test } from 'bun:test';

import { AMMO_BULLETS, AMMO_CELLS, AMMO_ROCKETS, AMMO_SHELLS, NUMAMMO, VANILLA_BACKPACK_MAX_AMMO, VANILLA_CLIP_AMMO, VANILLA_MAX_AMMO, applyAmmoPickup, getMaxAmmoFor } from '../../../src/player/implement-ammo-pickups.ts';

describe('vanilla ammo tables (P_GiveAmmo)', () => {
  test('NUMAMMO=4 with bullets=0, shells=1, cells=2, rockets=3', () => {
    expect(NUMAMMO).toBe(4);
    expect(AMMO_BULLETS).toBe(0);
    expect(AMMO_SHELLS).toBe(1);
    expect(AMMO_CELLS).toBe(2);
    expect(AMMO_ROCKETS).toBe(3);
  });

  test('clipammo = [10, 4, 20, 1]', () => {
    expect([...VANILLA_CLIP_AMMO]).toEqual([10, 4, 20, 1]);
  });

  test('maxammo = [200, 50, 300, 50]', () => {
    expect([...VANILLA_MAX_AMMO]).toEqual([200, 50, 300, 50]);
  });

  test('backpack doubles max: [400, 100, 600, 100]', () => {
    expect([...VANILLA_BACKPACK_MAX_AMMO]).toEqual([400, 100, 600, 100]);
  });
});

describe('getMaxAmmoFor', () => {
  test('returns base max without backpack', () => {
    expect(getMaxAmmoFor(AMMO_BULLETS, false)).toBe(200);
    expect(getMaxAmmoFor(AMMO_SHELLS, false)).toBe(50);
  });

  test('returns doubled max with backpack', () => {
    expect(getMaxAmmoFor(AMMO_BULLETS, true)).toBe(400);
    expect(getMaxAmmoFor(AMMO_CELLS, true)).toBe(600);
  });
});

describe('applyAmmoPickup', () => {
  test('adds amount when below cap', () => {
    const r = applyAmmoPickup({ ammoType: AMMO_BULLETS, amount: 10, currentAmount: 50, hasBackpack: false, isBabyOrNightmareSkill: false });
    expect(r.newAmount).toBe(60);
    expect(r.gave).toBe(true);
  });

  test('clamps to max', () => {
    const r = applyAmmoPickup({ ammoType: AMMO_BULLETS, amount: 100, currentAmount: 150, hasBackpack: false, isBabyOrNightmareSkill: false });
    expect(r.newAmount).toBe(200);
  });

  test('does not give when at cap', () => {
    const r = applyAmmoPickup({ ammoType: AMMO_BULLETS, amount: 10, currentAmount: 200, hasBackpack: false, isBabyOrNightmareSkill: false });
    expect(r.gave).toBe(false);
  });

  test('baby/nightmare skill doubles amount', () => {
    const r = applyAmmoPickup({ ammoType: AMMO_BULLETS, amount: 10, currentAmount: 0, hasBackpack: false, isBabyOrNightmareSkill: true });
    expect(r.newAmount).toBe(20);
  });

  test('backpack increases max to 400 for bullets', () => {
    const r = applyAmmoPickup({ ammoType: AMMO_BULLETS, amount: 10, currentAmount: 200, hasBackpack: true, isBabyOrNightmareSkill: false });
    expect(r.newAmount).toBe(210);
    expect(r.gave).toBe(true);
  });
});
