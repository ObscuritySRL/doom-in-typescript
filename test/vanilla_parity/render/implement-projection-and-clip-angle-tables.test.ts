import { describe, expect, test } from 'bun:test';

import {
  VANILLA_ANG90,
  VANILLA_ANGLETOFINESHIFT,
  VANILLA_FIELDOFVIEW_BAM,
  VANILLA_FINEANGLES,
  VANILLA_FINEANGLES_HALF,
  VANILLA_FINEANGLES_QUARTER,
  computeVanillaProjectionTableSizes,
  vanillaAngleToFineangleIndex,
  vanillaXToViewangleIndex,
} from '../../../src/render/implement-projection-and-clip-angle-tables.ts';

describe('projection table constants', () => {
  test('FIELDOFVIEW = 2048 BAM (90 degrees)', () => {
    expect(VANILLA_FIELDOFVIEW_BAM).toBe(2048);
  });

  test('FINEANGLES = 8192, half = 4096, quarter = 2048', () => {
    expect(VANILLA_FINEANGLES).toBe(8192);
    expect(VANILLA_FINEANGLES_HALF).toBe(4096);
    expect(VANILLA_FINEANGLES_QUARTER).toBe(2048);
  });

  test('ANGLETOFINESHIFT = 19', () => {
    expect(VANILLA_ANGLETOFINESHIFT).toBe(19);
  });

  test('ANG90 = 0x40000000', () => {
    expect(VANILLA_ANG90).toBe(0x40000000);
  });
});

describe('computeVanillaProjectionTableSizes', () => {
  test('viewangletox length is FINEANGLES/2 = 4096', () => {
    const result = computeVanillaProjectionTableSizes({ viewwidth: 320, centerxfrac: 160 << 16 });
    expect(result.viewangletoxLength).toBe(4096);
  });

  test('xtoviewangle length is viewwidth+1', () => {
    expect(computeVanillaProjectionTableSizes({ viewwidth: 320, centerxfrac: 160 << 16 }).xtoviewangleLength).toBe(321);
    expect(computeVanillaProjectionTableSizes({ viewwidth: 160, centerxfrac: 80 << 16 }).xtoviewangleLength).toBe(161);
  });

  test('focallength fineangle index is FINEANGLES/4 + FIELDOFVIEW/2 = 2048 + 1024 = 3072', () => {
    expect(computeVanillaProjectionTableSizes({ viewwidth: 320, centerxfrac: 160 << 16 }).focallengthFineangleIndex).toBe(3072);
  });

  test('result is frozen', () => {
    expect(Object.isFrozen(computeVanillaProjectionTableSizes({ viewwidth: 320, centerxfrac: 0 }))).toBe(true);
  });
});

describe('vanillaXToViewangleIndex', () => {
  test('returns x for in-range values', () => {
    expect(vanillaXToViewangleIndex(0, 320)).toBe(0);
    expect(vanillaXToViewangleIndex(320, 320)).toBe(320);
  });

  test('throws on negative x', () => {
    expect(() => vanillaXToViewangleIndex(-1, 320)).toThrow(RangeError);
  });

  test('throws on x > viewwidth', () => {
    expect(() => vanillaXToViewangleIndex(321, 320)).toThrow(RangeError);
  });
});

describe('vanillaAngleToFineangleIndex', () => {
  test('angle 0 maps to fineangle 0', () => {
    expect(vanillaAngleToFineangleIndex(0)).toBe(0);
  });

  test('ANG90 maps to FINEANGLES/4 = 2048', () => {
    expect(vanillaAngleToFineangleIndex(VANILLA_ANG90)).toBe(2048);
  });

  test('result is always in [0, FINEANGLES)', () => {
    for (const angle of [0, 0x10000000, 0x40000000, 0x80000000, 0xc0000000, 0xffffffff]) {
      const idx = vanillaAngleToFineangleIndex(angle);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(VANILLA_FINEANGLES);
    }
  });
});
