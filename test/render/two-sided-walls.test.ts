import { describe, expect, test } from 'bun:test';

import { FRACBITS } from '../../src/core/fixed.ts';
import { PATCH_COLUMN_END_MARKER, PATCH_COLUMN_OFFSET_BYTES, PATCH_HEADER_BYTES, POST_HEADER_BYTES, POST_TRAILING_PAD_BYTES, decodePatch } from '../../src/render/patchDraw.ts';
import type { DecodedPatch } from '../../src/render/patchDraw.ts';
import { LIGHTSCALESHIFT, MAXLIGHTSCALE, SCREENHEIGHT, SCREENWIDTH } from '../../src/render/projection.ts';
import { CEILINGCLIP_DEFAULT, VISPLANE_TOP_UNFILLED, floorclipDefault } from '../../src/render/renderLimits.ts';
import type { Visplane } from '../../src/render/renderLimits.ts';
import { HEIGHTBITS as SOLID_HEIGHTBITS, HEIGHTUNIT as SOLID_HEIGHTUNIT, INVERSE_SCALE_NUMERATOR as SOLID_INVERSE_SCALE_NUMERATOR } from '../../src/render/solidWalls.ts';
import { HEIGHTBITS, HEIGHTUNIT, INVERSE_SCALE_NUMERATOR, renderTwoSidedWall } from '../../src/render/twoSidedWalls.ts';
import type { TwoSidedWallRenderContext, TwoSidedWallSegment } from '../../src/render/twoSidedWalls.ts';
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

