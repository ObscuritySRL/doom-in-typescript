import { describe, expect, test } from 'bun:test';

import { FRACBITS } from '../../../src/core/fixed.ts';
import { VANILLA_BULLET_BASE_DAMAGE, VANILLA_BULLET_DAMAGE_MAX_MUL, VANILLA_MELEERANGE_FIXED, VANILLA_MISSILERANGE_FIXED, computeBulletDamage } from '../../../src/player/implement-hitscan-aim-and-damage.ts';

describe('vanilla hitscan constants', () => {
  test('MISSILERANGE = 32*64 = 2048 map units', () => {
    expect(VANILLA_MISSILERANGE_FIXED).toBe((32 * 64) << FRACBITS);
  });

  test('MELEERANGE = 64 map units', () => {
    expect(VANILLA_MELEERANGE_FIXED).toBe(64 << FRACBITS);
  });

  test('bullet base damage = 5, max multiplier = 3', () => {
    expect(VANILLA_BULLET_BASE_DAMAGE).toBe(5);
    expect(VANILLA_BULLET_DAMAGE_MAX_MUL).toBe(3);
  });
});

describe('computeBulletDamage', () => {
  test('5*(rng%3+1) yields 5/10/15', () => {
    expect(computeBulletDamage(0)).toBe(5);
    expect(computeBulletDamage(1)).toBe(10);
    expect(computeBulletDamage(2)).toBe(15);
    expect(computeBulletDamage(3)).toBe(5);
  });
});
