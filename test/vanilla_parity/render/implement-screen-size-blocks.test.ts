import { describe, expect, test } from 'bun:test';

import { VANILLA_SCREEN_BLOCK_DEFAULT, VANILLA_SCREEN_BLOCK_FULLSCREEN, VANILLA_SCREEN_BLOCK_MAX, VANILLA_SCREEN_BLOCK_MIN, isFullscreenScreenBlock, isValidScreenBlock } from '../../../src/render/implement-screen-size-blocks.ts';

describe('vanilla screen size blocks', () => {
  test('range is 3..11', () => {
    expect(VANILLA_SCREEN_BLOCK_MIN).toBe(3);
    expect(VANILLA_SCREEN_BLOCK_MAX).toBe(11);
  });

  test('default is 10', () => {
    expect(VANILLA_SCREEN_BLOCK_DEFAULT).toBe(10);
  });

  test('fullscreen is 11', () => {
    expect(VANILLA_SCREEN_BLOCK_FULLSCREEN).toBe(11);
  });
});

describe('helpers', () => {
  test('isValidScreenBlock for 3..11', () => {
    expect(isValidScreenBlock(2)).toBe(false);
    expect(isValidScreenBlock(3)).toBe(true);
    expect(isValidScreenBlock(11)).toBe(true);
    expect(isValidScreenBlock(12)).toBe(false);
  });

  test('isFullscreenScreenBlock only for 11', () => {
    expect(isFullscreenScreenBlock(10)).toBe(false);
    expect(isFullscreenScreenBlock(11)).toBe(true);
  });
});