function makeUniformTexture(name: string, width: number, height: number, byte: number): PreparedWallTexture {
  const patch = makeSolidPatch(width, height, () => byte);
  const placements: readonly WallPatchPlacement[] = [{ originX: 0, originY: 0, patch }];
  return prepareWallTexture(name, width, height, placements);
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
}): TwoSidedWallRenderContext & { readonly framebufferHeight: number } {
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

function makeSegment(overrides: Partial<TwoSidedWallSegment> = {}): TwoSidedWallSegment {
  const wallLights = overrides.wallLights ?? Array.from({ length: MAXLIGHTSCALE }, () => IDENTITY_COLORMAP);
  return {
    rwX: 0,
    rwStopX: 4,
    topFrac: 0,
    topStep: 0,
    bottomFrac: 32 * HEIGHTUNIT - 1,
    bottomStep: 0,
    topTexture: null,
    topTextureMid: 0,
    pixHigh: 0,
    pixHighStep: 0,
    bottomTexture: null,
    bottomTextureMid: 0,
    pixLow: 0,
    pixLowStep: 0,
    scale: 0x1000,
    scaleStep: 0,
    wallLights,
    markCeiling: false,
    ceilingPlane: null,
    markFloor: false,
    floorPlane: null,
    textureColumnFor: (x) => x,
    maskedTextureCol: null,
    ...overrides,
  };
}

describe('two-sided wall constants re-export solid-wall constants', () => {
  test('HEIGHTBITS matches solidWalls HEIGHTBITS (= 12)', () => {
    expect(HEIGHTBITS).toBe(SOLID_HEIGHTBITS);
    expect(HEIGHTBITS).toBe(12);
  });

  test('HEIGHTUNIT matches solidWalls HEIGHTUNIT (= 4096)', () => {
    expect(HEIGHTUNIT).toBe(SOLID_HEIGHTUNIT);
    expect(HEIGHTUNIT).toBe(4096);
  });

  test('INVERSE_SCALE_NUMERATOR matches solidWalls INVERSE_SCALE_NUMERATOR (= 0xffffffff)', () => {
    expect(INVERSE_SCALE_NUMERATOR).toBe(SOLID_INVERSE_SCALE_NUMERATOR);
    expect(INVERSE_SCALE_NUMERATOR).toBe(0xffff_ffff);
  });
});

describe('renderTwoSidedWall — no textures, no marks (pure pass-through)', () => {
  test('leaves framebuffer, ceilingClip, and floorClip untouched when all textures are null and no marks', () => {
    const ctx = makeContext({ viewHeight: 16, centerY: 8 });
    const ceilingSnapshot = new Int16Array(ctx.ceilingClip);
    const floorSnapshot = new Int16Array(ctx.floorClip);
    const seg = makeSegment({ rwX: 2, rwStopX: 6 });
    renderTwoSidedWall(seg, ctx);
    for (let i = 0; i < ctx.framebuffer.length; i += 1) {
      expect(ctx.framebuffer[i]).toBe(CANARY);
    }
    for (let x = 0; x < (ctx.screenWidth ?? SCREENWIDTH); x += 1) {
      expect(ctx.ceilingClip[x]).toBe(ceilingSnapshot[x]!);
      expect(ctx.floorClip[x]).toBe(floorSnapshot[x]!);
    }
  });

  test('rwStopX <= rwX draws nothing and touches nothing', () => {
    const ctx = makeContext({ viewHeight: 16, centerY: 8 });
    const seg = makeSegment({ rwX: 4, rwStopX: 4, topTexture: makeUniformTexture('UNI', 4, 16, 0x11), pixHigh: 0, pixHighStep: 0 });
    const ceilingSnapshot = new Int16Array(ctx.ceilingClip);
    const floorSnapshot = new Int16Array(ctx.floorClip);
    renderTwoSidedWall(seg, ctx);
    for (let i = 0; i < ctx.framebuffer.length; i += 1) {
      expect(ctx.framebuffer[i]).toBe(CANARY);
    }
    for (let x = 0; x < (ctx.screenWidth ?? SCREENWIDTH); x += 1) {
      expect(ctx.ceilingClip[x]).toBe(ceilingSnapshot[x]!);
      expect(ctx.floorClip[x]).toBe(floorSnapshot[x]!);
    }
  });
});

describe('renderTwoSidedWall — ceiling visplane marking (same semantics as solid wall)', () => {
  test('marks ceilingPlane from ceilingClip[x]+1 .. yl-1 when markCeiling is set', () => {
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
    renderTwoSidedWall(seg, ctx);
    for (let x = 2; x < 5; x += 1) {
      expect(ceilingPlane.top[x]).toBe(0);
      expect(ceilingPlane.bottom[x]).toBe(4);
    }
    expect(ceilingPlane.top[0]).toBe(VISPLANE_TOP_UNFILLED);
    expect(ceilingPlane.top[5]).toBe(VISPLANE_TOP_UNFILLED);
  });

  test('skips ceiling mark when yl is already clamped to ceilingClip[x]+1', () => {
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
    renderTwoSidedWall(seg, ctx);
    expect(ceilingPlane.top[3]).toBe(VISPLANE_TOP_UNFILLED);
    expect(ceilingPlane.bottom[3]).toBe(0);
  });
});

describe('renderTwoSidedWall — floor visplane marking (same semantics as solid wall)', () => {
  test('marks floorPlane from yh+1 .. floorClip[x]-1 when markFloor is set', () => {
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
    renderTwoSidedWall(seg, ctx);
    for (let x = 2; x < 5; x += 1) {
      expect(floorPlane.top[x]).toBe(11);
      expect(floorPlane.bottom[x]).toBe(19);
    }
    expect(floorPlane.top[0]).toBe(VISPLANE_TOP_UNFILLED);
    expect(floorPlane.top[5]).toBe(VISPLANE_TOP_UNFILLED);
  });
});

describe('renderTwoSidedWall — top texture (upper wall above opening)', () => {
  test('draws [yl, mid] when topTexture is set and mid >= yl, then writes ceilingClip[x] = mid', () => {
    const ctx = makeContext({ viewHeight: 32, centerY: 16, screenWidth: 4 });
    const topTexture = makeUniformTexture('TOPT', 4, 128, 0xc0);
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 4,
      topFrac: 0,
      bottomFrac: 24 * HEIGHTUNIT,
      topTexture,
      topTextureMid: 0,
      pixHigh: 8 * HEIGHTUNIT,
      pixHighStep: 0,
    });
    renderTwoSidedWall(seg, ctx);
    for (let x = 0; x < 4; x += 1) {
      for (let row = 0; row <= 8; row += 1) {
        expect(ctx.framebuffer[row * 4 + x]).toBe(0xc0);
      }
      for (let row = 9; row < ctx.framebufferHeight; row += 1) {
        expect(ctx.framebuffer[row * 4 + x]).toBe(CANARY);
      }
      expect(ctx.ceilingClip[x]).toBe(8);
    }
  });

  test('writes ceilingClip[x] = yl - 1 when topTexture is set but mid < yl (no pixels fit)', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10 });
    const topTexture = makeUniformTexture('TOP2', 4, 128, 0xd0);
    ctx.ceilingClip[0] = 10;
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 1,
      topFrac: 0,
      bottomFrac: 19 * HEIGHTUNIT,
      topTexture,
      topTextureMid: 0,
      pixHigh: 5 * HEIGHTUNIT,
      pixHighStep: 0,
    });
    renderTwoSidedWall(seg, ctx);
    for (let row = 0; row < ctx.framebufferHeight; row += 1) {
      expect(ctx.framebuffer[row * (ctx.screenWidth ?? SCREENWIDTH)]).toBe(CANARY);
    }
    expect(ctx.ceilingClip[0]).toBe(10);
  });

  test('clamps top-branch mid down to floorClip[x] - 1 when pixHigh would extend past the floor', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10 });
    const topTexture = makeUniformTexture('TOPCL', 4, 128, 0xe0);
    ctx.floorClip[0] = 6;
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 1,
      topFrac: 0,
      bottomFrac: 19 * HEIGHTUNIT,
      topTexture,
      topTextureMid: 0,
      pixHigh: 12 * HEIGHTUNIT,
      pixHighStep: 0,
    });
    renderTwoSidedWall(seg, ctx);
    for (let row = 0; row <= 5; row += 1) {
      expect(ctx.framebuffer[row * (ctx.screenWidth ?? SCREENWIDTH)]).toBe(0xe0);
    }
    for (let row = 6; row < ctx.framebufferHeight; row += 1) {
      expect(ctx.framebuffer[row * (ctx.screenWidth ?? SCREENWIDTH)]).toBe(CANARY);
    }
    expect(ctx.ceilingClip[0]).toBe(5);
  });

  test('advances pixHigh by pixHighStep every column', () => {
    const ctx = makeContext({ viewHeight: 32, centerY: 16, screenWidth: 4 });
    const topTexture = makeUniformTexture('TOPAD', 4, 128, 0xf0);
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 4,
      topFrac: 0,
      bottomFrac: 24 * HEIGHTUNIT,
      topTexture,
      topTextureMid: 0,
      pixHigh: 4 * HEIGHTUNIT,
      pixHighStep: HEIGHTUNIT,
    });
    renderTwoSidedWall(seg, ctx);
    for (let x = 0; x < 4; x += 1) {
      const expectedMid = 4 + x;
      expect(ctx.ceilingClip[x]).toBe(expectedMid);
      for (let row = 0; row <= expectedMid; row += 1) {
        expect(ctx.framebuffer[row * 4 + x]).toBe(0xf0);
      }
      for (let row = expectedMid + 1; row < ctx.framebufferHeight; row += 1) {
        expect(ctx.framebuffer[row * 4 + x]).toBe(CANARY);
      }
    }
  });

  test('without topTexture but with markCeiling, writes ceilingClip[x] = yl - 1', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10, screenWidth: 4 });
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 4,
      topFrac: 4 * HEIGHTUNIT,
      bottomFrac: 16 * HEIGHTUNIT,
      markCeiling: true,
      ceilingPlane: null,
    });
    renderTwoSidedWall(seg, ctx);
    for (let x = 0; x < 4; x += 1) {
      expect(ctx.ceilingClip[x]).toBe(3);
    }
  });

  test('without topTexture and without markCeiling, leaves ceilingClip untouched', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10, screenWidth: 4 });
    const initial = CEILINGCLIP_DEFAULT;
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 4,
      topFrac: 4 * HEIGHTUNIT,
      bottomFrac: 16 * HEIGHTUNIT,
      markCeiling: false,
    });
    renderTwoSidedWall(seg, ctx);
    for (let x = 0; x < 4; x += 1) {
      expect(ctx.ceilingClip[x]).toBe(initial);
    }
  });
});

