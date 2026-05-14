import { describe, expect, test } from 'bun:test';

import { VANILLA_AM_F_PANINC, VANILLA_AM_FOLLOW_DEFAULT, VANILLA_AM_GRID_DEFAULT, VANILLA_AM_GRID_MAPBLOCKSIZE, VANILLA_AM_M_ZOOMIN_FIXED, VANILLA_AM_M_ZOOMOUT_FIXED } from '../../../src/render/implement-automap-pan-zoom-follow-grid.ts';

describe('vanilla automap pan/zoom/follow/grid constants', () => {
  test('F_PANINC = 8 screen units', () => {
    expect(VANILLA_AM_F_PANINC).toBe(8);
  });

  test('zoom in/out multipliers', () => {
    expect(VANILLA_AM_M_ZOOMIN_FIXED).toBe(0x10570);
    expect(VANILLA_AM_M_ZOOMOUT_FIXED).toBe(0xfb00);
  });

  test('grid uses MAPBLOCKSIZE = 128 fixed', () => {
    expect(VANILLA_AM_GRID_MAPBLOCKSIZE).toBe(128);
  });

  test('follow default ON, grid default OFF', () => {
    expect(VANILLA_AM_FOLLOW_DEFAULT).toBe(true);
    expect(VANILLA_AM_GRID_DEFAULT).toBe(false);
  });
});
