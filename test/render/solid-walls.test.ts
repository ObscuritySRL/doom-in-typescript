import { describe, expect, test } from 'bun:test';

import { FRACBITS, FRACUNIT } from '../../src/core/fixed.ts';
import { PATCH_COLUMN_END_MARKER, PATCH_COLUMN_OFFSET_BYTES, PATCH_HEADER_BYTES, POST_HEADER_BYTES, POST_TRAILING_PAD_BYTES, decodePatch } from '../../src/render/patchDraw.ts';
import type { DecodedPatch } from '../../src/render/patchDraw.ts';
import { LIGHTSCALESHIFT, MAXLIGHTSCALE, SCREENHEIGHT, SCREENWIDTH } from '../../src/render/projection.ts';
import { CEILINGCLIP_DEFAULT, VISPLANE_TOP_UNFILLED, floorclipDefault } from '../../src/render/renderLimits.ts';
import type { Visplane } from '../../src/render/renderLimits.ts';
import { HEIGHTBITS, HEIGHTUNIT, INVERSE_SCALE_NUMERATOR, renderSolidWall } from '../../src/render/solidWalls.ts';
import type { SolidWallRenderContext, SolidWallSegment } from '../../src/render/solidWalls.ts';
import { prepareWallTexture } from '../../src/render/wallColumns.ts';
import type { PreparedWallTexture, WallPatchPlacement } from '../../src/render/wallColumns.ts';

const CANARY = 0xaa;
const IDENTITY_COLORMAP = Uint8Array.from({ length: 256 }, (_, i) => i);

interface SyntheticPost {
  readonly topDelta: number;
  readonly pixels: readonly number[];
}

function buildPatchLump(params: { readonly width: number; readonly height: number; readonly columns: readonly (readonly SyntheticPost[])[] }): Uint8Array {
  const { columns, height, width } = params;
  if (columns.length !== width) {
    throw new Error(`column count ${columns.length} does not match width ${width}`);
  }
  const columnBytes: Uint8Array[] = columns.map((posts) => {
    const totalBytes = posts.reduce((sum, post) => sum + POST_HEADER_BYTES + post.pixels.length + POST_TRAILING_PAD_BYTES, 0) + 1;
    const bytes = new Uint8Array(totalBytes);
    let cursor = 0;
    for (const post of posts) {
      bytes[cursor] = post.topDelta & 0xff;
      bytes[cursor + 1] = post.pixels.length & 0xff;
      bytes[cursor + 2] = 0x00;
      for (let i = 0; i < post.pixels.length; i += 1) {
        bytes[cursor + POST_HEADER_BYTES + i] = post.pixels[i]! & 0xff;
      }
      bytes[cursor + POST_HEADER_BYTES + post.pixels.length] = 0x00;
      cursor += POST_HEADER_BYTES + post.pixels.length + POST_TRAILING_PAD_BYTES;
    }
    bytes[cursor] = PATCH_COLUMN_END_MARKER;
    return bytes;
  });

  const columnTableBytes = width * PATCH_COLUMN_OFFSET_BYTES;
  const headerBytes = PATCH_HEADER_BYTES + columnTableBytes;
  const totalBytes = headerBytes + columnBytes.reduce((sum, bytes) => sum + bytes.length, 0);
  const lump = new Uint8Array(totalBytes);
  const view = new DataView(lump.buffer, lump.byteOffset, lump.byteLength);

  view.setInt16(0, width, true);
  view.setInt16(2, height, true);
  view.setInt16(4, 0, true);
  view.setInt16(6, 0, true);

  let columnStart = headerBytes;
  for (let col = 0; col < width; col += 1) {
    view.setInt32(PATCH_HEADER_BYTES + col * PATCH_COLUMN_OFFSET_BYTES, columnStart, true);
    const bytes = columnBytes[col]!;
    lump.set(bytes, columnStart);
    columnStart += bytes.length;
  }
  return lump;
}

function makeSolidPatch(width: number, height: number, columnByte: (col: number, row: number) => number): DecodedPatch {
  const columns: readonly SyntheticPost[][] = Array.from({ length: width }, (_, col) => [
    {
      topDelta: 0,
      pixels: Array.from({ length: height }, (_, row) => columnByte(col, row)),
    },
  ]);
  return decodePatch(buildPatchLump({ width, height, columns }));
}

function makeUniformTexture(width: number, height: number, byte: number): PreparedWallTexture {
  const patch = makeSolidPatch(width, height, () => byte);
  const placements: readonly WallPatchPlacement[] = [{ originX: 0, originY: 0, patch }];
  return prepareWallTexture(`UNI${byte}`, width, height, placements);
}

