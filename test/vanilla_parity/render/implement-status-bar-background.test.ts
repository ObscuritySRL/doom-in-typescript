import { describe, expect, test } from 'bun:test';

import {
  VANILLA_STARMS_PATCH_NAME,
  VANILLA_STARMS_X,
  VANILLA_STARMS_Y,
  VANILLA_STATUS_BAR_HEIGHT,
  VANILLA_STATUS_BAR_WIDTH,
  VANILLA_STATUS_BAR_X,
  VANILLA_STATUS_BAR_Y,
  VANILLA_STBAR_PATCH_NAME,
  buildStatusBarBackgroundDraws,
} from '../../../src/ui/implement-status-bar-background.ts';

describe('vanilla status bar background constants', () => {
  test('strip is 320x32 anchored at (0, 168)', () => {
    expect(VANILLA_STATUS_BAR_WIDTH).toBe(320);
    expect(VANILLA_STATUS_BAR_HEIGHT).toBe(32);
    expect(VANILLA_STATUS_BAR_X).toBe(0);
    expect(VANILLA_STATUS_BAR_Y).toBe(168);
    expect(VANILLA_STATUS_BAR_Y + VANILLA_STATUS_BAR_HEIGHT).toBe(200);
  });

  test('STARMS overlay at (104, 168)', () => {
    expect(VANILLA_STARMS_X).toBe(104);
    expect(VANILLA_STARMS_Y).toBe(168);
  });

  test('patch names match st_stuff.c', () => {
    expect(VANILLA_STBAR_PATCH_NAME).toBe('STBAR');
    expect(VANILLA_STARMS_PATCH_NAME).toBe('STARMS');
  });
});

describe('buildStatusBarBackgroundDraws', () => {
  test('single player arms visible draws STBAR then STARMS overlay', () => {
    const draws = buildStatusBarBackgroundDraws(true);
    expect(draws.map((d) => d.patch)).toEqual(['STBAR', 'STARMS']);
    expect(draws[0]).toEqual({ patch: 'STBAR', x: 0, y: 168 });
    expect(draws[1]).toEqual({ patch: 'STARMS', x: 104, y: 168 });
  });

  test('arms-hidden mode (frag overlay) omits STARMS overlay', () => {
    const draws = buildStatusBarBackgroundDraws(false);
    expect(draws.map((d) => d.patch)).toEqual(['STBAR']);
  });
});
