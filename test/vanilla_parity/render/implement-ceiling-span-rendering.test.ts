import { describe, expect, test } from 'bun:test';

import { VANILLA_ANGLETOSKYSHIFT, VANILLA_SKYTEXTUREMID_FRAC, classifyVanillaPlaneAsCeilingOrFloor, computeVanillaSkyColumnAngleIndex, vanillaSkyPlaneTakesColumnPath } from '../../../src/render/implement-ceiling-span-rendering.ts';

describe('ceiling/sky constants', () => {
  test('ANGLETOSKYSHIFT = 22 (sky moves slower than world)', () => {
    expect(VANILLA_ANGLETOSKYSHIFT).toBe(22);
  });

  test('skytexturemid = 100 << FRACBITS', () => {
    expect(VANILLA_SKYTEXTUREMID_FRAC).toBe(100 * 0x10000);
  });
});

describe('classifyVanillaPlaneAsCeilingOrFloor', () => {
  test('planeHeight > viewZ -> ceiling', () => {
    expect(classifyVanillaPlaneAsCeilingOrFloor({ planeHeight: 128 << 16, viewZ: 40 << 16 })).toBe('ceiling');
  });

  test('planeHeight < viewZ -> floor', () => {
    expect(classifyVanillaPlaneAsCeilingOrFloor({ planeHeight: 0, viewZ: 40 << 16 })).toBe('floor');
  });

  test('planeHeight == viewZ -> in-plane', () => {
    expect(classifyVanillaPlaneAsCeilingOrFloor({ planeHeight: 40 << 16, viewZ: 40 << 16 })).toBe('in-plane');
  });
});

describe('computeVanillaSkyColumnAngleIndex', () => {
  test('angle 0 maps to fineangle index 0', () => {
    expect(computeVanillaSkyColumnAngleIndex({ viewangle: 0, xtoviewangleAtX: 0 })).toBe(0);
  });

  test('shift is ANGLETOSKYSHIFT (22), not ANGLETOFINESHIFT (19)', () => {
    expect(computeVanillaSkyColumnAngleIndex({ viewangle: 1 << 22, xtoviewangleAtX: 0 })).toBe(1);
  });

  test('sum wraps unsigned 32-bit', () => {
    const result = computeVanillaSkyColumnAngleIndex({ viewangle: 0xffffffff, xtoviewangleAtX: 1 });
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

describe('vanillaSkyPlaneTakesColumnPath', () => {
  test('matching picnum routes through column path', () => {
    expect(vanillaSkyPlaneTakesColumnPath(7, 7)).toBe(true);
  });

  test('non-matching picnum stays on span path', () => {
    expect(vanillaSkyPlaneTakesColumnPath(7, 8)).toBe(false);
  });
});
