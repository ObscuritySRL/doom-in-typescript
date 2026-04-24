import { describe, expect, test } from 'bun:test';

import { fixedMul, FRACBITS, FRACUNIT } from '../../src/core/fixed.ts';
import type { MaskedDrawSeg, MaskedSegRenderContext } from '../../src/render/maskedTextures.ts';
import { MAXSHORT, renderMaskedSegRange } from '../../src/render/maskedTextures.ts';
import type { PatchColumn, PatchPost } from '../../src/render/patchDraw.ts';
import { LIGHTSCALESHIFT, MAXLIGHTSCALE } from '../../src/render/projection.ts';

const VIEW_WIDTH = 16;
const VIEW_HEIGHT = 16;
const CENTER_Y = VIEW_HEIGHT / 2;
const CENTER_Y_FRAC = CENTER_Y * FRACUNIT;

function identityColormap(): Uint8Array {
  return Uint8Array.from({ length: 256 }, (_, i) => i);
}

function buildWallLights(count: number = MAXLIGHTSCALE): Uint8Array[] {
  const table: Uint8Array[] = [];
  for (let i = 0; i < count; i += 1) {
    table.push(identityColormap());
  }
  return table;
}

function makePost(topDelta: number, pixels: readonly number[]): PatchPost {
  return Object.freeze({ topDelta, length: pixels.length, pixels: Uint8Array.from(pixels) });
}

function buildSeg(overrides: Partial<MaskedDrawSeg>): MaskedDrawSeg {
  const masked = new Int16Array(VIEW_WIDTH);
  const topClip = new Int16Array(VIEW_WIDTH).fill(-1);
  const botClip = new Int16Array(VIEW_WIDTH).fill(VIEW_HEIGHT);
  const defaultColumn: PatchColumn = [makePost(0, [10])];
  const base: MaskedDrawSeg = {
    x1: 0,
    x2: 0,
    scale1: FRACUNIT,
    scale2: FRACUNIT,
    silhouette: 0,
    bsilheight: 0,
    tsilheight: 0,
    sprtopclip: topClip,
    sprbottomclip: botClip,
    maskedtexturecol: masked,
    v1x: 0,
    v1y: 0,
    v2x: 0,
    v2y: 0,
    scaleStep: 0,
    textureMid: CENTER_Y_FRAC,
    midTextureWidthMask: 127,
    wallLights: buildWallLights(),
    fixedColormap: null,
    maskedColumnFor: () => defaultColumn,
  };
  return { ...base, ...overrides };
}

function buildCtx(overrides: Partial<MaskedSegRenderContext> = {}): MaskedSegRenderContext {
  return {
    framebuffer: new Uint8Array(VIEW_WIDTH * VIEW_HEIGHT),
    screenWidth: VIEW_WIDTH,
    centerY: CENTER_Y,
    centerYFrac: CENTER_Y_FRAC,
    ...overrides,
  };
}

describe('MAXSHORT constant', () => {
  test('is 0x7fff (int16 max)', () => {
    expect(MAXSHORT).toBe(0x7fff);
    expect(MAXSHORT).toBe(32767);
  });

  test('round-trips through Int16Array without truncation', () => {
    const arr = new Int16Array(1);
    arr[0] = MAXSHORT;
    expect(arr[0]).toBe(MAXSHORT);
  });
});

describe('renderMaskedSegRange null guards', () => {
  test('returns early when maskedtexturecol is null', () => {
    const ctx = buildCtx();
    const seg = buildSeg({ maskedtexturecol: null });
    renderMaskedSegRange(seg, 0, 2, ctx);
    expect(ctx.framebuffer.every((b) => b === 0)).toBe(true);
  });

  test('returns early when sprtopclip is null', () => {
    const ctx = buildCtx();
    const masked = new Int16Array(VIEW_WIDTH);
    masked[0] = 0;
    const seg = buildSeg({ sprtopclip: null, maskedtexturecol: masked });
    renderMaskedSegRange(seg, 0, 0, ctx);
    expect(ctx.framebuffer.every((b) => b === 0)).toBe(true);
    expect(masked[0]).toBe(0);
  });

  test('returns early when sprbottomclip is null', () => {
    const ctx = buildCtx();
    const masked = new Int16Array(VIEW_WIDTH);
    masked[0] = 0;
    const seg = buildSeg({ sprbottomclip: null, maskedtexturecol: masked });
    renderMaskedSegRange(seg, 0, 0, ctx);
    expect(ctx.framebuffer.every((b) => b === 0)).toBe(true);
    expect(masked[0]).toBe(0);
  });
});