function makeColumnDistinctTexture(width: number, height: number): PreparedWallTexture {
  const patch = makeSolidPatch(width, height, (col, row) => (col * height + row) & 0xff);
  const placements: readonly WallPatchPlacement[] = [{ originX: 0, originY: 0, patch }];
  return prepareWallTexture('DISTINCT', width, height, placements);
}

function makeWallLights(count: number): readonly Uint8Array[] {
  return Array.from({ length: count }, (_, index) => Uint8Array.from({ length: 256 }, (_, byte) => (byte + index) & 0xff));
}

function makeVisplane(width: number): Visplane {
  return {
    height: 0,
    picnum: 0,
    lightlevel: 0,
    minx: width,
    maxx: -1,
    top: new Uint8Array(width).fill(VISPLANE_TOP_UNFILLED),
    bottom: new Uint8Array(width),
  };
}

function makeContext(params: {
  readonly screenWidth?: number;
  readonly viewHeight: number;
  readonly centerY: number;
  readonly framebufferHeight?: number;
  readonly screenHeight?: number;
}): SolidWallRenderContext & { readonly framebufferHeight: number } {
  const screenWidth = params.screenWidth ?? 32;
  const screenHeight = params.screenHeight ?? params.framebufferHeight ?? params.viewHeight + 8;
  return {
    framebuffer: new Uint8Array(screenWidth * screenHeight).fill(CANARY),
    screenWidth,
    viewHeight: params.viewHeight,
    centerY: params.centerY,
    ceilingClip: new Int16Array(screenWidth).fill(CEILINGCLIP_DEFAULT),
    floorClip: new Int16Array(screenWidth).fill(floorclipDefault(params.viewHeight)),
    framebufferHeight: screenHeight,
  };
}

function makeSegment(overrides: Partial<SolidWallSegment> = {}): SolidWallSegment {
  const midTexture = overrides.midTexture ?? makeUniformTexture(4, 16, 0x42);
  const wallLights = overrides.wallLights ?? Array.from({ length: MAXLIGHTSCALE }, () => IDENTITY_COLORMAP);
  return {
    rwX: 0,
    rwStopX: 4,
    topFrac: 0,
    topStep: 0,
    bottomFrac: 10 * HEIGHTUNIT - 1,
    bottomStep: 0,
    midTexture,
    midTextureMid: 0,
    scale: 0x1000,
    scaleStep: 0,
    wallLights,
    markCeiling: false,
    ceilingPlane: null,
    markFloor: false,
    floorPlane: null,
    textureColumnFor: (x) => x,
    ...overrides,
  };
}

describe('HEIGHTBITS / HEIGHTUNIT / INVERSE_SCALE_NUMERATOR constants', () => {
  test('HEIGHTBITS matches vanilla r_segs.c (= 12)', () => {
    expect(HEIGHTBITS).toBe(12);
  });

  test('HEIGHTUNIT is 1 << HEIGHTBITS = 4096', () => {
    expect(HEIGHTUNIT).toBe(1 << HEIGHTBITS);
    expect(HEIGHTUNIT).toBe(4096);
  });

  test('INVERSE_SCALE_NUMERATOR matches vanilla 0xffffffff', () => {
    expect(INVERSE_SCALE_NUMERATOR).toBe(0xffff_ffff);
  });
});

