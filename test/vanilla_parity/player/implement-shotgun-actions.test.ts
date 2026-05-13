import { describe, expect, test } from 'bun:test';

import {
  VANILLA_BULLET_DAMAGE_BASE,
  VANILLA_BULLET_DAMAGE_MULTIPLIER_MAX,
  VANILLA_BULLET_SPREAD_ANGLE_SHIFT,
  VANILLA_SHOTGUN_AMMO_PER_SHOT,
  VANILLA_SHOTGUN_PELLET_COUNT,
  computeBulletSpreadAngleDelta,
  computeShotgunPelletDamage,
} from '../../../src/player/implement-shotgun-actions.ts';

describe('vanilla shotgun constants', () => {
  test('pellet count is 7', () => {
    expect(VANILLA_SHOTGUN_PELLET_COUNT).toBe(7);
  });

  test('shotgun consumes 1 shell per shot', () => {
    expect(VANILLA_SHOTGUN_AMMO_PER_SHOT).toBe(1);
  });

  test('bullet damage base=5, multiplier max=3', () => {
    expect(VANILLA_BULLET_DAMAGE_BASE).toBe(5);
    expect(VANILLA_BULLET_DAMAGE_MULTIPLIER_MAX).toBe(3);
  });

  test('bullet spread shift is 18', () => {
    expect(VANILLA_BULLET_SPREAD_ANGLE_SHIFT).toBe(18);
  });
});

describe('computeShotgunPelletDamage', () => {
  test('damage = 5 * (rng%3 + 1) yields 5, 10, or 15', () => {
    expect(computeShotgunPelletDamage([0])).toBe(5);
    expect(computeShotgunPelletDamage([1])).toBe(10);
    expect(computeShotgunPelletDamage([2])).toBe(15);
    expect(computeShotgunPelletDamage([3])).toBe(5);
  });
});

describe('computeBulletSpreadAngleDelta', () => {
  test('spread is signed difference shifted left 18', () => {
    expect(computeBulletSpreadAngleDelta(255, 0)).toBe(255 << 18);
    expect(computeBulletSpreadAngleDelta(0, 255)).toBe((-255 << 18) | 0);
    expect(computeBulletSpreadAngleDelta(128, 128)).toBe(0);
  });
});
