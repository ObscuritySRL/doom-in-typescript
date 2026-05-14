import { describe, expect, test } from 'bun:test';

import {
  VANILLA_AM_BACKGROUND,
  VANILLA_AM_CDWALLCOLORS,
  VANILLA_AM_FDWALLCOLORS,
  VANILLA_AM_GRIDCOLORS,
  VANILLA_AM_SECRETWALLCOLORS,
  VANILLA_AM_THINGCOLORS,
  VANILLA_AM_TSWALLCOLORS,
  VANILLA_AM_WALLCOLORS,
  VANILLA_AM_XHAIRCOLORS,
  VANILLA_AM_PALETTE,
} from '../../../src/ui/implement-automap-line-and-thing-colors.ts';

describe('vanilla automap palette indices', () => {
  test('canonical color palette indices from am_map.c', () => {
    expect(VANILLA_AM_BACKGROUND).toBe(0);
    expect(VANILLA_AM_WALLCOLORS).toBe(23);
    expect(VANILLA_AM_TSWALLCOLORS).toBe(96);
    expect(VANILLA_AM_FDWALLCOLORS).toBe(75);
    expect(VANILLA_AM_CDWALLCOLORS).toBe(76);
    expect(VANILLA_AM_THINGCOLORS).toBe(112);
    expect(VANILLA_AM_SECRETWALLCOLORS).toBe(252);
    expect(VANILLA_AM_GRIDCOLORS).toBe(104);
    expect(VANILLA_AM_XHAIRCOLORS).toBe(4);
  });

  test('VANILLA_AM_PALETTE collects all palette indices into a frozen lookup', () => {
    expect(Object.isFrozen(VANILLA_AM_PALETTE)).toBe(true);
    expect(VANILLA_AM_PALETTE.background).toBe(0);
    expect(VANILLA_AM_PALETTE.wall).toBe(23);
    expect(VANILLA_AM_PALETTE.twoSidedWall).toBe(96);
    expect(VANILLA_AM_PALETTE.floorDiffWall).toBe(75);
    expect(VANILLA_AM_PALETTE.ceilingDiffWall).toBe(76);
    expect(VANILLA_AM_PALETTE.thing).toBe(112);
    expect(VANILLA_AM_PALETTE.secretWall).toBe(252);
    expect(VANILLA_AM_PALETTE.grid).toBe(104);
    expect(VANILLA_AM_PALETTE.crosshair).toBe(4);
  });
});
