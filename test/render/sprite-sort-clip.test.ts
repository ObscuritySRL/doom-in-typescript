import { describe, expect, test } from 'bun:test';

import { FRACBITS } from '../../src/core/fixed.ts';
import type { SpriteClipDrawSeg } from '../../src/render/spriteClip.ts';
import { CLIP_TOP_DEFAULT, CLIP_UNSET, SIL_BOTH, SIL_BOTTOM, SIL_NONE, SIL_TOP, clipVisSprite, createSpriteClipBuffers, drawMasked, pointOnSegSide, sortVisSprites } from '../../src/render/spriteClip.ts';
import type { VisSprite } from '../../src/render/spriteProjection.ts';
import { createVisSpritePool } from '../../src/render/spriteProjection.ts';

function makeVisSprite(overrides: Partial<VisSprite> = {}): VisSprite {
  return {
    x1: overrides.x1 ?? 10,
    x2: overrides.x2 ?? 20,
    gx: overrides.gx ?? 0,
    gy: overrides.gy ?? 0,
    gz: overrides.gz ?? 0,
    gzt: overrides.gzt ?? 0,
    startFrac: overrides.startFrac ?? 0,
    scale: overrides.scale ?? 1000,
    xIscale: overrides.xIscale ?? 0,
    textureMid: overrides.textureMid ?? 0,
    patch: overrides.patch ?? 0,
    colormap: overrides.colormap ?? null,
    mobjFlags: overrides.mobjFlags ?? 0,
  };
}

function makeDrawSeg(overrides: Partial<SpriteClipDrawSeg> = {}): SpriteClipDrawSeg {
  return {
    x1: overrides.x1 ?? 0,
    x2: overrides.x2 ?? 319,
    scale1: overrides.scale1 ?? 1000,
    scale2: overrides.scale2 ?? 1000,
    silhouette: overrides.silhouette ?? SIL_NONE,
    bsilheight: overrides.bsilheight ?? 0,
    tsilheight: overrides.tsilheight ?? 0,
    sprtopclip: overrides.sprtopclip ?? null,
    sprbottomclip: overrides.sprbottomclip ?? null,
    maskedtexturecol: overrides.maskedtexturecol ?? null,
    v1x: overrides.v1x ?? 0,
    v1y: overrides.v1y ?? 0,
    v2x: overrides.v2x ?? 1,
    v2y: overrides.v2y ?? 0,
  };
}

describe('silhouette and sentinel constants (r_defs.h + r_things.c)', () => {
  test('SIL_* bit values mirror r_defs.h', () => {
    expect(SIL_NONE).toBe(0);
    expect(SIL_BOTTOM).toBe(1);
    expect(SIL_TOP).toBe(2);
    expect(SIL_BOTH).toBe(3);
    expect(SIL_BOTTOM | SIL_TOP).toBe(SIL_BOTH);
  });

  test('CLIP_UNSET is the r_things.c sentinel (-2) and CLIP_TOP_DEFAULT is -1', () => {
    expect(CLIP_UNSET).toBe(-2);
    expect(CLIP_TOP_DEFAULT).toBe(-1);
  });
});

describe('createSpriteClipBuffers', () => {
  test('allocates two Int16Arrays sized to viewWidth', () => {
    const buffers = createSpriteClipBuffers(320);
    expect(buffers.viewWidth).toBe(320);
    expect(buffers.clipBot).toBeInstanceOf(Int16Array);
    expect(buffers.clipTop).toBeInstanceOf(Int16Array);
    expect(buffers.clipBot.length).toBe(320);
    expect(buffers.clipTop.length).toBe(320);
  });

  test('rejects non-positive or non-integer viewWidth', () => {
    expect(() => createSpriteClipBuffers(0)).toThrow(RangeError);
    expect(() => createSpriteClipBuffers(-5)).toThrow(RangeError);
    expect(() => createSpriteClipBuffers(3.5)).toThrow(RangeError);
  });
});

