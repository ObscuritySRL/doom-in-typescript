/**
 * Parity tests for the completed `R_Subsector` (plane selection +
 * per-seg addLine → curline-bound store → clip dispatch).
 *
 * Same rigor bar as the I4c suite: floor/ceiling plane scenarios plus a
 * STRUCTURALLY DISTINCT in-test re-transcription of r_bsp.c
 * `R_Subsector` (including the per-`curline` `R_StoreWallRange`
 * binding) checked for selected-plane + per-seg store/fragment
 * equivalence. The verbatim primitives it composes (addLine, findPlane,
 * the I3 clip list, the I4d seg-store factory) have their own suites;
 * this verifies the orchestration control flow.
 */

import { describe, expect, test } from 'bun:test';

import { FRACUNIT } from '../../src/core/fixed.ts';

import type { AddLineSeg, AddLineSector } from '../../src/render/addLine.ts';
import { addLine } from '../../src/render/addLine.ts';
import { DetailMode, computeViewport } from '../../src/render/projection.ts';
import { buildProjectionAngleTables } from '../../src/render/renderInitTables.ts';
import type { RenderSubsectorScene, RenderSubsectorView } from '../../src/render/renderSubsector.ts';
import { renderSubsector } from '../../src/render/renderSubsector.ts';
import type { SegStore } from '../../src/render/segStoreFactory.ts';
import { clipPassWallSegment, clipSolidWallSegment, clearClipSegs } from '../../src/render/solidSegs.ts';
import { createVisplanePool, findPlane } from '../../src/render/visplanes.ts';

const viewport = computeViewport(11, DetailMode.high);
const angleTables = buildProjectionAngleTables(viewport);
const SKY = 9999;

function makeView(viewz: number): RenderSubsectorView {
  return { viewx: 0, viewy: 0, viewangle: 0, clipangle: angleTables.clipangle, viewangletox: angleTables.viewangletox, viewz, skyflatnum: SKY };
}

const front: AddLineSector = { ceilingheight: 128 * FRACUNIT, floorheight: 0, ceilingpic: 1, floorpic: 2, lightlevel: 160 };
const solidSeg: AddLineSeg = { v1: { x: 256 * FRACUNIT, y: 96 * FRACUNIT }, v2: { x: 256 * FRACUNIT, y: -96 * FRACUNIT }, backsector: null, sidedefMidtexture: 0 };
const windowBack: AddLineSector = { ceilingheight: 96 * FRACUNIT, floorheight: 16 * FRACUNIT, ceilingpic: 1, floorpic: 2, lightlevel: 160 };
const windowSeg: AddLineSeg = { v1: { x: 240 * FRACUNIT, y: 64 * FRACUNIT }, v2: { x: 240 * FRACUNIT, y: -64 * FRACUNIT }, backsector: windowBack, sidedefMidtexture: 0 };
const offEdgeSeg: AddLineSeg = { v1: { x: -256 * FRACUNIT, y: -8 * FRACUNIT }, v2: { x: -256 * FRACUNIT, y: 8 * FRACUNIT }, backsector: null, sidedefMidtexture: 0 };

// Absolute seg table; the subsector occupies [firstseg, firstseg+numsegs).
const FIRSTSEG = 5;
const SEGS: readonly AddLineSeg[] = Object.freeze([solidSeg, windowSeg, offEdgeSeg]);

function scene(): RenderSubsectorScene {
  return { frontsector: front, firstseg: FIRSTSEG, numsegs: SEGS.length, addLineSegAt: (segIndex: number) => SEGS[segIndex - FIRSTSEG]! };
}

interface Trace {
  storeCalls: Array<readonly [number, number]>;
  fragments: Array<readonly [number, number, number]>;
}

function recordingSegStore(trace: Trace): SegStore {
  return (segIndex: number, rwAngle1: number) => {
    trace.storeCalls.push([segIndex, rwAngle1]);
    return (first: number, last: number) => {
      trace.fragments.push([segIndex, first, last]);
    };
  };
}

function run(s: RenderSubsectorScene, view: RenderSubsectorView) {
  const pool = createVisplanePool();
  const state = clearClipSegs(viewport.viewWidth);
  const trace: Trace = { storeCalls: [], fragments: [] };
  const r = renderSubsector(s, view, pool, state, recordingSegStore(trace));
  return {
    trace,
    floor: r.floorplane ? { h: r.floorplane.height, p: r.floorplane.picnum, l: r.floorplane.lightlevel } : null,
    ceil: r.ceilingplane ? { h: r.ceilingplane.height, p: r.ceilingplane.picnum, l: r.ceilingplane.lightlevel } : null,
  };
}