describe('renderMaskedSegRange column skipping', () => {
  test('skips columns already flagged MAXSHORT and does not overwrite them', () => {
    const ctx = buildCtx();
    const masked = new Int16Array(VIEW_WIDTH);
    masked[0] = MAXSHORT;
    masked[1] = 0;
    masked[2] = MAXSHORT;
    const seg = buildSeg({ maskedtexturecol: masked, x1: 0, x2: 2 });
    renderMaskedSegRange(seg, 0, 2, ctx);
    expect(masked[0]).toBe(MAXSHORT);
    expect(masked[1]).toBe(MAXSHORT);
    expect(masked[2]).toBe(MAXSHORT);
  });

  test('empty x1 > x2 range is a no-op', () => {
    const ctx = buildCtx();
    const masked = new Int16Array(VIEW_WIDTH);
    masked[0] = 0;
    const seg = buildSeg({ maskedtexturecol: masked, x1: 0, x2: 0 });
    renderMaskedSegRange(seg, 5, 4, ctx);
    expect(masked[0]).toBe(0);
    expect(ctx.framebuffer.every((b) => b === 0)).toBe(true);
  });
});

describe('renderMaskedSegRange single-post draw', () => {
  test('paints the post pixel column at the expected rows', () => {
    const ctx = buildCtx();
    const pixels = [0x11, 0x22, 0x33, 0x44];
    const column: PatchColumn = [makePost(4, pixels)];
    const masked = new Int16Array(VIEW_WIDTH);
    masked[3] = 0;
    const seg = buildSeg({
      maskedtexturecol: masked,
      x1: 3,
      x2: 3,
      maskedColumnFor: () => column,
    });
    renderMaskedSegRange(seg, 3, 3, ctx);
    const fb = ctx.framebuffer;
    for (let row = 4; row < 8; row += 1) {
      expect(fb[row * VIEW_WIDTH + 3]).toBe(pixels[row - 4]!);
    }
    expect(fb[3 * VIEW_WIDTH + 3]).toBe(0);
    expect(fb[8 * VIEW_WIDTH + 3]).toBe(0);
  });

  test('does not touch columns outside x1..x2', () => {
    const ctx = buildCtx();
    const column: PatchColumn = [makePost(0, [0x99])];
    const masked = new Int16Array(VIEW_WIDTH);
    masked[2] = 0;
    const seg = buildSeg({
      maskedtexturecol: masked,
      x1: 2,
      x2: 2,
      maskedColumnFor: () => column,
    });
    renderMaskedSegRange(seg, 2, 2, ctx);
    for (let x = 0; x < VIEW_WIDTH; x += 1) {
      if (x === 2) {
        continue;
      }
      for (let y = 0; y < VIEW_HEIGHT; y += 1) {
        expect(ctx.framebuffer[y * VIEW_WIDTH + x]).toBe(0);
      }
    }
  });

  test('writes MAXSHORT done-flag after drawing', () => {
    const ctx = buildCtx();
    const column: PatchColumn = [makePost(0, [42])];
    const masked = new Int16Array(VIEW_WIDTH);
    masked[0] = 5;
    masked[1] = 7;
    const seg = buildSeg({
      maskedtexturecol: masked,
      x1: 0,
      x2: 1,
      maskedColumnFor: () => column,
    });
    renderMaskedSegRange(seg, 0, 1, ctx);
    expect(masked[0]).toBe(MAXSHORT);
    expect(masked[1]).toBe(MAXSHORT);
  });
});