describe('pointOnSegSide (r_main.c R_PointOnSegSide)', () => {
  test('vertical seg with ldy > 0: left-of-seg is back (1), right-of-seg is front (0)', () => {
    const seg = { v1x: 100, v1y: 0, v2x: 100, v2y: 100 };
    expect(pointOnSegSide(50, 50, seg)).toBe(1);
    expect(pointOnSegSide(150, 50, seg)).toBe(0);
  });

  test('vertical seg with ldy < 0: left-of-seg is front (0), right-of-seg is back (1)', () => {
    const seg = { v1x: 100, v1y: 100, v2x: 100, v2y: 0 };
    expect(pointOnSegSide(50, 50, seg)).toBe(0);
    expect(pointOnSegSide(150, 50, seg)).toBe(1);
  });

  test('vertical seg: x === lx takes the "x <= lx" branch', () => {
    const seg = { v1x: 100, v1y: 0, v2x: 100, v2y: 100 };
    expect(pointOnSegSide(100, 50, seg)).toBe(1);
  });

  test('horizontal seg with ldx > 0: below is front (0), above is back (1)', () => {
    const seg = { v1x: 0, v1y: 100, v2x: 100, v2y: 100 };
    expect(pointOnSegSide(50, 50, seg)).toBe(0);
    expect(pointOnSegSide(50, 150, seg)).toBe(1);
  });

  test('horizontal seg with ldx < 0: below is back (1), above is front (0)', () => {
    const seg = { v1x: 100, v1y: 100, v2x: 0, v2y: 100 };
    expect(pointOnSegSide(50, 50, seg)).toBe(1);
    expect(pointOnSegSide(50, 150, seg)).toBe(0);
  });

  test('general diagonal seg uses FixedMul fallback', () => {
    const seg = { v1x: 0, v1y: 0, v2x: 100 << FRACBITS, v2y: 100 << FRACBITS };
    expect(pointOnSegSide(60 << FRACBITS, 40 << FRACBITS, seg)).toBe(0);
    expect(pointOnSegSide(40 << FRACBITS, 60 << FRACBITS, seg)).toBe(1);
  });

  test('sign-bit quick decision path handles mixed sign operands', () => {
    const seg = { v1x: 0, v1y: 0, v2x: 10, v2y: 10 };
    expect(pointOnSegSide(100, -50, seg)).toBe(0);
    expect(pointOnSegSide(-100, 50, seg)).toBe(1);
  });
});

describe('sortVisSprites (R_SortVisSprites)', () => {
  test('empty pool returns an empty array', () => {
    const pool = createVisSpritePool();
    expect(sortVisSprites(pool)).toEqual([]);
  });

  test('ignores pool slots past pool.count', () => {
    const pool = createVisSpritePool();
    pool.sprites[0]!.scale = 100;
    pool.sprites[1]!.scale = 50;
    pool.sprites[2]!.scale = 999;
    pool.count = 2;
    const sorted = sortVisSprites(pool);
    expect(sorted).toHaveLength(2);
    expect(sorted.map((s) => s.scale)).toEqual([50, 100]);
  });

  test('sorts ascending by scale so index 0 is the farthest sprite', () => {
    const pool = createVisSpritePool();
    pool.sprites[0]!.scale = 300;
    pool.sprites[1]!.scale = 100;
    pool.sprites[2]!.scale = 200;
    pool.count = 3;
    const sorted = sortVisSprites(pool);
    expect(sorted.map((s) => s.scale)).toEqual([100, 200, 300]);
  });

  test('stable sort preserves pool order for equal-scale sprites', () => {
    const pool = createVisSpritePool();
    pool.sprites[0]!.scale = 150;
    pool.sprites[0]!.patch = 0xa;
    pool.sprites[1]!.scale = 150;
    pool.sprites[1]!.patch = 0xb;
    pool.sprites[2]!.scale = 150;
    pool.sprites[2]!.patch = 0xc;
    pool.count = 3;
    const sorted = sortVisSprites(pool);
    expect(sorted.map((s) => s.patch)).toEqual([0xa, 0xb, 0xc]);
  });

  test('result is a fresh array; pool order is not mutated', () => {
    const pool = createVisSpritePool();
    pool.sprites[0]!.scale = 300;
    pool.sprites[1]!.scale = 100;
    pool.count = 2;
    const sorted = sortVisSprites(pool);
    expect(sorted[0]).toBe(pool.sprites[1]!);
    expect(pool.sprites[0]!.scale).toBe(300);
    expect(pool.sprites[1]!.scale).toBe(100);
  });
});

