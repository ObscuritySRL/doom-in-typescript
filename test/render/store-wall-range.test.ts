/**
 * Increment I2 parity tests for the assembled-renderer
 * `R_StoreWallRange` per-seg coordinator.
 *
 * The verbatim r_main.c primitives (`R_PointToAngle` /
 * `R_PointToDist` / `R_ScaleFromGlobalAngle`) live in
 * `src/render/wallScaleMath.ts` and are exercised by
 * `test/render/wall-scale-math.test.ts`; this file consumes them and
 * focuses on the unique coordinator. The rigor bar mirrors the I1
 * pattern: alongside shape / invariant / determinism checks, the full
 * `R_StoreWallRange` parameter set is checked against a STRUCTURALLY
 * DISTINCT in-test re-transcription of r_segs.c (different statement
 * ordering / variable layout) so a transcription error in
 * `storeWallRange.ts` diverges from the oracle, plus exact
 * hand-computable scalars.
 */

import { describe, expect, test } from 'bun:test';

import { FRACBITS, FRACUNIT, fixedMul } from '../../src/core/fixed.ts';
import { ANG45, ANG90, ANG180 } from '../../src/core/angle.ts';
import { ANGLETOFINESHIFT, finesine, finetangent } from '../../src/core/trig.ts';

import { ML_DONTPEGBOTTOM, ML_DONTPEGTOP } from '../../src/map/lineSectorGeometry.ts';
import { DetailMode, LIGHTLEVELS, LIGHTSEGSHIFT, computeViewport } from '../../src/render/projection.ts';
import { SIL_BOTH, SIL_BOTTOM, SIL_NONE, SIL_TOP } from '../../src/render/spriteClip.ts';
import { buildProjectionAngleTables } from '../../src/render/renderInitTables.ts';
import { rPointToAngle, rPointToDist, rScaleFromGlobalAngle } from '../../src/render/wallScaleMath.ts';
import type { StoreWallRangeSeg, StoreWallRangeView } from '../../src/render/storeWallRange.ts';
import { storeWallRange } from '../../src/render/storeWallRange.ts';

const u32 = (v: number): number => v >>> 0;
const i32 = (v: number): number => v | 0;

// A viewport from the already-verified I1 builders. setBlocks 11 /
// high detail is the full-screen vanilla gameplay viewport.
const viewport = computeViewport(11, DetailMode.high);
const angleTables = buildProjectionAngleTables(viewport);

// ---------------------------------------------------------------------------
// Structurally distinct in-test re-transcription of r_segs.c
// R_StoreWallRange (parameter portion). Different statement ordering and
// variable grouping than storeWallRange.ts so a transcription bug in the
// implementation diverges from this oracle. The verbatim r_main.c
// primitives are reused from wallScaleMath.ts (single source of truth).
// ---------------------------------------------------------------------------

