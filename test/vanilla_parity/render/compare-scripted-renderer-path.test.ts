import { describe, expect, test } from 'bun:test';

import { VANILLA_RENDERER_CHECKPOINT_HASH_HEX_LENGTH, VANILLA_RENDERER_CHECKPOINT_TICS } from '../../../src/render/compare-scripted-renderer-path.ts';

describe('vanilla scripted renderer checkpoint constants', () => {
  test('checkpoint tics: spawn (0), 1-sec (35), 3-sec (105)', () => {
    expect([...VANILLA_RENDERER_CHECKPOINT_TICS]).toEqual([0, 35, 105]);
  });

  test('hash format is SHA-256 64-hex', () => {
    expect(VANILLA_RENDERER_CHECKPOINT_HASH_HEX_LENGTH).toBe(64);
  });
});