describe('renderTwoSidedWall — bottom texture (lower wall below opening)', () => {
  test('draws [mid, yh] when bottomTexture is set and mid <= yh, then writes floorClip[x] = mid', () => {
    const ctx = makeContext({ viewHeight: 32, centerY: 16, screenWidth: 4 });
    const bottomTexture = makeUniformTexture('BOT', 4, 128, 0x30);
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 4,
      topFrac: 0,
      bottomFrac: 24 * HEIGHTUNIT,
      bottomTexture,
      bottomTextureMid: 0,
      pixLow: 18 * HEIGHTUNIT,
      pixLowStep: 0,
    });
    renderTwoSidedWall(seg, ctx);
    for (let x = 0; x < 4; x += 1) {
      for (let row = 0; row < 18; row += 1) {
        expect(ctx.framebuffer[row * 4 + x]).toBe(CANARY);
      }
      for (let row = 18; row <= 24; row += 1) {
        expect(ctx.framebuffer[row * 4 + x]).toBe(0x30);
      }
      expect(ctx.floorClip[x]).toBe(18);
    }
  });

  test('writes floorClip[x] = yh + 1 when bottomTexture is set but mid > yh', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10 });
    const bottomTexture = makeUniformTexture('BOT2', 4, 128, 0x40);
    ctx.floorClip[0] = 5;
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 1,
      topFrac: 0,
      bottomFrac: 19 * HEIGHTUNIT,
      bottomTexture,
      bottomTextureMid: 0,
      pixLow: 15 * HEIGHTUNIT,
      pixLowStep: 0,
    });
    renderTwoSidedWall(seg, ctx);
    for (let row = 0; row < ctx.framebufferHeight; row += 1) {
      expect(ctx.framebuffer[row * (ctx.screenWidth ?? SCREENWIDTH)]).toBe(CANARY);
    }
    expect(ctx.floorClip[0]).toBe(5);
  });

  test('clamps bottom-branch mid up to ceilingClip[x] + 1 when pixLow would intersect ceiling', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10 });
    const bottomTexture = makeUniformTexture('BOTCL', 4, 128, 0x50);
    ctx.ceilingClip[0] = 6;
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 1,
      topFrac: 0,
      bottomFrac: 19 * HEIGHTUNIT,
      bottomTexture,
      bottomTextureMid: 0,
      pixLow: 3 * HEIGHTUNIT,
      pixLowStep: 0,
    });
    renderTwoSidedWall(seg, ctx);
    const sw = ctx.screenWidth ?? SCREENWIDTH;
    for (let row = 0; row < 7; row += 1) {
      expect(ctx.framebuffer[row * sw]).toBe(CANARY);
    }
    for (let row = 7; row <= 19; row += 1) {
      expect(ctx.framebuffer[row * sw]).toBe(0x50);
    }
    expect(ctx.floorClip[0]).toBe(7);
  });

  test('advances pixLow by pixLowStep every column', () => {
    const ctx = makeContext({ viewHeight: 32, centerY: 16, screenWidth: 4 });
    const bottomTexture = makeUniformTexture('BOTAD', 4, 128, 0x60);
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 4,
      topFrac: 0,
      bottomFrac: 28 * HEIGHTUNIT,
      bottomTexture,
      bottomTextureMid: 0,
      pixLow: 20 * HEIGHTUNIT,
      pixLowStep: HEIGHTUNIT,
    });
    renderTwoSidedWall(seg, ctx);
    for (let x = 0; x < 4; x += 1) {
      const expectedMid = 20 + x;
      expect(ctx.floorClip[x]).toBe(expectedMid);
      for (let row = 0; row < expectedMid; row += 1) {
        expect(ctx.framebuffer[row * 4 + x]).toBe(CANARY);
      }
      for (let row = expectedMid; row <= 28; row += 1) {
        expect(ctx.framebuffer[row * 4 + x]).toBe(0x60);
      }
    }
  });

  test('without bottomTexture but with markFloor, writes floorClip[x] = yh + 1', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10, screenWidth: 4 });
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 4,
      topFrac: 0,
      bottomFrac: 10 * HEIGHTUNIT,
      markFloor: true,
      floorPlane: null,
    });
    renderTwoSidedWall(seg, ctx);
    for (let x = 0; x < 4; x += 1) {
      expect(ctx.floorClip[x]).toBe(11);
    }
  });

  test('without bottomTexture and without markFloor, leaves floorClip untouched', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10, screenWidth: 4 });
    const initial = floorclipDefault(20);
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 4,
      topFrac: 0,
      bottomFrac: 10 * HEIGHTUNIT,
      markFloor: false,
    });
    renderTwoSidedWall(seg, ctx);
    for (let x = 0; x < 4; x += 1) {
      expect(ctx.floorClip[x]).toBe(initial);
    }
  });
});