describe('renderMaskedSegRange multi-post draw', () => {
  test('paints each post at its topDelta offset', () => {
    const ctx = buildCtx();
    const column: PatchColumn = [makePost(2, [0x11, 0x22]), makePost(5, [0x55, 0x66])];
    const masked = new Int16Array(VIEW_WIDTH);
    masked[4] = 0;
    const seg = buildSeg({
      maskedtexturecol: masked,
      x1: 4,
      x2: 4,
      maskedColumnFor: () => column,
    });
    renderMaskedSegRange(seg, 4, 4, ctx);
    const fb = ctx.framebuffer;
    expect(fb[2 * VIEW_WIDTH + 4]).toBe(0x11);
    expect(fb[3 * VIEW_WIDTH + 4]).toBe(0x22);
    expect(fb[4 * VIEW_WIDTH + 4]).toBe(0);
    expect(fb[5 * VIEW_WIDTH + 4]).toBe(0x55);
    expect(fb[6 * VIEW_WIDTH + 4]).toBe(0x66);
    expect(fb[7 * VIEW_WIDTH + 4]).toBe(0);
  });

  test('empty column (zero posts) paints nothing but still flags done', () => {
    const ctx = buildCtx();
    const emptyColumn: PatchColumn = [];
    const masked = new Int16Array(VIEW_WIDTH);
    masked[0] = 0;
    const seg = buildSeg({
      maskedtexturecol: masked,
      x1: 0,
      x2: 0,
      maskedColumnFor: () => emptyColumn,
    });
    renderMaskedSegRange(seg, 0, 0, ctx);
    expect(ctx.framebuffer.every((b) => b === 0)).toBe(true);
    expect(masked[0]).toBe(MAXSHORT);
  });
});

describe('renderMaskedSegRange clipping', () => {
  test('sprtopclip raises yl to sprtopclip + 1', () => {
    const ctx = buildCtx();
    const column: PatchColumn = [makePost(0, [0x10, 0x11, 0x12, 0x13, 0x14, 0x15])];
    const topClip = new Int16Array(VIEW_WIDTH).fill(-1);
    topClip[0] = 2;
    const botClip = new Int16Array(VIEW_WIDTH).fill(VIEW_HEIGHT);
    const masked = new Int16Array(VIEW_WIDTH);
    masked[0] = 0;
    const seg = buildSeg({
      sprtopclip: topClip,
      sprbottomclip: botClip,
      maskedtexturecol: masked,
      x1: 0,
      x2: 0,
      maskedColumnFor: () => column,
    });
    renderMaskedSegRange(seg, 0, 0, ctx);
    const fb = ctx.framebuffer;
    expect(fb[2 * VIEW_WIDTH + 0]).toBe(0);
    expect(fb[3 * VIEW_WIDTH + 0]).toBe(0x13);
    expect(fb[4 * VIEW_WIDTH + 0]).toBe(0x14);
    expect(fb[5 * VIEW_WIDTH + 0]).toBe(0x15);
  });

  test('sprbottomclip lowers yh to sprbottomclip - 1', () => {
    const ctx = buildCtx();
    const column: PatchColumn = [makePost(0, [0x10, 0x11, 0x12, 0x13, 0x14, 0x15])];
    const topClip = new Int16Array(VIEW_WIDTH).fill(-1);
    const botClip = new Int16Array(VIEW_WIDTH).fill(VIEW_HEIGHT);
    botClip[0] = 3;
    const masked = new Int16Array(VIEW_WIDTH);
    masked[0] = 0;
    const seg = buildSeg({
      sprtopclip: topClip,
      sprbottomclip: botClip,
      maskedtexturecol: masked,
      x1: 0,
      x2: 0,
      maskedColumnFor: () => column,
    });
    renderMaskedSegRange(seg, 0, 0, ctx);
    const fb = ctx.framebuffer;
    expect(fb[0 * VIEW_WIDTH + 0]).toBe(0x10);
    expect(fb[1 * VIEW_WIDTH + 0]).toBe(0x11);
    expect(fb[2 * VIEW_WIDTH + 0]).toBe(0x12);
    expect(fb[3 * VIEW_WIDTH + 0]).toBe(0);
    expect(fb[4 * VIEW_WIDTH + 0]).toBe(0);
  });

  test('full closure (topClip >= bottomClip) suppresses draw and still flags done', () => {
    const ctx = buildCtx();
    const column: PatchColumn = [makePost(0, [0xaa])];
    const topClip = new Int16Array(VIEW_WIDTH).fill(5);
    const botClip = new Int16Array(VIEW_WIDTH).fill(3);
    const masked = new Int16Array(VIEW_WIDTH);
    masked[0] = 0;
    const seg = buildSeg({
      sprtopclip: topClip,
      sprbottomclip: botClip,
      maskedtexturecol: masked,
      x1: 0,
      x2: 0,
      maskedColumnFor: () => column,
    });
    renderMaskedSegRange(seg, 0, 0, ctx);
    expect(ctx.framebuffer.every((b) => b === 0)).toBe(true);
    expect(masked[0]).toBe(MAXSHORT);
  });
});

