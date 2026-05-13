import { describe, expect, test } from 'bun:test';

import { FRACUNIT } from '../../../src/core/fixed.ts';
import {
  VANILLA_MELEERANGE,
  VANILLA_PUNCH_BERSERK_MULTIPLIER,
  VANILLA_PUNCH_DAMAGE_MAX,
  VANILLA_PUNCH_DAMAGE_MIN,
  VANILLA_SAW_DAMAGE_MAX,
  VANILLA_SAW_DAMAGE_MIN,
  VANILLA_SAW_RANGE_DELTA,
  computeVanillaPunchDamage,
  computeVanillaSawDamage,
} from '../../../src/player/implement-fist-and-chainsaw-actions.ts';

describe('vanilla melee constants', () => {
  test('MELEERANGE is 64 * FRACUNIT', () => {
    expect(VANILLA_MELEERANGE).toBe(64 * FRACUNIT);
  });

  test('chainsaw range is MELEERANGE + 1 (boundary-inclusive)', () => {
    expect(VANILLA_SAW_RANGE_DELTA).toBe(1);
  });

  test('punch damage range is 2..20 before berserk', () => {
    expect(VANILLA_PUNCH_DAMAGE_MIN).toBe(2);
    expect(VANILLA_PUNCH_DAMAGE_MAX).toBe(20);
  });

  test('berserk multiplier is 10x', () => {
    expect(VANILLA_PUNCH_BERSERK_MULTIPLIER).toBe(10);
  });

  test('saw damage range is 2..20 (no berserk bonus)', () => {
    expect(VANILLA_SAW_DAMAGE_MIN).toBe(2);
    expect(VANILLA_SAW_DAMAGE_MAX).toBe(20);
  });
});

describe('computeVanillaPunchDamage', () => {
  test('damage = ((random % 10) + 1) << 1 without berserk', () => {
    expect(computeVanillaPunchDamage({ randomByte: 0, hasBerserk: false })).toBe(2);
    expect(computeVanillaPunchDamage({ randomByte: 9, hasBerserk: false })).toBe(20);
    expect(computeVanillaPunchDamage({ randomByte: 5, hasBerserk: false })).toBe(12);
  });

  test('berserk multiplies damage by 10', () => {
    expect(computeVanillaPunchDamage({ randomByte: 0, hasBerserk: true })).toBe(20);
    expect(computeVanillaPunchDamage({ randomByte: 9, hasBerserk: true })).toBe(200);
  });
});

describe('computeVanillaSawDamage', () => {
  test('damage = 2 * ((random % 10) + 1)', () => {
    expect(computeVanillaSawDamage({ randomByte: 0 })).toBe(2);
    expect(computeVanillaSawDamage({ randomByte: 9 })).toBe(20);
    expect(computeVanillaSawDamage({ randomByte: 5 })).toBe(12);
  });

  test('saw damage matches punch base damage (no berserk bonus on saw)', () => {
    for (let randomByte = 0; randomByte < 10; randomByte += 1) {
      expect(computeVanillaSawDamage({ randomByte })).toBe(computeVanillaPunchDamage({ randomByte, hasBerserk: false }));
    }
  });
});
