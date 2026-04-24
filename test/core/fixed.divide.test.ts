import { describe, expect, test } from 'bun:test';

import { FIXED_MAX, FIXED_MIN, FRACUNIT, fixedDiv, fixedMul } from '../../src/core/fixed.ts';

describe('fixedDiv', () => {
  test('divides two equal values to FRACUNIT', () => {
    expect(fixedDiv(FRACUNIT, FRACUNIT)).toBe(FRACUNIT);
  });

  test('divides integer multiples: 6.0 / 3.0 = 2.0', () => {
    expect(fixedDiv(FRACUNIT * 6, FRACUNIT * 3)).toBe((FRACUNIT * 2) | 0);
  });

  test('produces fractional result: 3.0 / 2.0 = 1.5', () => {
    const onePointFive = FRACUNIT + (FRACUNIT >> 1); // 0x18000
    expect(fixedDiv(FRACUNIT * 3, FRACUNIT * 2)).toBe(onePointFive);
  });

  test('negative dividend: -3.0 / 2.0 = -1.5', () => {
    const negativeOnePointFive = -(FRACUNIT + (FRACUNIT >> 1));
    expect(fixedDiv(-FRACUNIT * 3, FRACUNIT * 2)).toBe(negativeOnePointFive);
  });

  test('negative divisor: 3.0 / -2.0 = -1.5', () => {
    const negativeOnePointFive = -(FRACUNIT + (FRACUNIT >> 1));
    expect(fixedDiv(FRACUNIT * 3, -FRACUNIT * 2)).toBe(negativeOnePointFive);
  });

  test('both negative: -3.0 / -2.0 = 1.5', () => {
    const onePointFive = FRACUNIT + (FRACUNIT >> 1);
    expect(fixedDiv(-FRACUNIT * 3, -FRACUNIT * 2)).toBe(onePointFive);
  });

  test('identity: dividing by FRACUNIT returns the original', () => {
    expect(fixedDiv(FRACUNIT * 7, FRACUNIT)).toBe((FRACUNIT * 7) | 0);
    expect(fixedDiv(-FRACUNIT * 3, FRACUNIT)).toBe((-FRACUNIT * 3) | 0);
  });

  test('zero dividend: 0 / any = 0', () => {
    expect(fixedDiv(0, FRACUNIT)).toBe(0);
    expect(fixedDiv(0, FIXED_MAX)).toBe(0);
    expect(fixedDiv(0, -FRACUNIT)).toBe(0);
  });

  test('0.5 / 0.5 = 1.0', () => {
    const half = FRACUNIT >> 1;
    expect(fixedDiv(half, half)).toBe(FRACUNIT);
  });

  test('division by zero: positive a returns FIXED_MAX', () => {
    expect(fixedDiv(FRACUNIT, 0)).toBe(FIXED_MAX);
    expect(fixedDiv(1, 0)).toBe(FIXED_MAX);
  });

  test('division by zero: negative a returns FIXED_MIN', () => {
    expect(fixedDiv(-FRACUNIT, 0)).toBe(FIXED_MIN);
    expect(fixedDiv(-1, 0)).toBe(FIXED_MIN);
  });

  test('division by zero: zero a returns FIXED_MAX', () => {
    // abs(0) >> 14 = 0, abs(0) = 0, 0 >= 0 -> guard triggers
    // (0 ^ 0) = 0, 0 < 0 -> false -> FIXED_MAX
    expect(fixedDiv(0, 0)).toBe(FIXED_MAX);
  });

  test('overflow guard: large positive numerator returns FIXED_MAX', () => {
    expect(fixedDiv(FIXED_MAX, 1)).toBe(FIXED_MAX);
  });

  test('overflow guard: negative numerator returns FIXED_MIN', () => {
    // -FIXED_MAX has abs = FIXED_MAX, >> 14 = 131071, >= 1 -> guard triggers
    // (-FIXED_MAX ^ 1) < 0 -> true -> FIXED_MIN
    expect(fixedDiv(-FIXED_MAX, 1)).toBe(FIXED_MIN);
  });

  test('FIXED_MIN / 1 bypasses guard due to abs(INT_MIN) parity', () => {
    // C: abs(INT_MIN) = INT_MIN (x86 UB), INT_MIN >> 14 = -131072
    // -131072 >= 1 -> false -> guard does NOT trigger
    // (-2^31 * 2^16) / 1 = -2^47, truncated to int32: 0
    expect(fixedDiv(FIXED_MIN, 1)).toBe(0);
  });

  test('overflow guard boundary: 16384 * FRACUNIT / FRACUNIT clamps', () => {
    // abs(16384 * FRACUNIT) >> 14 = 65536, abs(FRACUNIT) = 65536
    // 65536 >= 65536 -> guard triggers even though result would fit
    const sixteenThousand = (16384 * FRACUNIT) | 0;
    expect(fixedDiv(sixteenThousand, FRACUNIT)).toBe(FIXED_MAX);
  });

  test('just below overflow guard: 16383 * FRACUNIT / FRACUNIT passes', () => {
    // abs(16383 * FRACUNIT) >> 14 = 65535, abs(FRACUNIT) = 65536
    // 65535 >= 65536 -> false -> division proceeds
    const justBelow = (16383 * FRACUNIT) | 0;
    expect(fixedDiv(justBelow, FRACUNIT)).toBe(justBelow);
  });

  test('result is always int32', () => {
    expect(fixedDiv(FRACUNIT * 3, FRACUNIT * 2)).toBe(fixedDiv(FRACUNIT * 3, FRACUNIT * 2) | 0);
    expect(fixedDiv(FIXED_MAX, 1)).toBe(fixedDiv(FIXED_MAX, 1) | 0);
  });

  test('truncation toward zero for positive quotient', () => {
    // (7 << 16) / (3 * 65536) = 458752 / 196608 = 2 remainder ...
    expect(fixedDiv(7, FRACUNIT * 3)).toBe(2);
  });

  test('truncation toward zero for negative quotient', () => {
    // (-7 << 16) / (3 * 65536) = -458752 / 196608 = -2 (toward zero, not -3)
    expect(fixedDiv(-7, FRACUNIT * 3)).toBe(-2);
  });

  test('sub-unit division: 1 / FRACUNIT = 1', () => {
    // (1 << 16) / 65536 = 65536 / 65536 = 1
    expect(fixedDiv(1, FRACUNIT)).toBe(1);
  });

  test('FIXED_MIN abs parity: abs(INT_MIN) is INT_MIN on x86', () => {
    // C: abs(INT_MIN) = INT_MIN (undefined behavior, but x86 gives INT_MIN)
    // INT_MIN >> 14 = -131072, -131072 >= INT_MIN -> true -> guard triggers
    // (FIXED_MIN ^ FIXED_MIN) = 0, 0 < 0 -> false -> FIXED_MAX
    expect(fixedDiv(FIXED_MIN, FIXED_MIN)).toBe(FIXED_MAX);
  });

  test('FIXED_MIN / -1 wraps to zero through int32 truncation', () => {
    // abs(INT_MIN) >> 14 = -131072, abs(-1) = 1, -131072 >= 1 -> false
    // (-2^31 * 2^16) / -1 = 2^47, truncated to int32: 0
    expect(fixedDiv(FIXED_MIN, -1)).toBe(0);
  });

  test('is not commutative (unlike multiply)', () => {
    expect(fixedDiv(FRACUNIT * 3, FRACUNIT * 2)).not.toBe(fixedDiv(FRACUNIT * 2, FRACUNIT * 3));
  });

  test('inverse of multiply: fixedDiv(fixedMul(a, b), b) recovers a', () => {
    const a = FRACUNIT * 7; // 7.0
    const b = FRACUNIT * 3; // 3.0
    const product = fixedMul(a, b); // 21.0
    expect(fixedDiv(product, b)).toBe(a);
  });

  test('matches reference BigInt computation for non-overflowing pairs', () => {
    const values = [1, -1, FRACUNIT, -FRACUNIT, FRACUNIT >> 1, -(FRACUNIT >> 1), FRACUNIT * 100, -(FRACUNIT * 100), 0x0001_8000, -0x0001_8000];
    for (const a of values) {
      for (const b of values) {
        const guardAbsoluteA = a < 0 ? -a | 0 : a;
        const guardAbsoluteB = b < 0 ? -b | 0 : b;
        if (guardAbsoluteA >> 14 >= guardAbsoluteB) continue;

        const expected = Number((BigInt(a) << 16n) / BigInt(b)) | 0;
        expect(fixedDiv(a, b)).toBe(expected);
      }
    }
  });
});
