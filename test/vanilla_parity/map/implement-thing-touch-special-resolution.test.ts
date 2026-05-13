import { describe, expect, test } from 'bun:test';

import { VANILLA_PICKUP_CATEGORIES, resolvePickupCategory } from '../../../src/map/implement-thing-touch-special-resolution.ts';

describe('vanilla pickup resolution', () => {
  test('categories are sorted and unique', () => {
    expect([...VANILLA_PICKUP_CATEGORIES].sort()).toEqual([...VANILLA_PICKUP_CATEGORIES]);
    expect(new Set(VANILLA_PICKUP_CATEGORIES).size).toBe(VANILLA_PICKUP_CATEGORIES.length);
  });

  test('CLIP (2007) resolves to ammo', () => {
    expect(resolvePickupCategory(2007)).toBe('ammo');
  });

  test('SHOTGUN (2001) resolves to weapon', () => {
    expect(resolvePickupCategory(2001)).toBe('weapon');
  });

  test('GREENARMOR (2018) resolves to armor', () => {
    expect(resolvePickupCategory(2018)).toBe('armor');
  });

  test('STIMPACK (2011) resolves to health', () => {
    expect(resolvePickupCategory(2011)).toBe('health');
  });

  test('BLUE keycard (5) resolves to key', () => {
    expect(resolvePickupCategory(5)).toBe('key');
  });

  test('INVULN sphere (2022) resolves to powerup', () => {
    expect(resolvePickupCategory(2022)).toBe('powerup');
  });

  test('unknown mobj type returns null', () => {
    expect(resolvePickupCategory(99999)).toBeNull();
  });
});