// Structurally distinct re-transcription of r_bsp.c R_Subsector + the
// per-curline R_StoreWallRange binding.
function reDerive(s: RenderSubsectorScene, view: RenderSubsectorView) {
  const pool = createVisplanePool();
  const state = clearClipSegs(viewport.viewWidth);
  const trace: Trace = { storeCalls: [], fragments: [] };
  const fs = s.frontsector;
  let floorplane = null as ReturnType<typeof findPlane> | null;
  let ceilingplane = null as ReturnType<typeof findPlane> | null;
  if (fs.floorheight < view.viewz) {
    floorplane = findPlane(pool, fs.floorheight, fs.floorpic, fs.lightlevel, view.skyflatnum);
  }
  if (fs.ceilingheight > view.viewz || fs.ceilingpic === view.skyflatnum) {
    ceilingplane = findPlane(pool, fs.ceilingheight, fs.ceilingpic, fs.lightlevel, view.skyflatnum);
  }
  for (let k = 0; k < s.numsegs; k += 1) {
    const segIndex = s.firstseg + k;
    const d = addLine(s.addLineSegAt(segIndex), fs, view);
    if (!d) {
      continue;
    }
    trace.storeCalls.push([segIndex, d.rwAngle1]);
    const store = (first: number, last: number): void => {
      trace.fragments.push([segIndex, first, last]);
    };
    if (d.kind === 'solid') {
      clipSolidWallSegment(state, d.x1, d.last, store);
    } else {
      clipPassWallSegment(state, d.x1, d.last, store);
    }
  }
  return {
    trace,
    floor: floorplane ? { h: floorplane.height, p: floorplane.picnum, l: floorplane.lightlevel } : null,
    ceil: ceilingplane ? { h: ceilingplane.height, p: ceilingplane.picnum, l: ceilingplane.lightlevel } : null,
  };
}

describe('renderSubsector: completed R_Subsector with per-seg curline stores', () => {
  test('floor + ceiling visible: planes selected and every accepted seg gets its own curline store', () => {
    const view = makeView(64 * FRACUNIT);
    const got = run(scene(), view);
    const want = reDerive(scene(), view);

    expect(got.floor).toEqual(want.floor);
    expect(got.ceil).toEqual(want.ceil);
    expect(got.floor).not.toBeNull();
    expect(got.ceil).not.toBeNull();
    // The solid + window segs are accepted (absolute indices 5, 6); the
    // off-edge seg (index 7) is rejected → no store, no fragment.
    expect(got.trace.storeCalls).toEqual(want.trace.storeCalls);
    expect(got.trace.storeCalls.map(([i]) => i)).toEqual([FIRSTSEG, FIRSTSEG + 1]);
    expect(got.trace.fragments).toEqual(want.trace.fragments);
    expect(got.trace.fragments.length).toBeGreaterThan(0);
    expect(got.trace.fragments.every(([i]) => i === FIRSTSEG || i === FIRSTSEG + 1)).toBe(true);
  });

  test('ceiling below viewz and not sky → no ceilingplane (still routes segs)', () => {
    const view = makeView(256 * FRACUNIT);
    const got = run(scene(), view);
    const want = reDerive(scene(), view);
    expect(got.ceil).toBeNull();
    expect(want.ceil).toBeNull();
    expect(got.floor).toEqual(want.floor);
    expect(got.trace.storeCalls).toEqual(want.trace.storeCalls);
  });

  test('sky ceiling forces a ceilingplane even when ceilingheight <= viewz', () => {
    const skyFront: AddLineSector = { ...front, ceilingpic: SKY };
    const s: RenderSubsectorScene = { ...scene(), frontsector: skyFront };
    const view = makeView(256 * FRACUNIT);
    expect(run(s, view).ceil).toEqual(reDerive(s, view).ceil);
    expect(run(s, view).ceil).not.toBeNull();
  });

  test('empty subsector selects planes but stores nothing', () => {
    const s: RenderSubsectorScene = { ...scene(), numsegs: 0 };
    const view = makeView(64 * FRACUNIT);
    const got = run(s, view);
    expect(got.trace.storeCalls).toEqual([]);
    expect(got.trace.fragments).toEqual([]);
    expect(got.floor).not.toBeNull();
    expect(got.ceil).not.toBeNull();
  });
});
