import { describe, expect, test } from 'bun:test';

import { computeVanillaTextureWidthMask, fetchVanillaTextureColumnIndex, vanillaTextureWidthIsPowerOfTwo } from '../../../src/render/implement-wall-texture-column-fetch.ts';

describe('computeVanillaTextureWidthMask — power-of-2 widths', () => {
  test('width 64 -> mask 63', () => {
    expect(computeVanillaTextureWidthMask({ textureWidth: 64 })).toBe(63);
  });

  test('width 128 -> mask 127', () => {
    expect(computeVanillaTextureWidthMask({ textureWidth: 128 })).toBe(127);
  });

  test('width 256 -> mask 255', () => {
    expect(computeVanillaTextureWidthMask({ textureWidth: 256 })).toBe(255);
  });

  test('width 1 -> mask 0', () => {
    expect(computeVanillaTextureWidthMask({ textureWidth: 1 })).toBe(0);
  });
});

describe('computeVanillaTextureWidthMask — non-power-of-2 widths (vanilla wrap quirk)', () => {
  test('width 100 -> mask 63 (largest j with 2*j <= 100 is 64, so mask=63)', () => {
    expect(computeVanillaTextureWidthMask({ textureWidth: 100 })).toBe(63);
  });

  test('width 192 -> mask 127', () => {
    expect(computeVanillaTextureWidthMask({ textureWidth: 192 })).toBe(127);
  });

  test('width 200 -> mask 127', () => {
    expect(computeVanillaTextureWidthMask({ textureWidth: 200 })).toBe(127);
  });

  test('width 7 -> mask 3', () => {
    expect(computeVanillaTextureWidthMask({ textureWidth: 7 })).toBe(3);
  });
});

describe('computeVanillaTextureWidthMask — boundary errors', () => {
  test('throws on zero or negative width', () => {
    expect(() => computeVanillaTextureWidthMask({ textureWidth: 0 })).toThrow(RangeError);
    expect(() => computeVanillaTextureWidthMask({ textureWidth: -1 })).toThrow(RangeError);
  });
});

describe('fetchVanillaTextureColumnIndex', () => {
  test('in-range column passes through unchanged for power-of-2 mask', () => {
    expect(fetchVanillaTextureColumnIndex({ textureWidthMask: 63, column: 0 })).toBe(0);
    expect(fetchVanillaTextureColumnIndex({ textureWidthMask: 63, column: 32 })).toBe(32);
    expect(fetchVanillaTextureColumnIndex({ textureWidthMask: 63, column: 63 })).toBe(63);
  });

  test('out-of-range column wraps via bitwise-AND', () => {
    expect(fetchVanillaTextureColumnIndex({ textureWidthMask: 63, column: 64 })).toBe(0);
    expect(fetchVanillaTextureColumnIndex({ textureWidthMask: 63, column: 70 })).toBe(6);
    expect(fetchVanillaTextureColumnIndex({ textureWidthMask: 63, column: 200 })).toBe(8);
  });

  test('non-power-of-2 texture (width 100, mask 63): column 70 wraps to 6 (vanilla quirk)', () => {
    const mask = computeVanillaTextureWidthMask({ textureWidth: 100 });
    expect(fetchVanillaTextureColumnIndex({ textureWidthMask: mask, column: 70 })).toBe(6);
  });
});

describe('vanillaTextureWidthIsPowerOfTwo', () => {
  test('returns true for power-of-2 widths', () => {
    expect(vanillaTextureWidthIsPowerOfTwo(1)).toBe(true);
    expect(vanillaTextureWidthIsPowerOfTwo(64)).toBe(true);
    expect(vanillaTextureWidthIsPowerOfTwo(128)).toBe(true);
    expect(vanillaTextureWidthIsPowerOfTwo(256)).toBe(true);
  });

  test('returns false for non-power-of-2 widths', () => {
    expect(vanillaTextureWidthIsPowerOfTwo(100)).toBe(false);
    expect(vanillaTextureWidthIsPowerOfTwo(192)).toBe(false);
    expect(vanillaTextureWidthIsPowerOfTwo(7)).toBe(false);
  });

  test('returns false for zero or negative', () => {
    expect(vanillaTextureWidthIsPowerOfTwo(0)).toBe(false);
    expect(vanillaTextureWidthIsPowerOfTwo(-1)).toBe(false);
  });
});
