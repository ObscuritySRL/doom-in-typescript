import { describe, expect, test } from 'bun:test';

import { FRACBITS } from '../../src/core/fixed.ts';
import { SCREENHEIGHT, SCREENWIDTH } from '../../src/host/windowPolicy.ts';
import {
  DetailMode,
  FIELDOFVIEW,
  LIGHTLEVELS,
  LIGHTSCALESHIFT,
  LIGHTSEGSHIFT,
  LIGHTZSHIFT,
  MAXLIGHTSCALE,
  MAXLIGHTZ,
  MAXOPENINGS,
  MAX_SETBLOCKS,
  MAXSEGS,
  MAXVISPLANES,
  MIN_SETBLOCKS,
  NUMCOLORMAPS,
  SBARHEIGHT,
  computeViewport,
} from '../../src/render/projection.ts';
import type { Viewport } from '../../src/render/projection.ts';

describe('field-of-view and status-bar constants', () => {
  test('FIELDOFVIEW is vanilla 2048', () => {
    expect(FIELDOFVIEW).toBe(2048);
  });

  test('FIELDOFVIEW covers one quadrant of the 4096-entry finetangent table', () => {
    expect(FIELDOFVIEW * 2).toBe(4096);
  });

  test('SBARHEIGHT matches st_stuff.h ST_HEIGHT', () => {
    expect(SBARHEIGHT).toBe(32);
  });

  test('SBARHEIGHT leaves room for the setblocks=10 view window', () => {
    expect(SCREENHEIGHT - SBARHEIGHT).toBe(168);
  });
});

describe('lighting constants (r_main.h)', () => {
  test('LIGHTLEVELS is 16 buckets', () => {
    expect(LIGHTLEVELS).toBe(16);
  });

  test('LIGHTSEGSHIFT right-shifts lightlevel (0..255) to bucket index (0..15)', () => {
    expect(LIGHTSEGSHIFT).toBe(4);
    expect(255 >> LIGHTSEGSHIFT).toBe(15);
    expect(0 >> LIGHTSEGSHIFT).toBe(0);
  });

  test('LIGHTSCALESHIFT is 12', () => {
    expect(LIGHTSCALESHIFT).toBe(12);
  });

  test('MAXLIGHTSCALE is 48', () => {
    expect(MAXLIGHTSCALE).toBe(48);
  });

  test('LIGHTZSHIFT is 20', () => {
    expect(LIGHTZSHIFT).toBe(20);
  });

  test('MAXLIGHTZ is 128', () => {
    expect(MAXLIGHTZ).toBe(128);
  });

  test('NUMCOLORMAPS matches the 32 colormap ramps packed into COLORMAP', () => {
    expect(NUMCOLORMAPS).toBe(32);
  });
});

describe('renderer-limit constants (r_bsp.c / r_plane.c)', () => {
  test('MAXSEGS is SCREENWIDTH / 2 + 1', () => {
    expect(MAXSEGS).toBe(SCREENWIDTH / 2 + 1);
    expect(MAXSEGS).toBe(161);
  });

  test('MAXVISPLANES matches vanilla 128 (F-024 cross-reference)', () => {
    expect(MAXVISPLANES).toBe(128);
  });

  test('MAXOPENINGS is SCREENWIDTH * 64', () => {
    expect(MAXOPENINGS).toBe(SCREENWIDTH * 64);
    expect(MAXOPENINGS).toBe(20_480);
  });
});

describe('setblocks range', () => {
  test('MIN_SETBLOCKS is 3', () => {
    expect(MIN_SETBLOCKS).toBe(3);
  });

  test('MAX_SETBLOCKS is 11', () => {
    expect(MAX_SETBLOCKS).toBe(11);
  });
});

describe('DetailMode enum', () => {
  test('high detail is 0 (no shift)', () => {
    expect(DetailMode.high).toBe(0);
  });

  test('low detail is 1 (halves horizontal sampling)', () => {
    expect(DetailMode.low).toBe(1);
  });
});

describe('computeViewport at setBlocks=11 (full screen)', () => {
  const view: Viewport = computeViewport(11, DetailMode.high);

  test('scaledViewWidth is SCREENWIDTH (320)', () => {
    expect(view.scaledViewWidth).toBe(SCREENWIDTH);
  });

  test('viewHeight is SCREENHEIGHT (200) — no status bar', () => {
    expect(view.viewHeight).toBe(SCREENHEIGHT);
  });

  test('viewWidth matches scaledViewWidth at high detail', () => {
    expect(view.viewWidth).toBe(view.scaledViewWidth);
  });

  test('centerX is 160 and centerY is 100', () => {
    expect(view.centerX).toBe(160);
    expect(view.centerY).toBe(100);
  });

  test('centerXFrac and centerYFrac are centerX/Y shifted by FRACBITS', () => {
    expect(view.centerXFrac).toBe(view.centerX << FRACBITS);
    expect(view.centerYFrac).toBe(view.centerY << FRACBITS);
  });

  test('projection equals centerXFrac', () => {
    expect(view.projection).toBe(view.centerXFrac);
  });

  test('viewWindowX and viewWindowY are zero (full-screen gate)', () => {
    expect(view.viewWindowX).toBe(0);
    expect(view.viewWindowY).toBe(0);
  });

  test('detailShift echoes the input', () => {
    expect(view.detailShift).toBe(DetailMode.high);
  });
});