describe('renderSolidWall — column closure', () => {
  test('writes ceilingClip[x] = viewHeight and floorClip[x] = -1 for every column it covers', () => {
    const ctx = makeContext({ viewHeight: 16, centerY: 8 });
    const seg = makeSegment({ rwX: 2, rwStopX: 6 });
    renderSolidWall(seg, ctx);
    for (let x = 0; x < 2; x += 1) {
      expect(ctx.ceilingClip[x]).toBe(CEILINGCLIP_DEFAULT);
      expect(ctx.floorClip[x]).toBe(16);
    }
    for (let x = 2; x < 6; x += 1) {
      expect(ctx.ceilingClip[x]).toBe(16);
      expect(ctx.floorClip[x]).toBe(-1);
    }
    for (let x = 6; x < (ctx.screenWidth ?? SCREENWIDTH); x += 1) {
      expect(ctx.ceilingClip[x]).toBe(CEILINGCLIP_DEFAULT);
      expect(ctx.floorClip[x]).toBe(16);
    }
  });

  test('rwStopX <= rwX draws nothing and leaves every clip untouched', () => {
    const ctx = makeContext({ viewHeight: 16, centerY: 8 });
    const seg = makeSegment({ rwX: 4, rwStopX: 4 });
    renderSolidWall(seg, ctx);
    for (let x = 0; x < (ctx.screenWidth ?? SCREENWIDTH); x += 1) {
      expect(ctx.ceilingClip[x]).toBe(CEILINGCLIP_DEFAULT);
      expect(ctx.floorClip[x]).toBe(16);
    }
    for (let i = 0; i < ctx.framebuffer.length; i += 1) {
      expect(ctx.framebuffer[i]).toBe(CANARY);
    }
  });

  test('overwrites pre-existing ceilingClip / floorClip values on every covered column', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10 });
    for (let x = 0; x < (ctx.screenWidth ?? SCREENWIDTH); x += 1) {
      ctx.ceilingClip[x] = 5;
      ctx.floorClip[x] = 12;
    }
    const seg = makeSegment({ rwX: 1, rwStopX: 3, bottomFrac: 15 * HEIGHTUNIT - 1 });
    renderSolidWall(seg, ctx);
    expect(ctx.ceilingClip[0]).toBe(5);
    expect(ctx.ceilingClip[1]).toBe(20);
    expect(ctx.ceilingClip[2]).toBe(20);
    expect(ctx.ceilingClip[3]).toBe(5);
    expect(ctx.floorClip[0]).toBe(12);
    expect(ctx.floorClip[1]).toBe(-1);
    expect(ctx.floorClip[2]).toBe(-1);
    expect(ctx.floorClip[3]).toBe(12);
  });
});

describe('renderSolidWall — yl / yh derivation', () => {
  test('yl = (topFrac + HEIGHTUNIT - 1) >> HEIGHTBITS (ceiling divide)', () => {
    const ctx = makeContext({ viewHeight: 16, centerY: 8 });
    const texture = makeUniformTexture(4, 128, 0x11);
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 1,
      topFrac: 3 * HEIGHTUNIT,
      bottomFrac: 9 * HEIGHTUNIT,
      midTexture: texture,
    });
    renderSolidWall(seg, ctx);
    const screenWidth = ctx.screenWidth ?? SCREENWIDTH;
    for (let row = 0; row < 3; row += 1) {
      expect(ctx.framebuffer[row * screenWidth + 0]).toBe(CANARY);
    }
    for (let row = 3; row <= 9; row += 1) {
      expect(ctx.framebuffer[row * screenWidth + 0]).toBe(0x11);
    }
    for (let row = 10; row < ctx.framebufferHeight; row += 1) {
      expect(ctx.framebuffer[row * screenWidth + 0]).toBe(CANARY);
    }
  });

  test('yl ceiling divide rounds up a non-integer topFrac', () => {
    const ctx = makeContext({ viewHeight: 16, centerY: 8 });
    const texture = makeUniformTexture(4, 128, 0x22);
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 1,
      topFrac: 2 * HEIGHTUNIT + 1,
      bottomFrac: 5 * HEIGHTUNIT,
      midTexture: texture,
    });
    renderSolidWall(seg, ctx);
    const screenWidth = ctx.screenWidth ?? SCREENWIDTH;
    for (let row = 0; row < 3; row += 1) {
      expect(ctx.framebuffer[row * screenWidth + 0]).toBe(CANARY);
    }
    for (let row = 3; row <= 5; row += 1) {
      expect(ctx.framebuffer[row * screenWidth + 0]).toBe(0x22);
    }
  });

  test('yh = bottomFrac >> HEIGHTBITS (floor divide, no +HEIGHTUNIT-1 bias)', () => {
    const ctx = makeContext({ viewHeight: 16, centerY: 8 });
    const texture = makeUniformTexture(4, 128, 0x33);
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 1,
      topFrac: 0,
      bottomFrac: 4 * HEIGHTUNIT + HEIGHTUNIT - 1,
      midTexture: texture,
    });
    renderSolidWall(seg, ctx);
    const screenWidth = ctx.screenWidth ?? SCREENWIDTH;
    for (let row = 0; row <= 4; row += 1) {
      expect(ctx.framebuffer[row * screenWidth + 0]).toBe(0x33);
    }
    for (let row = 5; row < ctx.framebufferHeight; row += 1) {
      expect(ctx.framebuffer[row * screenWidth + 0]).toBe(CANARY);
    }
  });

  test('per-column topStep / bottomStep advance yl and yh monotonically', () => {
    const ctx = makeContext({ viewHeight: 16, centerY: 8 });
    const texture = makeUniformTexture(4, 128, 0x44);
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 4,
      topFrac: 0,
      topStep: HEIGHTUNIT,
      bottomFrac: 8 * HEIGHTUNIT,
      bottomStep: -HEIGHTUNIT,
      midTexture: texture,
    });
    renderSolidWall(seg, ctx);
    const screenWidth = ctx.screenWidth ?? SCREENWIDTH;
    const expectedRanges: ReadonlyArray<readonly [number, number]> = [
      [0, 8],
      [1, 7],
      [2, 6],
      [3, 5],
    ];
    for (let x = 0; x < expectedRanges.length; x += 1) {
      const [yl, yh] = expectedRanges[x]!;
      for (let row = 0; row < yl; row += 1) {
        expect(ctx.framebuffer[row * screenWidth + x]).toBe(CANARY);
      }
      for (let row = yl; row <= yh; row += 1) {
        expect(ctx.framebuffer[row * screenWidth + x]).toBe(0x44);
      }
      for (let row = yh + 1; row < ctx.framebufferHeight; row += 1) {
        expect(ctx.framebuffer[row * screenWidth + x]).toBe(CANARY);
      }
    }
  });
});