function reDeriveStoreWallRange(seg: StoreWallRangeSeg, view: StoreWallRangeView) {
  const front = seg.frontsector;
  const back = seg.backsector;

  const rwNormalangle = u32(seg.curlineAngle + ANG90);

  let oa = Math.abs(i32(rwNormalangle - seg.rwAngle1));
  if (oa > ANG90) {
    oa = ANG90;
  }
  const distangle = u32(ANG90 - oa);
  const hyp = rPointToDist(view.viewx, view.viewy, seg.v1.x, seg.v1.y);
  const rwDistance = fixedMul(hyp, finesine[distangle >>> ANGLETOFINESHIFT]!);

  const sg = (col: number): number => rScaleFromGlobalAngle(u32(view.viewangle + view.xtoviewangle[col]!), view.viewangle, rwNormalangle, rwDistance, view.projection, view.detailshift);
  const scale1 = sg(seg.start);
  const scale2 = seg.stop > seg.start ? sg(seg.stop) : scale1;
  const rwScalestep = seg.stop > seg.start ? i32((scale2 - scale1) / (seg.stop - seg.start)) : 0;

  let worldtop = i32(front.ceilingheight - view.viewz);
  const worldbottom = i32(front.floorheight - view.viewz);
  let worldhigh: number | null = null;
  let worldlow: number | null = null;

  let mid = 0;
  let top = 0;
  let bot = 0;
  let masked = false;
  let mFloor = false;
  let mCeil = false;
  let midMid = 0;
  let topMid = 0;
  let botMid = 0;
  let sil = SIL_NONE as number;
  let bsil = 0;
  let tsil = 0;
  let sprTop: 'screenheight' | null = null;
  let sprBot: 'negone' | null = null;
  const INT_MAX = 0x7fff_ffff;
  const INT_MIN = -0x8000_0000;

  if (!back) {
    mid = seg.sidedef.midtexture; // identity texturetranslation
    mFloor = true;
    mCeil = true;
    midMid = seg.linedefFlags & ML_DONTPEGBOTTOM ? i32(i32(front.floorheight + 0) - view.viewz) : worldtop;
    midMid = i32(midMid + seg.sidedef.rowoffset);
    sil = SIL_BOTH;
    sprTop = 'screenheight';
    sprBot = 'negone';
    bsil = INT_MAX;
    tsil = INT_MIN;
  } else {
    if (front.floorheight > back.floorheight) {
      sil = SIL_BOTTOM;
      bsil = front.floorheight;
    } else if (back.floorheight > view.viewz) {
      sil = SIL_BOTTOM;
      bsil = INT_MAX;
    }
    if (front.ceilingheight < back.ceilingheight) {
      sil |= SIL_TOP;
      tsil = front.ceilingheight;
    } else if (back.ceilingheight < view.viewz) {
      sil |= SIL_TOP;
      tsil = INT_MIN;
    }
    if (back.ceilingheight <= front.floorheight) {
      sprBot = 'negone';
      bsil = INT_MAX;
      sil |= SIL_BOTTOM;
    }
    if (back.floorheight >= front.ceilingheight) {
      sprTop = 'screenheight';
      tsil = INT_MIN;
      sil |= SIL_TOP;
    }
    worldhigh = i32(back.ceilingheight - view.viewz);
    worldlow = i32(back.floorheight - view.viewz);
    if (front.ceilingpic === view.skyflatnum && back.ceilingpic === view.skyflatnum) {
      worldtop = worldhigh;
    }
    mFloor = worldlow !== worldbottom || back.floorpic !== front.floorpic || back.lightlevel !== front.lightlevel;
    mCeil = worldhigh !== worldtop || back.ceilingpic !== front.ceilingpic || back.lightlevel !== front.lightlevel;
    if (back.ceilingheight <= front.floorheight || back.floorheight >= front.ceilingheight) {
      mCeil = true;
      mFloor = true;
    }
    if (worldhigh < worldtop) {
      top = seg.sidedef.toptexture;
      topMid = seg.linedefFlags & ML_DONTPEGTOP ? worldtop : i32(i32(back.ceilingheight + 0) - view.viewz);
    }
    if (worldlow > worldbottom) {
      bot = seg.sidedef.bottomtexture;
      botMid = seg.linedefFlags & ML_DONTPEGBOTTOM ? worldtop : worldlow;
    }
    topMid = i32(topMid + seg.sidedef.rowoffset);
    botMid = i32(botMid + seg.sidedef.rowoffset);
    if (seg.sidedef.midtexture) {
      masked = true;
    }
  }

  const segtextured = (mid | top | bot | (masked ? 1 : 0)) !== 0;

  let rwOffset = 0;
  let rwCenterangle = 0;
  let lightnum: number | null = null;
  let wallLightsIndex: number | null = null;
  if (segtextured) {
    let off = u32(rwNormalangle - seg.rwAngle1);
    if (off > ANG180) {
      off = u32(-off);
    }
    if (off > ANG90) {
      off = ANG90;
    }
    rwOffset = fixedMul(hyp, finesine[off >>> ANGLETOFINESHIFT]!);
    if (u32(rwNormalangle - seg.rwAngle1) < ANG180) {
      rwOffset = i32(-rwOffset);
    }
    rwOffset = i32(rwOffset + i32(seg.sidedef.textureoffset + seg.curlineOffset));
    rwCenterangle = u32(ANG90 + view.viewangle - rwNormalangle);
    if (!view.fixedColormap) {
      let ln = i32((front.lightlevel >> LIGHTSEGSHIFT) + view.extralight);
      if (seg.v1.y === seg.v2.y) {
        ln -= 1;
      } else if (seg.v1.x === seg.v2.x) {
        ln += 1;
      }
      lightnum = ln;
      wallLightsIndex = ln < 0 ? 0 : ln >= LIGHTLEVELS ? LIGHTLEVELS - 1 : ln;
    }
  }

  if (front.floorheight >= view.viewz) {
    mFloor = false;
  }
  if (front.ceilingheight <= view.viewz && front.ceilingpic !== view.skyflatnum) {
    mCeil = false;
  }

  const cy = view.centeryfrac >> 4;
  const wt4 = worldtop >> 4;
  const wb4 = worldbottom >> 4;
  const topStep = i32(-fixedMul(rwScalestep, wt4));
  const topFrac = i32(cy - fixedMul(wt4, scale1));
  const bottomStep = i32(-fixedMul(rwScalestep, wb4));
  const bottomFrac = i32(cy - fixedMul(wb4, scale1));

  let pixhigh: number | null = null;
  let pixhighstep: number | null = null;
  let pixlow: number | null = null;
  let pixlowstep: number | null = null;
  if (back) {
    const wh4 = (worldhigh as number) >> 4;
    const wl4 = (worldlow as number) >> 4;
    if (wh4 < wt4) {
      pixhigh = i32(cy - fixedMul(wh4, scale1));
      pixhighstep = i32(-fixedMul(rwScalestep, wh4));
    }
    if (wl4 > wb4) {
      pixlow = i32(cy - fixedMul(wl4, scale1));
      pixlowstep = i32(-fixedMul(rwScalestep, wl4));
    }
  }

  return {
    rwX: seg.start,
    rwStopX: seg.stop + 1,
    rwNormalangle,
    rwDistance,
    rwOffset,
    rwCenterangle,
    rwScale: scale1,
    rwScalestep,
    scale1,
    scale2,
    // vanilla `worldtop` is a single mutable local — the outdoor sky
    // hack rewrites it to worldhigh in place; expose the tracked value.
    worldtop,
    worldbottom,
    worldhigh,
    worldlow,
    midTexture: mid,
    topTexture: top,
    bottomTexture: bot,
    maskedTexture: masked,
    segtextured,
    rwMidtexturemid: midMid,
    rwToptexturemid: topMid,
    rwBottomtexturemid: botMid,
    markFloor: mFloor,
    markCeiling: mCeil,
    silhouette: sil,
    bsilheight: bsil,
    tsilheight: tsil,
    sprTopClip: sprTop,
    sprBottomClip: sprBot,
    topFrac,
    topStep,
    bottomFrac,
    bottomStep,
    pixhigh,
    pixhighstep,
    pixlow,
    pixlowstep,
    lightnum,
    wallLightsIndex,
  };
}