describe('renderTwoSidedWall — top-branch and bottom-branch interaction', () => {
  test('bottom branch reads LIVE ceilingClip[x] that the top branch just wrote', () => {
    const ctx = makeContext({ viewHeight: 32, centerY: 16, screenWidth: 1 });
    const topTexture = makeUniformTexture('TOPIX', 4, 128, 0x70);
    const bottomTexture = makeUniformTexture('BOTIX', 4, 128, 0x71);
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 1,
      topFrac: 0,
      bottomFrac: 28 * HEIGHTUNIT,
      topTexture,
      topTextureMid: 0,
      pixHigh: 10 * HEIGHTUNIT,
      pixHighStep: 0,
      bottomTexture,
      bottomTextureMid: 0,
      pixLow: 5 * HEIGHTUNIT,
      pixLowStep: 0,
    });
    renderTwoSidedWall(seg, ctx);
    for (let row = 0; row <= 10; row += 1) {
      expect(ctx.framebuffer[row]).toBe(0x70);
    }
    for (let row = 11; row <= 28; row += 1) {
      expect(ctx.framebuffer[row]).toBe(0x71);
    }
    expect(ctx.ceilingClip[0]).toBe(10);
    expect(ctx.floorClip[0]).toBe(11);
  });

  test('upper and lower render on same seg with non-overlapping opening between them', () => {
    const ctx = makeContext({ viewHeight: 32, centerY: 16, screenWidth: 2 });
    const topTexture = makeUniformTexture('TOPOP', 4, 128, 0x80);
    const bottomTexture = makeUniformTexture('BOTOP', 4, 128, 0x81);
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 2,
      topFrac: 0,
      bottomFrac: 30 * HEIGHTUNIT,
      topTexture,
      topTextureMid: 0,
      pixHigh: 8 * HEIGHTUNIT,
      pixHighStep: 0,
      bottomTexture,
      bottomTextureMid: 0,
      pixLow: 22 * HEIGHTUNIT,
      pixLowStep: 0,
    });
    renderTwoSidedWall(seg, ctx);
    for (let x = 0; x < 2; x += 1) {
      for (let row = 0; row <= 8; row += 1) {
        expect(ctx.framebuffer[row * 2 + x]).toBe(0x80);
      }
      for (let row = 9; row <= 21; row += 1) {
        expect(ctx.framebuffer[row * 2 + x]).toBe(CANARY);
      }
      for (let row = 22; row <= 30; row += 1) {
        expect(ctx.framebuffer[row * 2 + x]).toBe(0x81);
      }
      expect(ctx.ceilingClip[x]).toBe(8);
      expect(ctx.floorClip[x]).toBe(22);
    }
  });
});

