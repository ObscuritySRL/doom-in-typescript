import { describe, expect, test } from 'bun:test';

import { FIXED_MAX, FIXED_MIN, FRACUNIT, fixedAdd, fixedSub } from '../../src/core/fixed.ts';

describe('fixedAdd', () => {
  test('adds two positive values', () => {
    expect(fixedAdd(FRACUNIT, FRACUNIT)).toBe((FRACUNIT * 2) | 0);
  });

  test('adds positive and negative values', () => {
    expect(fixedAdd(FRACUNIT, -FRACUNIT)).toBe(0);
  });

  test('adds two negative values', () => {
    expect(fixedAdd(-FRACUNIT, -FRACUNIT)).toBe((-FRACUNIT * 2) | 0);
  });

  test('identity: adding zero returns the original', () => {
    expect(fixedAdd(FRACUNIT, 0)).toBe(FRACUNIT);
    expect(fixedAdd(0, FRACUNIT)).toBe(FRACUNIT);
    expect(fixedAdd(0, 0)).toBe(0);
  });

  test('is commutative', () => {
    const a = 0x0001_8000; // 1.5
    const b = 0x0002_4000; // 2.25
    expect(fixedAdd(a, b)).toBe(fixedAdd(b, a));
  });

  test('result is always int32', () => {
    const result = fixedAdd(FRACUNIT, FRACUNIT);
    expect(result).toBe(result | 0);
  });

  test("positive overflow wraps to negative (two's complement)", () => {
    // FIXED_MAX + 1 wraps to FIXED_MIN — vanilla Doom relies on this
    expect(fixedAdd(FIXED_MAX, 1)).toBe(FIXED_MIN);
  });

  test('positive overflow wraps correctly for FRACUNIT past MAX', () => {
    expect(fixedAdd(FIXED_MAX, FRACUNIT)).toBe((FIXED_MAX + FRACUNIT) | 0);
  });

  test("negative overflow wraps to positive (two's complement)", () => {
    // FIXED_MIN + (-1) wraps to FIXED_MAX
    expect(fixedAdd(FIXED_MIN, -1)).toBe(FIXED_MAX);
  });

  test('double overflow wraps deterministically', () => {
    // FIXED_MAX + FIXED_MAX = 0x7FFFFFFF + 0x7FFFFFFF = 0xFFFFFFFE → -2 as int32
    expect(fixedAdd(FIXED_MAX, FIXED_MAX)).toBe(-2);
  });

  test('FIXED_MIN + FIXED_MIN wraps to zero', () => {
    // -0x80000000 + -0x80000000 = -0x100000000 → 0 as int32
    expect(fixedAdd(FIXED_MIN, FIXED_MIN)).toBe(0);
  });

  test('fractional precision is preserved', () => {
    const quarter = FRACUNIT >> 2; // 0.25
    const half = FRACUNIT >> 1; // 0.5
    expect(fixedAdd(quarter, quarter)).toBe(half);
  });
});

describe('fixedSub', () => {
  test('subtracts two positive values', () => {
    expect(fixedSub(FRACUNIT * 3, FRACUNIT)).toBe((FRACUNIT * 2) | 0);
  });

  test('subtracting a negative is addition', () => {
    expect(fixedSub(FRACUNIT, -FRACUNIT)).toBe((FRACUNIT * 2) | 0);
  });

  test('subtracting equal values yields zero', () => {
    expect(fixedSub(FRACUNIT, FRACUNIT)).toBe(0);
    expect(fixedSub(FIXED_MAX, FIXED_MAX)).toBe(0);
    expect(fixedSub(FIXED_MIN, FIXED_MIN)).toBe(0);
  });

  test('identity: subtracting zero returns the original', () => {
    expect(fixedSub(FRACUNIT, 0)).toBe(FRACUNIT);
    expect(fixedSub(FIXED_MAX, 0)).toBe(FIXED_MAX);
    expect(fixedSub(FIXED_MIN, 0)).toBe(FIXED_MIN);
  });

  test('result is always int32', () => {
    const result = fixedSub(FRACUNIT, FRACUNIT);
    expect(result).toBe(result | 0);
  });

  test("negative underflow wraps to positive (two's complement)", () => {
    // FIXED_MIN - 1 wraps to FIXED_MAX — vanilla Doom relies on this
    expect(fixedSub(FIXED_MIN, 1)).toBe(FIXED_MAX);
  });

  test('positive overflow wraps to negative on negative subtrahend', () => {
    // FIXED_MAX - (-1) = FIXED_MAX + 1 wraps to FIXED_MIN
    expect(fixedSub(FIXED_MAX, -1)).toBe(FIXED_MIN);
  });

  test('FIXED_MIN - FIXED_MAX wraps deterministically', () => {
    // -0x80000000 - 0x7FFFFFFF = -0xFFFFFFFF → 1 as int32
    expect(fixedSub(FIXED_MIN, FIXED_MAX)).toBe(1);
  });

  test('FIXED_MAX - FIXED_MIN wraps deterministically', () => {
    // 0x7FFFFFFF - (-0x80000000) = 0xFFFFFFFF → -1 as int32
    expect(fixedSub(FIXED_MAX, FIXED_MIN)).toBe(-1);
  });

  test('fractional precision is preserved', () => {
    const threeQuarters = (FRACUNIT >> 2) * 3; // 0.75
    const quarter = FRACUNIT >> 2; // 0.25
    expect(fixedSub(threeQuarters, quarter)).toBe((FRACUNIT >> 1) | 0);
  });
});

describe('add/sub inverse relationship', () => {
  test('fixedSub(fixedAdd(a, b), b) === a for in-range values', () => {
    const a = 0x0003_c000; // 3.75
    const b = 0x0001_8000; // 1.5
    expect(fixedSub(fixedAdd(a, b), b)).toBe(a);
  });

  test('fixedAdd(fixedSub(a, b), b) === a for in-range values', () => {
    const a = 0x0005_0000; // 5.0
    const b = 0x0002_0000; // 2.0
    expect(fixedAdd(fixedSub(a, b), b)).toBe(a);
  });

  test('inverse holds even through overflow (wrapping is reversible)', () => {
    // Adding then subtracting the same value always recovers the original
    // because two's complement wrapping is a group operation
    expect(fixedSub(fixedAdd(FIXED_MAX, FRACUNIT), FRACUNIT)).toBe(FIXED_MAX);
    expect(fixedAdd(fixedSub(FIXED_MIN, FRACUNIT), FRACUNIT)).toBe(FIXED_MIN);
  });
});
