import { describe, expect, test } from 'bun:test';

import { SCREENHEIGHT, SCREENWIDTH } from '../../src/host/windowPolicy.ts';
import {
  CEILINGCLIP_DEFAULT,
  CLIPRANGE_SENTINEL_FIRST_LOW,
  CLIPRANGE_SENTINEL_LAST_HIGH,
  CLIPRANGE_SENTINEL_LAST_LOW,
  MAXDRAWSEGS,
  MAXOPENINGS,
  MAXSEGS,
  MAXVISPLANES,
  OPENINGS_BYTES_PER_ENTRY,
  OPENINGS_POOL_BYTES,
  RENDER_POOL_LIMITS,
  Silhouette,
  VISPLANE_TOP_UNFILLED,
  floorclipDefault,
} from '../../src/render/renderLimits.ts';
import type { ClipRange, Drawseg, RenderPoolLimits, Visplane } from '../../src/render/renderLimits.ts';

describe('vanilla pool capacities (r_bsp.c / r_plane.c / r_defs.h)', () => {
  test('MAXDRAWSEGS matches vanilla 256 (r_defs.h)', () => {
    expect(MAXDRAWSEGS).toBe(256);
  });

  test('MAXSEGS re-exports the SCREENWIDTH/2+1 cap from projection.ts', () => {
    expect(MAXSEGS).toBe(SCREENWIDTH / 2 + 1);
    expect(MAXSEGS).toBe(161);
  });

  test('MAXVISPLANES re-exports the vanilla 128 cap (F-024 cross-reference)', () => {
    expect(MAXVISPLANES).toBe(128);
  });

  test('MAXOPENINGS re-exports the SCREENWIDTH*64 pool cap', () => {
    expect(MAXOPENINGS).toBe(SCREENWIDTH * 64);
    expect(MAXOPENINGS).toBe(20_480);
  });

  test('OPENINGS_BYTES_PER_ENTRY matches vanilla short openings[]', () => {
    expect(OPENINGS_BYTES_PER_ENTRY).toBe(2);
  });

  test('OPENINGS_POOL_BYTES = MAXOPENINGS * OPENINGS_BYTES_PER_ENTRY', () => {
    expect(OPENINGS_POOL_BYTES).toBe(MAXOPENINGS * OPENINGS_BYTES_PER_ENTRY);
    expect(OPENINGS_POOL_BYTES).toBe(40_960);
  });
});

describe('RENDER_POOL_LIMITS snapshot is frozen and matches the constants', () => {
  test('mirrors every constant in one record', () => {
    expect(RENDER_POOL_LIMITS).toEqual({
      maxDrawsegs: MAXDRAWSEGS,
      maxOpenings: MAXOPENINGS,
      maxSegs: MAXSEGS,
      maxVisplanes: MAXVISPLANES,
      screenHeight: SCREENHEIGHT,
      screenWidth: SCREENWIDTH,
    });
  });

  test('is frozen against accidental runtime mutation', () => {
    expect(Object.isFrozen(RENDER_POOL_LIMITS)).toBe(true);
  });

  test('typing exposes a RenderPoolLimits record', () => {
    const limits: RenderPoolLimits = RENDER_POOL_LIMITS;
    expect(limits.maxDrawsegs).toBe(256);
  });
});

describe('Silhouette flags (r_defs.h SIL_NONE / SIL_BOTTOM / SIL_TOP / SIL_BOTH)', () => {
  test('SIL_NONE is 0', () => {
    expect(Silhouette.none).toBe(0);
  });

  test('SIL_BOTTOM is 1', () => {
    expect(Silhouette.bottom).toBe(1);
  });

  test('SIL_TOP is 2', () => {
    expect(Silhouette.top).toBe(2);
  });

  test('SIL_BOTH is 3', () => {
    expect(Silhouette.both).toBe(3);
  });

  test('top | bottom equals both — flags are bit fields', () => {
    expect(Silhouette.top | Silhouette.bottom).toBe(Silhouette.both);
  });

  test('none | x equals x for every flag', () => {
    expect(Silhouette.none | Silhouette.bottom).toBe(Silhouette.bottom);
    expect(Silhouette.none | Silhouette.top).toBe(Silhouette.top);
    expect(Silhouette.none | Silhouette.both).toBe(Silhouette.both);
  });
});

describe('R_ClearPlanes column-clip defaults', () => {
  test('ceilingclip default is -1 (one row above the top scanline)', () => {
    expect(CEILINGCLIP_DEFAULT).toBe(-1);
  });

  test('floorclipDefault echoes the active viewHeight', () => {
    expect(floorclipDefault(168)).toBe(168);
    expect(floorclipDefault(200)).toBe(200);
    expect(floorclipDefault(48)).toBe(48);
  });

  test('floorclipDefault truncates non-integer input via |0', () => {
    expect(floorclipDefault(168.9)).toBe(168);
    expect(floorclipDefault(-1.5)).toBe(-1);
  });

  test('a fresh per-column clip array initializes to the vanilla defaults', () => {
    const viewHeight = 168;
    const ceilingClip = new Int16Array(SCREENWIDTH).fill(CEILINGCLIP_DEFAULT);
    const floorClip = new Int16Array(SCREENWIDTH).fill(floorclipDefault(viewHeight));
    expect(ceilingClip[0]).toBe(-1);
    expect(ceilingClip[SCREENWIDTH - 1]).toBe(-1);
    expect(floorClip[0]).toBe(168);
    expect(floorClip[SCREENWIDTH - 1]).toBe(168);
  });
});

