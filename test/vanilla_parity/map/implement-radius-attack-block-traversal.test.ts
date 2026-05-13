import { describe, expect, test } from 'bun:test';

import { buildRadiusAttackBoundingBox, computeRadiusAttackDamage } from '../../../src/map/implement-radius-attack-block-traversal.ts';

describe('buildRadiusAttackBoundingBox', () => {
  test('expands the source point by the radius in all four directions', () => {
    const bbox = buildRadiusAttackBoundingBox({ sourceX: 100, sourceY: 200, damage: 100, radius: 128 });
    expect(bbox).toEqual({ minX: -28, maxX: 228, minY: 72, maxY: 328 });
  });
});

describe('computeRadiusAttackDamage', () => {
  test('zero damage at or beyond the radius', () => {
    expect(computeRadiusAttackDamage({ sourceX: 0, sourceY: 0, damage: 100, radius: 100 }, 100, 0)).toBe(0);
    expect(computeRadiusAttackDamage({ sourceX: 0, sourceY: 0, damage: 100, radius: 100 }, 200, 0)).toBe(0);
  });

  test('full damage at distance 0', () => {
    expect(computeRadiusAttackDamage({ sourceX: 0, sourceY: 0, damage: 100, radius: 100 }, 0, 0)).toBe(100);
  });

  test('proportional damage at midpoint', () => {
    expect(computeRadiusAttackDamage({ sourceX: 0, sourceY: 0, damage: 100, radius: 100 }, 50, 0)).toBe(50);
  });

  test('chebyshev distance used (max of |dx|, |dy|)', () => {
    expect(computeRadiusAttackDamage({ sourceX: 0, sourceY: 0, damage: 100, radius: 100 }, 50, 50)).toBe(50);
  });
});