describe('renderTwoSidedWall — masked midtexture column recording', () => {
  test('writes maskedTextureCol[x] = texturecolumn for every covered column', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10, screenWidth: 8 });
    const maskedTextureCol = new Int16Array(8).fill(0x7e7e);
    const seg = makeSegment({
      rwX: 2,
      rwStopX: 6,
      textureColumnFor: (x) => x + 100,
      maskedTextureCol,
    });
    renderTwoSidedWall(seg, ctx);
    expect(maskedTextureCol[0]).toBe(0x7e7e);
    expect(maskedTextureCol[1]).toBe(0x7e7e);
    expect(maskedTextureCol[2]).toBe(102);
    expect(maskedTextureCol[3]).toBe(103);
    expect(maskedTextureCol[4]).toBe(104);
    expect(maskedTextureCol[5]).toBe(105);
    expect(maskedTextureCol[6]).toBe(0x7e7e);
    expect(maskedTextureCol[7]).toBe(0x7e7e);
  });

  test('records the raw unmasked texturecolumn (no width-mask applied)', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10, screenWidth: 2 });
    const maskedTextureCol = new Int16Array(2);
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 2,
      textureColumnFor: (x) => (x === 0 ? 1000 : -37),
      maskedTextureCol,
    });
    renderTwoSidedWall(seg, ctx);
    expect(maskedTextureCol[0]).toBe(1000);
    expect(maskedTextureCol[1]).toBe(-37);
  });

  test('does not write maskedTextureCol when null', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10, screenWidth: 4 });
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 4,
      maskedTextureCol: null,
    });
    expect(() => renderTwoSidedWall(seg, ctx)).not.toThrow();
  });
});

