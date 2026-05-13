import { describe, expect, test } from 'bun:test';

import { FRACBITS, FRACUNIT } from '../../../src/core/fixed.ts';
import {
  VANILLA_DRAW_COLUMN_TEXTURE_HEIGHT,
  VANILLA_DRAW_COLUMN_TEXTURE_MASK,
  computeVanillaDrawColumnInitialFrac,
  vanillaDrawColumnPixelCount,
  vanillaDrawColumnPixelStride,
  vanillaDrawColumnTextureIndex,
} from '../../../src/render/implement-draw-column-low-and-high-detail.ts';

describe('draw column constants', () => {
  test('texture mask is 127 (matches & 127 in upstream)', () => {
    expect(VANILLA_DRAW_COLUMN_TEXTURE_MASK).toBe(127);
  });

  test('texture height is 128', () => {
    expect(VANILLA_DRAW_COLUMN_TEXTURE_HEIGHT).toBe(128);
  });
});

describe('vanillaDrawColumnPixelCount', () => {
  test('returns yh - yl + 1 when yh >= yl', () => {
    expect(vanillaDrawColumnPixelCount({ dc_yl: 0, dc_yh: 9 })).toBe(10);
    expect(vanillaDrawColumnPixelCount({ dc_yl: 50, dc_yh: 50 })).toBe(1);
  });

  test('returns 0 when count <= 0', () => {
    expect(vanillaDrawColumnPixelCount({ dc_yl: 10, dc_yh: 5 })).toBe(0);
  });
});

describe('computeVanillaDrawColumnInitialFrac', () => {
  test('formula = dc_texturemid + (dc_yl - centery) * dc_iscale', () => {
    expect(computeVanillaDrawColumnInitialFrac({ dc_texturemid: 0, dc_yl: 10, centery: 100, dc_iscale: FRACUNIT })).toBe(-90 * FRACUNIT);
  });

  test('initial frac at centery equals dc_texturemid', () => {
    expect(computeVanillaDrawColumnInitialFrac({ dc_texturemid: 0x800000, dc_yl: 100, centery: 100, dc_iscale: FRACUNIT })).toBe(0x800000);
  });
});

describe('vanillaDrawColumnTextureIndex', () => {
  test('frac=0 maps to index 0', () => {
    expect(vanillaDrawColumnTextureIndex({ frac: 0 })).toBe(0);
  });

  test('frac=FRACUNIT maps to index 1', () => {
    expect(vanillaDrawColumnTextureIndex({ frac: FRACUNIT })).toBe(1);
  });

  test('frac >> FRACBITS = 128 wraps to 0 (& 127)', () => {
    expect(vanillaDrawColumnTextureIndex({ frac: 128 << FRACBITS })).toBe(0);
  });

  test('frac >> FRACBITS = 127 stays at 127', () => {
    expect(vanillaDrawColumnTextureIndex({ frac: 127 << FRACBITS })).toBe(127);
  });
});

describe('vanillaDrawColumnPixelStride', () => {
  test('high detail writes 1 pixel per column', () => {
    expect(vanillaDrawColumnPixelStride('high')).toBe(1);
  });

  test('low detail writes 2 pixels per column (pixel doubling)', () => {
    expect(vanillaDrawColumnPixelStride('low')).toBe(2);
  });
});
