import { describe, expect, test } from 'bun:test';

import {
  VANILLA_SCREEN_BLOCK_DEFAULT,
  VANILLA_SCREEN_BLOCK_FULLSCREEN,
  VANILLA_SCREEN_BLOCK_MAX,
  VANILLA_SCREEN_BLOCK_MIN,
  VANILLA_SCREEN_HEIGHT,
  VANILLA_SCREEN_HEIGHT_ABOVE_STATUS_BAR,
  VANILLA_SCREEN_WIDTH,
  VANILLA_STATUS_BAR_HEIGHT,
  isFullscreenScreenBlock,
  isValidScreenBlock,
  scaledViewWidthForScreenBlock,
  viewHeightForScreenBlock,
} from '../../../src/render/implement-screen-size-blocks.ts';

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

  test('screen and status-bar constants match vanilla doomdef.h / st_stuff.h', () => {
    expect(VANILLA_SCREEN_WIDTH).toBe(320);
    expect(VANILLA_SCREEN_HEIGHT).toBe(200);
    expect(VANILLA_STATUS_BAR_HEIGHT).toBe(32);
    expect(VANILLA_SCREEN_HEIGHT_ABOVE_STATUS_BAR).toBe(168);
    expect(VANILLA_SCREEN_HEIGHT - VANILLA_STATUS_BAR_HEIGHT).toBe(VANILLA_SCREEN_HEIGHT_ABOVE_STATUS_BAR);
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

describe('viewport derivation matches R_ExecuteSetViewSize', () => {
  test('scaledviewwidth = setblocks * 32 for blocks 3..10', () => {
    expect(scaledViewWidthForScreenBlock(3)).toBe(96);
    expect(scaledViewWidthForScreenBlock(4)).toBe(128);
    expect(scaledViewWidthForScreenBlock(5)).toBe(160);
    expect(scaledViewWidthForScreenBlock(6)).toBe(192);
    expect(scaledViewWidthForScreenBlock(7)).toBe(224);
    expect(scaledViewWidthForScreenBlock(8)).toBe(256);
    expect(scaledViewWidthForScreenBlock(9)).toBe(288);
    expect(scaledViewWidthForScreenBlock(10)).toBe(320);
  });

  test('scaledviewwidth = SCREENWIDTH for block 11', () => {
    expect(scaledViewWidthForScreenBlock(11)).toBe(320);
    expect(scaledViewWidthForScreenBlock(11)).toBe(VANILLA_SCREEN_WIDTH);
  });

  test('viewheight = (setblocks * 168 / 10) & ~7 for blocks 3..10', () => {
    expect(viewHeightForScreenBlock(3)).toBe(48); // 3*168/10 = 50.4 → 50 → 50 & ~7 = 48
    expect(viewHeightForScreenBlock(4)).toBe(64); // 4*168/10 = 67.2 → 67 → 67 & ~7 = 64
    expect(viewHeightForScreenBlock(5)).toBe(80); // 5*168/10 = 84 → 84 & ~7 = 80
    expect(viewHeightForScreenBlock(6)).toBe(96); // 6*168/10 = 100.8 → 100 → 100 & ~7 = 96
    expect(viewHeightForScreenBlock(7)).toBe(112); // 7*168/10 = 117.6 → 117 → 117 & ~7 = 112
    expect(viewHeightForScreenBlock(8)).toBe(128); // 8*168/10 = 134.4 → 134 → 134 & ~7 = 128
    expect(viewHeightForScreenBlock(9)).toBe(144); // 9*168/10 = 151.2 → 151 → 151 & ~7 = 144
    expect(viewHeightForScreenBlock(10)).toBe(168); // 10*168/10 = 168 → 168 & ~7 = 168
  });

  test('viewheight = SCREENHEIGHT for block 11', () => {
    expect(viewHeightForScreenBlock(11)).toBe(200);
    expect(viewHeightForScreenBlock(11)).toBe(VANILLA_SCREEN_HEIGHT);
  });
});
