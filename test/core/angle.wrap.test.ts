import { describe, expect, test } from 'bun:test';

import { ANG45, ANG90, ANG180, ANG270, angleWrap } from '../../src/core/angle.ts';
import type { Angle } from '../../src/core/angle.ts';

describe('ANG45', () => {
  test('is exactly 0x20000000', () => {
    expect(ANG45).toBe(0x2000_0000);
  });

  test('is one-eighth of a full circle', () => {
    expect(ANG45).toBe(0x1_0000_0000 / 8);
  });
});

describe('ANG90', () => {
  test('is exactly 0x40000000', () => {
    expect(ANG90).toBe(0x4000_0000);
  });

  test('is double ANG45', () => {
    expect(ANG90).toBe(ANG45 * 2);
  });

  test('is one-quarter of a full circle', () => {
    expect(ANG90).toBe(0x1_0000_0000 / 4);
  });
});

describe('ANG180', () => {
  test('is exactly 0x80000000', () => {
    expect(ANG180).toBe(0x8000_0000);
  });

  test('is double ANG90', () => {
    expect(ANG180).toBe(ANG90 * 2);
  });

  test('is one-half of a full circle', () => {
    expect(ANG180).toBe(0x1_0000_0000 / 2);
  });
});

describe('ANG270', () => {
  test('is exactly 0xC0000000', () => {
    expect(ANG270).toBe(0xc000_0000);
  });

  test('is ANG180 + ANG90', () => {
    expect(ANG270).toBe(ANG180 + ANG90);
  });

  test('is three-quarters of a full circle', () => {
    expect(ANG270).toBe((0x1_0000_0000 * 3) / 4);
  });
});

describe('angle constants relationships', () => {
  test('are multiples of ANG45', () => {
    expect(ANG90).toBe(ANG45 * 2);
    expect(ANG180).toBe(ANG45 * 4);
    expect(ANG270).toBe(ANG45 * 6);
  });

  test('eight ANG45 equals a full circle', () => {
    expect(ANG45 * 8).toBe(0x1_0000_0000);
  });

  test('four ANG90 equals a full circle', () => {
    expect(ANG90 * 4).toBe(0x1_0000_0000);
  });
});

describe('angleWrap', () => {
  test('preserves zero', () => {
    expect(angleWrap(0)).toBe(0);
  });

  test('preserves ANG45', () => {
    expect(angleWrap(ANG45)).toBe(ANG45);
  });

  test('preserves ANG90', () => {
    expect(angleWrap(ANG90)).toBe(ANG90);
  });

  test('preserves ANG180', () => {
    expect(angleWrap(ANG180)).toBe(ANG180);
  });

  test('preserves ANG270', () => {
    expect(angleWrap(ANG270)).toBe(ANG270);
  });

  test('preserves maximum uint32 (0xFFFFFFFF)', () => {
    expect(angleWrap(0xffff_ffff)).toBe(0xffff_ffff);
  });

  test('wraps full circle to zero', () => {
    expect(angleWrap(0x1_0000_0000)).toBe(0);
  });

  test('wraps ANG180 + ANG180 to zero', () => {
    expect(angleWrap(ANG180 + ANG180)).toBe(0);
  });

  test('wraps ANG270 + ANG180 to ANG90', () => {
    expect(angleWrap(ANG270 + ANG180)).toBe(ANG90);
  });

  test('wraps negative to positive uint32', () => {
    expect(angleWrap(-1)).toBe(0xffff_ffff);
  });

  test('wraps -ANG90 to ANG270', () => {
    expect(angleWrap(-ANG90)).toBe(ANG270);
  });

  test('wraps -ANG45 to ANG270 + ANG45', () => {
    expect(angleWrap(-ANG45)).toBe(ANG270 + ANG45);
  });

  test('signed INT32_MIN reinterprets as ANG180 (parity-critical)', () => {
    // In C, angle subtraction producing a negative signed result
    // reinterprets as a large unsigned value. The renderer relies
    // on this for FOV delta computation. -0x80000000 as uint32 is
    // 0x80000000 = ANG180.
    expect(angleWrap(-0x8000_0000)).toBe(ANG180);
  });

  test('double wrap is idempotent', () => {
    const values = [0, ANG45, ANG90, ANG180, ANG270, 0xffff_ffff, -1, -ANG90];
    for (const value of values) {
      expect(angleWrap(angleWrap(value))).toBe(angleWrap(value));
    }
  });

  test('wraps values beyond uint32 max', () => {
    expect(angleWrap(0x1_0000_0001)).toBe(1);
    expect(angleWrap(0x2_0000_0000)).toBe(0);
  });

  test('runtime typeof is number', () => {
    const angle: Angle = angleWrap(ANG90);
    expect(typeof angle).toBe('number');
  });
});
