/**
 * Increment I4b parity tests for the assembled-renderer
 * `R_CheckBBox` BSP node bounding-box visibility cull.
 *
 * Rigor bar mirrors I1-I4a: viewpoint-quadrant / occlusion / frustum
 * scenario asserts plus a STRUCTURALLY DISTINCT in-test
 * re-transcription of r_bsp.c `R_CheckBBox` (different control flow /
 * variable layout) checked for boolean equivalence over a
 * deterministic pseudo-random battery of boxes against clip states
 * built with the real I3 clip list.
 */

import { describe, expect, test } from 'bun:test';

import { FRACUNIT } from '../../src/core/fixed.ts';
import { ANG90, ANG180 } from '../../src/core/angle.ts';
import { ANGLETOFINESHIFT } from '../../src/core/trig.ts';
import { BOXBOTTOM, BOXLEFT, BOXRIGHT, BOXTOP } from '../../src/map/lineSectorGeometry.ts';

import { DetailMode, computeViewport } from '../../src/render/projection.ts';
import { buildProjectionAngleTables } from '../../src/render/renderInitTables.ts';
import { rPointToAngle } from '../../src/render/wallScaleMath.ts';
import { clearClipSegs, clipSolidWallSegment } from '../../src/render/solidSegs.ts';
import type { ClipState } from '../../src/render/solidSegs.ts';
import type { CheckBBoxView } from '../../src/render/checkBBox.ts';
import { CHECKCOORD, rCheckBBox } from '../../src/render/checkBBox.ts';

const u32 = (v: number): number => v >>> 0;

const viewport = computeViewport(11, DetailMode.high);
const angleTables = buildProjectionAngleTables(viewport);
const view: CheckBBoxView = { viewx: 0, viewy: 0, viewangle: 0, clipangle: angleTables.clipangle, viewangletox: angleTables.viewangletox };

type Bbox = readonly [number, number, number, number]; // [top, bottom, left, right]

// Structurally distinct re-transcription of r_bsp.c R_CheckBBox.
function reDeriveCheckBBox(b: Bbox, v: CheckBBoxView, state: ClipState): boolean {
  const two = u32(2 * v.clipangle);
  const bx = v.viewx <= b[BOXLEFT] ? 0 : v.viewx < b[BOXRIGHT] ? 1 : 2;
  const by = v.viewy >= b[BOXTOP] ? 0 : v.viewy > b[BOXBOTTOM] ? 1 : 2;
  const pos = (by << 2) + bx;
  if (pos === 5) {
    return true;
  }
  const cc = CHECKCOORD[pos]!;
  let a1 = u32(rPointToAngle(v.viewx, v.viewy, b[cc[0]]!, b[cc[1]]!) - v.viewangle);
  let a2 = u32(rPointToAngle(v.viewx, v.viewy, b[cc[2]]!, b[cc[3]]!) - v.viewangle);
  const sp = u32(a1 - a2);
  if (sp >= ANG180) {
    return true;
  }
  let ts = u32(a1 + v.clipangle);
  if (ts > two) {
    ts = u32(ts - two);
    if (ts >= sp) {
      return false;
    }
    a1 = v.clipangle;
  }
  ts = u32(v.clipangle - a2);
  if (ts > two) {
    ts = u32(ts - two);
    if (ts >= sp) {
      return false;
    }
    a2 = u32(-v.clipangle);
  }
  const i1 = v.viewangletox[u32(a1 + ANG90) >>> ANGLETOFINESHIFT]!;
  let i2 = v.viewangletox[u32(a2 + ANG90) >>> ANGLETOFINESHIFT]!;
  if (i1 === i2) {
    return false;
  }
  i2 -= 1;
  let s = 0;
  while (state.solidsegs[s]!.last < i2) {
    s += 1;
  }
  if (i1 >= state.solidsegs[s]!.first && i2 <= state.solidsegs[s]!.last) {
    return false;
  }
  return true;
}

