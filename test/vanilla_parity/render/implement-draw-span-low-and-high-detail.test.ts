import { describe, expect, test } from 'bun:test';

import {
  VANILLA_DRAW_SPAN_X_MASK,
  VANILLA_DRAW_SPAN_X_SHIFT,
  VANILLA_DRAW_SPAN_Y_MASK,
  VANILLA_DRAW_SPAN_Y_SHIFT,
  VANILLA_FLAT_TEXTURE_DIMENSION,
  VANILLA_FLAT_TEXTURE_SIZE,
  vanillaDrawSpanFlatIndex,
  vanillaDrawSpanPixelCount,
  vanillaDrawSpanPixelStride,
} from '../../../src/render/implement-draw-span-low-and-high-detail.ts';

describe('draw span flat constants', () => {
  test('flat texture is 64x64 = 4096 bytes', () => {
    expect(VANILLA_FLAT_TEXTURE_DIMENSION).toBe(64);
    expect(VANILLA_FLAT_TEXTURE_SIZE).toBe(4096);
  });

  test('y mask = 63*64 = 4032 (0xFC0), x mask = 0x3F', () => {
    expect(VANILLA_DRAW_SPAN_Y_MASK).toBe(63 * 64);
    expect(VANILLA_DRAW_SPAN_Y_MASK).toBe(4032);
    expect(VANILLA_DRAW_SPAN_X_MASK).toBe(0x3f);
  });

  test('y shift = 10, x shift = 16', () => {
    expect(VANILLA_DRAW_SPAN_Y_SHIFT).toBe(10);
    expect(VANILLA_DRAW_SPAN_X_SHIFT).toBe(16);
  });
});

describe('vanillaDrawSpanPixelCount', () => {
  test('returns x2 - x1 + 1 when range is valid', () => {
    expect(vanillaDrawSpanPixelCount({ ds_x1: 0, ds_x2: 9 })).toBe(10);
    expect(vanillaDrawSpanPixelCount({ ds_x1: 50, ds_x2: 50 })).toBe(1);
  });

  test('returns 0 when x1 > x2 (negative count)', () => {
    expect(vanillaDrawSpanPixelCount({ ds_x1: 10, ds_x2: 5 })).toBe(0);
  });
});

describe('vanillaDrawSpanFlatIndex', () => {
  test('xfrac=0, yfrac=0 maps to flat index 0', () => {
    expect(vanillaDrawSpanFlatIndex({ xfrac: 0, yfrac: 0 })).toBe(0);
  });

  test('xfrac in [0, 64) selects x column', () => {
    expect(vanillaDrawSpanFlatIndex({ xfrac: 1 << 16, yfrac: 0 })).toBe(1);
    expect(vanillaDrawSpanFlatIndex({ xfrac: 32 << 16, yfrac: 0 })).toBe(32);
  });

  test('yfrac selects y row * 64', () => {
    expect(vanillaDrawSpanFlatIndex({ xfrac: 0, yfrac: 1 << 16 })).toBe(64);
    expect(vanillaDrawSpanFlatIndex({ xfrac: 0, yfrac: 32 << 16 })).toBe(32 * 64);
  });

  test('xfrac wraps modulo 64 (x mask)', () => {
    expect(vanillaDrawSpanFlatIndex({ xfrac: 64 << 16, yfrac: 0 })).toBe(0);
    expect(vanillaDrawSpanFlatIndex({ xfrac: 65 << 16, yfrac: 0 })).toBe(1);
  });

  test('yfrac wraps modulo 64 (y mask)', () => {
    expect(vanillaDrawSpanFlatIndex({ xfrac: 0, yfrac: 64 << 16 })).toBe(0);
  });

  test('combined: xfrac=20, yfrac=5 -> 5*64 + 20 = 340', () => {
    expect(vanillaDrawSpanFlatIndex({ xfrac: 20 << 16, yfrac: 5 << 16 })).toBe(340);
  });

  test('flat index always in [0, 4096)', () => {
    for (let x = 0; x < 200; x += 17) {
      for (let y = 0; y < 200; y += 23) {
        const idx = vanillaDrawSpanFlatIndex({ xfrac: x << 16, yfrac: y << 16 });
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(4096);
      }
    }
  });
});

describe('vanillaDrawSpanPixelStride', () => {
  test('high detail writes 1 pixel per step', () => {
    expect(vanillaDrawSpanPixelStride('high')).toBe(1);
  });

  test('low detail writes 2 pixels per step', () => {
    expect(vanillaDrawSpanPixelStride('low')).toBe(2);
  });
});