function baseView(overrides: Partial<StoreWallRangeView> = {}): StoreWallRangeView {
  return {
    viewx: 0,
    viewy: 0,
    viewz: 0,
    viewangle: 0,
    extralight: 0,
    skyflatnum: 9999,
    fixedColormap: false,
    centeryfrac: viewport.centerYFrac,
    projection: viewport.projection,
    detailshift: viewport.detailShift,
    xtoviewangle: angleTables.xtoviewangle,
    ...overrides,
  };
}

function assertParity(seg: StoreWallRangeSeg, view: StoreWallRangeView): void {
  const got = storeWallRange(seg, view);
  const want = reDeriveStoreWallRange(seg, view);
  const { textureColumnFor, ...gotScalars } = got;
  expect(gotScalars).toEqual(want);
  // textureColumnFor matches the verbatim R_RenderSegLoop formula.
  for (let x = seg.start; x <= seg.stop; x += 1) {
    const angle = u32(got.rwCenterangle + view.xtoviewangle[x]!) >>> ANGLETOFINESHIFT;
    const expected = i32(got.rwOffset - fixedMul(finetangent[angle]!, got.rwDistance)) >> FRACBITS;
    expect(textureColumnFor(x)).toBe(expected);
  }
}

describe('R_StoreWallRange — single-sided seg', () => {
  const seg: StoreWallRangeSeg = {
    start: 40,
    stop: 120,
    curlineAngle: ANG90,
    curlineOffset: 0,
    v1: { x: 256 * FRACUNIT, y: -64 * FRACUNIT },
    v2: { x: 256 * FRACUNIT, y: 64 * FRACUNIT },
    linedefFlags: 0,
    sidedef: { midtexture: 5, toptexture: 0, bottomtexture: 0, textureoffset: 8 * FRACUNIT, rowoffset: 0 },
    frontsector: { ceilingheight: 128 * FRACUNIT, floorheight: 0, ceilingpic: 1, floorpic: 2, lightlevel: 160 },
    backsector: null,
    rwAngle1: rPointToAngle(0, 0, 256 * FRACUNIT, -64 * FRACUNIT),
  };

  test('full parameter set matches the independent re-transcription', () => {
    assertParity(seg, baseView({ viewz: 41 * FRACUNIT }));
  });

  test('hand-computable scalars are exact', () => {
    const r = storeWallRange(seg, baseView({ viewz: 41 * FRACUNIT }));
    expect(r.rwX).toBe(40);
    expect(r.rwStopX).toBe(121);
    expect(r.rwNormalangle).toBe(u32(ANG90 + ANG90)); // curlineAngle + ANG90
    // one-sided line is terminal: it marks both ends, and front floor
    // (0) < viewz (41<<16) and front ceiling (128<<16) > viewz so the
    // wrong-side-of-viewplane clears do NOT fire.
    expect(r.markFloor).toBe(true);
    expect(r.markCeiling).toBe(true);
    expect(r.silhouette).toBe(SIL_BOTH);
    expect(r.maskedTexture).toBe(false);
    expect(r.segtextured).toBe(true);
    expect(r.midTexture).toBe(5);
    expect(r.worldtop).toBe(i32(128 * FRACUNIT - 41 * FRACUNIT));
    expect(r.worldbottom).toBe(i32(0 - 41 * FRACUNIT));
    expect(r.worldhigh).toBeNull();
    expect(r.pixhigh).toBeNull();
  });

  test('floor mark clears when the front floor is at/above the view plane', () => {
    // viewz == floorheight (0) → frontsector->floorheight >= viewz →
    // markfloor forced false even though the seg is single-sided.
    const r = storeWallRange(seg, baseView({ viewz: 0 }));
    expect(r.markFloor).toBe(false);
    expect(r.markCeiling).toBe(true);
  });

  test('ML_DONTPEGBOTTOM changes rw_midtexturemid', () => {
    const pegged = storeWallRange({ ...seg, linedefFlags: ML_DONTPEGBOTTOM }, baseView({ viewz: 41 * FRACUNIT }));
    const unpegged = storeWallRange(seg, baseView({ viewz: 41 * FRACUNIT }));
    expect(pegged.rwMidtexturemid).not.toBe(unpegged.rwMidtexturemid);
  });

  test('deterministic', () => {
    const v = baseView({ viewz: 41 * FRACUNIT });
    const a = storeWallRange(seg, v);
    const b = storeWallRange(seg, v);
    const { textureColumnFor: fa, ...sa } = a;
    const { textureColumnFor: fb, ...sb } = b;
    expect(sa).toEqual(sb);
    expect(fa(80)).toBe(fb(80));
  });
});