describe('clipVisSprite (R_DrawSprite clip phase)', () => {
  test('with no drawsegs, every column in [x1, x2] gets the default fills', () => {
    const buffers = createSpriteClipBuffers(320);
    const spr = makeVisSprite({ x1: 10, x2: 20 });
    clipVisSprite(spr, { viewHeight: 200, drawsegs: [], renderMaskedSegRange: () => {} }, buffers);
    for (let x = 10; x <= 20; x += 1) {
      expect(buffers.clipBot[x]).toBe(200);
      expect(buffers.clipTop[x]).toBe(CLIP_TOP_DEFAULT);
    }
  });

  test('horizontally disjoint drawseg is ignored', () => {
    const buffers = createSpriteClipBuffers(320);
    const spr = makeVisSprite({ x1: 10, x2: 20, gz: 0, gzt: 100 });
    const topClip = new Int16Array(320).fill(99);
    const ds = makeDrawSeg({
      x1: 50,
      x2: 100,
      silhouette: SIL_TOP,
      sprtopclip: topClip,
      scale1: 5000,
      scale2: 5000,
      tsilheight: 0,
    });
    clipVisSprite(spr, { viewHeight: 200, drawsegs: [ds], renderMaskedSegRange: () => {} }, buffers);
    for (let x = 10; x <= 20; x += 1) {
      expect(buffers.clipTop[x]).toBe(CLIP_TOP_DEFAULT);
    }
  });

  test('drawseg with no silhouette and no masked texture is pure noise', () => {
    const buffers = createSpriteClipBuffers(320);
    const spr = makeVisSprite({ x1: 10, x2: 20 });
    let calls = 0;
    const ds = makeDrawSeg({ x1: 0, x2: 319, silhouette: SIL_NONE, maskedtexturecol: null });
    clipVisSprite(
      spr,
      {
        viewHeight: 200,
        drawsegs: [ds],
        renderMaskedSegRange: () => {
          calls += 1;
        },
      },
      buffers,
    );
    expect(calls).toBe(0);
    for (let x = 10; x <= 20; x += 1) {
      expect(buffers.clipBot[x]).toBe(200);
      expect(buffers.clipTop[x]).toBe(CLIP_TOP_DEFAULT);
    }
  });

  test('SIL_BOTTOM writes sprbottomclip[x] into clipBot[x] inside the overlap', () => {
    const buffers = createSpriteClipBuffers(320);
    const spr = makeVisSprite({ x1: 10, x2: 15, scale: 500, gz: 0, gzt: 100 });
    const botClip = new Int16Array(320);
    for (let x = 0; x < 320; x += 1) botClip[x] = 160 + (x - 10);
    const ds = makeDrawSeg({
      x1: 10,
      x2: 15,
      scale1: 2000,
      scale2: 2000,
      silhouette: SIL_BOTTOM,
      sprbottomclip: botClip,
      bsilheight: 200,
    });
    clipVisSprite(spr, { viewHeight: 200, drawsegs: [ds], renderMaskedSegRange: () => {} }, buffers);
    expect(buffers.clipBot[10]).toBe(160);
    expect(buffers.clipBot[15]).toBe(165);
    expect(buffers.clipTop[10]).toBe(CLIP_TOP_DEFAULT);
  });

  test('SIL_TOP writes sprtopclip[x] into clipTop[x]', () => {
    const buffers = createSpriteClipBuffers(320);
    const spr = makeVisSprite({ x1: 10, x2: 15, scale: 500, gz: 0, gzt: 100 });
    const topClip = new Int16Array(320);
    for (let x = 0; x < 320; x += 1) topClip[x] = 5 + (x - 10);
    const ds = makeDrawSeg({
      x1: 10,
      x2: 15,
      scale1: 2000,
      scale2: 2000,
      silhouette: SIL_TOP,
      sprtopclip: topClip,
      tsilheight: 0,
    });
    clipVisSprite(spr, { viewHeight: 200, drawsegs: [ds], renderMaskedSegRange: () => {} }, buffers);
    expect(buffers.clipTop[10]).toBe(5);
    expect(buffers.clipTop[15]).toBe(10);
    expect(buffers.clipBot[10]).toBe(200);
  });

  test('SIL_BOTH writes both arrays', () => {
    const buffers = createSpriteClipBuffers(320);
    const spr = makeVisSprite({ x1: 10, x2: 12, scale: 500, gz: 0, gzt: 100 });
    const botClip = new Int16Array(320).fill(190);
    const topClip = new Int16Array(320).fill(8);
    const ds = makeDrawSeg({
      x1: 10,
      x2: 12,
      scale1: 2000,
      scale2: 2000,
      silhouette: SIL_BOTH,
      sprbottomclip: botClip,
      sprtopclip: topClip,
      bsilheight: 1000,
      tsilheight: 0,
    });
    clipVisSprite(spr, { viewHeight: 200, drawsegs: [ds], renderMaskedSegRange: () => {} }, buffers);
    for (let x = 10; x <= 12; x += 1) {
      expect(buffers.clipBot[x]).toBe(190);
      expect(buffers.clipTop[x]).toBe(8);
    }
  });

  test('SIL_BOTTOM is dropped when sprGz >= bsilheight (sprite feet above seg bottom)', () => {
    const buffers = createSpriteClipBuffers(320);
    const spr = makeVisSprite({ x1: 10, x2: 12, scale: 500, gz: 200, gzt: 300 });
    const botClip = new Int16Array(320).fill(99);
    const ds = makeDrawSeg({
      x1: 10,
      x2: 12,
      scale1: 2000,
      scale2: 2000,
      silhouette: SIL_BOTTOM,
      sprbottomclip: botClip,
      bsilheight: 200,
    });
    clipVisSprite(spr, { viewHeight: 200, drawsegs: [ds], renderMaskedSegRange: () => {} }, buffers);
    for (let x = 10; x <= 12; x += 1) {
      expect(buffers.clipBot[x]).toBe(200);
    }
  });

  test('SIL_TOP is dropped when sprGzt <= tsilheight (sprite top below seg top)', () => {
    const buffers = createSpriteClipBuffers(320);
    const spr = makeVisSprite({ x1: 10, x2: 12, scale: 500, gz: 0, gzt: 100 });
    const topClip = new Int16Array(320).fill(9);
    const ds = makeDrawSeg({
      x1: 10,
      x2: 12,
      scale1: 2000,
      scale2: 2000,
      silhouette: SIL_TOP,
      sprtopclip: topClip,
      tsilheight: 100,
    });
    clipVisSprite(spr, { viewHeight: 200, drawsegs: [ds], renderMaskedSegRange: () => {} }, buffers);
    for (let x = 10; x <= 12; x += 1) {
      expect(buffers.clipTop[x]).toBe(CLIP_TOP_DEFAULT);
    }
  });

  test('SIL_BOTH reduces to SIL_TOP when only the bottom guard fires', () => {
    const buffers = createSpriteClipBuffers(320);
    const spr = makeVisSprite({ x1: 10, x2: 12, scale: 500, gz: 200, gzt: 300 });
    const botClip = new Int16Array(320).fill(111);
    const topClip = new Int16Array(320).fill(22);
    const ds = makeDrawSeg({
      x1: 10,
      x2: 12,
      scale1: 2000,
      scale2: 2000,
      silhouette: SIL_BOTH,
      sprbottomclip: botClip,
      sprtopclip: topClip,
      bsilheight: 200,
      tsilheight: 0,
    });
    clipVisSprite(spr, { viewHeight: 200, drawsegs: [ds], renderMaskedSegRange: () => {} }, buffers);
    for (let x = 10; x <= 12; x += 1) {
      expect(buffers.clipBot[x]).toBe(200);
      expect(buffers.clipTop[x]).toBe(22);
    }
  });

  test('behind-sprite branch: seg with scale < sprScale triggers renderMaskedSegRange over [r1, r2] and skips silhouette write', () => {
    const buffers = createSpriteClipBuffers(320);
    const spr = makeVisSprite({ x1: 10, x2: 15, scale: 2000, gx: 1000, gy: 0, gzt: 100 });
    const topClip = new Int16Array(320).fill(5);
    const maskedTex = new Int16Array(320);
    const ds = makeDrawSeg({
      x1: 5,
      x2: 20,
      scale1: 500,
      scale2: 500,
      silhouette: SIL_TOP,
      sprtopclip: topClip,
      maskedtexturecol: maskedTex,
      tsilheight: 0,
    });
    const calls: Array<[SpriteClipDrawSeg, number, number]> = [];
    clipVisSprite(
      spr,
      {
        viewHeight: 200,
        drawsegs: [ds],
        renderMaskedSegRange: (seg, x1, x2) => calls.push([seg, x1, x2]),
      },
      buffers,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]![0]).toBe(ds);
    expect(calls[0]![1]).toBe(10);
    expect(calls[0]![2]).toBe(15);
    for (let x = 10; x <= 15; x += 1) {
      expect(buffers.clipTop[x]).toBe(CLIP_TOP_DEFAULT);
    }
  });

  test('behind-sprite branch with no masked texture does not invoke the callback', () => {
    const buffers = createSpriteClipBuffers(320);
    const spr = makeVisSprite({ x1: 10, x2: 15, scale: 2000, gx: 1000, gy: 0, gzt: 100 });
    const topClip = new Int16Array(320).fill(5);
    const ds = makeDrawSeg({
      x1: 5,
      x2: 20,
      scale1: 500,
      scale2: 500,
      silhouette: SIL_TOP,
      sprtopclip: topClip,
      tsilheight: 0,
    });
    let calls = 0;
    clipVisSprite(
      spr,
      {
        viewHeight: 200,
        drawsegs: [ds],
        renderMaskedSegRange: () => {
          calls += 1;
        },
      },
      buffers,
    );
    expect(calls).toBe(0);
    for (let x = 10; x <= 15; x += 1) {
      expect(buffers.clipTop[x]).toBe(CLIP_TOP_DEFAULT);
    }
  });

  test('reverse walk: nearer (last-allocated) drawseg wins per-column clip (first-write-wins)', () => {
    const buffers = createSpriteClipBuffers(320);
    const spr = makeVisSprite({ x1: 10, x2: 15, scale: 500, gz: 0, gzt: 100 });
    const topClipNear = new Int16Array(320).fill(7);
    const topClipFar = new Int16Array(320).fill(99);
    const farSeg = makeDrawSeg({
      x1: 10,
      x2: 15,
      scale1: 2000,
      scale2: 2000,
      silhouette: SIL_TOP,
      sprtopclip: topClipFar,
      tsilheight: 0,
    });
    const nearSeg = makeDrawSeg({
      x1: 10,
      x2: 15,
      scale1: 5000,
      scale2: 5000,
      silhouette: SIL_TOP,
      sprtopclip: topClipNear,
      tsilheight: 0,
    });
    clipVisSprite(
      spr,
      {
        viewHeight: 200,
        drawsegs: [farSeg, nearSeg],
        renderMaskedSegRange: () => {},
      },
      buffers,
    );
    for (let x = 10; x <= 15; x += 1) {
      expect(buffers.clipTop[x]).toBe(7);
    }
  });

  test('partial overlap writes only columns in [r1, r2] and leaves others at default', () => {
    const buffers = createSpriteClipBuffers(320);
    const spr = makeVisSprite({ x1: 10, x2: 20, scale: 500, gz: 0, gzt: 100 });
    const topClip = new Int16Array(320).fill(77);
    const ds = makeDrawSeg({
      x1: 15,
      x2: 30,
      scale1: 2000,
      scale2: 2000,
      silhouette: SIL_TOP,
      sprtopclip: topClip,
      tsilheight: 0,
    });
    clipVisSprite(spr, { viewHeight: 200, drawsegs: [ds], renderMaskedSegRange: () => {} }, buffers);
    for (let x = 10; x <= 14; x += 1) {
      expect(buffers.clipTop[x]).toBe(CLIP_TOP_DEFAULT);
    }
    for (let x = 15; x <= 20; x += 1) {
      expect(buffers.clipTop[x]).toBe(77);
    }
  });

  test('scale picks max(scale1, scale2) regardless of which endpoint is closer', () => {
    const buffers = createSpriteClipBuffers(320);
    const spr = makeVisSprite({ x1: 10, x2: 12, scale: 1500, gx: 0, gy: 10, gz: 0, gzt: 100 });
    const topClip = new Int16Array(320).fill(4);
    const ds = makeDrawSeg({
      x1: 10,
      x2: 12,
      scale1: 500,
      scale2: 2000,
      silhouette: SIL_TOP,
      sprtopclip: topClip,
      tsilheight: 0,
      v1x: 0,
      v1y: 0,
      v2x: 1,
      v2y: 0,
    });
    clipVisSprite(spr, { viewHeight: 200, drawsegs: [ds], renderMaskedSegRange: () => {} }, buffers);
    for (let x = 10; x <= 12; x += 1) {
      expect(buffers.clipTop[x]).toBe(4);
    }
  });

  test('behind-sprite branch also fires when scale >= sprScale but lowscale < sprScale AND sprite is on front side of seg', () => {
    const buffers = createSpriteClipBuffers(320);
    const spr = makeVisSprite({ x1: 10, x2: 15, scale: 1500, gx: 0, gy: -10, gzt: 100 });
    const topClip = new Int16Array(320).fill(5);
    const maskedTex = new Int16Array(320);
    const ds = makeDrawSeg({
      x1: 10,
      x2: 15,
      scale1: 2000,
      scale2: 500,
      silhouette: SIL_TOP,
      sprtopclip: topClip,
      maskedtexturecol: maskedTex,
      tsilheight: 0,
      v1x: 0,
      v1y: 0,
      v2x: 1,
      v2y: 0,
    });
    const calls: Array<[number, number]> = [];
    clipVisSprite(
      spr,
      {
        viewHeight: 200,
        drawsegs: [ds],
        renderMaskedSegRange: (_seg, x1, x2) => calls.push([x1, x2]),
      },
      buffers,
    );
    expect(calls).toEqual([[10, 15]]);
    for (let x = 10; x <= 15; x += 1) {
      expect(buffers.clipTop[x]).toBe(CLIP_TOP_DEFAULT);
    }
  });
});

