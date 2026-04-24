import { describe, expect, test } from 'bun:test';

import { FRACBITS, FRACUNIT } from '../../src/core/fixed.ts';
import { SCREENHEIGHT, SCREENWIDTH } from '../../src/render/projection.ts';
import { VISPLANE_TOP_UNFILLED } from '../../src/render/renderLimits.ts';
import type { Visplane } from '../../src/render/renderLimits.ts';
import { ANGLETOSKYSHIFT, SKY_COLORMAP_INDEX, SKY_FLAT_NAME, SKY_TEXTURE_MID, computePspriteIscale, computeSkyColumnAngle, computeSkyIscale, isSkyVisplane, renderSkyVisplane, shouldCollapseSkyUpper } from '../../src/render/sky.ts';
import type { SkyRenderContext } from '../../src/render/sky.ts';
import type { PreparedWallTexture } from '../../src/render/wallColumns.ts';

const IDENTITY_COLORMAP = Uint8Array.from({ length: 256 }, (_, i) => i);

function makeVisplane(overrides: Partial<Pick<Visplane, 'picnum' | 'minx' | 'maxx'>> = {}, screenWidth = SCREENWIDTH): Visplane {
  return {
    height: 0,
    picnum: overrides.picnum ?? 0,
    lightlevel: 0,
    minx: overrides.minx ?? 0,
    maxx: overrides.maxx ?? screenWidth - 1,
    top: new Uint8Array(screenWidth).fill(VISPLANE_TOP_UNFILLED),
    bottom: new Uint8Array(screenWidth),
  };
}

function makeSkyTexture(width: number, height: number, fillByColumn: (col: number, row: number) => number): PreparedWallTexture {
  // Construct a synthetic prepared wall texture whose columns[c][r] is
  // deterministic. widthMask follows the vanilla largest-power-of-2-<=-width
  // rule; since DOOM sky lumps are 256 wide we exercise mostly power-of-2
  // widths here.
  let widthMask = 0;
  if (width > 0) {
    let j = 1;
    while (j * 2 <= width) {
      j <<= 1;
    }
    widthMask = j - 1;
  }
  const composite = new Uint8Array(width * height);
  const columns: Uint8Array[] = new Array(width);
  for (let c = 0; c < width; c += 1) {
    const offset = c * height;
    for (let r = 0; r < height; r += 1) {
      composite[offset + r] = fillByColumn(c, r) & 0xff;
    }
    columns[c] = composite.subarray(offset, offset + height);
  }
  return Object.freeze({
    name: `SKY${width}`,
    width,
    height,
    widthMask,
    composite,
    columns: Object.freeze(columns),
  }) as PreparedWallTexture;
}

function makeSkyContext(overrides: Partial<SkyRenderContext> = {}): SkyRenderContext {
  const screenWidth = overrides.screenWidth ?? SCREENWIDTH;
  return {
    skyTexture: overrides.skyTexture ?? makeSkyTexture(4, SCREENHEIGHT, (c, r) => (c << 4) | (r & 0x0f)),
    viewAngle: overrides.viewAngle ?? 0,
    xToViewAngle: overrides.xToViewAngle ?? new Int32Array(screenWidth),
    baseColormap: overrides.baseColormap ?? IDENTITY_COLORMAP,
    iscale: overrides.iscale ?? FRACUNIT,
    textureMid: overrides.textureMid ?? SKY_TEXTURE_MID,
    centerY: overrides.centerY ?? SCREENHEIGHT / 2,
    framebuffer: overrides.framebuffer ?? new Uint8Array(screenWidth * SCREENHEIGHT),
    screenWidth,
  };
}

describe('sky constants', () => {
  test('SKY_FLAT_NAME is "F_SKY1" (r_sky.h SKYFLATNAME)', () => {
    expect(SKY_FLAT_NAME).toBe('F_SKY1');
  });

  test('ANGLETOSKYSHIFT is 22 (r_sky.h)', () => {
    expect(ANGLETOSKYSHIFT).toBe(22);
  });

  test('SKY_TEXTURE_MID is SCREENHEIGHT/2 * FRACUNIT (r_sky.c R_InitSkyMap)', () => {
    expect(SKY_TEXTURE_MID).toBe((SCREENHEIGHT / 2) * FRACUNIT);
    expect(SKY_TEXTURE_MID).toBe(100 << FRACBITS);
    expect(SKY_TEXTURE_MID).toBe(0x0064_0000);
  });

  test('SKY_COLORMAP_INDEX is 0 (r_plane.c dc_colormap = colormaps)', () => {
    expect(SKY_COLORMAP_INDEX).toBe(0);
  });
});

