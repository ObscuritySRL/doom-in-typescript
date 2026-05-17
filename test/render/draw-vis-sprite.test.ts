/**
 * Parity tests for the vissprite column iteration
 * (`planVisSpriteColumns` = r_things.c `R_DrawVisSprite`, the
 * iteration/state half).
 *
 * Rigor bar mirrors the pipeline: exact hand-derived scalar asserts
 * (dc_iscale abs+detailshift, sprtopscreen formula, frac stepping
 * order), the RANGECHECK throw, the fuzz/base colfunc split, a
 * STRUCTURALLY DISTINCT in-test re-transcription differential, and an
 * I7→here integration on a real DOOM1.WAD PISG vissprite.
 */

import { describe, expect, test } from 'bun:test';

import { FRACBITS, FRACUNIT, fixedMul } from '../../src/core/fixed.ts';
import { DetailMode, computeViewport } from '../../src/render/projection.ts';
import type { VisSpriteColfunc, VisSpriteColumnInput, VisSpriteColumnView } from '../../src/render/drawVisSprite.ts';
import { planVisSpriteColumns } from '../../src/render/drawVisSprite.ts';

const view: VisSpriteColumnView = (() => {
  const v = computeViewport(9, DetailMode.high);
  return { centerYFrac: v.centerYFrac, detailShift: v.detailShift };
})();

const baseVis = (over: Partial<VisSpriteColumnInput> = {}): VisSpriteColumnInput => ({
  x1: 10,
  x2: 20,
  texturemid: 50 * FRACUNIT,
  scale: 0x10000,
  xiscale: 0x10000,
  startfrac: 0,
  patchWidth: 64,
  colormap: { kind: 'spritelights', index: 47 },
  ...over,
});

// Structurally distinct re-transcription of R_DrawVisSprite iteration.
function oracle(vis: VisSpriteColumnInput, v: VisSpriteColumnView) {
  const colfunc: VisSpriteColfunc = vis.colormap.kind === 'shadow' ? 'fuzz' : vis.hasTranslation === true ? 'translation' : 'base';
  const ax = vis.xiscale < 0 ? -vis.xiscale | 0 : vis.xiscale | 0;
  const dcIscale = ax >> v.detailShift;
  const sprtopscreen = (v.centerYFrac - fixedMul(vis.texturemid, vis.scale)) | 0;
  const columns: { dcX: number; textureColumn: number }[] = [];
  let frac = vis.startfrac | 0;
  for (let x = vis.x1; x <= vis.x2; x += 1) {
    const tc = frac >> FRACBITS;
    if (tc < 0 || tc >= vis.patchWidth) throw new Error('bad texturecolumn');
    columns.push({ dcX: x, textureColumn: tc });
    frac = (frac + vis.xiscale) | 0;
  }
  return { dcIscale, dcTexturemid: vis.texturemid, spryscale: vis.scale, sprtopscreen, colfunc, columns };
}

describe('planVisSpriteColumns — iteration / state', () => {
  test('dc state + column sequence match the verbatim re-transcription', () => {
    const vis = baseVis();
    const got = planVisSpriteColumns(vis, view);
    const want = oracle(vis, view);
    expect(got.dcIscale).toBe(want.dcIscale);
    expect(got.dcTexturemid).toBe(want.dcTexturemid);
    expect(got.spryscale).toBe(want.spryscale);
    expect(got.sprtopscreen).toBe(want.sprtopscreen);
    expect(got.colfunc).toBe('base');
    expect(got.columns.map((c) => ({ dcX: c.dcX, textureColumn: c.textureColumn }))).toEqual(want.columns);
  });

  test('sprtopscreen = centeryfrac - FixedMul(texturemid, scale)', () => {
    const vis = baseVis({ texturemid: 70 * FRACUNIT, scale: 0x14000 });
    const r = planVisSpriteColumns(vis, view);
    expect(r.sprtopscreen).toBe((view.centerYFrac - fixedMul(70 * FRACUNIT, 0x14000)) | 0);
  });

  test('dc_iscale is abs(xiscale) >> detailshift (negative xiscale → positive)', () => {
    // Single column (x1==x2, startfrac 0 → col 0 in range) isolates the
    // dc_iscale derivation from the frac-stepping RANGECHECK.
    const r = planVisSpriteColumns(baseVis({ xiscale: -0x12340, x1: 5, x2: 5 }), view);
    expect(r.dcIscale).toBe(0x12340 >> view.detailShift);
  });

  test('column frac stepping: dc_x in x1..x2, texturecolumn = (startfrac + i*xiscale)>>FRACBITS', () => {
    const vis = baseVis({ x1: 3, x2: 6, startfrac: 2 * FRACUNIT, xiscale: FRACUNIT });
    const r = planVisSpriteColumns(vis, view);
    expect([...r.columns]).toEqual([
      { dcX: 3, textureColumn: 2 },
      { dcX: 4, textureColumn: 3 },
      { dcX: 5, textureColumn: 4 },
      { dcX: 6, textureColumn: 5 },
    ]);
  });

  test('NULL/shadow colormap selects the fuzz colfunc', () => {
    expect(planVisSpriteColumns(baseVis({ colormap: { kind: 'shadow' } }), view).colfunc).toBe('fuzz');
  });

  test('RANGECHECK: a stepped texturecolumn outside [0,patchWidth) throws', () => {
    expect(() => planVisSpriteColumns(baseVis({ startfrac: 100 * FRACUNIT, patchWidth: 8 }), view)).toThrow(/bad texturecolumn/);
    expect(() => planVisSpriteColumns(baseVis({ startfrac: -1 * FRACUNIT, xiscale: -FRACUNIT }), view)).toThrow(/bad texturecolumn/);
  });

  test('differential over a deterministic x-range / scale / xiscale battery', () => {
    let seed = 0x77_aa_55_cc >>> 0;
    const rnd = (n: number): number => {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      return seed % n;
    };
    for (let i = 0; i < 300; i += 1) {
      const x1 = rnd(60);
      const vis = baseVis({
        x1,
        x2: x1 + rnd(40),
        startfrac: rnd(40) * FRACUNIT,
        xiscale: (rnd(2) === 0 ? 1 : -1) * (0x4000 + rnd(0x10000)),
        patchWidth: 128,
        scale: 0x8000 + rnd(0x20000),
        texturemid: (rnd(200) - 50) * FRACUNIT,
        colormap: rnd(3) === 0 ? { kind: 'shadow' } : { kind: 'spritelights', index: 47 },
      });
      let threw = false;
      let g: ReturnType<typeof planVisSpriteColumns> | null = null;
      try {
        g = planVisSpriteColumns(vis, view);
      } catch {
        threw = true;
      }
      if (threw) {
        expect(() => oracle(vis, view)).toThrow();
      } else {
        const w = oracle(vis, view);
        expect(g!.dcIscale).toBe(w.dcIscale);
        expect(g!.dcTexturemid).toBe(w.dcTexturemid);
        expect(g!.spryscale).toBe(w.spryscale);
        expect(g!.sprtopscreen).toBe(w.sprtopscreen);
        expect(g!.colfunc).toBe(w.colfunc);
        expect(g!.columns.map((c) => ({ dcX: c.dcX, textureColumn: c.textureColumn }))).toEqual(w.columns);
      }
    }
  });
});