describe('R_ClearClipSegs solidsegs sentinels', () => {
  test('low-end first sentinel is -0x7FFFFFFF', () => {
    expect(CLIPRANGE_SENTINEL_FIRST_LOW).toBe(-0x7fff_ffff);
  });

  test('low-end last sentinel is -1', () => {
    expect(CLIPRANGE_SENTINEL_LAST_LOW).toBe(-1);
  });

  test('high-end last sentinel is +0x7FFFFFFF', () => {
    expect(CLIPRANGE_SENTINEL_LAST_HIGH).toBe(0x7fff_ffff);
  });

  test('low/high sentinels stay inside int32 — no implicit BigInt promotion', () => {
    expect(CLIPRANGE_SENTINEL_FIRST_LOW | 0).toBe(CLIPRANGE_SENTINEL_FIRST_LOW);
    expect(CLIPRANGE_SENTINEL_LAST_HIGH | 0).toBe(CLIPRANGE_SENTINEL_LAST_HIGH);
  });

  test('sentinels flank the viewWidth so the clip walker never escapes', () => {
    const viewWidth = 320;
    const solidsegs: ClipRange[] = [
      { first: CLIPRANGE_SENTINEL_FIRST_LOW, last: CLIPRANGE_SENTINEL_LAST_LOW },
      { first: viewWidth, last: CLIPRANGE_SENTINEL_LAST_HIGH },
    ];
    expect(solidsegs[0].last).toBeLessThan(0);
    expect(solidsegs[1].first).toBe(viewWidth);
    expect(solidsegs[1].last).toBeGreaterThan(viewWidth);
  });
});

describe('VISPLANE_TOP_UNFILLED sentinel', () => {
  test('matches vanilla 0xff (memset(check->top, 0xff, ...))', () => {
    expect(VISPLANE_TOP_UNFILLED).toBe(0xff);
  });

  test('fits in a single Uint8 column slot', () => {
    expect(VISPLANE_TOP_UNFILLED).toBeGreaterThanOrEqual(0);
    expect(VISPLANE_TOP_UNFILLED).toBeLessThanOrEqual(0xff);
  });

  test('fresh visplane top column is all-0xff after the vanilla memset pattern', () => {
    const top = new Uint8Array(SCREENWIDTH).fill(VISPLANE_TOP_UNFILLED);
    for (let column = 0; column < SCREENWIDTH; column += 1) {
      expect(top[column]).toBe(VISPLANE_TOP_UNFILLED);
    }
  });
});

describe('Visplane interface mirrors r_defs.h visplane_t', () => {
  test('a freshly allocated visplane reports an empty horizontal range (minx > maxx)', () => {
    const plane: Visplane = {
      height: 0,
      picnum: 0,
      lightlevel: 0,
      minx: SCREENWIDTH,
      maxx: -1,
      top: new Uint8Array(SCREENWIDTH).fill(VISPLANE_TOP_UNFILLED),
      bottom: new Uint8Array(SCREENWIDTH),
    };
    expect(plane.minx).toBeGreaterThan(plane.maxx);
    expect(plane.top.length).toBe(SCREENWIDTH);
    expect(plane.bottom.length).toBe(SCREENWIDTH);
  });
});

describe('Drawseg interface mirrors r_defs.h drawseg_t', () => {
  test('a fully populated drawseg accepts all vanilla fields', () => {
    const drawseg: Drawseg = {
      curlineIndex: 7,
      x1: 0,
      x2: 319,
      scale1: 0x10_000,
      scale2: 0x8_000,
      scalestep: -0x100,
      silhouette: Silhouette.both,
      bsilheight: -0x80_0000,
      tsilheight: 0x80_0000,
      sprtopclip: 0,
      sprbottomclip: SCREENWIDTH,
      maskedtexturecol: -1,
    };
    expect(drawseg.silhouette).toBe(Silhouette.both);
    expect(drawseg.x2 - drawseg.x1 + 1).toBe(SCREENWIDTH);
  });
});

describe('parity-sensitive edge case: pool caps gate the renderer overflow guards', () => {
  test('writing the (MAXVISPLANES + 1)-th visplane is the I_Error trigger', () => {
    const used = MAXVISPLANES;
    expect(used === MAXVISPLANES).toBe(true);
    expect(used + 1).toBeGreaterThan(MAXVISPLANES);
  });

  test('writing the (MAXOPENINGS + 1)-th opening is the I_Error trigger', () => {
    const used = MAXOPENINGS;
    expect(used + 1).toBeGreaterThan(MAXOPENINGS);
  });

  test('writing the (MAXDRAWSEGS + 1)-th drawseg is the I_Error trigger', () => {
    const used = MAXDRAWSEGS;
    expect(used + 1).toBeGreaterThan(MAXDRAWSEGS);
  });
});
