/**
 * Increment I4a parity tests for the assembled-renderer `R_AddLine`
 * seg projection + solid/pass classification.
 *
 * The verbatim r_main.c `R_PointToAngle` and the I1 `viewangletox`
 * table are covered by their own suites; this file focuses on the
 * `R_AddLine` control flow (backface cull, frustum clip, pixel
 * reject, solid/pass/skip classification). The rigor bar mirrors
 * I1-I3: targeted geometry-derived classification asserts plus a
 * STRUCTURALLY DISTINCT in-test re-transcription of r_bsp.c
 * `R_AddLine` (different branch ordering / variable layout) checked
 * for full-result equivalence over constructed and deterministic
 * pseudo-random segs.
 */

import { describe, expect, test } from 'bun:test';

import { FRACUNIT } from '../../src/core/fixed.ts';
import { ANG90, ANG180 } from '../../src/core/angle.ts';
import { ANGLETOFINESHIFT } from '../../src/core/trig.ts';

import { DetailMode, computeViewport } from '../../src/render/projection.ts';
import { buildProjectionAngleTables } from '../../src/render/renderInitTables.ts';
import { rPointToAngle } from '../../src/render/wallScaleMath.ts';
import type { AddLineSeg, AddLineSector, AddLineView } from '../../src/render/addLine.ts';
import { addLine } from '../../src/render/addLine.ts';

const u32 = (v: number): number => v >>> 0;

const viewport = computeViewport(11, DetailMode.high);
const angleTables = buildProjectionAngleTables(viewport);

const view: AddLineView = {
  viewx: 0,
  viewy: 0,
  viewangle: 0,
  clipangle: angleTables.clipangle,
  viewangletox: angleTables.viewangletox,
};

// A solid (one-sided) wall directly ahead (+x), wound so its front
// faces the viewer at the origin: v1 on the +y side, v2 on the -y
// side. Subtends a wide angle so the projection is non-degenerate.
const frontsector: AddLineSector = { ceilingheight: 128 * FRACUNIT, floorheight: 0, ceilingpic: 1, floorpic: 2, lightlevel: 160 };
const aheadV1 = { x: 256 * FRACUNIT, y: 96 * FRACUNIT };
const aheadV2 = { x: 256 * FRACUNIT, y: -96 * FRACUNIT };

// ---------------------------------------------------------------------------
// Structurally distinct re-transcription of r_bsp.c R_AddLine.
// ---------------------------------------------------------------------------

function reDeriveAddLine(line: AddLineSeg, front: AddLineSector, v: AddLineView) {
  const ca = v.clipangle;
  const two = u32(2 * ca);
  let a1 = rPointToAngle(v.viewx, v.viewy, line.v1.x, line.v1.y);
  let a2 = rPointToAngle(v.viewx, v.viewy, line.v2.x, line.v2.y);
  const sp = u32(a1 - a2);
  if (sp >= ANG180) {
    return null;
  }
  const keepAngle1 = a1;
  a1 = u32(a1 - v.viewangle);
  a2 = u32(a2 - v.viewangle);
  let ts = u32(a1 + ca);
  if (ts > two) {
    ts = u32(ts - two);
    if (ts >= sp) {
      return null;
    }
    a1 = ca;
  }
  ts = u32(ca - a2);
  if (ts > two) {
    ts = u32(ts - two);
    if (ts >= sp) {
      return null;
    }
    a2 = u32(-ca);
  }
  const ix1 = v.viewangletox[u32(a1 + ANG90) >>> ANGLETOFINESHIFT]!;
  const ix2 = v.viewangletox[u32(a2 + ANG90) >>> ANGLETOFINESHIFT]!;
  if (ix1 === ix2) {
    return null;
  }
  const dispatch = (kind: 'solid' | 'pass') => ({ kind, x1: ix1, last: ix2 - 1, rwAngle1: keepAngle1 });
  const bs = line.backsector;
  if (!bs) {
    return dispatch('solid');
  }
  if (bs.ceilingheight <= front.floorheight || bs.floorheight >= front.ceilingheight) {
    return dispatch('solid');
  }
  if (bs.ceilingheight !== front.ceilingheight || bs.floorheight !== front.floorheight) {
    return dispatch('pass');
  }
  if (bs.ceilingpic === front.ceilingpic && bs.floorpic === front.floorpic && bs.lightlevel === front.lightlevel && line.sidedefMidtexture === 0) {
    return null;
  }
  return dispatch('pass');
}

function expectParity(line: AddLineSeg, front: AddLineSector, v: AddLineView): void {
  expect(addLine(line, front, v)).toEqual(reDeriveAddLine(line, front, v));
}

