import { describe, expect, test } from 'bun:test';

import { VANILLA_BACKPACK_AMMO_MULTIPLIER, VANILLA_BACKPACK_CLIP_PER_TYPE, VANILLA_BACKPACK_MAX_AMMO, VANILLA_DEFAULT_MAX_AMMO, applyVanillaBackpackPickup } from '../../../src/player/implement-backpack-semantics.ts';

describe('vanilla P_GiveBackpack tables', () => {
  test('multiplier is 2 (doubles maxammo on first pickup)', () => {
    expect(VANILLA_BACKPACK_AMMO_MULTIPLIER).toBe(2);
  });

  test('default maxammo = [200, 50, 300, 50] (clip, shell, cell, missile)', () => {
    expect([...VANILLA_DEFAULT_MAX_AMMO]).toEqual([200, 50, 300, 50]);
  });

  test('backpack maxammo = [400, 100, 600, 100]', () => {
    expect([...VANILLA_BACKPACK_MAX_AMMO]).toEqual([400, 100, 600, 100]);
  });

  test('clip-per-type grants [10, 4, 20, 1] per ammo bucket', () => {
    expect([...VANILLA_BACKPACK_CLIP_PER_TYPE]).toEqual([10, 4, 20, 1]);
  });
});

describe('applyVanillaBackpackPickup', () => {
  test('first backpack doubles maxammo and grants one clip of each ammo', () => {
    const result = applyVanillaBackpackPickup({ hasBackpack: false, currentMaxAmmo: [200, 50, 300, 50] });
    expect(result.hasBackpack).toBe(true);
    expect([...result.newMaxAmmo]).toEqual([400, 100, 600, 100]);
    expect([...result.clipsGranted]).toEqual([10, 4, 20, 1]);
  });

  test('second backpack does NOT re-double maxammo but still grants clips', () => {
    const result = applyVanillaBackpackPickup({ hasBackpack: true, currentMaxAmmo: [400, 100, 600, 100] });
    expect(result.hasBackpack).toBe(true);
    expect([...result.newMaxAmmo]).toEqual([400, 100, 600, 100]);
    expect([...result.clipsGranted]).toEqual([10, 4, 20, 1]);
  });

  test('result is frozen', () => {
    const result = applyVanillaBackpackPickup({ hasBackpack: false, currentMaxAmmo: [200, 50, 300, 50] });
    expect(Object.isFrozen(result)).toBe(true);
  });
});
