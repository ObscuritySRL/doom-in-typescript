import { describe, expect, test } from 'bun:test';

import { RENDERER_FRAMEBUFFER_PARITY_GATE } from '../../../src/render/gate-renderer-framebuffer-parity.ts';

describe('gate: renderer framebuffer parity', () => {
  test('framebuffer 320x200=64000 bytes', () => {
    expect(RENDERER_FRAMEBUFFER_PARITY_GATE.width).toBe(320);
    expect(RENDERER_FRAMEBUFFER_PARITY_GATE.height).toBe(200);
    expect(RENDERER_FRAMEBUFFER_PARITY_GATE.byteLength).toBe(64000);
  });

  test('hash format is SHA-256 64-hex', () => {
    expect(RENDERER_FRAMEBUFFER_PARITY_GATE.hashHexLength).toBe(64);
  });

  test('checkpoint tics: 0, 35, 105', () => {
    expect([...RENDERER_FRAMEBUFFER_PARITY_GATE.checkpointTics]).toEqual([0, 35, 105]);
  });
});
