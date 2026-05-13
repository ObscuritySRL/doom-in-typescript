import { describe, expect, test } from 'bun:test';

import {
  VANILLA_DETAIL_DEFAULT,
  VANILLA_DETAIL_HIGH,
  VANILLA_DETAIL_LOW,
  VANILLA_GAMMA_DEFAULT,
  VANILLA_GAMMA_LEVELS,
  VANILLA_GAMMA_MAX,
  VANILLA_GAMMA_MIN,
  VANILLA_SCREENBLOCKS_DEFAULT,
  VANILLA_SCREENBLOCKS_MAX,
  VANILLA_SCREENBLOCKS_MIN,
  VANILLA_SCREENSIZE_DEFAULT,
  VANILLA_SCREENSIZE_MAX,
  VANILLA_SCREENSIZE_MIN,
  applyVanillaSizeDisplay,
  cycleVanillaGamma,
  toggleVanillaDetail,
} from '../../../src/ui/implement-screen-size-detail-gamma-menu.ts';

describe('screen size constants', () => {
  test('screenblocks range 3..11', () => {
    expect(VANILLA_SCREENBLOCKS_MIN).toBe(3);
    expect(VANILLA_SCREENBLOCKS_MAX).toBe(11);
  });

  test('screenSize range 0..8', () => {
    expect(VANILLA_SCREENSIZE_MIN).toBe(0);
    expect(VANILLA_SCREENSIZE_MAX).toBe(8);
  });

  test('defaults are screenblocks 10 / screenSize 7', () => {
    expect(VANILLA_SCREENBLOCKS_DEFAULT).toBe(10);
    expect(VANILLA_SCREENSIZE_DEFAULT).toBe(7);
  });
});

describe('detail constants', () => {
  test('high = 0, low = 1, default = high', () => {
    expect(VANILLA_DETAIL_HIGH).toBe(0);
    expect(VANILLA_DETAIL_LOW).toBe(1);
    expect(VANILLA_DETAIL_DEFAULT).toBe(0);
  });
});

describe('gamma constants', () => {
  test('5 levels with range 0..4 and default 0', () => {
    expect(VANILLA_GAMMA_LEVELS).toBe(5);
    expect(VANILLA_GAMMA_MIN).toBe(0);
    expect(VANILLA_GAMMA_MAX).toBe(4);
    expect(VANILLA_GAMMA_DEFAULT).toBe(0);
  });
});

describe('applyVanillaSizeDisplay — left arrow', () => {
  test('decrements screen size and screenblocks together when above min', () => {
    const result = applyVanillaSizeDisplay({ currentScreenSize: 7, currentScreenblocks: 10, arrowDirection: 'left' });
    expect(result.screenSizeAfter).toBe(6);
    expect(result.screenblocksAfter).toBe(9);
    expect(result.viewSizeChanged).toBe(true);
  });

  test('does not decrement at screenSize 0 (min)', () => {
    const result = applyVanillaSizeDisplay({ currentScreenSize: 0, currentScreenblocks: 3, arrowDirection: 'left' });
    expect(result.screenSizeAfter).toBe(0);
    expect(result.screenblocksAfter).toBe(3);
    expect(result.viewSizeChanged).toBe(false);
  });
});

describe('applyVanillaSizeDisplay — right arrow', () => {
  test('increments screen size and screenblocks together when below max', () => {
    const result = applyVanillaSizeDisplay({ currentScreenSize: 5, currentScreenblocks: 8, arrowDirection: 'right' });
    expect(result.screenSizeAfter).toBe(6);
    expect(result.screenblocksAfter).toBe(9);
    expect(result.viewSizeChanged).toBe(true);
  });

  test('does not increment at screenSize 8 (max)', () => {
    const result = applyVanillaSizeDisplay({ currentScreenSize: 8, currentScreenblocks: 11, arrowDirection: 'right' });
    expect(result.screenSizeAfter).toBe(8);
    expect(result.screenblocksAfter).toBe(11);
    expect(result.viewSizeChanged).toBe(false);
  });
});

describe('toggleVanillaDetail', () => {
  test('toggles 0 <-> 1', () => {
    expect(toggleVanillaDetail(0)).toBe(1);
    expect(toggleVanillaDetail(1)).toBe(0);
  });
});

describe('cycleVanillaGamma', () => {
  test('cycles 0->1->2->3->4->0', () => {
    expect(cycleVanillaGamma(0)).toBe(1);
    expect(cycleVanillaGamma(1)).toBe(2);
    expect(cycleVanillaGamma(2)).toBe(3);
    expect(cycleVanillaGamma(3)).toBe(4);
    expect(cycleVanillaGamma(4)).toBe(0);
  });
});