describe('drawMasked (R_DrawMasked)', () => {
  test('clips and draws sprites back-to-front by scale, then renders remaining masked segs at full range', () => {
    const pool = createVisSpritePool();
    pool.sprites[0]!.scale = 300;
    pool.sprites[0]!.patch = 0xa;
    pool.sprites[0]!.x1 = 10;
    pool.sprites[0]!.x2 = 20;
    pool.sprites[1]!.scale = 100;
    pool.sprites[1]!.patch = 0xb;
    pool.sprites[1]!.x1 = 30;
    pool.sprites[1]!.x2 = 40;
    pool.count = 2;

    const buffers = createSpriteClipBuffers(320);
    const maskedTex = new Int16Array(320);
    const ds = makeDrawSeg({ x1: 50, x2: 100, maskedtexturecol: maskedTex });
    const drawOrder: number[] = [];
    const maskedCalls: Array<[number, number]> = [];

    drawMasked(
      pool,
      {
        viewHeight: 200,
        drawsegs: [ds],
        renderMaskedSegRange: (_seg, x1, x2) => maskedCalls.push([x1, x2]),
        drawVisSprite: (spr) => drawOrder.push(spr.patch),
        viewAngleOffset: 0,
      },
      buffers,
    );

    expect(drawOrder).toEqual([0xb, 0xa]);
    expect(maskedCalls).toEqual([[50, 100]]);
  });

  test('invokes drawPlayerSprites when viewAngleOffset === 0', () => {
    const pool = createVisSpritePool();
    const buffers = createSpriteClipBuffers(320);
    let playerCalls = 0;
    drawMasked(
      pool,
      {
        viewHeight: 200,
        drawsegs: [],
        renderMaskedSegRange: () => {},
        drawVisSprite: () => {},
        viewAngleOffset: 0,
        drawPlayerSprites: () => {
          playerCalls += 1;
        },
      },
      buffers,
    );
    expect(playerCalls).toBe(1);
  });

  test('skips drawPlayerSprites when viewAngleOffset !== 0 (side-view replay)', () => {
    const pool = createVisSpritePool();
    const buffers = createSpriteClipBuffers(320);
    let playerCalls = 0;
    drawMasked(
      pool,
      {
        viewHeight: 200,
        drawsegs: [],
        renderMaskedSegRange: () => {},
        drawVisSprite: () => {},
        viewAngleOffset: 1,
        drawPlayerSprites: () => {
          playerCalls += 1;
        },
      },
      buffers,
    );
    expect(playerCalls).toBe(0);
  });

  test('skips drawPlayerSprites when callback is omitted even at viewAngleOffset === 0', () => {
    const pool = createVisSpritePool();
    const buffers = createSpriteClipBuffers(320);
    expect(() =>
      drawMasked(
        pool,
        {
          viewHeight: 200,
          drawsegs: [],
          renderMaskedSegRange: () => {},
          drawVisSprite: () => {},
          viewAngleOffset: 0,
        },
        buffers,
      ),
    ).not.toThrow();
  });

  test('remaining-masked pass skips drawsegs with no masked texture', () => {
    const pool = createVisSpritePool();
    const buffers = createSpriteClipBuffers(320);
    const ds = makeDrawSeg({ x1: 50, x2: 100, maskedtexturecol: null, silhouette: SIL_BOTH });
    let calls = 0;
    drawMasked(
      pool,
      {
        viewHeight: 200,
        drawsegs: [ds],
        renderMaskedSegRange: () => {
          calls += 1;
        },
        drawVisSprite: () => {},
        viewAngleOffset: 0,
      },
      buffers,
    );
    expect(calls).toBe(0);
  });
});
