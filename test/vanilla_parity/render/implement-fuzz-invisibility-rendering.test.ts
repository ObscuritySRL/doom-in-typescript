import { describe, expect, test } from 'bun:test';

import { VANILLA_FUZZTABLE, VANILLA_FUZZ_COLORMAP_INDEX, VANILLA_FUZZ_OFFSET_PATTERN } from '../../../src/render/implement-fuzz-invisibility-rendering.ts';

describe('vanilla fuzz rendering constants', () => {
  test('FUZZTABLE = 50', () => {
    expect(VANILLA_FUZZTABLE).toBe(50);
  });

  test('fuzz colormap index = 6', () => {
    expect(VANILLA_FUZZ_COLORMAP_INDEX).toBe(6);
  });

  test('fuzz offset pattern has FUZZTABLE entries', () => {
    expect(VANILLA_FUZZ_OFFSET_PATTERN).toHaveLength(VANILLA_FUZZTABLE);
  });

  test('all fuzz offsets are +1 or -1', () => {
    for (const v of VANILLA_FUZZ_OFFSET_PATTERN) {
      expect([-1, 1]).toContain(v);
    }
  });
});
