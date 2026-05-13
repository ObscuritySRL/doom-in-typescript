import { describe, expect, test } from 'bun:test';

import { VANILLA_ROCKET_AMMO_PER_SHOT, VANILLA_ROCKET_EXPLOSION_DAMAGE, VANILLA_ROCKET_EXPLOSION_RADIUS, VANILLA_ROCKET_PROJECTILE_TYPE, getVanillaRocketContract } from '../../../src/player/implement-rocket-launcher-actions.ts';

describe('vanilla A_FireMissile constants', () => {
  test('rocket consumes 1 ammo per shot', () => {
    expect(VANILLA_ROCKET_AMMO_PER_SHOT).toBe(1);
  });

  test('projectile type is MT_ROCKET', () => {
    expect(VANILLA_ROCKET_PROJECTILE_TYPE).toBe('MT_ROCKET');
  });

  test('explosion damage is 128', () => {
    expect(VANILLA_ROCKET_EXPLOSION_DAMAGE).toBe(128);
  });

  test('explosion radius is 128 map units', () => {
    expect(VANILLA_ROCKET_EXPLOSION_RADIUS).toBe(128);
  });
});

describe('getVanillaRocketContract', () => {
  test('returns frozen record with all canonical fields', () => {
    const c = getVanillaRocketContract();
    expect(c.ammoPerShot).toBe(1);
    expect(c.projectileType).toBe('MT_ROCKET');
    expect(c.explosionDamage).toBe(128);
    expect(c.explosionRadius).toBe(128);
    expect(Object.isFrozen(c)).toBe(true);
  });
});
