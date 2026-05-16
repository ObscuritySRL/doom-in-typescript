/**
 * Increment I4c parity tests for the assembled-renderer
 * `R_Subsector` orchestrator (plane selection + per-seg
 * addLine → clip dispatch).
 *
 * Rigor bar mirrors I1-I4b: floor/ceiling plane-selection scenario
 * asserts plus a STRUCTURALLY DISTINCT in-test re-transcription of
 * r_bsp.c `R_Subsector` checked for store-call-log + selected-plane
 * equivalence over constructed scenes. The verbatim primitives it
 * composes (addLine I4a, findPlane, the I3 clip list) have their own
 * suites; this verifies the orchestration control flow.
 */

import { describe, expect, test } from 'bun:test';

import { FRACUNIT } from '../../src/core/fixed.ts';

import { DetailMode, computeViewport } from '../../src/render/projection.ts';
import { buildProjectionAngleTables } from '../../src/render/renderInitTables.ts';
import { createVisplanePool, findPlane } from '../../src/render/visplanes.ts';
import { clearClipSegs } from '../../src/render/solidSegs.ts';
import { addLine } from '../../src/render/addLine.ts';
import { clipPassWallSegment, clipSolidWallSegment } from '../../src/render/solidSegs.ts';
import type { AddLineSeg, AddLineSector } from '../../src/render/addLine.ts';
import type { RSubsectorScene, RSubsectorView } from '../../src/render/subsector.ts';
import { rSubsector } from '../../src/render/subsector.ts';

const viewport = computeViewport(11, DetailMode.high);
const angleTables = buildProjectionAngleTables(viewport);
const SKY = 9999;

function makeView(viewz: number): RSubsectorView {
  return {
    viewx: 0,
    viewy: 0,
    viewangle: 0,
    clipangle: angleTables.clipangle,
    viewangletox: angleTables.viewangletox,
    viewz,
    skyflatnum: SKY,
  };
}

function recorder() {
  const calls: Array<readonly [number, number]> = [];
  return { calls, store: (a: number, b: number) => calls.push([a, b]) };
}

const front: AddLineSector = { ceilingheight: 128 * FRACUNIT, floorheight: 0, ceilingpic: 1, floorpic: 2, lightlevel: 160 };
const solidSeg: AddLineSeg = { v1: { x: 256 * FRACUNIT, y: 96 * FRACUNIT }, v2: { x: 256 * FRACUNIT, y: -96 * FRACUNIT }, backsector: null, sidedefMidtexture: 0 };
const windowBack: AddLineSector = { ceilingheight: 96 * FRACUNIT, floorheight: 16 * FRACUNIT, ceilingpic: 1, floorpic: 2, lightlevel: 160 };
const windowSeg: AddLineSeg = { v1: { x: 240 * FRACUNIT, y: 64 * FRACUNIT }, v2: { x: 240 * FRACUNIT, y: -64 * FRACUNIT }, backsector: windowBack, sidedefMidtexture: 0 };
const offEdgeSeg: AddLineSeg = { v1: { x: -256 * FRACUNIT, y: -8 * FRACUNIT }, v2: { x: -256 * FRACUNIT, y: 8 * FRACUNIT }, backsector: null, sidedefMidtexture: 0 };

// Structurally distinct re-transcription of r_bsp.c R_Subsector.
function reDeriveSubsector(scene: RSubsectorScene, view: RSubsectorView) {
  const pool = createVisplanePool();
  const state = clearClipSegs(viewport.viewWidth);
  const rec = recorder();
  const fs = scene.frontsector;
  let floorplane = null as ReturnType<typeof findPlane> | null;
  let ceilingplane = null as ReturnType<typeof findPlane> | null;
  if (fs.floorheight < view.viewz) {
    floorplane = findPlane(pool, fs.floorheight, fs.floorpic, fs.lightlevel, view.skyflatnum);
  }
  if (fs.ceilingheight > view.viewz || fs.ceilingpic === view.skyflatnum) {
    ceilingplane = findPlane(pool, fs.ceilingheight, fs.ceilingpic, fs.lightlevel, view.skyflatnum);
  }
  for (let i = 0; i < scene.segs.length; i += 1) {
    const d = addLine(scene.segs[i]!, fs, view);
    if (!d) {
      continue;
    }
    if (d.kind === 'solid') {
      clipSolidWallSegment(state, d.x1, d.last, rec.store);
    } else {
      clipPassWallSegment(state, d.x1, d.last, rec.store);
    }
  }
  return {
    calls: rec.calls,
    floor: floorplane ? { h: floorplane.height, p: floorplane.picnum, l: floorplane.lightlevel } : null,
    ceil: ceilingplane ? { h: ceilingplane.height, p: ceilingplane.picnum, l: ceilingplane.lightlevel } : null,
  };
}

