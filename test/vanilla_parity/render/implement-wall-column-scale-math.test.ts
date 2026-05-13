import { describe, expect, test } from 'bun:test';

import { FRACUNIT } from '../../../src/core/fixed.ts';
import { VANILLA_WALL_SCALE_MAX, VANILLA_WALL_SCALE_MIN, applyVanillaWallScaleSaturated, clampVanillaWallScale, vanillaWallScaleDenominatorPasses } from '../../../src/render/implement-wall-column-scale-math.ts';

describe('wall scale clamp constants', () => {
  test('max is 64 * FRACUNIT = 4_194_304', () => {
    expect(VANILLA_WALL_SCALE_MAX).toBe(64 * FRACUNIT);
    expect(VANILLA_WALL_SCALE_MAX).toBe(4194304);
  });

  test('min is the literal 256 (NOT 1 in fixed-point)', () => {
    expect(VANILLA_WALL_SCALE_MIN).toBe(256);
  });
});

describe('clampVanillaWallScale', () => {
  test('clamps above max to max', () => {
    expect(clampVanillaWallScale({ rawScale: VANILLA_WALL_SCALE_MAX + 1 })).toBe(VANILLA_WALL_SCALE_MAX);
    expect(clampVanillaWallScale({ rawScale: 1 << 30 })).toBe(VANILLA_WALL_SCALE_MAX);
  });

  test('clamps below min to min', () => {
    expect(clampVanillaWallScale({ rawScale: 100 })).toBe(VANILLA_WALL_SCALE_MIN);
    expect(clampVanillaWallScale({ rawScale: 255 })).toBe(VANILLA_WALL_SCALE_MIN);
  });

  test('passes through in-range values', () => {
    expect(clampVanillaWallScale({ rawScale: 256 })).toBe(256);
    expect(clampVanillaWallScale({ rawScale: 100000 })).toBe(100000);
    expect(clampVanillaWallScale({ rawScale: VANILLA_WALL_SCALE_MAX })).toBe(VANILLA_WALL_SCALE_MAX);
  });

  test('truncates fractional values', () => {
    expect(clampVanillaWallScale({ rawScale: 100000.7 })).toBe(100000);
  });
});

describe('vanillaWallScaleDenominatorPasses', () => {
  test('true when den > num >> 16', () => {
    expect(vanillaWallScaleDenominatorPasses({ den: 1000000, num: 100000 })).toBe(true);
  });

  test('false when den <= num >> 16 (overflow guard)', () => {
    // num = 0x10000, num >> 16 = 1, den = 1: not greater
    expect(vanillaWallScaleDenominatorPasses({ den: 1, num: 0x10000 })).toBe(false);
    expect(vanillaWallScaleDenominatorPasses({ den: 0, num: 0x20000 })).toBe(false);
  });
});

describe('applyVanillaWallScaleSaturated', () => {
  test('returns clamped scale when denominator passes', () => {
    expect(applyVanillaWallScaleSaturated({ den: 1000000, num: 100000, rawScale: 500000 })).toBe(500000);
    expect(applyVanillaWallScaleSaturated({ den: 1000000, num: 100000, rawScale: 100 })).toBe(VANILLA_WALL_SCALE_MIN);
  });

  test('saturates to max when denominator fails (wall behind/overhead)', () => {
    expect(applyVanillaWallScaleSaturated({ den: 0, num: 0x20000, rawScale: 100000 })).toBe(VANILLA_WALL_SCALE_MAX);
  });
});
