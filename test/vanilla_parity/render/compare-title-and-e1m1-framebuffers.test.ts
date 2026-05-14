import { describe, expect, test } from 'bun:test';

import {
  VANILLA_FRAMEBUFFER_BYTE_LENGTH,
  VANILLA_FRAMEBUFFER_HASH_ALGORITHM,
  VANILLA_FRAMEBUFFER_HASH_HEX_LENGTH,
  VANILLA_FRAMEBUFFER_HEIGHT,
  VANILLA_FRAMEBUFFER_WIDTH,
  isValidFramebufferHashHex,
} from '../../../src/render/compare-title-and-e1m1-framebuffers.ts';

describe('vanilla framebuffer oracle constants', () => {
  test('framebuffer 320x200 = 64000 bytes', () => {
    expect(VANILLA_FRAMEBUFFER_WIDTH).toBe(320);
    expect(VANILLA_FRAMEBUFFER_HEIGHT).toBe(200);
    expect(VANILLA_FRAMEBUFFER_BYTE_LENGTH).toBe(64000);
  });

  test('hash is SHA-256 64-hex', () => {
    expect(VANILLA_FRAMEBUFFER_HASH_ALGORITHM).toBe('sha256');
    expect(VANILLA_FRAMEBUFFER_HASH_HEX_LENGTH).toBe(64);
  });
});

describe('isValidFramebufferHashHex', () => {
  test('accepts 64-char lowercase hex', () => {
    expect(isValidFramebufferHashHex('a'.repeat(64))).toBe(true);
    expect(isValidFramebufferHashHex('0123456789abcdef'.repeat(4))).toBe(true);
  });

  test('rejects wrong length or non-hex chars', () => {
    expect(isValidFramebufferHashHex('a'.repeat(63))).toBe(false);
    expect(isValidFramebufferHashHex('a'.repeat(65))).toBe(false);
    expect(isValidFramebufferHashHex('A'.repeat(64))).toBe(false);
    expect(isValidFramebufferHashHex('z'.repeat(64))).toBe(false);
  });
});