describe('renderMaskedSegRange scale stepping', () => {
  test('advances spryscale by scaleStep across columns', () => {
    const ctx = buildCtx();
    const column: PatchColumn = [makePost(6, [0x77])];
    const masked = new Int16Array(VIEW_WIDTH);
    masked[0] = 0;
    masked[1] = 0;
    masked[2] = 0;
    const scaleStep = 0x1000;
    const seg = buildSeg({
      x1: 0,
      x2: 2,
      scale1: FRACUNIT,
      scale2: (FRACUNIT + 2 * scaleStep) | 0,
      scaleStep,
      maskedtexturecol: masked,
      maskedColumnFor: () => column,
    });
    renderMaskedSegRange(seg, 0, 2, ctx);
    expect(masked[0]).toBe(MAXSHORT);
    expect(masked[1]).toBe(MAXSHORT);
    expect(masked[2]).toBe(MAXSHORT);
  });

  test('advances spryscale even when column skipped via MAXSHORT flag', () => {
    const ctx = buildCtx();
    const column: PatchColumn = [makePost(8, [0xcc])];
    const masked = new Int16Array(VIEW_WIDTH);
    masked[0] = 0;
    masked[1] = MAXSHORT;
    masked[2] = 0;
    const scaleStep = 0x2000;
    const seg = buildSeg({
      x1: 0,
      x2: 2,
      scale1: FRACUNIT,
      scale2: (FRACUNIT + 2 * scaleStep) | 0,
      scaleStep,
      maskedtexturecol: masked,
      maskedColumnFor: () => column,
    });
    renderMaskedSegRange(seg, 0, 2, ctx);
    expect(masked[0]).toBe(MAXSHORT);
    expect(masked[1]).toBe(MAXSHORT);
    expect(masked[2]).toBe(MAXSHORT);
  });

  test('applies (x1 - seg.x1) * scaleStep when x1 is inside seg range', () => {
    const ctx = buildCtx();
    const column: PatchColumn = [makePost(4, [0x44])];
    const masked = new Int16Array(VIEW_WIDTH);
    masked[5] = 0;
    masked[6] = 0;
    const scaleStep = 0x800;
    const seg = buildSeg({
      x1: 0,
      x2: 15,
      scale1: FRACUNIT,
      scale2: (FRACUNIT + 15 * scaleStep) | 0,
      scaleStep,
      maskedtexturecol: masked,
      maskedColumnFor: () => column,
    });
    renderMaskedSegRange(seg, 5, 6, ctx);
    expect(masked[4]).toBe(0);
    expect(masked[5]).toBe(MAXSHORT);
    expect(masked[6]).toBe(MAXSHORT);
    expect(masked[7]).toBe(0);
  });
});

describe('renderMaskedSegRange widthMask wrapping', () => {
  test('wraps texCol via widthMask before calling maskedColumnFor', () => {
    const ctx = buildCtx();
    const column: PatchColumn = [makePost(8, [0xee])];
    const receivedColumns: number[] = [];
    const masked = new Int16Array(VIEW_WIDTH);
    masked[0] = 130;
    const seg = buildSeg({
      x1: 0,
      x2: 0,
      maskedtexturecol: masked,
      midTextureWidthMask: 127,
      maskedColumnFor: (col) => {
        receivedColumns.push(col);
        return column;
      },
    });
    renderMaskedSegRange(seg, 0, 0, ctx);
    expect(receivedColumns).toEqual([130 & 127]);
  });

  test('wraps negative texCol to positive via two-s-complement bitwise AND', () => {
    const ctx = buildCtx();
    const column: PatchColumn = [makePost(8, [0xdd])];
    const receivedColumns: number[] = [];
    const masked = new Int16Array(VIEW_WIDTH);
    masked[0] = -1;
    const seg = buildSeg({
      x1: 0,
      x2: 0,
      maskedtexturecol: masked,
      midTextureWidthMask: 63,
      maskedColumnFor: (col) => {
        receivedColumns.push(col);
        return column;
      },
    });
    renderMaskedSegRange(seg, 0, 0, ctx);
    expect(receivedColumns).toEqual([63]);
  });

  test('non-power-of-2 widthMask wraps mid-texture columns to bottom power-of-2 chunk', () => {
    const ctx = buildCtx();
    const column: PatchColumn = [makePost(8, [0xaa])];
    const receivedColumns: number[] = [];
    const masked = new Int16Array(VIEW_WIDTH);
    masked[0] = 80;
    const seg = buildSeg({
      x1: 0,
      x2: 0,
      maskedtexturecol: masked,
      midTextureWidthMask: 63,
      maskedColumnFor: (col) => {
        receivedColumns.push(col);
        return column;
      },
    });
    renderMaskedSegRange(seg, 0, 0, ctx);
    expect(receivedColumns).toEqual([80 & 63]);
  });
});

