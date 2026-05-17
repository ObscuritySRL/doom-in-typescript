import { describe, expect, test } from 'bun:test';

import { FRACUNIT } from '../../src/core/fixed.ts';

import type { AddLineSeg, AddLineSector } from '../../src/render/addLine.ts';
import { DetailMode, computeViewport } from '../../src/render/projection.ts';
import { buildProjectionAngleTables } from '../../src/render/renderInitTables.ts';
import type { RenderSubsectorResult, RenderSubsectorView } from '../../src/render/renderSubsector.ts';
import type { SegStore } from '../../src/render/segStoreFactory.ts';
import { clearClipSegs } from '../../src/render/solidSegs.ts';
import type { SubsectorVisitorDeps } from '../../src/render/subsectorVisitor.ts';
import { makeSubsectorVisitor } from '../../src/render/subsectorVisitor.ts';
import { createVisplanePool } from '../../src/render/visplanes.ts';

const viewport = computeViewport(11, DetailMode.high);
const angleTables = buildProjectionAngleTables(viewport);
const SKY = 9999;

const view: RenderSubsectorView = { viewx: 0, viewy: 0, viewangle: 0, clipangle: angleTables.clipangle, viewangletox: angleTables.viewangletox, viewz: 64 * FRACUNIT, skyflatnum: SKY };

const front: AddLineSector = { ceilingheight: 128 * FRACUNIT, floorheight: 0, ceilingpic: 1, floorpic: 2, lightlevel: 160 };
const solidSeg: AddLineSeg = { v1: { x: 256 * FRACUNIT, y: 96 * FRACUNIT }, v2: { x: 256 * FRACUNIT, y: -96 * FRACUNIT }, backsector: null, sidedefMidtexture: 0 };
const offEdgeSeg: AddLineSeg = { v1: { x: -256 * FRACUNIT, y: -8 * FRACUNIT }, v2: { x: -256 * FRACUNIT, y: 8 * FRACUNIT }, backsector: null, sidedefMidtexture: 0 };

function baseDeps(overrides: Partial<SubsectorVisitorDeps>): SubsectorVisitorDeps {
  return {
    subsectorAt: () => ({ firstseg: 0, numsegs: 0 }),
    frontsectorOf: () => front,
    addLineSegAt: () => solidSeg,
    view,
    pool: createVisplanePool(),
    state: clearClipSegs(viewport.viewWidth),
    makeSegStore: () => () => () => {},
    ...overrides,
  };
}

describe('subsectorVisitor: makeSubsectorVisitor — subsectorIndex → completed R_Subsector', () => {
  test('resolves the subsector to its sector + seg span and runs renderSubsector once', () => {
    const subAtArgs: number[] = [];
    const frontOfArgs: number[] = [];
    const factoryPlanes: Array<{ floor: boolean; ceil: boolean }> = [];

    const onSubsector = makeSubsectorVisitor(
      baseDeps({
        subsectorAt: (i) => {
          subAtArgs.push(i);
          return { firstseg: 5, numsegs: 0 };
        },
        frontsectorOf: (i) => {
          frontOfArgs.push(i);
          return front;
        },
        makeSegStore: (planes: RenderSubsectorResult): SegStore => {
          factoryPlanes.push({ floor: planes.floorplane !== null, ceil: planes.ceilingplane !== null });
          return () => () => {};
        },
      }),
    );

    onSubsector(42);

    expect(subAtArgs).toEqual([42]);
    expect(frontOfArgs).toEqual([42]);
    // viewz 64 is between floor 0 and ceiling 128 → both planes selected;
    // the store factory is invoked once with exactly those planes.
    expect(factoryPlanes).toEqual([{ floor: true, ceil: true }]);
  });

  test('threads firstseg + addLineSegAt so each seg gets the correct absolute index', () => {
    const FIRST = 5;
    const SEGS: readonly AddLineSeg[] = [solidSeg, offEdgeSeg];
    const storeCalls: number[] = [];

    const onSubsector = makeSubsectorVisitor(
      baseDeps({
        subsectorAt: () => ({ firstseg: FIRST, numsegs: SEGS.length }),
        addLineSegAt: (segIndex) => SEGS[segIndex - FIRST]!,
        makeSegStore: (): SegStore => (segIndex: number) => {
          storeCalls.push(segIndex);
          return () => {};
        },
      }),
    );

    onSubsector(0);

    // The solid seg (absolute index 5) is accepted; the off-edge seg
    // (index 6) is rejected by addLine → no store. Index = firstseg + k.
    expect(storeCalls).toEqual([FIRST]);
  });

  test('a fresh deps object each frame keeps the visitor deterministic', () => {
    const seen: number[][] = [];
    for (let frame = 0; frame < 2; frame += 1) {
      const calls: number[] = [];
      const onSubsector = makeSubsectorVisitor(
        baseDeps({
          subsectorAt: () => ({ firstseg: 2, numsegs: 1 }),
          addLineSegAt: () => solidSeg,
          makeSegStore: (): SegStore => (segIndex: number) => {
            calls.push(segIndex);
            return () => {};
          },
        }),
      );
      onSubsector(7);
      seen.push(calls);
    }
    expect(seen[0]).toEqual(seen[1]!);
    expect(seen[0]).toEqual([2]);
  });
});
