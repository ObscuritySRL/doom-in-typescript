import { describe, expect, test } from 'bun:test';

import { VANILLA_LIGHTZSHIFT, VANILLA_MAXLIGHTZ, computeVanillaSpanYfrac, selectVanillaSpanColormap, vanillaPlaneDistanceLightIndex } from '../../../src/render/implement-floor-span-rendering.ts';

describe('floor span constants', () => {
  test('LIGHTZSHIFT = 20', () => {
    expect(VANILLA_LIGHTZSHIFT).toBe(20);
  });

  test('MAXLIGHTZ = 128', () => {
    expect(VANILLA_MAXLIGHTZ).toBe(128);
  });
});

describe('vanillaPlaneDistanceLightIndex', () => {
  test('distance 0 yields index 0 (brightest)', () => {
    expect(vanillaPlaneDistanceLightIndex({ distance: 0 })).toBe(0);
  });

  test('distance 1 << 20 yields index 1', () => {
    expect(vanillaPlaneDistanceLightIndex({ distance: 1 << 20 })).toBe(1);
  });

  test('distance 128 << 20 clamps to MAXLIGHTZ - 1 = 127', () => {
    expect(vanillaPlaneDistanceLightIndex({ distance: 128 << 20 })).toBe(127);
  });

  test('distance >> 20 = 127 stays at 127 (last valid index)', () => {
    expect(vanillaPlaneDistanceLightIndex({ distance: 127 << 20 })).toBe(127);
  });

  test('huge distance clamps to 127', () => {
    expect(vanillaPlaneDistanceLightIndex({ distance: 0x7fffffff })).toBe(127);
  });

  test('negative distance clamps to 0 (defensive)', () => {
    expect(vanillaPlaneDistanceLightIndex({ distance: -100 })).toBe(0);
  });
});

describe('computeVanillaSpanYfrac', () => {
  test('ds_yfrac = -viewy - sineAtAngle * length', () => {
    expect(computeVanillaSpanYfrac({ viewy: 100, sineAtAngle: 2, length: 3 })).toBe(-100 - 6);
  });

  test('zero length yields just -viewy', () => {
    expect(computeVanillaSpanYfrac({ viewy: 100, sineAtAngle: 0, length: 100 })).toBe(-100);
  });

  test('zero viewy yields -sineAtAngle * length', () => {
    expect(computeVanillaSpanYfrac({ viewy: 0, sineAtAngle: 5, length: 4 })).toBe(-20);
  });
});

describe('selectVanillaSpanColormap', () => {
  test('returns fixedcolormap when non-null (invulnerability/infrared)', () => {
    const result = selectVanillaSpanColormap({
      fixedcolormap: 0xdeadbeef,
      distance: 0,
      planezlightAtIndex: () => 0xcafebabe,
    });
    expect(result).toBe(0xdeadbeef);
  });

  test('returns planezlight[index] when fixedcolormap is null', () => {
    const result = selectVanillaSpanColormap({
      fixedcolormap: null,
      distance: 5 << 20,
      planezlightAtIndex: (index) => index + 1000,
    });
    expect(result).toBe(1005);
  });

  test('clamps to planezlight[MAXLIGHTZ - 1] for far distances', () => {
    const result = selectVanillaSpanColormap({
      fixedcolormap: null,
      distance: 0x7fffffff,
      planezlightAtIndex: (index) => index,
    });
    expect(result).toBe(127);
  });
});