describe('renderMaskedSegRange colormap selection', () => {
  test('fixedColormap overrides wallLights regardless of scale', () => {
    const ctx = buildCtx();
    const fixedColormap = Uint8Array.from({ length: 256 }, () => 0xf0);
    const pixels = Array.from({ length: 16 }, () => 0x42);
    const column: PatchColumn = [makePost(0, pixels)];
    const masked = new Int16Array(VIEW_WIDTH);
    masked[0] = 0;
    const seg = buildSeg({
      x1: 0,
      x2: 0,
      scale1: (1 << (LIGHTSCALESHIFT + 3)) | 0,
      scaleStep: 0,
      fixedColormap,
      maskedtexturecol: masked,
      maskedColumnFor: () => column,
    });
    renderMaskedSegRange(seg, 0, 0, ctx);
    expect(ctx.framebuffer.some((b) => b === 0xf0)).toBe(true);
    expect(ctx.framebuffer.every((b) => b === 0 || b === 0xf0)).toBe(true);
  });

  test('uses wallLights[scale >> LIGHTSCALESHIFT] for normal-scale column', () => {
    const ctx = buildCtx();
    const pixels = Array.from({ length: 16 }, () => 0);
    const column: PatchColumn = [makePost(0, pixels)];
    const scale = (5 << LIGHTSCALESHIFT) | 0;
    const masked = new Int16Array(VIEW_WIDTH);
    masked[0] = 0;
    const bucket5 = Uint8Array.from({ length: 256 }, () => 0x55);
    const wallLights: Uint8Array[] = [];
    for (let i = 0; i < MAXLIGHTSCALE; i += 1) {
      wallLights.push(i === 5 ? bucket5 : new Uint8Array(256));
    }
    const seg = buildSeg({
      x1: 0,
      x2: 0,
      scale1: scale,
      scaleStep: 0,
      wallLights,
      maskedtexturecol: masked,
      maskedColumnFor: () => column,
    });
    renderMaskedSegRange(seg, 0, 0, ctx);
    expect(ctx.framebuffer.some((b) => b === 0x55)).toBe(true);
    expect(ctx.framebuffer.every((b) => b === 0 || b === 0x55)).toBe(true);
  });

  test('clamps bucket to MAXLIGHTSCALE - 1 when scale is very large', () => {
    const ctx = buildCtx();
    const pixels = Array.from({ length: 16 }, () => 0);
    const column: PatchColumn = [makePost(0, pixels)];
    const masked = new Int16Array(VIEW_WIDTH);
    masked[0] = 0;
    const hugeScale = (MAXLIGHTSCALE * (1 << LIGHTSCALESHIFT) * 4) | 0;
    const wallLights: Uint8Array[] = [];
    const lastMap = Uint8Array.from({ length: 256 }, () => 0xab);
    for (let i = 0; i < MAXLIGHTSCALE; i += 1) {
      wallLights.push(i === MAXLIGHTSCALE - 1 ? lastMap : new Uint8Array(256));
    }
    const seg = buildSeg({
      x1: 0,
      x2: 0,
      scale1: hugeScale,
      scaleStep: 0,
      wallLights,
      maskedtexturecol: masked,
      maskedColumnFor: () => column,
    });
    renderMaskedSegRange(seg, 0, 0, ctx);
    expect(ctx.framebuffer.some((b) => b === 0xab)).toBe(true);
    expect(ctx.framebuffer.every((b) => b === 0 || b === 0xab)).toBe(true);
  });

  test('clamps bucket to 0 when scale is too small (bucket index = 0)', () => {
    const ctx = buildCtx();
    const pixels = Array.from({ length: 16 }, () => 0);
    const column: PatchColumn = [makePost(0, pixels)];
    const masked = new Int16Array(VIEW_WIDTH);
    masked[0] = 0;
    const wallLights: Uint8Array[] = [];
    const bucket0 = Uint8Array.from({ length: 256 }, () => 0x77);
    for (let i = 0; i < MAXLIGHTSCALE; i += 1) {
      wallLights.push(i === 0 ? bucket0 : new Uint8Array(256));
    }
    const seg = buildSeg({
      x1: 0,
      x2: 0,
      scale1: 4095,
      scaleStep: 0,
      wallLights,
      maskedtexturecol: masked,
      maskedColumnFor: () => column,
    });
    renderMaskedSegRange(seg, 0, 0, ctx);
    expect(ctx.framebuffer.some((b) => b === 0x77)).toBe(true);
    expect(ctx.framebuffer.every((b) => b === 0 || b === 0x77)).toBe(true);
  });
});