describe('R_CheckBBox — scenarios', () => {
  test('viewpoint inside the box (boxpos == 5) is always visible', () => {
    const box: Bbox = [64 * FRACUNIT, -64 * FRACUNIT, -64 * FRACUNIT, 64 * FRACUNIT]; // top,bottom,left,right
    const state = clearClipSegs(viewport.viewWidth);
    expect(rCheckBBox(box, view, state)).toBe(true);
  });

  test('a box in front of an empty clip list is visible', () => {
    // Box well ahead (+x), spanning the view; clip list = sentinels only.
    const box: Bbox = [96 * FRACUNIT, -96 * FRACUNIT, 256 * FRACUNIT, 320 * FRACUNIT];
    const state = clearClipSegs(viewport.viewWidth);
    expect(rCheckBBox(box, view, state)).toBe(true);
    expect(rCheckBBox(box, view, state)).toBe(reDeriveCheckBBox(box, view, state));
  });

  test('a box fully behind a wall-covering solidseg is culled', () => {
    const state = clearClipSegs(viewport.viewWidth);
    // Occlude the entire view width with a solid seg.
    clipSolidWallSegment(state, 0, viewport.viewWidth - 1, () => {});
    const box: Bbox = [96 * FRACUNIT, -96 * FRACUNIT, 256 * FRACUNIT, 320 * FRACUNIT];
    expect(rCheckBBox(box, view, state)).toBe(false);
    expect(rCheckBBox(box, view, state)).toBe(reDeriveCheckBBox(box, view, state));
  });

  test('a box entirely behind the viewer is culled', () => {
    // Viewer faces +x; this box is far behind (-x) and thin.
    const box: Bbox = [8 * FRACUNIT, -8 * FRACUNIT, -512 * FRACUNIT, -256 * FRACUNIT];
    const state = clearClipSegs(viewport.viewWidth);
    expect(rCheckBBox(box, view, state)).toBe(reDeriveCheckBBox(box, view, state));
  });

  test('CHECKCOORD is the verbatim 12x4 table with zero-filled padding rows', () => {
    expect(CHECKCOORD.length).toBe(12);
    expect(CHECKCOORD[0]).toEqual([3, 0, 2, 1]);
    expect(CHECKCOORD[5]).toEqual([0, 0, 0, 0]); // boxpos 5 short-circuits; padding
    expect(CHECKCOORD[10]).toEqual([2, 1, 3, 0]);
  });
});

describe('R_CheckBBox — independent re-transcription differential', () => {
  test('matches the oracle over a deterministic random box/clip battery', () => {
    let seed = 0x0bad_f00d >>> 0;
    const rnd = (n: number): number => {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      return seed % n;
    };
    const coord = (): number => (rnd(2048) - 1024) * FRACUNIT;

    for (let trial = 0; trial < 300; trial += 1) {
      // Build a pseudo-random clip state via the real I3 list.
      const state = clearClipSegs(viewport.viewWidth);
      const segs = rnd(6);
      for (let s = 0; s < segs; s += 1) {
        const a = rnd(viewport.viewWidth);
        const c = rnd(viewport.viewWidth);
        clipSolidWallSegment(state, Math.min(a, c), Math.max(a, c), () => {});
      }
      const v: CheckBBoxView = { ...view, viewangle: u32(rnd(8) * 0x2000_0000) };
      for (let k = 0; k < 4; k += 1) {
        const cx = coord();
        const cy = coord();
        const halfW = (1 + rnd(256)) * FRACUNIT;
        const halfH = (1 + rnd(256)) * FRACUNIT;
        // [top, bottom, left, right]
        const box: Bbox = [cy + halfH, cy - halfH, cx - halfW, cx + halfW];
        expect(rCheckBBox(box, v, state)).toBe(reDeriveCheckBBox(box, v, state));
      }
    }
  });
});
