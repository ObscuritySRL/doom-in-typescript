import { describe, expect, test } from 'bun:test';

import {
  VANILLA_MT_SPIDER,
  VANILLA_SPIDER_BULLET_SPREAD_SHIFT,
  VANILLA_SPIDER_DAMAGE_MULTIPLIER,
  VANILLA_SPIDER_DAMAGE_RNG_MODULO,
  computeSpiderBulletDamage,
  computeSpiderBulletSpreadAngleDelta,
} from '../../../src/ai/implement-spider-mastermind-attack-for-registered-iwad.ts';

describe('vanilla spider mastermind constants', () => {
  test('MT_SPIDER = 20', () => {
    expect(VANILLA_MT_SPIDER).toBe(20);
  });

  test('bullet damage = (rng%5+1)*3', () => {
    expect(VANILLA_SPIDER_DAMAGE_RNG_MODULO).toBe(5);
    expect(VANILLA_SPIDER_DAMAGE_MULTIPLIER).toBe(3);
  });

  test('spread shift = 21 (tighter than zombie shift 20)', () => {
    expect(VANILLA_SPIDER_BULLET_SPREAD_SHIFT).toBe(21);
  });
});

describe('computeSpiderBulletDamage', () => {
  test('range 3..15 across rng 0..4', () => {
    expect(computeSpiderBulletDamage(0)).toBe(3);
    expect(computeSpiderBulletDamage(4)).toBe(15);
  });

  test('wraps via %5', () => {
    expect(computeSpiderBulletDamage(5)).toBe(3);
  });
});

describe('computeSpiderBulletSpreadAngleDelta', () => {
  test('signed diff shifted left 21', () => {
    expect(computeSpiderBulletSpreadAngleDelta(255, 0)).toBe(255 << 21);
    expect(computeSpiderBulletSpreadAngleDelta(128, 128)).toBe(0);
  });
});
