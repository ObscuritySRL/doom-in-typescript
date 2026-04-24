import { describe, expect, test } from 'bun:test';

import { FIXED_MAX, FIXED_MIN, FRACBITS, FRACUNIT, fixedMul } from '../../src/core/fixed.ts';

describe('fixedMul', () => {
  test('multiplies two positive integers', () => {
    // 3.0 * 2.0 = 6.0
    expect(fixedMul(FRACUNIT * 3, FRACUNIT * 2)).toBe((FRACUNIT * 6) | 0);
  });

  test('multiplies positive and negative', () => {
    // 3.0 * -2.0 = -6.0
    expect(fixedMul(FRACUNIT * 3, -FRACUNIT * 2)).toBe((-FRACUNIT * 6) | 0);
  });

  test('multiplies two negative values', () => {
    // -3.0 * -2.0 = 6.0
    expect(fixedMul(-FRACUNIT * 3, -FRACUNIT * 2)).toBe((FRACUNIT * 6) | 0);
  });

  test('multiplies fractional values: 1.5 * 1.5 = 2.25', () => {
    const onePointFive = FRACUNIT + (FRACUNIT >> 1); // 0x18000
    const twoPointTwoFive = FRACUNIT * 2 + (FRACUNIT >> 2); // 0x24000
    expect(fixedMul(onePointFive, onePointFive)).toBe(twoPointTwoFive);
  });

  test('multiplies negative fractional: -1.5 * 1.5 = -2.25', () => {
    const onePointFive = FRACUNIT + (FRACUNIT >> 1);
    const negativeTwoPointTwoFive = -((FRACUNIT * 2 + (FRACUNIT >> 2)) | 0);
    expect(fixedMul(-onePointFive, onePointFive)).toBe(negativeTwoPointTwoFive);
  });

  test('0.5 * 0.5 = 0.25', () => {
    const half = FRACUNIT >> 1; // 0x8000
    const quarter = FRACUNIT >> 2; // 0x4000
    expect(fixedMul(half, half)).toBe(quarter);
  });

  test('identity: multiplying by FRACUNIT returns the original', () => {
    expect(fixedMul(FRACUNIT * 7, FRACUNIT)).toBe((FRACUNIT * 7) | 0);
    expect(fixedMul(FRACUNIT, FRACUNIT * 7)).toBe((FRACUNIT * 7) | 0);
    expect(fixedMul(-FRACUNIT * 3, FRACUNIT)).toBe((-FRACUNIT * 3) | 0);
  });

  test('zero: anything multiplied by zero is zero', () => {
    expect(fixedMul(FRACUNIT, 0)).toBe(0);
    expect(fixedMul(0, FRACUNIT)).toBe(0);
    expect(fixedMul(0, 0)).toBe(0);
    expect(fixedMul(FIXED_MAX, 0)).toBe(0);
    expect(fixedMul(FIXED_MIN, 0)).toBe(0);
  });

  test('is commutative', () => {
    const a = 0x0003_c000; // 3.75
    const b = 0x0001_8000; // 1.5
    expect(fixedMul(a, b)).toBe(fixedMul(b, a));
  });

  test('result is always int32', () => {
    expect(fixedMul(FRACUNIT * 3, FRACUNIT * 2)).toBe(fixedMul(FRACUNIT * 3, FRACUNIT * 2) | 0);
    expect(fixedMul(FIXED_MAX, FIXED_MAX)).toBe(fixedMul(FIXED_MAX, FIXED_MAX) | 0);
  });

  test('FIXED_MAX * FIXED_MAX truncates to int32', () => {
    // C: ((int64_t)0x7FFFFFFF * (int64_t)0x7FFFFFFF) >> 16
    //  = 0x3FFFFFFF00000001 >> 16 = 0x3FFFFFFF0000
    //  truncated to int32: 0xFFFF0000 = -65536 = -FRACUNIT
    expect(fixedMul(FIXED_MAX, FIXED_MAX)).toBe(-FRACUNIT);
  });

  test('FIXED_MIN * FIXED_MIN truncates to zero', () => {
    // C: ((int64_t)(-2^31) * (int64_t)(-2^31)) >> 16 = 2^46
    //  truncated to int32: 0 (2^46 mod 2^32 = 0)
    expect(fixedMul(FIXED_MIN, FIXED_MIN)).toBe(0);
  });

  test('FIXED_MIN * FRACUNIT = FIXED_MIN (identity preserves extremes)', () => {
    // -32768.0 * 1.0 = -32768.0
    expect(fixedMul(FIXED_MIN, FRACUNIT)).toBe(FIXED_MIN);
  });

  test('FIXED_MAX * FRACUNIT = FIXED_MAX (identity preserves extremes)', () => {
    // 32767.9999... * 1.0 = 32767.9999...
    expect(fixedMul(FIXED_MAX, FRACUNIT)).toBe(FIXED_MAX);
  });

  test('negative arithmetic right shift rounds toward -infinity, not zero', () => {
    // This is the key parity-sensitive edge case.
    // C: ((int64_t)(-3) * (int64_t)(1)) >> 16 = -3 >> 16 = -1
    // Division toward zero would give 0; arithmetic shift gives -1.
    expect(fixedMul(-3, 1)).toBe(-1);
  });

  test('small positive values vanish under right shift', () => {
    // C: ((int64_t)(3) * (int64_t)(1)) >> 16 = 3 >> 16 = 0
    expect(fixedMul(3, 1)).toBe(0);
  });

  test('sub-unit multiplication preserves carry', () => {
    // 1 + 1/65536 squared: C: 0x10001 * 0x10001 = 0x100020001 >> 16 = 0x10002
    const onePlusEpsilon = FRACUNIT + 1; // 0x10001
    expect(fixedMul(onePlusEpsilon, onePlusEpsilon)).toBe(FRACUNIT + 2);
  });

  test('matches reference BigInt computation for assorted values', () => {
    // Cross-check decomposition against BigInt for a spread of operands
    const values = [0, 1, -1, FRACUNIT, -FRACUNIT, FRACUNIT >> 1, -(FRACUNIT >> 1), FRACUNIT * 100, -(FRACUNIT * 100), FIXED_MAX, FIXED_MIN, 0x0001_8000, -0x0001_8000, 0x7fff_0001, -0x7fff_0001];
    for (const a of values) {
      for (const b of values) {
        const expected = Number((BigInt(a) * BigInt(b)) >> BigInt(FRACBITS)) | 0;
        expect(fixedMul(a, b)).toBe(expected);
      }
    }
  });
});
