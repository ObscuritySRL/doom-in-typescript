import { describe, expect, test } from 'bun:test';

import { FRACBITS } from '../../../src/core/fixed.ts';
import { VANILLA_SCREEN_HEIGHT, VANILLA_SCREEN_WIDTH, VANILLA_STATUS_BAR_HEIGHT, VANILLA_VIEW_AREA_HEIGHT, executeVanillaSetViewSize } from '../../../src/render/implement-view-setup-constants.ts';

describe('view setup constants', () => {
  test('SCREENWIDTH = 320, SCREENHEIGHT = 200', () => {
    expect(VANILLA_SCREEN_WIDTH).toBe(320);
    expect(VANILLA_SCREEN_HEIGHT).toBe(200);
  });

  test('ST_HEIGHT = 32, view area = 168', () => {
    expect(VANILLA_STATUS_BAR_HEIGHT).toBe(32);
    expect(VANILLA_VIEW_AREA_HEIGHT).toBe(168);
  });
});

describe('executeVanillaSetViewSize — setblocks 11 (fullscreen)', () => {
  test('fullscreen uses SCREENWIDTH x SCREENHEIGHT and hides status bar', () => {
    const result = executeVanillaSetViewSize({ setblocks: 11, setdetail: 0 });
    expect(result.scaledviewwidth).toBe(320);
    expect(result.viewheight).toBe(200);
    expect(result.viewwidth).toBe(320);
    expect(result.centerx).toBe(160);
    expect(result.centery).toBe(100);
    expect(result.statusBarHidden).toBe(true);
  });
});

describe('executeVanillaSetViewSize — setblocks 10 (default)', () => {
  test('default screenblocks 10 yields 320x168 area (status bar visible)', () => {
    const result = executeVanillaSetViewSize({ setblocks: 10, setdetail: 0 });
    expect(result.scaledviewwidth).toBe(320);
    // viewheight = (10 * 168 / 10) & ~7 = 168 & ~7 = 168
    expect(result.viewheight).toBe(168);
    expect(result.viewwidth).toBe(320);
    expect(result.centerx).toBe(160);
    expect(result.centery).toBe(84);
    expect(result.statusBarHidden).toBe(false);
  });
});

describe('executeVanillaSetViewSize — small screenblocks', () => {
  test('setblocks 3 yields 96x48 view area', () => {
    const result = executeVanillaSetViewSize({ setblocks: 3, setdetail: 0 });
    expect(result.scaledviewwidth).toBe(96);
    // viewheight = (3 * 168 / 10) & ~7 = trunc(50.4) & ~7 = 50 & ~7 = 48
    expect(result.viewheight).toBe(48);
    expect(result.viewwidth).toBe(96);
    expect(result.centerx).toBe(48);
    expect(result.centery).toBe(24);
  });
});

describe('executeVanillaSetViewSize — low detail', () => {
  test('detailshift 1 halves viewwidth (pixels doubled)', () => {
    const result = executeVanillaSetViewSize({ setblocks: 10, setdetail: 1 });
    expect(result.scaledviewwidth).toBe(320);
    expect(result.viewwidth).toBe(160);
    expect(result.centerx).toBe(80);
    expect(result.detailshift).toBe(1);
  });
});

describe('executeVanillaSetViewSize — fixed-point computations', () => {
  test('centerxfrac = centerx << FRACBITS', () => {
    const result = executeVanillaSetViewSize({ setblocks: 10, setdetail: 0 });
    expect(result.centerxfrac).toBe(result.centerx << FRACBITS);
  });

  test('projection = centerxfrac', () => {
    const result = executeVanillaSetViewSize({ setblocks: 11, setdetail: 0 });
    expect(result.projection).toBe(result.centerxfrac);
  });
});

describe('result immutability', () => {
  test('result is frozen', () => {
    expect(Object.isFrozen(executeVanillaSetViewSize({ setblocks: 10, setdetail: 0 }))).toBe(true);
  });
});