describe('renderSolidWall — yl / yh clipping against ceilingClip / floorClip', () => {
  test('yl clamps up to ceilingClip[x] + 1 when topFrac would draw higher', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10 });
    ctx.ceilingClip[0] = 5;
    const texture = makeUniformTexture(4, 128, 0x55);
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 1,
      topFrac: 0,
      bottomFrac: 15 * HEIGHTUNIT,
      midTexture: texture,
    });
    renderSolidWall(seg, ctx);
    const screenWidth = ctx.screenWidth ?? SCREENWIDTH;
    for (let row = 0; row <= 5; row += 1) {
      expect(ctx.framebuffer[row * screenWidth + 0]).toBe(CANARY);
    }
    for (let row = 6; row <= 15; row += 1) {
      expect(ctx.framebuffer[row * screenWidth + 0]).toBe(0x55);
    }
  });

  test('yh clamps down to floorClip[x] - 1 when bottomFrac would draw lower', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10 });
    ctx.floorClip[0] = 12;
    const texture = makeUniformTexture(4, 128, 0x66);
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 1,
      topFrac: 2 * HEIGHTUNIT,
      bottomFrac: 18 * HEIGHTUNIT,
      midTexture: texture,
    });
    renderSolidWall(seg, ctx);
    const screenWidth = ctx.screenWidth ?? SCREENWIDTH;
    for (let row = 2; row <= 11; row += 1) {
      expect(ctx.framebuffer[row * screenWidth + 0]).toBe(0x66);
    }
    for (let row = 12; row < ctx.framebufferHeight; row += 1) {
      expect(ctx.framebuffer[row * screenWidth + 0]).toBe(CANARY);
    }
  });

  test('when ceiling and floor clips invert (yl > yh) rDrawColumn draws nothing', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10 });
    ctx.ceilingClip[0] = 15;
    ctx.floorClip[0] = 3;
    const texture = makeUniformTexture(4, 16, 0x77);
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 1,
      topFrac: 0,
      bottomFrac: 20 * HEIGHTUNIT,
      midTexture: texture,
    });
    renderSolidWall(seg, ctx);
    const screenWidth = ctx.screenWidth ?? SCREENWIDTH;
    for (let row = 0; row < ctx.framebufferHeight; row += 1) {
      expect(ctx.framebuffer[row * screenWidth + 0]).toBe(CANARY);
    }
    expect(ctx.ceilingClip[0]).toBe(20);
    expect(ctx.floorClip[0]).toBe(-1);
  });
});