describe('computeViewport at setBlocks=10 (full-width minus status bar)', () => {
  const view: Viewport = computeViewport(10, DetailMode.high);

  test('scaledViewWidth is SCREENWIDTH — the full-width gate pins viewWindowY to 0', () => {
    expect(view.scaledViewWidth).toBe(SCREENWIDTH);
    expect(view.viewWindowY).toBe(0);
  });

  test('viewHeight is 168 (SCREENHEIGHT - SBARHEIGHT)', () => {
    expect(view.viewHeight).toBe(168);
    expect(view.viewHeight).toBe(SCREENHEIGHT - SBARHEIGHT);
  });

  test('centerX is 160 and centerY is 84', () => {
    expect(view.centerX).toBe(160);
    expect(view.centerY).toBe(84);
  });
});

describe('computeViewport at setBlocks=9 (letterboxed)', () => {
  const view: Viewport = computeViewport(9, DetailMode.high);

  test('scaledViewWidth is 288 (9 * 32)', () => {
    expect(view.scaledViewWidth).toBe(288);
  });

  test('viewHeight is 144 ((9*168/10) & ~7)', () => {
    expect(view.viewHeight).toBe(144);
  });

  test('centerX is 144 and centerY is 72', () => {
    expect(view.centerX).toBe(144);
    expect(view.centerY).toBe(72);
  });

  test('viewWindowX is 16 ((320-288)/2)', () => {
    expect(view.viewWindowX).toBe(16);
  });

  test('viewWindowY is 12 ((200-32-144)/2)', () => {
    expect(view.viewWindowY).toBe(12);
  });
});

describe('computeViewport at setBlocks=3 (smallest window)', () => {
  const view: Viewport = computeViewport(3, DetailMode.high);

  test('scaledViewWidth is 96 (3 * 32)', () => {
    expect(view.scaledViewWidth).toBe(96);
  });

  test('viewHeight is 48 ((3*168/10) & ~7)', () => {
    expect(view.viewHeight).toBe(48);
  });

  test('viewWindowX is 112 and viewWindowY is 60', () => {
    expect(view.viewWindowX).toBe(112);
    expect(view.viewWindowY).toBe(60);
  });
});

describe('computeViewport sweep across setblocks 3..11 (vanilla pins)', () => {
  const cases: ReadonlyArray<readonly [number, number, number]> = [
    [3, 96, 48],
    [4, 128, 64],
    [5, 160, 80],
    [6, 192, 96],
    [7, 224, 112],
    [8, 256, 128],
    [9, 288, 144],
    [10, 320, 168],
    [11, 320, 200],
  ];

  for (const [setBlocks, expectedWidth, expectedHeight] of cases) {
    test(`setblocks=${setBlocks} → ${expectedWidth}x${expectedHeight}`, () => {
      const view = computeViewport(setBlocks, DetailMode.high);
      expect(view.scaledViewWidth).toBe(expectedWidth);
      expect(view.viewHeight).toBe(expectedHeight);
    });
  }
});

describe('computeViewport detail-shift halves horizontal sampling', () => {
  test('low detail halves viewWidth but leaves scaledViewWidth untouched', () => {
    const high = computeViewport(11, DetailMode.high);
    const low = computeViewport(11, DetailMode.low);
    expect(low.scaledViewWidth).toBe(high.scaledViewWidth);
    expect(low.viewWidth).toBe(high.viewWidth >> 1);
  });

  test('low detail halves centerX and centerXFrac', () => {
    const low = computeViewport(11, DetailMode.low);
    expect(low.centerX).toBe(80);
    expect(low.centerXFrac).toBe(80 << FRACBITS);
    expect(low.projection).toBe(low.centerXFrac);
  });

  test('detail shift does not change viewHeight or centerY', () => {
    const high = computeViewport(11, DetailMode.high);
    const low = computeViewport(11, DetailMode.low);
    expect(low.viewHeight).toBe(high.viewHeight);
    expect(low.centerY).toBe(high.centerY);
    expect(low.centerYFrac).toBe(high.centerYFrac);
  });

  test('non-zero detailShift resolves to low detail (vanilla treats bit-0 as the toggle)', () => {
    const view = computeViewport(11, 3 as DetailMode);
    expect(view.detailShift).toBe(DetailMode.low);
    expect(view.viewWidth).toBe(160);
  });
});

describe('computeViewport clamps setBlocks to [MIN_SETBLOCKS, MAX_SETBLOCKS]', () => {
  test('setBlocks below MIN clamps to 3', () => {
    const a = computeViewport(0, DetailMode.high);
    const b = computeViewport(MIN_SETBLOCKS, DetailMode.high);
    expect(a).toEqual(b);
  });

  test('setBlocks above MAX clamps to 11', () => {
    const a = computeViewport(99, DetailMode.high);
    const b = computeViewport(MAX_SETBLOCKS, DetailMode.high);
    expect(a).toEqual(b);
  });
});

describe('computeViewport parity-sensitive edge case: scaledViewWidth gates viewWindowY', () => {
  test('setblocks 10 pins viewWindowY=0 even though viewHeight is not full screen', () => {
    const view = computeViewport(10, DetailMode.high);
    expect(view.scaledViewWidth).toBe(SCREENWIDTH);
    expect(view.viewHeight).toBeLessThan(SCREENHEIGHT);
    expect(view.viewWindowY).toBe(0);
  });

  test('setblocks 9 triggers the (SCREENHEIGHT - SBARHEIGHT - viewHeight) >> 1 branch', () => {
    const view = computeViewport(9, DetailMode.high);
    expect(view.scaledViewWidth).toBeLessThan(SCREENWIDTH);
    expect(view.viewWindowY).toBe((SCREENHEIGHT - SBARHEIGHT - view.viewHeight) >> 1);
  });
});