describe('R_StoreWallRange — two-sided seg', () => {
  const seg: StoreWallRangeSeg = {
    start: 10,
    stop: 90,
    curlineAngle: ANG45,
    curlineOffset: 16 * FRACUNIT,
    v1: { x: 320 * FRACUNIT, y: -96 * FRACUNIT },
    v2: { x: 384 * FRACUNIT, y: 32 * FRACUNIT },
    linedefFlags: ML_DONTPEGTOP,
    sidedef: { midtexture: 0, toptexture: 7, bottomtexture: 9, textureoffset: 0, rowoffset: 4 * FRACUNIT },
    frontsector: { ceilingheight: 192 * FRACUNIT, floorheight: 0, ceilingpic: 3, floorpic: 4, lightlevel: 192 },
    backsector: { ceilingheight: 96 * FRACUNIT, floorheight: 48 * FRACUNIT, ceilingpic: 3, floorpic: 6, lightlevel: 128 },
    rwAngle1: rPointToAngle(0, 0, 320 * FRACUNIT, -96 * FRACUNIT),
  };

  test('full parameter set matches the independent re-transcription', () => {
    assertParity(seg, baseView({ viewz: 41 * FRACUNIT }));
  });

  test('window seg exposes top and bottom textures and steps', () => {
    const r = storeWallRange(seg, baseView({ viewz: 41 * FRACUNIT }));
    // back ceiling (96) < front ceiling (192) → top texture; back
    // floor (48) > front floor (0) → bottom texture.
    expect(r.topTexture).toBe(7);
    expect(r.bottomTexture).toBe(9);
    expect(r.worldhigh).toBe(i32(96 * FRACUNIT - 41 * FRACUNIT));
    expect(r.worldlow).toBe(i32(48 * FRACUNIT - 41 * FRACUNIT));
    expect(r.pixhigh).not.toBeNull();
    expect(r.pixlow).not.toBeNull();
    // worldhigh(55<<16) < worldtop(151<<16) and worldlow(7<<16) >
    // worldbottom(-41<<16), so both pix accumulators populate.
    expect(r.pixhighstep).not.toBeNull();
    expect(r.pixlowstep).not.toBeNull();
    expect(r.markCeiling).toBe(true); // ceilingpic equal but lightlevel differs
    expect(r.markFloor).toBe(true);
  });

  test('sky hack: matching sky ceilings raise worldtop to worldhigh', () => {
    const skySeg: StoreWallRangeSeg = {
      ...seg,
      frontsector: { ...seg.frontsector, ceilingpic: 77 },
      backsector: { ...seg.backsector!, ceilingpic: 77 },
    };
    const view = baseView({ viewz: 41 * FRACUNIT, skyflatnum: 77 });
    assertParity(skySeg, view);
    const r = storeWallRange(skySeg, view);
    // worldtop was raised to worldhigh, so worldhigh === worldtop and
    // (absent pic/light diffs) the markceiling test sees them equal.
    expect(r.worldhigh).toBe(i32(96 * FRACUNIT - 41 * FRACUNIT));
  });

  test('fixed colormap suppresses the light-table selection', () => {
    const r = storeWallRange(seg, baseView({ viewz: 41 * FRACUNIT, fixedColormap: true }));
    expect(r.lightnum).toBeNull();
    expect(r.wallLightsIndex).toBeNull();
    expect(r.segtextured).toBe(true);
  });
});
