import { describe, expect, test } from 'bun:test';

import { FRACBITS, FRACUNIT, FIXED_MAX, FIXED_MIN } from '../../src/core/fixed.ts';
import type { Fixed } from '../../src/core/fixed.ts';

describe('FRACBITS', () => {
  test('is exactly 16', () => {
    expect(FRACBITS).toBe(16);
  });

  test('matches vanilla Doom 16.16 format', () => {
    expect(FRACBITS).toBeGreaterThan(0);
    expect(FRACBITS).toBeLessThan(32);
  });
});

describe('FRACUNIT', () => {
  test('is exactly 65536', () => {
    expect(FRACUNIT).toBe(65_536);
  });

  test('equals 1 << FRACBITS', () => {
    expect(FRACUNIT).toBe(1 << FRACBITS);
  });

  test('is 0x10000 in hex', () => {
    expect(FRACUNIT).toBe(0x10000);
  });

  test('is a power of two', () => {
    expect(FRACUNIT > 0 && (FRACUNIT & (FRACUNIT - 1)) === 0).toBe(true);
  });
});

describe('FIXED_MAX', () => {
  test('is exactly 0x7FFFFFFF (INT32_MAX)', () => {
    expect(FIXED_MAX).toBe(0x7fff_ffff);
  });

  test('equals 2147483647', () => {
    expect(FIXED_MAX).toBe(2_147_483_647);
  });

  test('is positive', () => {
    expect(FIXED_MAX).toBeGreaterThan(0);
  });

  test('integer part is 32767 (max signed 16-bit)', () => {
    expect(FIXED_MAX >> FRACBITS).toBe(32_767);
  });

  test('fractional part is fully saturated (0xFFFF)', () => {
    expect(FIXED_MAX & (FRACUNIT - 1)).toBe(0xffff);
  });

  test('survives int32 coercion via bitwise OR', () => {
    expect(FIXED_MAX | 0).toBe(FIXED_MAX);
  });
});

describe('FIXED_MIN', () => {
  test('is exactly -0x80000000 (INT32_MIN)', () => {
    expect(FIXED_MIN).toBe(-0x8000_0000);
  });

  test('equals -2147483648', () => {
    expect(FIXED_MIN).toBe(-2_147_483_648);
  });

  test('is negative', () => {
    expect(FIXED_MIN).toBeLessThan(0);
  });

  test('integer part is -32768 (min signed 16-bit)', () => {
    expect(FIXED_MIN >> FRACBITS).toBe(-32_768);
  });

  test('fractional part is zero', () => {
    expect(FIXED_MIN & (FRACUNIT - 1)).toBe(0);
  });

  test('survives int32 coercion via bitwise OR', () => {
    expect(FIXED_MIN | 0).toBe(FIXED_MIN);
  });
});

describe('range consistency', () => {
  test('FIXED_MAX + 1 wraps to FIXED_MIN under int32 coercion', () => {
    expect((FIXED_MAX + 1) | 0).toBe(FIXED_MIN);
  });

  test('FIXED_MIN - 1 wraps to FIXED_MAX under int32 coercion', () => {
    expect((FIXED_MIN - 1) | 0).toBe(FIXED_MAX);
  });

  test('range spans exactly 2^32 values', () => {
    expect(FIXED_MAX - FIXED_MIN + 1).toBe(2 ** 32);
  });

  test('FIXED_MAX is FRACUNIT * 32767 + (FRACUNIT - 1)', () => {
    expect(FIXED_MAX).toBe(FRACUNIT * 32_767 + (FRACUNIT - 1));
  });

  test('FIXED_MIN is -(FRACUNIT * 32768)', () => {
    expect(FIXED_MIN).toBe(-(FRACUNIT * 32_768));
  });
});

describe('type alias', () => {
  test('Fixed values are plain numbers at runtime', () => {
    const value: Fixed = FRACUNIT;
    expect(typeof value).toBe('number');
  });
});