describe('computePspriteIscale', () => {
  test('returns FRACUNIT at viewWidth=SCREENWIDTH (setblocks=11 high detail)', () => {
    expect(computePspriteIscale(SCREENWIDTH)).toBe(FRACUNIT);
  });

  test('doubles at viewWidth=SCREENWIDTH/2 (low-detail full screen)', () => {
    expect(computePspriteIscale(SCREENWIDTH / 2)).toBe(FRACUNIT * 2);
  });

  test('matches vanilla formula FRACUNIT*SCREENWIDTH/viewWidth for setblocks=9 (288 wide)', () => {
    expect(computePspriteIscale(288)).toBe(((FRACUNIT * SCREENWIDTH) / 288) | 0);
  });

  test('rejects non-positive viewWidth with RangeError (C divide-by-zero guard)', () => {
    expect(() => computePspriteIscale(0)).toThrow(RangeError);
    expect(() => computePspriteIscale(-1)).toThrow(RangeError);
  });
});

describe('computeSkyIscale', () => {
  test('detailShift=0 returns pspriteIscale unchanged', () => {
    expect(computeSkyIscale(FRACUNIT, 0)).toBe(FRACUNIT);
    expect(computeSkyIscale(0x1_2345, 0)).toBe(0x1_2345);
  });

  test('detailShift=1 halves pspriteIscale (low-detail normalization)', () => {
    expect(computeSkyIscale(FRACUNIT * 2, 1)).toBe(FRACUNIT);
    expect(computeSkyIscale(0x20_000, 1)).toBe(0x10_000);
  });

  test('net iscale for setblocks=11 is FRACUNIT in both detail modes', () => {
    const highIscale = computeSkyIscale(computePspriteIscale(SCREENWIDTH), 0);
    const lowIscale = computeSkyIscale(computePspriteIscale(SCREENWIDTH / 2), 1);
    expect(highIscale).toBe(FRACUNIT);
    expect(lowIscale).toBe(FRACUNIT);
  });
});

describe('computeSkyColumnAngle', () => {
  test('returns 0 for viewAngle=0, xToViewAngle=0', () => {
    expect(computeSkyColumnAngle(0, 0)).toBe(0);
  });

  test('shifts 22 bits right (ANGLETOSKYSHIFT) to produce 10-bit index', () => {
    expect(computeSkyColumnAngle(1 << 22, 0)).toBe(1);
    expect(computeSkyColumnAngle(0x3ff << 22, 0)).toBe(0x3ff);
  });

  test('uses unsigned shift so negative/high-bit angles wrap to [0,1024)', () => {
    // 0xFFFFFFFF is the largest angle_t; >>> 22 = 0x3FF (1023), not -1.
    expect(computeSkyColumnAngle(0xffff_ffff | 0, 0)).toBe(0x3ff);
    expect(computeSkyColumnAngle(0x8000_0000 | 0, 0)).toBe(0x200);
  });

  test('adds viewAngle and xToViewAngle with 32-bit wrap (angle_t overflow)', () => {
    // 0x80000000 + 0x80000000 = 0x100000000 → wraps to 0 in 32-bit unsigned.
    const sum = ((0x8000_0000 | 0) + (0x8000_0000 | 0)) | 0;
    expect(sum).toBe(0);
    expect(computeSkyColumnAngle(0x8000_0000 | 0, 0x8000_0000 | 0)).toBe(0);
  });
});

describe('isSkyVisplane', () => {
  test('true when picnum matches skyFlatNum', () => {
    const plane = makeVisplane({ picnum: 177 });
    expect(isSkyVisplane(plane, 177)).toBe(true);
  });

  test('false when picnum does not match', () => {
    const plane = makeVisplane({ picnum: 12 });
    expect(isSkyVisplane(plane, 177)).toBe(false);
  });
});