describe('renderSolidWall — ceiling visplane marking', () => {
  test('marks ceilingPlane from ceilingClip[x]+1 .. yl-1 when markCeiling is set and yl leaves room', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10, screenWidth: 8 });
    const ceilingPlane = makeVisplane(8);
    const seg = makeSegment({
      rwX: 2,
      rwStopX: 5,
      topFrac: 5 * HEIGHTUNIT,
      bottomFrac: 15 * HEIGHTUNIT,
      markCeiling: true,
      ceilingPlane,
    });
    renderSolidWall(seg, ctx);
    for (let x = 2; x < 5; x += 1) {
      expect(ceilingPlane.top[x]).toBe(0);
      expect(ceilingPlane.bottom[x]).toBe(4);
    }
    expect(ceilingPlane.top[0]).toBe(VISPLANE_TOP_UNFILLED);
    expect(ceilingPlane.top[1]).toBe(VISPLANE_TOP_UNFILLED);
    expect(ceilingPlane.top[5]).toBe(VISPLANE_TOP_UNFILLED);
    expect(ceilingPlane.top[7]).toBe(VISPLANE_TOP_UNFILLED);
  });

  test('skips ceiling marking when yl is already clamped to ceilingClip[x]+1 (top == yl, bottom == yl-1)', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10, screenWidth: 8 });
    ctx.ceilingClip[3] = 7;
    const ceilingPlane = makeVisplane(8);
    const seg = makeSegment({
      rwX: 3,
      rwStopX: 4,
      topFrac: 0,
      bottomFrac: 18 * HEIGHTUNIT,
      markCeiling: true,
      ceilingPlane,
    });
    renderSolidWall(seg, ctx);
    expect(ceilingPlane.top[3]).toBe(VISPLANE_TOP_UNFILLED);
    expect(ceilingPlane.bottom[3]).toBe(0);
  });

  test('clamps ceiling-mark bottom to floorClip[x] - 1 when yl - 1 would extend past the floor', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10, screenWidth: 8 });
    ctx.floorClip[4] = 6;
    const ceilingPlane = makeVisplane(8);
    const seg = makeSegment({
      rwX: 4,
      rwStopX: 5,
      topFrac: 12 * HEIGHTUNIT,
      bottomFrac: 18 * HEIGHTUNIT,
      markCeiling: true,
      ceilingPlane,
    });
    renderSolidWall(seg, ctx);
    expect(ceilingPlane.top[4]).toBe(0);
    expect(ceilingPlane.bottom[4]).toBe(5);
  });

  test('does nothing when markCeiling is false even with a ceilingPlane supplied', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10, screenWidth: 8 });
    const ceilingPlane = makeVisplane(8);
    const seg = makeSegment({
      rwX: 1,
      rwStopX: 3,
      topFrac: 5 * HEIGHTUNIT,
      bottomFrac: 15 * HEIGHTUNIT,
      markCeiling: false,
      ceilingPlane,
    });
    renderSolidWall(seg, ctx);
    for (let x = 0; x < 8; x += 1) {
      expect(ceilingPlane.top[x]).toBe(VISPLANE_TOP_UNFILLED);
    }
  });
});

describe('renderSolidWall — floor visplane marking', () => {
  test('marks floorPlane from yh+1 .. floorClip[x]-1 when markFloor is set and yh leaves room', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10, screenWidth: 8 });
    const floorPlane = makeVisplane(8);
    const seg = makeSegment({
      rwX: 2,
      rwStopX: 5,
      topFrac: 0,
      bottomFrac: 10 * HEIGHTUNIT,
      markFloor: true,
      floorPlane,
    });
    renderSolidWall(seg, ctx);
    for (let x = 2; x < 5; x += 1) {
      expect(floorPlane.top[x]).toBe(11);
      expect(floorPlane.bottom[x]).toBe(19);
    }
    expect(floorPlane.top[0]).toBe(VISPLANE_TOP_UNFILLED);
    expect(floorPlane.top[5]).toBe(VISPLANE_TOP_UNFILLED);
  });

  test('clamps floor-mark top up to ceilingClip[x] + 1 when yh + 1 is above the ceiling', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10, screenWidth: 8 });
    ctx.ceilingClip[4] = 14;
    const floorPlane = makeVisplane(8);
    const seg = makeSegment({
      rwX: 4,
      rwStopX: 5,
      topFrac: 15 * HEIGHTUNIT,
      bottomFrac: 5 * HEIGHTUNIT,
      markFloor: true,
      floorPlane,
    });
    renderSolidWall(seg, ctx);
    expect(floorPlane.top[4]).toBe(15);
    expect(floorPlane.bottom[4]).toBe(19);
  });

  test('skips floor marking when yh is already clamped to floorClip[x]-1 (top == yh+1 == floorClip[x], bottom == floorClip[x]-1 == yh)', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10, screenWidth: 8 });
    ctx.floorClip[3] = 8;
    const floorPlane = makeVisplane(8);
    const seg = makeSegment({
      rwX: 3,
      rwStopX: 4,
      topFrac: 0,
      bottomFrac: 18 * HEIGHTUNIT,
      markFloor: true,
      floorPlane,
    });
    renderSolidWall(seg, ctx);
    expect(floorPlane.top[3]).toBe(VISPLANE_TOP_UNFILLED);
    expect(floorPlane.bottom[3]).toBe(0);
  });

  test('does nothing when markFloor is false even with a floorPlane supplied', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10, screenWidth: 8 });
    const floorPlane = makeVisplane(8);
    const seg = makeSegment({
      rwX: 1,
      rwStopX: 3,
      topFrac: 0,
      bottomFrac: 10 * HEIGHTUNIT,
      markFloor: false,
      floorPlane,
    });
    renderSolidWall(seg, ctx);
    for (let x = 0; x < 8; x += 1) {
      expect(floorPlane.top[x]).toBe(VISPLANE_TOP_UNFILLED);
    }
  });
});

