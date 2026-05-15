import { describe, expect, test } from 'bun:test';

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
import { FRAMEBUFFER_WIDTH } from '../../../src/oracles/framebufferHash.ts';

describe('plan_final render: wire-framebuffer-hash', () => {
  test('VANILLA_FRAMEBUFFER_HASH_WIDTH and HEIGHT pin the canonical 320x200 source dimensions', () => {
    expect(VANILLA_FRAMEBUFFER_HASH_WIDTH).toBe(320);
    expect(VANILLA_FRAMEBUFFER_HASH_HEIGHT).toBe(200);
  });

  test('VANILLA_FRAMEBUFFER_HASH_SIZE_BYTES pins 320*200=64000 bytes', () => {
    expect(VANILLA_FRAMEBUFFER_HASH_SIZE_BYTES).toBe(64_000);
  });

  test('VANILLA_FRAMEBUFFER_HASH_PALETTE_COUNT pins the 14-palette PLAYPAL set', () => {
    expect(VANILLA_FRAMEBUFFER_HASH_PALETTE_COUNT).toBe(14);
  });

  test('VANILLA_FRAMEBUFFER_HASH_DEFAULT_SAMPLING_INTERVAL_TICS pins the 35-tic (1Hz) default sampling cadence', () => {
    expect(VANILLA_FRAMEBUFFER_HASH_DEFAULT_SAMPLING_INTERVAL_TICS).toBe(35);
  });

  test('VANILLA_FRAMEBUFFER_HASH_HOOK_PHASE pins the after-tic-render-complete hook phase', () => {
    expect(VANILLA_FRAMEBUFFER_HASH_HOOK_PHASE).toBe('after-tic-render-complete');
  });

  test('FRAMEBUFFER_WIDTH from the oracles framebufferHash module matches the renderer constant', () => {
    expect(FRAMEBUFFER_WIDTH).toBe(VANILLA_FRAMEBUFFER_HASH_WIDTH);
  });

  test('vanillaFramebufferHashShouldSample returns true at tic-0 and every Nth tic, false in-between', () => {
    expect(vanillaFramebufferHashShouldSample(0, 35)).toBe(true);
    expect(vanillaFramebufferHashShouldSample(1, 35)).toBe(false);
    expect(vanillaFramebufferHashShouldSample(34, 35)).toBe(false);
    expect(vanillaFramebufferHashShouldSample(35, 35)).toBe(true);
    expect(vanillaFramebufferHashShouldSample(70, 35)).toBe(true);
  });

  test('vanillaFramebufferHashValidateLength accepts the canonical 64000-byte length', () => {
    expect(vanillaFramebufferHashValidateLength(64_000)).toBe(true);
  });

  test('vanillaFramebufferHashValidateLength throws for non-canonical lengths', () => {
    expect(() => vanillaFramebufferHashValidateLength(63_999)).toThrow();
    expect(() => vanillaFramebufferHashValidateLength(64_001)).toThrow();
  });

  test('vanillaFramebufferHashValidatePaletteIndex accepts every canonical 0..13 index', () => {
    for (let paletteIndex = 0; paletteIndex < 14; paletteIndex += 1) {
      expect(vanillaFramebufferHashValidatePaletteIndex(paletteIndex)).toBe(true);
    }
  });

  test('vanillaFramebufferHashValidatePaletteIndex throws for out-of-range indices', () => {
    expect(() => vanillaFramebufferHashValidatePaletteIndex(-1)).toThrow();
    expect(() => vanillaFramebufferHashValidatePaletteIndex(14)).toThrow();
  });
});