describe('shouldCollapseSkyUpper', () => {
  test('true when both sectors have sky ceiling (r_segs.c outdoor hack)', () => {
    expect(shouldCollapseSkyUpper(177, 177, 177)).toBe(true);
  });

  test('false when only front ceiling is sky', () => {
    expect(shouldCollapseSkyUpper(177, 12, 177)).toBe(false);
  });

  test('false when only back ceiling is sky', () => {
    expect(shouldCollapseSkyUpper(12, 177, 177)).toBe(false);
  });

  test('false when neither ceiling is sky', () => {
    expect(shouldCollapseSkyUpper(12, 34, 177)).toBe(false);
  });
});

describe('renderSkyVisplane — normal path', () => {
  test('draws each column in [minx, maxx] at top..bottom rows', () => {
    const screenWidth = 32;
    const viewHeight = 16;
    const plane = makeVisplane({ minx: 4, maxx: 7 }, screenWidth);
    for (let x = plane.minx; x <= plane.maxx; x += 1) {
      plane.top[x] = 2;
      plane.bottom[x] = 5;
    }
    const skyTexture = makeSkyTexture(4, 128, (c, r) => (c << 4) | (r & 0x0f));
    const framebuffer = new Uint8Array(screenWidth * viewHeight);
    const ctx = makeSkyContext({
      skyTexture,
      centerY: 4,
      iscale: FRACUNIT,
      textureMid: 0,
      framebuffer,
      xToViewAngle: new Int32Array(screenWidth),
      screenWidth,
    });

    renderSkyVisplane(plane, ctx);

    // viewAngle=0, xToViewAngle=0 → angle index 0 → column 0 of sky.
    // textureMid=0, centerY=4 → frac starts at (2-4)*FRACUNIT = -2<<16.
    // Row writes: columns 4..7 pick up sky column 0 bytes rows (-2,-1,0,1).
    // rDrawColumn masks row index with 127 (COLUMN_HEIGHT_MASK); sky column 0
    // bytes are (c=0) [0x00..0x0F] so row 0→0x00, row 1→0x01; negative rows
    // (-2 & 127) = 126, (-1 & 127) = 127 — beyond the 128-row sky (which we
    // sized above to exactly 128 rows) so they read the last two entries.
    // That deliberately exercises the column wrap semantics: sky columns are
    // indexed modulo 128 just like any other wall column.
    for (let x = plane.minx; x <= plane.maxx; x += 1) {
      expect(framebuffer[2 * screenWidth + x]).toBe(skyTexture.columns[0]![126]!);
      expect(framebuffer[3 * screenWidth + x]).toBe(skyTexture.columns[0]![127]!);
      expect(framebuffer[4 * screenWidth + x]).toBe(skyTexture.columns[0]![0]!);
      expect(framebuffer[5 * screenWidth + x]).toBe(skyTexture.columns[0]![1]!);
    }
    // Pixels outside the plane's column range remain 0.
    expect(framebuffer[2 * screenWidth + 0]).toBe(0);
    expect(framebuffer[2 * screenWidth + 8]).toBe(0);
  });

  test('uses supplied colormap — every byte is routed through colormap[source[.]]', () => {
    const screenWidth = 16;
    const viewHeight = 8;
    const plane = makeVisplane({ minx: 0, maxx: 0 }, screenWidth);
    plane.top[0] = 0;
    plane.bottom[0] = 3;
    const skyTexture = makeSkyTexture(4, 128, (_c, r) => r);
    const framebuffer = new Uint8Array(screenWidth * viewHeight);
    // Colormap that inverts the low 8 bits.
    const colormap = Uint8Array.from({ length: 256 }, (_, i) => ~i & 0xff);
    const ctx = makeSkyContext({
      skyTexture,
      centerY: 0,
      iscale: FRACUNIT,
      textureMid: 0,
      framebuffer,
      baseColormap: colormap,
      xToViewAngle: new Int32Array(screenWidth),
      screenWidth,
    });

    renderSkyVisplane(plane, ctx);

    expect(framebuffer[0]).toBe(colormap[0]!);
    expect(framebuffer[screenWidth]).toBe(colormap[1]!);
    expect(framebuffer[2 * screenWidth]).toBe(colormap[2]!);
    expect(framebuffer[3 * screenWidth]).toBe(colormap[3]!);
  });

  test('column angle varies with xToViewAngle — selects different sky columns per screen column', () => {
    const screenWidth = 16;
    const viewHeight = 4;
    const plane = makeVisplane({ minx: 0, maxx: 3 }, screenWidth);
    for (let x = plane.minx; x <= plane.maxx; x += 1) {
      plane.top[x] = 0;
      plane.bottom[x] = 0;
    }
    const skyTexture = makeSkyTexture(4, 128, (c, _r) => 0x10 + c);
    // Per-column xToViewAngle values chosen so
    // (0 + xToViewAngle[x]) >>> 22 lands on sky columns 0,1,2,3.
    const xToViewAngle = new Int32Array(screenWidth);
    xToViewAngle[0] = 0 << ANGLETOSKYSHIFT;
    xToViewAngle[1] = 1 << ANGLETOSKYSHIFT;
    xToViewAngle[2] = 2 << ANGLETOSKYSHIFT;
    xToViewAngle[3] = 3 << ANGLETOSKYSHIFT;

    const framebuffer = new Uint8Array(screenWidth * viewHeight);
    const ctx = makeSkyContext({
      skyTexture,
      centerY: 0,
      iscale: FRACUNIT,
      textureMid: 0,
      framebuffer,
      xToViewAngle,
      screenWidth,
    });

    renderSkyVisplane(plane, ctx);

    expect(framebuffer[0]).toBe(0x10);
    expect(framebuffer[1]).toBe(0x11);
    expect(framebuffer[2]).toBe(0x12);
    expect(framebuffer[3]).toBe(0x13);
  });

  test('column angle wraps via texture widthMask (4-column sky at 256-column resolution)', () => {
    // A 4-wide sky with widthMask=3 should produce identical output when the
    // sky angle index is 0 vs 4 vs 8 etc. — vanilla's per-rotation tiling.
    const screenWidth = 16;
    const viewHeight = 4;
    const plane = makeVisplane({ minx: 0, maxx: 1 }, screenWidth);
    plane.top[0] = 0;
    plane.bottom[0] = 0;
    plane.top[1] = 0;
    plane.bottom[1] = 0;
    const skyTexture = makeSkyTexture(4, 128, (c, _r) => 0x20 + c);
    const xToViewAngle = new Int32Array(screenWidth);
    xToViewAngle[0] = 0 << ANGLETOSKYSHIFT; // angle index 0
    xToViewAngle[1] = 4 << ANGLETOSKYSHIFT; // angle index 4, wraps to col 0

    const framebuffer = new Uint8Array(screenWidth * viewHeight);
    const ctx = makeSkyContext({
      skyTexture,
      centerY: 0,
      iscale: FRACUNIT,
      textureMid: 0,
      framebuffer,
      xToViewAngle,
      screenWidth,
    });

    renderSkyVisplane(plane, ctx);

    expect(framebuffer[0]).toBe(0x20);
    expect(framebuffer[1]).toBe(0x20);
  });

  test('viewAngle rotates the sky — adding 1<<22 advances every column by one sky tile', () => {
    const screenWidth = 16;
    const viewHeight = 4;
    const plane = makeVisplane({ minx: 0, maxx: 0 }, screenWidth);
    plane.top[0] = 0;
    plane.bottom[0] = 0;
    const skyTexture = makeSkyTexture(4, 128, (c, _r) => 0x30 + c);
    const xToViewAngle = new Int32Array(screenWidth);

    const framebufferA = new Uint8Array(screenWidth * viewHeight);
    renderSkyVisplane(
      plane,
      makeSkyContext({
        skyTexture,
        viewAngle: 0,
        centerY: 0,
        iscale: FRACUNIT,
        textureMid: 0,
        framebuffer: framebufferA,
        xToViewAngle,
        screenWidth,
      }),
    );
    expect(framebufferA[0]).toBe(0x30);

    const framebufferB = new Uint8Array(screenWidth * viewHeight);
    renderSkyVisplane(
      plane,
      makeSkyContext({
        skyTexture,
        viewAngle: 1 << ANGLETOSKYSHIFT,
        centerY: 0,
        iscale: FRACUNIT,
        textureMid: 0,
        framebuffer: framebufferB,
        xToViewAngle,
        screenWidth,
      }),
    );
    expect(framebufferB[0]).toBe(0x31);
  });
});