describe('renderSolidWall — lighting and iscale', () => {
  test('picks wallLights[scale >> LIGHTSCALESHIFT] per column', () => {
    const ctx = makeContext({ viewHeight: 16, centerY: 8, screenWidth: 4 });
    const texture = makeUniformTexture(4, 128, 0x80);
    const initialScale = 3 << LIGHTSCALESHIFT;
    const scaleStep = 1 << LIGHTSCALESHIFT;
    const lights = makeWallLights(MAXLIGHTSCALE);
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 4,
      midTexture: texture,
      scale: initialScale,
      scaleStep,
      wallLights: lights,
      topFrac: 0,
      bottomFrac: 3 * HEIGHTUNIT,
    });
    renderSolidWall(seg, ctx);
    const expectedIndices = [3, 4, 5, 6];
    for (let x = 0; x < 4; x += 1) {
      const index = expectedIndices[x]!;
      expect(ctx.framebuffer[0 * 4 + x]).toBe((0x80 + index) & 0xff);
    }
  });

  test('clamps the lighting index to MAXLIGHTSCALE - 1 when scale >> LIGHTSCALESHIFT is out of range', () => {
    const ctx = makeContext({ viewHeight: 16, centerY: 8, screenWidth: 2 });
    const texture = makeUniformTexture(4, 128, 0x20);
    const lights = makeWallLights(MAXLIGHTSCALE);
    const hugeScale = (MAXLIGHTSCALE + 10) << LIGHTSCALESHIFT;
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 2,
      midTexture: texture,
      scale: hugeScale,
      scaleStep: 0,
      wallLights: lights,
      topFrac: 0,
      bottomFrac: 3 * HEIGHTUNIT,
    });
    renderSolidWall(seg, ctx);
    for (let x = 0; x < 2; x += 1) {
      expect(ctx.framebuffer[0 * 2 + x]).toBe((0x20 + (MAXLIGHTSCALE - 1)) & 0xff);
    }
  });

  test('iscale is `0xffffffff / scale` truncated to int32', () => {
    const ctx = makeContext({ viewHeight: 16, centerY: 0, screenWidth: 1 });
    const texture = makeColumnDistinctTexture(1, 128);
    const lights = Array.from({ length: MAXLIGHTSCALE }, () => IDENTITY_COLORMAP);
    const scale = 0x100;
    const expectedIscale = (INVERSE_SCALE_NUMERATOR / scale) | 0;
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 1,
      midTexture: texture,
      scale,
      scaleStep: 0,
      wallLights: lights,
      topFrac: 0,
      bottomFrac: 3 * HEIGHTUNIT,
      textureColumnFor: () => 0,
      midTextureMid: 0,
    });
    renderSolidWall(seg, ctx);
    const source = texture.columns[0]!;
    for (let row = 0; row <= 3; row += 1) {
      const frac = (row * expectedIscale) | 0;
      const expectedSourceIndex = (frac >> FRACBITS) & 127;
      expect(ctx.framebuffer[row]).toBe(source[expectedSourceIndex]!);
    }
  });

  test('iscale divides `INVERSE_SCALE_NUMERATOR` by unsigned `scale` — small scales produce negative int32 iscale', () => {
    const ctx = makeContext({ viewHeight: 16, centerY: 0, screenWidth: 1 });
    const texture = makeColumnDistinctTexture(1, 128);
    const lights = Array.from({ length: MAXLIGHTSCALE }, () => IDENTITY_COLORMAP);
    const scale = 1;
    const iscale = (INVERSE_SCALE_NUMERATOR / (scale >>> 0)) | 0;
    expect(iscale).toBe(-1);
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 1,
      midTexture: texture,
      scale,
      scaleStep: 0,
      wallLights: lights,
      topFrac: 0,
      bottomFrac: 2 * HEIGHTUNIT,
      textureColumnFor: () => 0,
      midTextureMid: 0,
    });
    renderSolidWall(seg, ctx);
    const source = texture.columns[0]!;
    for (let row = 0; row <= 2; row += 1) {
      const frac = (row * iscale) | 0;
      const expectedSourceIndex = (frac >> FRACBITS) & 127;
      expect(ctx.framebuffer[row]).toBe(source[expectedSourceIndex]!);
    }
  });
});