describe('R_AddLine — classification', () => {
  test('a front-facing one-sided seg is solid with x1 < x2 (last = x2-1)', () => {
    const seg: AddLineSeg = { v1: aheadV1, v2: aheadV2, backsector: null, sidedefMidtexture: 0 };
    const r = addLine(seg, frontsector, view);
    expect(r).not.toBeNull();
    expect(r!.kind).toBe('solid');
    expect(r!.last).toBe(reDeriveAddLine(seg, frontsector, view)!.last);
    expect(r!.x1).toBeLessThanOrEqual(r!.last + 1);
    // rw_angle1 is the pre-viewangle angle to v1.
    expect(r!.rwAngle1).toBe(rPointToAngle(0, 0, aheadV1.x, aheadV1.y));
    expectParity(seg, frontsector, view);
  });

  test('the same seg wound backwards is back-facing and rejected', () => {
    const seg: AddLineSeg = { v1: aheadV2, v2: aheadV1, backsector: null, sidedefMidtexture: 0 };
    // span = angle1 - angle2 >= ANG180 → culled.
    expect(addLine(seg, frontsector, view)).toBeNull();
    expectParity(seg, frontsector, view);
  });

  test('a closed door (back ceiling <= front floor) is solid', () => {
    const back: AddLineSector = { ceilingheight: -8 * FRACUNIT, floorheight: -16 * FRACUNIT, ceilingpic: 3, floorpic: 4, lightlevel: 100 };
    const seg: AddLineSeg = { v1: aheadV1, v2: aheadV2, backsector: back, sidedefMidtexture: 0 };
    expect(addLine(seg, frontsector, view)!.kind).toBe('solid');
    expectParity(seg, frontsector, view);
  });

  test('a window (differing ceiling/floor) is a pass seg', () => {
    const back: AddLineSector = { ceilingheight: 96 * FRACUNIT, floorheight: 16 * FRACUNIT, ceilingpic: 1, floorpic: 2, lightlevel: 160 };
    const seg: AddLineSeg = { v1: aheadV1, v2: aheadV2, backsector: back, sidedefMidtexture: 0 };
    expect(addLine(seg, frontsector, view)!.kind).toBe('pass');
    expectParity(seg, frontsector, view);
  });

  test('an empty trigger line (identical sectors, no midtexture) is rejected', () => {
    const back: AddLineSector = { ...frontsector };
    const seg: AddLineSeg = { v1: aheadV1, v2: aheadV2, backsector: back, sidedefMidtexture: 0 };
    expect(addLine(seg, frontsector, view)).toBeNull();
    expectParity(seg, frontsector, view);
  });

  test('identical sectors WITH a midtexture is a pass seg (not rejected)', () => {
    const back: AddLineSector = { ...frontsector };
    const seg: AddLineSeg = { v1: aheadV1, v2: aheadV2, backsector: back, sidedefMidtexture: 12 };
    expect(addLine(seg, frontsector, view)!.kind).toBe('pass');
    expectParity(seg, frontsector, view);
  });

  test('a seg entirely off the right edge is rejected', () => {
    // Far behind / to the left of the viewer facing +x.
    const seg: AddLineSeg = { v1: { x: -256 * FRACUNIT, y: -8 * FRACUNIT }, v2: { x: -256 * FRACUNIT, y: 8 * FRACUNIT }, backsector: null, sidedefMidtexture: 0 };
    expect(addLine(seg, frontsector, view)).toBeNull();
    expectParity(seg, frontsector, view);
  });
});

describe('R_AddLine — independent re-transcription differential', () => {
  test('matches the oracle over a deterministic pseudo-random seg battery', () => {
    let seed = 0x2468_ace0 >>> 0;
    const rnd = (n: number): number => {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      return seed % n;
    };
    const coord = (): number => (rnd(4096) - 2048) * FRACUNIT;

    for (let i = 0; i < 500; i += 1) {
      const twoSided = rnd(2) === 0;
      const back: AddLineSector | null = twoSided
        ? {
            ceilingheight: (rnd(8) - 1) * 32 * FRACUNIT,
            floorheight: (rnd(4) - 1) * 32 * FRACUNIT,
            ceilingpic: rnd(3),
            floorpic: rnd(3),
            lightlevel: rnd(2) === 0 ? 160 : 96,
          }
        : null;
      const seg: AddLineSeg = {
        v1: { x: coord(), y: coord() },
        v2: { x: coord(), y: coord() },
        backsector: back,
        sidedefMidtexture: rnd(2),
      };
      const front: AddLineSector = { ceilingheight: 160 * FRACUNIT, floorheight: 0, ceilingpic: 0, floorpic: 0, lightlevel: 160 };
      const v: AddLineView = { ...view, viewangle: u32(rnd(8) * 0x2000_0000) };
      expect(addLine(seg, front, v)).toEqual(reDeriveAddLine(seg, front, v));
    }
  });
});