describe('renderTwoSidedWall — texture column resolution', () => {
  test('invokes textureColumnFor exactly once per covered column and reuses the value for top, bottom, and masked', () => {
    const ctx = makeContext({ viewHeight: 32, centerY: 16, screenWidth: 4 });
    const topTexture = makeUniformTexture('TOPR', 4, 128, 0x90);
    const bottomTexture = makeUniformTexture('BOTR', 4, 128, 0x91);
    const maskedTextureCol = new Int16Array(4);
    const received: number[] = [];
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 4,
      topFrac: 0,
      bottomFrac: 28 * HEIGHTUNIT,
      topTexture,
      topTextureMid: 0,
      pixHigh: 8 * HEIGHTUNIT,
      pixHighStep: 0,
      bottomTexture,
      bottomTextureMid: 0,
      pixLow: 22 * HEIGHTUNIT,
      pixLowStep: 0,
      textureColumnFor: (x) => {
        received.push(x);
        return x + 7;
      },
      maskedTextureCol,
    });
    renderTwoSidedWall(seg, ctx);
    expect(received).toEqual([0, 1, 2, 3]);
    for (let x = 0; x < 4; x += 1) {
      expect(maskedTextureCol[x]).toBe(x + 7);
    }
  });
});

describe('renderTwoSidedWall — lighting and iscale', () => {
  test('picks wallLights[scale >> LIGHTSCALESHIFT] per column (shared by upper and lower draws)', () => {
    const ctx = makeContext({ viewHeight: 32, centerY: 16, screenWidth: 4 });
    const topTexture = makeUniformTexture('TL', 4, 128, 0xa0);
    const bottomTexture = makeUniformTexture('BL', 4, 128, 0xb0);
    const lights = Array.from({ length: MAXLIGHTSCALE }, (_, i) => Uint8Array.from({ length: 256 }, (_, b) => (b + i) & 0xff));
    const initialScale = 3 << LIGHTSCALESHIFT;
    const scaleStep = 1 << LIGHTSCALESHIFT;
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 4,
      topFrac: 0,
      bottomFrac: 28 * HEIGHTUNIT,
      topTexture,
      topTextureMid: 0,
      pixHigh: 4 * HEIGHTUNIT,
      pixHighStep: 0,
      bottomTexture,
      bottomTextureMid: 0,
      pixLow: 24 * HEIGHTUNIT,
      pixLowStep: 0,
      scale: initialScale,
      scaleStep,
      wallLights: lights,
    });
    renderTwoSidedWall(seg, ctx);
    for (let x = 0; x < 4; x += 1) {
      const index = 3 + x;
      expect(ctx.framebuffer[0 * 4 + x]).toBe((0xa0 + index) & 0xff);
      expect(ctx.framebuffer[24 * 4 + x]).toBe((0xb0 + index) & 0xff);
    }
  });

  test('clamps lighting index to MAXLIGHTSCALE - 1 when scale >> LIGHTSCALESHIFT is out of range', () => {
    const ctx = makeContext({ viewHeight: 16, centerY: 8, screenWidth: 1 });
    const topTexture = makeUniformTexture('TLC', 4, 128, 0x10);
    const lights = Array.from({ length: MAXLIGHTSCALE }, (_, i) => Uint8Array.from({ length: 256 }, (_, b) => (b + i) & 0xff));
    const hugeScale = (MAXLIGHTSCALE + 10) << LIGHTSCALESHIFT;
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 1,
      topFrac: 0,
      bottomFrac: 10 * HEIGHTUNIT,
      topTexture,
      topTextureMid: 0,
      pixHigh: 3 * HEIGHTUNIT,
      pixHighStep: 0,
      scale: hugeScale,
      scaleStep: 0,
      wallLights: lights,
    });
    renderTwoSidedWall(seg, ctx);
    expect(ctx.framebuffer[0]).toBe((0x10 + (MAXLIGHTSCALE - 1)) & 0xff);
  });

  test('iscale is 0xffffffff / scale truncated to int32', () => {
    const ctx = makeContext({ viewHeight: 16, centerY: 0, screenWidth: 1 });
    const topTexture = makeUniformTexture('TIS', 1, 128, 0);
    const lights = Array.from({ length: MAXLIGHTSCALE }, () => IDENTITY_COLORMAP);
    const scale = 0x100;
    const expectedIscale = (INVERSE_SCALE_NUMERATOR / scale) | 0;
    const sourcePatch = makeSolidPatch(1, 128, (_, row) => row & 0xff);
    const distinctTexture = prepareWallTexture('DIST', 1, 128, [{ originX: 0, originY: 0, patch: sourcePatch }]);
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 1,
      topFrac: 0,
      bottomFrac: 10 * HEIGHTUNIT,
      topTexture: distinctTexture,
      topTextureMid: 0,
      pixHigh: 3 * HEIGHTUNIT,
      pixHighStep: 0,
      scale,
      scaleStep: 0,
      wallLights: lights,
      textureColumnFor: () => 0,
    });
    renderTwoSidedWall(seg, ctx);
    void topTexture;
    const source = distinctTexture.columns[0]!;
    for (let row = 0; row <= 3; row += 1) {
      const frac = (row * expectedIscale) | 0;
      const expectedSourceIndex = (frac >> FRACBITS) & 127;
      expect(ctx.framebuffer[row]).toBe(source[expectedSourceIndex]!);
    }
  });
});