describe('renderSolidWall — texture column resolution', () => {
  test('invokes textureColumnFor with every covered screen column', () => {
    const ctx = makeContext({ viewHeight: 16, centerY: 8, screenWidth: 8 });
    const texture = makeUniformTexture(4, 16, 0x10);
    const received: number[] = [];
    const seg = makeSegment({
      rwX: 3,
      rwStopX: 7,
      midTexture: texture,
      textureColumnFor: (x) => {
        received.push(x);
        return x;
      },
    });
    renderSolidWall(seg, ctx);
    expect(received).toEqual([3, 4, 5, 6]);
  });

  test('feeds the resolved column through getWallColumn — non-power-of-2 widths wrap via widthMask', () => {
    const ctx = makeContext({ viewHeight: 16, centerY: 0, screenWidth: 4 });
    const pixels = Array.from({ length: 48 }, (_, row) => row & 0xff);
    const patch = decodePatch(buildPatchLump({ width: 48, height: 1, columns: Array.from({ length: 48 }, (_, col) => [{ topDelta: 0, pixels: [col & 0xff] }]) }));
    const placements: readonly WallPatchPlacement[] = [{ originX: 0, originY: 0, patch }];
    const texture = prepareWallTexture('NPO2', 48, 1, placements);
    expect(texture.widthMask).toBe(31);
    const lights = Array.from({ length: MAXLIGHTSCALE }, () => IDENTITY_COLORMAP);
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 4,
      midTexture: texture,
      scale: 0x1000,
      scaleStep: 0,
      wallLights: lights,
      topFrac: 0,
      bottomFrac: 1 * HEIGHTUNIT - 1,
      textureColumnFor: (x) => x + 40,
      midTextureMid: 0,
    });
    renderSolidWall(seg, ctx);
    expect(ctx.framebuffer[0 * 4 + 0]).toBe(8);
    expect(ctx.framebuffer[0 * 4 + 1]).toBe(9);
    expect(ctx.framebuffer[0 * 4 + 2]).toBe(10);
    expect(ctx.framebuffer[0 * 4 + 3]).toBe(11);
    void pixels;
  });
});