describe('renderSkyVisplane — edge cases', () => {
  test('empty plane (minx > maxx) is a no-op', () => {
    const screenWidth = 16;
    const viewHeight = 4;
    const plane = makeVisplane({ minx: screenWidth, maxx: -1 }, screenWidth);
    const framebuffer = new Uint8Array(screenWidth * viewHeight).fill(0xab);
    const ctx = makeSkyContext({ framebuffer, screenWidth });

    renderSkyVisplane(plane, ctx);

    expect(Array.from(framebuffer)).toEqual(new Array(screenWidth * viewHeight).fill(0xab));
  });

  test('column with top > bottom skips drawing that column', () => {
    const screenWidth = 8;
    const viewHeight = 4;
    const plane = makeVisplane({ minx: 0, maxx: 2 }, screenWidth);
    plane.top[0] = 0;
    plane.bottom[0] = 1;
    // Column 1: top > bottom means vanilla's dc_yl <= dc_yh gate skips it.
    plane.top[1] = 3;
    plane.bottom[1] = 0;
    plane.top[2] = 0;
    plane.bottom[2] = 1;

    const skyTexture = makeSkyTexture(4, 128, (c, _r) => 0x40 + c);
    const framebuffer = new Uint8Array(screenWidth * viewHeight);
    const ctx = makeSkyContext({
      skyTexture,
      centerY: 0,
      iscale: FRACUNIT,
      textureMid: 0,
      framebuffer,
      xToViewAngle: new Int32Array(screenWidth),
      screenWidth,
    });

    renderSkyVisplane(plane, ctx);

    // Columns 0 and 2 painted; column 1 untouched.
    expect(framebuffer[0]).toBe(0x40);
    expect(framebuffer[1]).toBe(0);
    expect(framebuffer[2]).toBe(0x40);
    expect(framebuffer[screenWidth + 0]).toBe(0x40);
    expect(framebuffer[screenWidth + 1]).toBe(0);
    expect(framebuffer[screenWidth + 2]).toBe(0x40);
  });

  test('single-column plane draws exactly one column', () => {
    const screenWidth = 8;
    const viewHeight = 4;
    const plane = makeVisplane({ minx: 3, maxx: 3 }, screenWidth);
    plane.top[3] = 0;
    plane.bottom[3] = 2;

    const skyTexture = makeSkyTexture(4, 128, (c, r) => (c << 4) | (r & 0x0f));
    const framebuffer = new Uint8Array(screenWidth * viewHeight);
    const ctx = makeSkyContext({
      skyTexture,
      centerY: 0,
      iscale: FRACUNIT,
      textureMid: 0,
      framebuffer,
      xToViewAngle: new Int32Array(screenWidth),
      screenWidth,
    });

    renderSkyVisplane(plane, ctx);

    expect(framebuffer[3]).toBe(0x00);
    expect(framebuffer[screenWidth + 3]).toBe(0x01);
    expect(framebuffer[2 * screenWidth + 3]).toBe(0x02);
    // Neighbors untouched.
    expect(framebuffer[2]).toBe(0);
    expect(framebuffer[4]).toBe(0);
  });

  test('iscale controls vertical texture stepping', () => {
    const screenWidth = 8;
    const viewHeight = 4;
    const plane = makeVisplane({ minx: 0, maxx: 0 }, screenWidth);
    plane.top[0] = 0;
    plane.bottom[0] = 3;

    const skyTexture = makeSkyTexture(4, 128, (_c, r) => r);
    const framebuffer = new Uint8Array(screenWidth * viewHeight);
    const ctx = makeSkyContext({
      skyTexture,
      centerY: 0,
      iscale: FRACUNIT * 2,
      textureMid: 0,
      framebuffer,
      xToViewAngle: new Int32Array(screenWidth),
      screenWidth,
    });

    renderSkyVisplane(plane, ctx);

    // Each row steps by 2*FRACUNIT so output rows pick up sky rows 0, 2, 4, 6.
    expect(framebuffer[0]).toBe(0);
    expect(framebuffer[screenWidth]).toBe(2);
    expect(framebuffer[2 * screenWidth]).toBe(4);
    expect(framebuffer[3 * screenWidth]).toBe(6);
  });
});
