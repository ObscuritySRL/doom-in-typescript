import { describe, expect, test } from 'bun:test';

import { FRAMEBUFFER_HEIGHT, FRAMEBUFFER_SIZE, FRAMEBUFFER_WIDTH, PALETTE_COUNT, DEFAULT_FRAMEBUFFER_SAMPLING_INTERVAL_TICS } from '../../../src/oracles/framebufferHash.ts';
import {
  VANILLA_FRAMEBUFFER_HASH_DEFAULT_SAMPLING_INTERVAL_TICS,
  VANILLA_FRAMEBUFFER_HASH_HEIGHT,
  VANILLA_FRAMEBUFFER_HASH_HOOK_PHASE,
  VANILLA_FRAMEBUFFER_HASH_PALETTE_COUNT,
  VANILLA_FRAMEBUFFER_HASH_SIZE_BYTES,
  VANILLA_FRAMEBUFFER_HASH_WIDTH,
  vanillaFramebufferHashShouldSample,
  vanillaFramebufferHashValidateLength,
  vanillaFramebufferHashValidatePaletteIndex,
} from '../../../src/render/add-framebuffer-hash-hook.ts';

describe('vanilla framebuffer hash hook constants', () => {
  test('width × height = 320 × 200 = 64000 bytes', () => {
    expect(VANILLA_FRAMEBUFFER_HASH_WIDTH).toBe(320);
    expect(VANILLA_FRAMEBUFFER_HASH_HEIGHT).toBe(200);
    expect(VANILLA_FRAMEBUFFER_HASH_SIZE_BYTES).toBe(64000);
    expect(VANILLA_FRAMEBUFFER_HASH_WIDTH * VANILLA_FRAMEBUFFER_HASH_HEIGHT).toBe(VANILLA_FRAMEBUFFER_HASH_SIZE_BYTES);
  });

  test('PLAYPAL palette count = 14', () => {
    expect(VANILLA_FRAMEBUFFER_HASH_PALETTE_COUNT).toBe(14);
  });

  test('default sampling interval = 35 tics (1 second)', () => {
    expect(VANILLA_FRAMEBUFFER_HASH_DEFAULT_SAMPLING_INTERVAL_TICS).toBe(35);
  });

  test('hook fires after all tic rendering completes', () => {
    expect(VANILLA_FRAMEBUFFER_HASH_HOOK_PHASE).toBe('after-tic-render-complete');
  });

  test('mirrors src/oracles/framebufferHash.ts canonical constants', () => {
    expect(VANILLA_FRAMEBUFFER_HASH_WIDTH).toBe(FRAMEBUFFER_WIDTH);
    expect(VANILLA_FRAMEBUFFER_HASH_HEIGHT).toBe(FRAMEBUFFER_HEIGHT);
    expect(VANILLA_FRAMEBUFFER_HASH_SIZE_BYTES).toBe(FRAMEBUFFER_SIZE);
    expect(VANILLA_FRAMEBUFFER_HASH_PALETTE_COUNT).toBe(PALETTE_COUNT);
    expect(VANILLA_FRAMEBUFFER_HASH_DEFAULT_SAMPLING_INTERVAL_TICS).toBe(DEFAULT_FRAMEBUFFER_SAMPLING_INTERVAL_TICS);
  });
});

describe('vanillaFramebufferHashShouldSample', () => {
  test('interval=1 samples every tic', () => {
    expect(vanillaFramebufferHashShouldSample(0, 1)).toBe(true);
    expect(vanillaFramebufferHashShouldSample(1, 1)).toBe(true);
    expect(vanillaFramebufferHashShouldSample(100, 1)).toBe(true);
  });

  test('interval=35 samples once per second at 35 Hz', () => {
    expect(vanillaFramebufferHashShouldSample(0, 35)).toBe(true);
    expect(vanillaFramebufferHashShouldSample(1, 35)).toBe(false);
    expect(vanillaFramebufferHashShouldSample(34, 35)).toBe(false);
    expect(vanillaFramebufferHashShouldSample(35, 35)).toBe(true);
    expect(vanillaFramebufferHashShouldSample(70, 35)).toBe(true);
  });

  test('rejects non-positive interval', () => {
    expect(() => vanillaFramebufferHashShouldSample(0, 0)).toThrow();
    expect(() => vanillaFramebufferHashShouldSample(0, -1)).toThrow();
  });

  test('rejects negative tic', () => {
    expect(() => vanillaFramebufferHashShouldSample(-1, 35)).toThrow();
  });
});

describe('vanillaFramebufferHashValidateLength', () => {
  test('accepts exactly 64000 bytes', () => {
    expect(vanillaFramebufferHashValidateLength(64000)).toBe(true);
  });

  test('rejects wrong-size buffers', () => {
    expect(() => vanillaFramebufferHashValidateLength(0)).toThrow();
    expect(() => vanillaFramebufferHashValidateLength(63999)).toThrow();
    expect(() => vanillaFramebufferHashValidateLength(64001)).toThrow();
    expect(() => vanillaFramebufferHashValidateLength(320 * 240)).toThrow(); // wrong height
  });
});

describe('vanillaFramebufferHashValidatePaletteIndex', () => {
  test('accepts 0..13', () => {
    expect(vanillaFramebufferHashValidatePaletteIndex(0)).toBe(true);
    expect(vanillaFramebufferHashValidatePaletteIndex(13)).toBe(true);
  });

  test('rejects out-of-range and non-integer', () => {
    expect(() => vanillaFramebufferHashValidatePaletteIndex(-1)).toThrow();
    expect(() => vanillaFramebufferHashValidatePaletteIndex(14)).toThrow();
    expect(() => vanillaFramebufferHashValidatePaletteIndex(1.5)).toThrow();
  });
});