describe('renderMaskedSegRange post position arithmetic', () => {
  test('post topDelta shifts yl by spryscale * topDelta when textureMid = centerYFrac', () => {
    const ctx = buildCtx();
    const topDelta = 4;
    const pixels = [0x21, 0x22];
    const column: PatchColumn = [makePost(topDelta, pixels)];
    const masked = new Int16Array(VIEW_WIDTH);
    masked[0] = 0;
    const seg = buildSeg({
      x1: 0,
      x2: 0,
      textureMid: CENTER_Y_FRAC,
      scale1: FRACUNIT,
      scaleStep: 0,
      maskedtexturecol: masked,
      maskedColumnFor: () => column,
    });
    renderMaskedSegRange(seg, 0, 0, ctx);
    for (let i = 0; i < pixels.length; i += 1) {
      expect(ctx.framebuffer[(topDelta + i) * VIEW_WIDTH + 0]).toBe(pixels[i]!);
    }
    expect(ctx.framebuffer[(topDelta - 1) * VIEW_WIDTH + 0]).toBe(0);
    expect(ctx.framebuffer[(topDelta + pixels.length) * VIEW_WIDTH + 0]).toBe(0);
  });

  test('per-post dc_texturemid subtracts topDelta << FRACBITS so frac at yl maps to pixels[0]', () => {
    const ctx = buildCtx();
    const pixels = [0xa1, 0xa2, 0xa3, 0xa4];
    const column: PatchColumn = [makePost(3, pixels)];
    const masked = new Int16Array(VIEW_WIDTH);
    masked[0] = 0;
    const seg = buildSeg({
      x1: 0,
      x2: 0,
      textureMid: CENTER_Y_FRAC,
      scale1: FRACUNIT,
      scaleStep: 0,
      maskedtexturecol: masked,
      maskedColumnFor: () => column,
    });
    renderMaskedSegRange(seg, 0, 0, ctx);
    for (let i = 0; i < pixels.length; i += 1) {
      expect(ctx.framebuffer[(3 + i) * VIEW_WIDTH + 0]).toBe(pixels[i]!);
    }
  });

  test('clipped yl advances frac into the post so first painted pixel is at the clip boundary', () => {
    const ctx = buildCtx();
    const pixels = [0xb0, 0xb1, 0xb2, 0xb3, 0xb4, 0xb5];
    const column: PatchColumn = [makePost(0, pixels)];
    const topClip = new Int16Array(VIEW_WIDTH).fill(-1);
    const botClip = new Int16Array(VIEW_WIDTH).fill(VIEW_HEIGHT);
    topClip[0] = 1;
    const masked = new Int16Array(VIEW_WIDTH);
    masked[0] = 0;
    const seg = buildSeg({
      x1: 0,
      x2: 0,
      textureMid: CENTER_Y_FRAC,
      scale1: FRACUNIT,
      scaleStep: 0,
      sprtopclip: topClip,
      sprbottomclip: botClip,
      maskedtexturecol: masked,
      maskedColumnFor: () => column,
    });
    renderMaskedSegRange(seg, 0, 0, ctx);
    expect(ctx.framebuffer[0 * VIEW_WIDTH + 0]).toBe(0);
    expect(ctx.framebuffer[1 * VIEW_WIDTH + 0]).toBe(0);
    expect(ctx.framebuffer[2 * VIEW_WIDTH + 0]).toBe(pixels[2]!);
    expect(ctx.framebuffer[3 * VIEW_WIDTH + 0]).toBe(pixels[3]!);
    expect(ctx.framebuffer[4 * VIEW_WIDTH + 0]).toBe(pixels[4]!);
    expect(ctx.framebuffer[5 * VIEW_WIDTH + 0]).toBe(pixels[5]!);
  });

  test('sprtopscreen = centerYFrac - FixedMul(textureMid, spryscale) shifts post position by textureMid', () => {
    const ctx = buildCtx();
    const column: PatchColumn = [makePost(0, [0xcc, 0xcd])];
    const masked = new Int16Array(VIEW_WIDTH);
    masked[0] = 0;
    const textureMid = 2 * FRACUNIT;
    const seg = buildSeg({
      x1: 0,
      x2: 0,
      textureMid,
      scale1: FRACUNIT,
      scaleStep: 0,
      maskedtexturecol: masked,
      maskedColumnFor: () => column,
    });
    renderMaskedSegRange(seg, 0, 0, ctx);
    const sprtopscreen = (CENTER_Y_FRAC - fixedMul(textureMid, FRACUNIT)) | 0;
    const expectedYl = (sprtopscreen + FRACUNIT - 1) >> FRACBITS;
    expect(ctx.framebuffer[expectedYl * VIEW_WIDTH + 0]).toBe(0xcc);
    expect(ctx.framebuffer[(expectedYl + 1) * VIEW_WIDTH + 0]).toBe(0xcd);
  });
});