describe('renderTwoSidedWall — vanilla full-frame invariants', () => {
  test('renders upper wall, visplane bands for opening, lower wall, and leaves opening clip live', () => {
    const ctx = makeContext({ viewHeight: 32, centerY: 16, screenWidth: 4 });
    const ceilingPlane = makeVisplane(4);
    const floorPlane = makeVisplane(4);
    const topTexture = makeUniformTexture('FRT', 4, 128, 0xa1);
    const bottomTexture = makeUniformTexture('FRB', 4, 128, 0xa2);
    const lights = Array.from({ length: MAXLIGHTSCALE }, () => IDENTITY_COLORMAP);
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 4,
      topFrac: 4 * HEIGHTUNIT,
      topStep: 0,
      bottomFrac: 26 * HEIGHTUNIT,
      bottomStep: 0,
      topTexture,
      topTextureMid: 0,
      pixHigh: 10 * HEIGHTUNIT,
      pixHighStep: 0,
      bottomTexture,
      bottomTextureMid: 0,
      pixLow: 20 * HEIGHTUNIT,
      pixLowStep: 0,
      scale: 1 << LIGHTSCALESHIFT,
      scaleStep: 0,
      wallLights: lights,
      markCeiling: true,
      ceilingPlane,
      markFloor: true,
      floorPlane,
    });
    renderTwoSidedWall(seg, ctx);
    for (let x = 0; x < 4; x += 1) {
      expect(ceilingPlane.top[x]).toBe(0);
      expect(ceilingPlane.bottom[x]).toBe(3);
      expect(floorPlane.top[x]).toBe(27);
      expect(floorPlane.bottom[x]).toBe(31);
      for (let row = 0; row < 4; row += 1) {
        expect(ctx.framebuffer[row * 4 + x]).toBe(CANARY);
      }
      for (let row = 4; row <= 10; row += 1) {
        expect(ctx.framebuffer[row * 4 + x]).toBe(0xa1);
      }
      for (let row = 11; row <= 19; row += 1) {
        expect(ctx.framebuffer[row * 4 + x]).toBe(CANARY);
      }
      for (let row = 20; row <= 26; row += 1) {
        expect(ctx.framebuffer[row * 4 + x]).toBe(0xa2);
      }
      for (let row = 27; row < ctx.framebufferHeight; row += 1) {
        expect(ctx.framebuffer[row * 4 + x]).toBe(CANARY);
      }
      expect(ctx.ceilingClip[x]).toBe(10);
      expect(ctx.floorClip[x]).toBe(20);
    }
  });

  test('uses SCREENWIDTH as the default framebuffer stride when screenWidth is omitted', () => {
    const framebuffer = new Uint8Array(SCREENWIDTH * SCREENHEIGHT).fill(CANARY);
    const ceilingClip = new Int16Array(SCREENWIDTH).fill(CEILINGCLIP_DEFAULT);
    const floorClip = new Int16Array(SCREENWIDTH).fill(floorclipDefault(SCREENHEIGHT));
    const topTexture = makeUniformTexture('DEF', 4, 128, 0x5c);
    const lights = Array.from({ length: MAXLIGHTSCALE }, () => IDENTITY_COLORMAP);
    const seg = makeSegment({
      rwX: 100,
      rwStopX: 103,
      topFrac: 50 * HEIGHTUNIT,
      bottomFrac: 150 * HEIGHTUNIT,
      topTexture,
      topTextureMid: 0,
      pixHigh: 90 * HEIGHTUNIT,
      pixHighStep: 0,
      wallLights: lights,
    });
    renderTwoSidedWall(seg, {
      framebuffer,
      viewHeight: SCREENHEIGHT,
      centerY: SCREENHEIGHT >> 1,
      ceilingClip,
      floorClip,
    });
    for (let row = 50; row <= 90; row += 1) {
      expect(framebuffer[row * SCREENWIDTH + 101]).toBe(0x5c);
    }
    expect(framebuffer[25 * SCREENWIDTH + 101]).toBe(CANARY);
    expect(ceilingClip[101]).toBe(90);
    expect(floorClip[101]).toBe(floorclipDefault(SCREENHEIGHT));
  });

  test('pixHigh does NOT advance when topTexture is null (accumulator is untouched)', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10, screenWidth: 4 });
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 4,
      topTexture: null,
      pixHigh: 0x7fff_fff0,
      pixHighStep: 0x1000_0000,
      markCeiling: false,
    });
    expect(() => renderTwoSidedWall(seg, ctx)).not.toThrow();
    for (let x = 0; x < 4; x += 1) {
      expect(ctx.ceilingClip[x]).toBe(CEILINGCLIP_DEFAULT);
    }
  });

  test('pixLow does NOT advance when bottomTexture is null (accumulator is untouched)', () => {
    const ctx = makeContext({ viewHeight: 20, centerY: 10, screenWidth: 4 });
    const seg = makeSegment({
      rwX: 0,
      rwStopX: 4,
      bottomTexture: null,
      pixLow: 0x7fff_fff0,
      pixLowStep: 0x1000_0000,
      markFloor: false,
    });
    expect(() => renderTwoSidedWall(seg, ctx)).not.toThrow();
    for (let x = 0; x < 4; x += 1) {
      expect(ctx.floorClip[x]).toBe(floorclipDefault(20));
    }
  });
});