describe('renderSolidWall — vanilla full-frame invariants', () => {
  test('reproduces the vanilla `R_RenderSegLoop` sequence: mark ceiling / draw / close column', () => {
    const ctx = makeContext({ viewHeight: 32, centerY: 16, screenWidth: 6 });
    const ceilingPlane = makeVisplane(6);
    const floorPlane = makeVisplane(6);
    const texture = makeUniformTexture(4, 128, 0xa1);
    const lights = Array.from({ length: MAXLIGHTSCALE }, () => IDENTITY_COLORMAP);
    const seg = makeSegment({
      rwX: 1,
      rwStopX: 5,
      topFrac: 8 * HEIGHTUNIT,
      topStep: 0,
      bottomFrac: 24 * HEIGHTUNIT,
      bottomStep: 0,
      midTexture: texture,
      midTextureMid: 0,
      scale: 1 << LIGHTSCALESHIFT,
      scaleStep: 0,
      wallLights: lights,
      markCeiling: true,
      ceilingPlane,
      markFloor: true,
      floorPlane,
      textureColumnFor: (x) => x,
    });
    renderSolidWall(seg, ctx);
    const screenWidth = ctx.screenWidth ?? SCREENWIDTH;
    for (let x = 1; x < 5; x += 1) {
      expect(ceilingPlane.top[x]).toBe(0);
      expect(ceilingPlane.bottom[x]).toBe(7);
      expect(floorPlane.top[x]).toBe(25);
      expect(floorPlane.bottom[x]).toBe(31);
      for (let row = 0; row < 8; row += 1) {
        expect(ctx.framebuffer[row * screenWidth + x]).toBe(CANARY);
      }
      for (let row = 8; row <= 24; row += 1) {
        expect(ctx.framebuffer[row * screenWidth + x]).toBe(0xa1);
      }
      for (let row = 25; row < ctx.framebufferHeight; row += 1) {
        expect(ctx.framebuffer[row * screenWidth + x]).toBe(CANARY);
      }
      expect(ctx.ceilingClip[x]).toBe(32);
      expect(ctx.floorClip[x]).toBe(-1);
    }
  });

  test('a second seg that shares a column with a closed-off first seg draws nothing in that column', () => {
    const ctx = makeContext({ viewHeight: 16, centerY: 8, screenWidth: 4 });
    const firstTexture = makeUniformTexture(4, 128, 0xb1);
    const secondTexture = makeUniformTexture(4, 128, 0xb2);
    const first = makeSegment({
      rwX: 0,
      rwStopX: 2,
      midTexture: firstTexture,
      topFrac: 0,
      bottomFrac: 15 * HEIGHTUNIT,
    });
    renderSolidWall(first, ctx);
    const second = makeSegment({
      rwX: 1,
      rwStopX: 3,
      midTexture: secondTexture,
      topFrac: 0,
      bottomFrac: 15 * HEIGHTUNIT,
    });
    renderSolidWall(second, ctx);
    const screenWidth = ctx.screenWidth ?? SCREENWIDTH;
    for (let row = 0; row <= 15; row += 1) {
      expect(ctx.framebuffer[row * screenWidth + 0]).toBe(0xb1);
      expect(ctx.framebuffer[row * screenWidth + 1]).toBe(0xb1);
      expect(ctx.framebuffer[row * screenWidth + 2]).toBe(0xb2);
    }
    expect(ctx.ceilingClip[1]).toBe(16);
    expect(ctx.floorClip[1]).toBe(-1);
  });

  test('uses SCREENWIDTH as the default framebuffer stride when screenWidth is omitted', () => {
    const framebuffer = new Uint8Array(SCREENWIDTH * SCREENHEIGHT).fill(CANARY);
    const ceilingClip = new Int16Array(SCREENWIDTH).fill(CEILINGCLIP_DEFAULT);
    const floorClip = new Int16Array(SCREENWIDTH).fill(floorclipDefault(SCREENHEIGHT));
    const texture = makeUniformTexture(4, 128, 0x5c);
    const lights = Array.from({ length: MAXLIGHTSCALE }, () => IDENTITY_COLORMAP);
    const seg = makeSegment({
      rwX: 100,
      rwStopX: 103,
      midTexture: texture,
      wallLights: lights,
      topFrac: 50 * HEIGHTUNIT,
      bottomFrac: 100 * HEIGHTUNIT,
    });
    renderSolidWall(seg, {
      framebuffer,
      viewHeight: SCREENHEIGHT,
      centerY: SCREENHEIGHT >> 1,
      ceilingClip,
      floorClip,
    });
    for (let row = 50; row <= 100; row += 1) {
      expect(framebuffer[row * SCREENWIDTH + 101]).toBe(0x5c);
    }
    expect(framebuffer[25 * SCREENWIDTH + 101]).toBe(CANARY);
    expect(ceilingClip[101]).toBe(SCREENHEIGHT);
    expect(floorClip[101]).toBe(-1);
  });

  test('scale accumulator advances by scaleStep every column (verified via per-column lighting)', () => {
    const ctx = makeContext({ viewHeight: 16, centerY: 8, screenWidth: 5 });
    const texture = makeUniformTexture(4, 128, 0x00);
    const lights = makeWallLights(MAXLIGHTSCALE);
    const scaleAt = (column: number) => ((10 + column) << LIGHTSCALESHIFT) | 0;
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 5,
      midTexture: texture,
      scale: scaleAt(0),
      scaleStep: 1 << LIGHTSCALESHIFT,
      wallLights: lights,
      topFrac: 0,
      bottomFrac: 3 * HEIGHTUNIT,
    });
    renderSolidWall(seg, ctx);
    for (let x = 0; x < 5; x += 1) {
      const expectedIndex = 10 + x;
      expect(ctx.framebuffer[0 * 5 + x]).toBe((0x00 + expectedIndex) & 0xff);
    }
  });

  test('midTextureMid adjusts the starting frac — shifting it shifts which source row lands at centerY', () => {
    const ctx = makeContext({ viewHeight: 32, centerY: 0, screenWidth: 1 });
    const texture = makeColumnDistinctTexture(1, 32);
    const lights = Array.from({ length: MAXLIGHTSCALE }, () => IDENTITY_COLORMAP);
    const scale = 0x1_0000;
    const iscale = (INVERSE_SCALE_NUMERATOR / scale) | 0;
    const textureMid = 5 * FRACUNIT;
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 1,
      midTexture: texture,
      scale,
      scaleStep: 0,
      wallLights: lights,
      topFrac: 0,
      bottomFrac: 3 * HEIGHTUNIT,
      textureColumnFor: () => 0,
      midTextureMid: textureMid,
    });
    renderSolidWall(seg, ctx);
    const source = texture.columns[0]!;
    for (let row = 0; row <= 3; row += 1) {
      const frac = (textureMid + row * iscale) | 0;
      const expectedSourceIndex = (frac >> FRACBITS) & 127;
      expect(ctx.framebuffer[row]).toBe(source[expectedSourceIndex]!);
    }
  });
});
