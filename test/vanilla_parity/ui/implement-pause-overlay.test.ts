import { describe, expect, test } from 'bun:test';

import { VANILLA_PAUSE_LUMP_NAME, VANILLA_PAUSE_OVERLAY_Y, VANILLA_SCREEN_WIDTH, resolveVanillaPauseOverlay } from '../../../src/ui/implement-pause-overlay.ts';

describe('pause overlay constants', () => {
  test('lump name is M_PAUSE', () => {
    expect(VANILLA_PAUSE_LUMP_NAME).toBe('M_PAUSE');
  });

  test('overlay y position is fixed at 4', () => {
    expect(VANILLA_PAUSE_OVERLAY_Y).toBe(4);
  });

  test('SCREENWIDTH is 320', () => {
    expect(VANILLA_SCREEN_WIDTH).toBe(320);
  });
});

describe('resolveVanillaPauseOverlay — draw gating', () => {
  test('does not draw when not paused', () => {
    expect(resolveVanillaPauseOverlay({ paused: false, gamestate: 'GS_LEVEL', patchWidth: 100 }).shouldDraw).toBe(false);
  });

  test('does not draw when paused but not at GS_LEVEL', () => {
    expect(resolveVanillaPauseOverlay({ paused: true, gamestate: 'GS_INTERMISSION', patchWidth: 100 }).shouldDraw).toBe(false);
    expect(resolveVanillaPauseOverlay({ paused: true, gamestate: 'GS_FINALE', patchWidth: 100 }).shouldDraw).toBe(false);
    expect(resolveVanillaPauseOverlay({ paused: true, gamestate: 'GS_TITLESCREEN', patchWidth: 100 }).shouldDraw).toBe(false);
  });

  test('draws when paused and at GS_LEVEL', () => {
    expect(resolveVanillaPauseOverlay({ paused: true, gamestate: 'GS_LEVEL', patchWidth: 100 }).shouldDraw).toBe(true);
  });
});

describe('resolveVanillaPauseOverlay — positioning', () => {
  test('x is centered: (320 - width) / 2', () => {
    expect(resolveVanillaPauseOverlay({ paused: true, gamestate: 'GS_LEVEL', patchWidth: 100 }).x).toBe(110);
    expect(resolveVanillaPauseOverlay({ paused: true, gamestate: 'GS_LEVEL', patchWidth: 60 }).x).toBe(130);
  });

  test('y is always 4', () => {
    expect(resolveVanillaPauseOverlay({ paused: true, gamestate: 'GS_LEVEL', patchWidth: 100 }).y).toBe(4);
  });

  test('lump name is M_PAUSE regardless of state', () => {
    expect(resolveVanillaPauseOverlay({ paused: false, gamestate: 'GS_LEVEL', patchWidth: 0 }).lumpName).toBe('M_PAUSE');
    expect(resolveVanillaPauseOverlay({ paused: true, gamestate: 'GS_LEVEL', patchWidth: 100 }).lumpName).toBe('M_PAUSE');
  });

  test('result is frozen', () => {
    expect(Object.isFrozen(resolveVanillaPauseOverlay({ paused: true, gamestate: 'GS_LEVEL', patchWidth: 100 }))).toBe(true);
  });
});