function run(scene: RSubsectorScene, view: RSubsectorView) {
  const pool = createVisplanePool();
  const state = clearClipSegs(viewport.viewWidth);
  const rec = recorder();
  const r = rSubsector(scene, view, pool, state, rec.store);
  return {
    calls: rec.calls,
    floor: r.floorplane ? { h: r.floorplane.height, p: r.floorplane.picnum, l: r.floorplane.lightlevel } : null,
    ceil: r.ceilingplane ? { h: r.ceilingplane.height, p: r.ceilingplane.picnum, l: r.ceilingplane.lightlevel } : null,
  };
}

describe('R_Subsector — plane selection', () => {
  test('floor below / ceiling above the view plane both allocate planes', () => {
    const scene: RSubsectorScene = { frontsector: front, segs: [] };
    const r = run(scene, makeView(41 * FRACUNIT)); // 0 < 41<<16 < 128<<16
    expect(r.floor).toEqual({ h: 0, p: 2, l: 160 });
    expect(r.ceil).toEqual({ h: 128 * FRACUNIT, p: 1, l: 160 });
  });

  test('floor at/above the view plane yields no floor plane', () => {
    const scene: RSubsectorScene = { frontsector: front, segs: [] };
    const r = run(scene, makeView(0)); // floorheight(0) is NOT < viewz(0)
    expect(r.floor).toBeNull();
    expect(r.ceil).toEqual({ h: 128 * FRACUNIT, p: 1, l: 160 });
  });

  test('ceiling below the view plane yields no ceiling plane unless it is sky', () => {
    const lowCeil: AddLineSector = { ...front, ceilingheight: -8 * FRACUNIT };
    const r = run({ frontsector: lowCeil, segs: [] }, makeView(0));
    expect(r.ceil).toBeNull();
    const skyCeil: AddLineSector = { ...lowCeil, ceilingpic: SKY };
    const rs = run({ frontsector: skyCeil, segs: [] }, makeView(0));
    // sky collapses height/light to 0 in findPlane.
    expect(rs.ceil).toEqual({ h: 0, p: SKY, l: 0 });
  });
});

describe('R_Subsector — seg dispatch', () => {
  test('solid + window + off-edge segs route to the correct clip paths', () => {
    const scene: RSubsectorScene = { frontsector: front, segs: [solidSeg, windowSeg, offEdgeSeg] };
    const view = makeView(41 * FRACUNIT);
    expect(run(scene, view)).toEqual(reDeriveSubsector(scene, view));
    // The off-edge seg contributes no store call; the solid + window do.
    const r = run(scene, view);
    expect(r.calls.length).toBeGreaterThanOrEqual(1);
  });

  test('empty subsector stores nothing', () => {
    const scene: RSubsectorScene = { frontsector: front, segs: [] };
    expect(run(scene, makeView(41 * FRACUNIT)).calls).toEqual([]);
  });

  test('matches the independent re-transcription over varied scenes', () => {
    const scenes: RSubsectorScene[] = [
      { frontsector: front, segs: [solidSeg] },
      { frontsector: front, segs: [windowSeg] },
      { frontsector: front, segs: [solidSeg, windowSeg] },
      { frontsector: { ...front, ceilingpic: SKY }, segs: [solidSeg, offEdgeSeg, windowSeg] },
      { frontsector: { ...front, floorheight: 64 * FRACUNIT }, segs: [windowSeg, solidSeg] },
    ];
    for (const viewz of [0, 41 * FRACUNIT, 200 * FRACUNIT]) {
      for (const scene of scenes) {
        const view = makeView(viewz);
        expect(run(scene, view)).toEqual(reDeriveSubsector(scene, view));
      }
    }
  });
});