describe('renderMaskedSegRange scale-varying draw', () => {
  test('doubled spryscale stretches the post vertically by 2', () => {
    const ctx = buildCtx();
    const pixels = [0x31, 0x32, 0x33, 0x34];
    const column: PatchColumn = [makePost(0, pixels)];
    const masked = new Int16Array(VIEW_WIDTH);
    masked[0] = 0;
    const scale = 2 * FRACUNIT;
    const textureMid = (CENTER_Y_FRAC / 2) | 0;
    const seg = buildSeg({
      x1: 0,
      x2: 0,
      textureMid,
      scale1: scale,
      scaleStep: 0,
      maskedtexturecol: masked,
      maskedColumnFor: () => column,
    });
    renderMaskedSegRange(seg, 0, 0, ctx);
    const sprtopscreen = (CENTER_Y_FRAC - fixedMul(textureMid, scale)) | 0;
    const yl = (sprtopscreen + FRACUNIT - 1) >> FRACBITS;
    const bottomscreen = (sprtopscreen + scale * pixels.length) | 0;
    const yh = (bottomscreen - 1) >> FRACBITS;
    for (let y = yl; y <= yh; y += 1) {
      const frac = (textureMid + (y - CENTER_Y) * ((0xffffffff / (scale >>> 0)) | 0)) | 0;
      const idx = frac >> FRACBITS;
      if (idx >= 0 && idx < pixels.length) {
        expect(ctx.framebuffer[y * VIEW_WIDTH + 0]).toBe(pixels[idx]!);
      }
    }
  });
});

describe('renderMaskedSegRange default screenWidth', () => {
  test('uses SCREENWIDTH fallback when ctx.screenWidth omitted', () => {
    const framebuffer = new Uint8Array(320 * 16);
    const ctx: MaskedSegRenderContext = {
      framebuffer,
      centerY: CENTER_Y,
      centerYFrac: CENTER_Y_FRAC,
    };
    const column: PatchColumn = [makePost(0, [0x7e])];
    const masked = new Int16Array(320);
    masked[10] = 0;
    const topClip = new Int16Array(320).fill(-1);
    const botClip = new Int16Array(320).fill(VIEW_HEIGHT);
    const seg = buildSeg({
      x1: 10,
      x2: 10,
      textureMid: CENTER_Y_FRAC,
      sprtopclip: topClip,
      sprbottomclip: botClip,
      maskedtexturecol: masked,
      maskedColumnFor: () => column,
    });
    renderMaskedSegRange(seg, 10, 10, ctx);
    expect(framebuffer[0 * 320 + 10]).toBe(0x7e);
  });
});
