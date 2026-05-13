import { describe, expect, test } from 'bun:test';

import { VANILLA_MELEE_DISTANCE_HALVE_DIVISOR, VANILLA_MISSILE_DISTANCE_CAP, VANILLA_MISSILE_DISTANCE_OFFSET, approxDistance, shouldFireMissile } from '../../../src/ai/implement-monster-missile-range.ts';

describe('vanilla missile range constants', () => {
  test('distance offset = 64', () => {
    expect(VANILLA_MISSILE_DISTANCE_OFFSET).toBe(64);
  });

  test('distance cap = 200', () => {
    expect(VANILLA_MISSILE_DISTANCE_CAP).toBe(200);
  });

  test('melee divisor = 2', () => {
    expect(VANILLA_MELEE_DISTANCE_HALVE_DIVISOR).toBe(2);
  });
});

describe('approxDistance (vanilla P_AproxDistance)', () => {
  test('returns max(|dx|,|dy|) + min(|dx|,|dy|)/2', () => {
    expect(approxDistance(100, 200)).toBe(250);
    expect(approxDistance(-100, -200)).toBe(250);
    expect(approxDistance(200, 100)).toBe(250);
    expect(approxDistance(0, 0)).toBe(0);
  });

  test('uses dx>>1 when dx<dy and dy>>1 when dy<=dx', () => {
    // dx=4, dy=8: dx<dy => 4 + 8 - (4>>1)=4+8-2=10
    expect(approxDistance(4, 8)).toBe(10);
    // dx=8, dy=4: dy<=dx => 8 + 4 - (4>>1)=8+4-2=10
    expect(approxDistance(8, 4)).toBe(10);
  });
});

describe('shouldFireMissile', () => {
  test('fires when distance is low and random is high', () => {
    expect(shouldFireMissile({ dx: 100, dy: 0, hasMeleeAttack: false, randomByte: 255 })).toBe(true);
  });

  test('does not fire when random byte is below dist', () => {
    expect(shouldFireMissile({ dx: 500, dy: 0, hasMeleeAttack: false, randomByte: 0 })).toBe(false);
  });

  test('distance cap clamps at 200', () => {
    expect(shouldFireMissile({ dx: 10000, dy: 0, hasMeleeAttack: false, randomByte: 200 })).toBe(true);
    expect(shouldFireMissile({ dx: 10000, dy: 0, hasMeleeAttack: false, randomByte: 199 })).toBe(false);
  });

  test('melee monster halves distance', () => {
    expect(shouldFireMissile({ dx: 264, dy: 0, hasMeleeAttack: true, randomByte: 100 })).toBe(true);
  });
});
