import { describe, expect, it } from 'bun:test';

import type { Fixed } from '../../src/core/fixed.ts';
import { FRACBITS, FRACUNIT } from '../../src/core/fixed.ts';
import { createValidCount } from '../../src/map/blockmapIter.ts';
import type { ValidCount } from '../../src/map/blockmapIter.ts';
import type { Blockmap } from '../../src/map/blockmap.ts';
import type { MapLinedef, MapSector, MapVertex } from '../../src/map/lineSectorGeometry.ts';
import { BOXTOP, BOXBOTTOM, BOXLEFT, BOXRIGHT, ML_BLOCKING, ST_HORIZONTAL, ST_NEGATIVE, ST_POSITIVE, ST_VERTICAL } from '../../src/map/lineSectorGeometry.ts';
import type { MapData, LineSectors } from '../../src/map/mapSetup.ts';
import type { RejectMap } from '../../src/map/reject.ts';
import { MF_DROPOFF, MF_FLOAT, MF_NOCLIP, MF_SOLID, MF_TELEPORT, Mobj, MobjType } from '../../src/world/mobj.ts';
import { createBlockThingsGrid } from '../../src/world/checkPosition.ts';
import type { BlockThingsGrid } from '../../src/world/checkPosition.ts';
import { MAXSTEPHEIGHT, tryMove } from '../../src/world/tryMove.ts';
import type { TryMoveCallbacks, TryMoveResult } from '../../src/world/tryMove.ts';

// ── Helpers ──────────────────────────────────────────────────────────

const F = FRACUNIT;

function createEmptyBlockmap(columns: number, rows: number, originX: Fixed = 0, originY: Fixed = 0): Blockmap {
  const cellCount = columns * rows;
  const offsets: number[] = [];
  const words: number[] = [];
  let cursor = 0;

  for (let i = 0; i < cellCount; i++) {
    offsets.push(cursor);
    words.push(-1);
    cursor++;
  }

  const lumpData = Buffer.alloc(words.length * 2);
  for (let i = 0; i < words.length; i++) {
    lumpData.writeInt16LE(words[i]!, i * 2);
  }

  return {
    originX,
    originY,
    columns,
    rows,
    offsets: Object.freeze(offsets),
    lumpData,
  };
}

function createBlockmapWithLines(columns: number, rows: number, originX: Fixed, originY: Fixed, cellLines: Map<number, number[]>): Blockmap {
  const cellCount = columns * rows;
  const offsets: number[] = [];
  const words: number[] = [];
  let cursor = 0;

  for (let i = 0; i < cellCount; i++) {
    offsets.push(cursor);
    const lines = cellLines.get(i);
    if (lines !== undefined) {
      for (const lineIndex of lines) {
        words.push(lineIndex);
        cursor++;
      }
    }
    words.push(-1);
    cursor++;
  }

  const lumpData = Buffer.alloc(words.length * 2);
  for (let i = 0; i < words.length; i++) {
    lumpData.writeInt16LE(words[i]!, i * 2);
  }

  return {
    originX,
    originY,
    columns,
    rows,
    offsets: Object.freeze(offsets),
    lumpData,
  };
}

function createTestMapData(overrides?: {
  sectors?: readonly MapSector[];
  linedefs?: readonly MapLinedef[];
  vertexes?: readonly MapVertex[];
  lineSectors?: readonly LineSectors[];
  blockmap?: Blockmap;
  subsectorSectors?: readonly number[];
}): MapData {
  const sectors: readonly MapSector[] = overrides?.sectors ?? [
    Object.freeze({
      floorheight: 0,
      ceilingheight: (128 * F) | 0,
      floorpic: 'FLOOR4_8',
      ceilingpic: 'CEIL3_5',
      lightlevel: 160,
      special: 0,
      tag: 0,
    }),
  ];
  const linedefs = overrides?.linedefs ?? [];
  const vertexes = overrides?.vertexes ?? [];
  const lineSectors = overrides?.lineSectors ?? [];
  const blockmap = overrides?.blockmap ?? createEmptyBlockmap(4, 4);
  const validCount = createValidCount(linedefs.length);
  const subsectorSectors = overrides?.subsectorSectors ?? [0];

  const rejectMap: RejectMap = {
    sectorCount: sectors.length,
    totalBits: sectors.length * sectors.length,
    expectedSize: Math.ceil((sectors.length * sectors.length) / 8),
    data: Buffer.alloc(Math.ceil((sectors.length * sectors.length) / 8)),
  };

  return {
    name: 'TEST',
    vertexes: Object.freeze(vertexes) as readonly MapVertex[],
    sectors: Object.freeze(sectors) as readonly MapSector[],
    sidedefs: Object.freeze([]),
    linedefs: Object.freeze(linedefs) as readonly MapLinedef[],
    segs: Object.freeze([]),
    subsectors: Object.freeze([]),
    nodes: Object.freeze([]),
    things: Object.freeze([]),
    blockmap,
    reject: rejectMap,
    subsectorSectors: Object.freeze(subsectorSectors) as readonly number[],
    lineSectors: Object.freeze(lineSectors) as readonly LineSectors[],
    sectorGroups: Object.freeze([]),
    validCount,
  } as MapData;
}

function createMobj(props: { x?: Fixed; y?: Fixed; z?: Fixed; radius?: Fixed; height?: Fixed; flags?: number; type?: MobjType; player?: unknown; floorz?: Fixed; ceilingz?: Fixed }): Mobj {
  const mobj = new Mobj();
  mobj.x = props.x ?? 0;
  mobj.y = props.y ?? 0;
  mobj.z = props.z ?? 0;
  mobj.radius = props.radius ?? (20 * F) | 0;
  mobj.height = props.height ?? (56 * F) | 0;
  mobj.flags = props.flags ?? 0;
  mobj.type = props.type ?? MobjType.PLAYER;
  mobj.player = props.player ?? null;
  mobj.floorz = props.floorz ?? 0;
  mobj.ceilingz = props.ceilingz ?? (128 * F) | 0;
  return mobj;
}

function makeLinedef(vertexIndex1: number, vertexIndex2: number, v1x: Fixed, v1y: Fixed, v2x: Fixed, v2y: Fixed, flags = 0, special = 0, sidenum1 = -1): MapLinedef {
  const dx = (v2x - v1x) | 0;
  const dy = (v2y - v1y) | 0;
  let slopetype: 0 | 1 | 2 | 3;
  if (dy === 0) slopetype = ST_HORIZONTAL;
  else if (dx === 0) slopetype = ST_VERTICAL;
  else if ((dx > 0 && dy > 0) || (dx < 0 && dy < 0)) slopetype = ST_POSITIVE;
  else slopetype = ST_NEGATIVE;

  const bboxTop = Math.max(v1y, v2y);
  const bboxBottom = Math.min(v1y, v2y);
  const bboxLeft = Math.min(v1x, v2x);
  const bboxRight = Math.max(v1x, v2x);

  return Object.freeze({
    v1: vertexIndex1,
    v2: vertexIndex2,
    dx,
    dy,
    flags,
    special,
    tag: 0,
    sidenum0: 0,
    sidenum1,
    slopetype,
    bbox: Object.freeze([bboxTop, bboxBottom, bboxLeft, bboxRight] as const),
  });
}

function linkMobjToCell(mobj: Mobj, cellIndex: number, blocklinks: BlockThingsGrid): void {
  mobj.blockNext = blocklinks[cellIndex] ?? null;
  if (mobj.blockNext !== null) {
    (mobj.blockNext as Mobj).blockPrev = mobj;
  }
  mobj.blockPrev = null;
  blocklinks[cellIndex] = mobj;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('MAXSTEPHEIGHT', () => {
  it('equals 24 * FRACUNIT', () => {
    expect(MAXSTEPHEIGHT).toBe((24 * FRACUNIT) | 0);
  });

  it('is 24 map units in fixed-point', () => {
    expect(MAXSTEPHEIGHT >> FRACBITS).toBe(24);
  });
});

describe('tryMove — open space', () => {
  it('succeeds in open space with no obstacles', () => {
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ x: 0, y: 0, z: 0 });
    const result = tryMove(mobj, (10 * F) | 0, (10 * F) | 0, mapData, blocklinks);
    expect(result.moved).toBe(true);
    expect(result.floatok).toBe(true);
  });

  it('updates thing x and y on success', () => {
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ x: 0, y: 0, z: 0 });
    const targetX = (10 * F) | 0;
    const targetY = (15 * F) | 0;
    tryMove(mobj, targetX, targetY, mapData, blocklinks);
    expect(mobj.x).toBe(targetX);
    expect(mobj.y).toBe(targetY);
  });

  it('updates thing floorz and ceilingz from checkPosition', () => {
    const sectors: readonly MapSector[] = [
      Object.freeze({
        floorheight: (16 * F) | 0,
        ceilingheight: (200 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ x: 0, y: 0, z: (16 * F) | 0 });
    tryMove(mobj, (5 * F) | 0, (5 * F) | 0, mapData, blocklinks);
    expect(mobj.floorz).toBe((16 * F) | 0);
    expect(mobj.ceilingz).toBe((200 * F) | 0);
  });

  it('returns checkResult with floor/ceiling data', () => {
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ x: 0, y: 0, z: 0 });
    const result = tryMove(mobj, (10 * F) | 0, (10 * F) | 0, mapData, blocklinks);
    expect(result.checkResult).not.toBeNull();
    expect(result.checkResult!.passed).toBe(true);
    expect(result.checkResult!.floorz).toBe(0);
    expect(result.checkResult!.ceilingz).toBe((128 * F) | 0);
  });
});

describe('tryMove — floatok', () => {
  it('is false when checkPosition fails', () => {
    const blocklinks = createBlockThingsGrid(4, 4);
    const blocker = createMobj({
      x: (5 * F) | 0,
      y: (5 * F) | 0,
      z: 0,
      flags: MF_SOLID,
    });
    linkMobjToCell(blocker, 0, blocklinks);
    const mapData = createTestMapData();
    const mobj = createMobj({ x: 0, y: 0, z: 0 });
    const result = tryMove(mobj, (5 * F) | 0, (5 * F) | 0, mapData, blocklinks);
    expect(result.moved).toBe(false);
    expect(result.floatok).toBe(false);
  });

  it('is false when gap is too small for thing height', () => {
    const sectors: readonly MapSector[] = [
      Object.freeze({
        floorheight: 0,
        ceilingheight: (40 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ x: 0, y: 0, z: 0, height: (56 * F) | 0 });
    const result = tryMove(mobj, (5 * F) | 0, (5 * F) | 0, mapData, blocklinks);
    expect(result.moved).toBe(false);
    expect(result.floatok).toBe(false);
  });

  it('is true even when step-up blocks the move', () => {
    // Floor at 25 map units: step up > 24*FRACUNIT from z=0.
    // But ceiling-floor gap (128-25=103) > height (56), so floatok=true.
    const sectors: readonly MapSector[] = [
      Object.freeze({
        floorheight: (25 * F) | 0,
        ceilingheight: (128 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ x: 0, y: 0, z: 0, height: (56 * F) | 0 });
    const result = tryMove(mobj, (5 * F) | 0, (5 * F) | 0, mapData, blocklinks);
    expect(result.moved).toBe(false);
    expect(result.floatok).toBe(true);
  });

  it('is true even when dropoff blocks the move', () => {
    // Two sectors: front floor at 0, back floor at -30. The line opening
    // makes dropoffz = -30*F, floorz stays 0. Dropoff > 24*FRACUNIT.
    // But gap is fine, so floatok=true.
    // Line at y=5*F so the thing's bbox (radius 20*F) straddles it.
    const vertexes: MapVertex[] = [Object.freeze({ x: (-100 * F) | 0, y: (5 * F) | 0 }), Object.freeze({ x: (100 * F) | 0, y: (5 * F) | 0 })];
    const sectors: MapSector[] = [
      Object.freeze({
        floorheight: 0,
        ceilingheight: (128 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      }),
      Object.freeze({
        floorheight: (-30 * F) | 0,
        ceilingheight: (128 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      }),
    ];
    const linedefs = [makeLinedef(0, 1, vertexes[0]!.x, vertexes[0]!.y, vertexes[1]!.x, vertexes[1]!.y, 0, 0, 1)];
    const lineSectors: LineSectors[] = [{ frontsector: 0, backsector: 1 }];
    const cellLines = new Map<number, number[]>();
    cellLines.set(0, [0]);
    cellLines.set(1, [0]);
    cellLines.set(2, [0]);
    cellLines.set(3, [0]);
    const blockmap = createBlockmapWithLines(2, 2, (-64 * F) | 0, (-64 * F) | 0, cellLines);
    const mapData = createTestMapData({
      sectors,
      vertexes,
      linedefs,
      lineSectors,
      blockmap,
      subsectorSectors: [0],
    });
    const blocklinks = createBlockThingsGrid(2, 2);
    const mobj = createMobj({ x: 0, y: 0, z: 0, height: (56 * F) | 0 });
    const result = tryMove(mobj, 0, 0, mapData, blocklinks);
    // floorz=0, dropoffz=-30*F, difference=30*F > MAXSTEPHEIGHT
    expect(result.moved).toBe(false);
    expect(result.floatok).toBe(true);
  });
});

describe('tryMove — height constraints', () => {
  it('rejects when ceiling too low for thing to fit', () => {
    // Thing at z=50, height=56. Ceiling at 100. 100-50=50 < 56.
    const sectors: readonly MapSector[] = [
      Object.freeze({
        floorheight: 0,
        ceilingheight: (100 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({
      x: 0,
      y: 0,
      z: (50 * F) | 0,
      height: (56 * F) | 0,
    });
    const result = tryMove(mobj, (5 * F) | 0, (5 * F) | 0, mapData, blocklinks);
    expect(result.moved).toBe(false);
    expect(result.floatok).toBe(true);
  });

  it('rejects when step up exceeds MAXSTEPHEIGHT', () => {
    const sectors: readonly MapSector[] = [
      Object.freeze({
        floorheight: (25 * F) | 0,
        ceilingheight: (200 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ x: 0, y: 0, z: 0 });
    const result = tryMove(mobj, (5 * F) | 0, (5 * F) | 0, mapData, blocklinks);
    expect(result.moved).toBe(false);
  });

  it('allows step up exactly at MAXSTEPHEIGHT boundary', () => {
    // Floor at 24 map units. Step from z=0. floorz-z = 24*F = MAXSTEPHEIGHT.
    // The check is > (strictly greater), so exactly 24 is allowed.
    const sectors: readonly MapSector[] = [
      Object.freeze({
        floorheight: (24 * F) | 0,
        ceilingheight: (200 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ x: 0, y: 0, z: 0 });
    const result = tryMove(mobj, (5 * F) | 0, (5 * F) | 0, mapData, blocklinks);
    expect(result.moved).toBe(true);
  });

  it('allows ceiling exactly at thing.z + height', () => {
    // Thing at z=0, height=56. Ceiling at 56. ceiling-z = 56 = height.
    // The check is < (strictly less), so exactly equal is allowed.
    const sectors: readonly MapSector[] = [
      Object.freeze({
        floorheight: 0,
        ceilingheight: (56 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ x: 0, y: 0, z: 0, height: (56 * F) | 0 });
    const result = tryMove(mobj, (5 * F) | 0, (5 * F) | 0, mapData, blocklinks);
    expect(result.moved).toBe(true);
  });
});

describe('tryMove — MF_NOCLIP', () => {
  it('always succeeds regardless of obstacles', () => {
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({
      x: 0,
      y: 0,
      z: 0,
      flags: MF_NOCLIP,
    });
    const result = tryMove(mobj, (10 * F) | 0, (10 * F) | 0, mapData, blocklinks);
    expect(result.moved).toBe(true);
  });

  it('does not set floatok (skips all collision checks)', () => {
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({
      x: 0,
      y: 0,
      z: 0,
      flags: MF_NOCLIP,
    });
    const result = tryMove(mobj, (10 * F) | 0, (10 * F) | 0, mapData, blocklinks);
    // NOCLIP skips the constraint checks entirely, so floatok stays false
    expect(result.floatok).toBe(false);
  });

  it('updates position even in a tiny sector', () => {
    const sectors: readonly MapSector[] = [
      Object.freeze({
        floorheight: 0,
        ceilingheight: F,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({
      x: 0,
      y: 0,
      z: 0,
      height: (56 * F) | 0,
      flags: MF_NOCLIP,
    });
    const targetX = (10 * F) | 0;
    tryMove(mobj, targetX, 0, mapData, blocklinks);
    expect(mobj.x).toBe(targetX);
  });

  it('skips special line processing', () => {
    const vertexes: MapVertex[] = [Object.freeze({ x: (-100 * F) | 0, y: (5 * F) | 0 }), Object.freeze({ x: (100 * F) | 0, y: (5 * F) | 0 })];
    const linedefs = [makeLinedef(0, 1, vertexes[0]!.x, vertexes[0]!.y, vertexes[1]!.x, vertexes[1]!.y, 0, 42, 1)];
    const lineSectors: LineSectors[] = [{ frontsector: 0, backsector: 0 }];
    const cellLines = new Map<number, number[]>();
    cellLines.set(0, [0]);
    const blockmap = createBlockmapWithLines(1, 1, (-128 * F) | 0, (-128 * F) | 0, cellLines);
    const mapData = createTestMapData({
      vertexes,
      linedefs,
      lineSectors,
      blockmap,
    });
    const blocklinks = createBlockThingsGrid(1, 1);
    const crossedLines: number[] = [];
    const callbacks: TryMoveCallbacks = {
      crossSpecialLine: (linedefIndex) => {
        crossedLines.push(linedefIndex);
      },
    };
    const mobj = createMobj({
      x: 0,
      y: 0,
      z: 0,
      flags: MF_NOCLIP,
    });
    tryMove(mobj, 0, (10 * F) | 0, mapData, blocklinks, callbacks);
    expect(crossedLines.length).toBe(0);
  });
});

describe('tryMove — MF_TELEPORT', () => {
  it('skips ceiling check', () => {
    // Thing at z=50, height=56. Ceiling at 100. Normally blocked (100-50=50 < 56).
    const sectors: readonly MapSector[] = [
      Object.freeze({
        floorheight: 0,
        ceilingheight: (100 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({
      x: 0,
      y: 0,
      z: (50 * F) | 0,
      height: (56 * F) | 0,
      flags: MF_TELEPORT,
    });
    const result = tryMove(mobj, (5 * F) | 0, (5 * F) | 0, mapData, blocklinks);
    expect(result.moved).toBe(true);
  });

  it('skips step-up check', () => {
    // Floor at 30 map units. Step from z=0. Normally blocked (30 > 24).
    const sectors: readonly MapSector[] = [
      Object.freeze({
        floorheight: (30 * F) | 0,
        ceilingheight: (200 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({
      x: 0,
      y: 0,
      z: 0,
      flags: MF_TELEPORT,
    });
    const result = tryMove(mobj, (5 * F) | 0, (5 * F) | 0, mapData, blocklinks);
    expect(result.moved).toBe(true);
  });

  it('still checks gap fits thing height', () => {
    // Even MF_TELEPORT must fit in the ceiling-floor gap.
    const sectors: readonly MapSector[] = [
      Object.freeze({
        floorheight: 0,
        ceilingheight: (40 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({
      x: 0,
      y: 0,
      z: 0,
      height: (56 * F) | 0,
      flags: MF_TELEPORT,
    });
    const result = tryMove(mobj, (5 * F) | 0, (5 * F) | 0, mapData, blocklinks);
    expect(result.moved).toBe(false);
  });

  it('skips special line processing', () => {
    const vertexes: MapVertex[] = [Object.freeze({ x: (-100 * F) | 0, y: (5 * F) | 0 }), Object.freeze({ x: (100 * F) | 0, y: (5 * F) | 0 })];
    const linedefs = [makeLinedef(0, 1, vertexes[0]!.x, vertexes[0]!.y, vertexes[1]!.x, vertexes[1]!.y, 0, 42, 1)];
    const lineSectors: LineSectors[] = [{ frontsector: 0, backsector: 0 }];
    const cellLines = new Map<number, number[]>();
    cellLines.set(0, [0]);
    const blockmap = createBlockmapWithLines(1, 1, (-128 * F) | 0, (-128 * F) | 0, cellLines);
    const mapData = createTestMapData({
      vertexes,
      linedefs,
      lineSectors,
      blockmap,
    });
    const blocklinks = createBlockThingsGrid(1, 1);
    const crossedLines: number[] = [];
    const callbacks: TryMoveCallbacks = {
      crossSpecialLine: (linedefIndex) => {
        crossedLines.push(linedefIndex);
      },
    };
    const mobj = createMobj({
      x: 0,
      y: 0,
      z: 0,
      flags: MF_TELEPORT,
    });
    tryMove(mobj, 0, (10 * F) | 0, mapData, blocklinks, callbacks);
    expect(crossedLines.length).toBe(0);
  });
});

describe('tryMove — MF_DROPOFF and MF_FLOAT', () => {
  // Set up a two-sector scenario with a large dropoff.
  function makeDropoffMap(): { mapData: MapData; blocklinks: BlockThingsGrid } {
    const vertexes: MapVertex[] = [Object.freeze({ x: (-100 * F) | 0, y: (5 * F) | 0 }), Object.freeze({ x: (100 * F) | 0, y: (5 * F) | 0 })];
    const sectors: MapSector[] = [
      Object.freeze({
        floorheight: 0,
        ceilingheight: (128 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      }),
      Object.freeze({
        floorheight: (-30 * F) | 0,
        ceilingheight: (128 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      }),
    ];
    const linedefs = [makeLinedef(0, 1, vertexes[0]!.x, vertexes[0]!.y, vertexes[1]!.x, vertexes[1]!.y, 0, 0, 1)];
    const lineSectors: LineSectors[] = [{ frontsector: 0, backsector: 1 }];
    const cellLines = new Map<number, number[]>();
    for (let i = 0; i < 4; i++) cellLines.set(i, [0]);
    const blockmap = createBlockmapWithLines(2, 2, (-64 * F) | 0, (-64 * F) | 0, cellLines);
    const mapData = createTestMapData({
      sectors,
      vertexes,
      linedefs,
      lineSectors,
      blockmap,
      subsectorSectors: [0],
    });
    return { mapData, blocklinks: createBlockThingsGrid(2, 2) };
  }

  it('rejects normal thing at large dropoff', () => {
    const { mapData, blocklinks } = makeDropoffMap();
    const mobj = createMobj({ x: 0, y: 0, z: 0, flags: 0 });
    const result = tryMove(mobj, 0, 0, mapData, blocklinks);
    expect(result.moved).toBe(false);
    expect(result.floatok).toBe(true);
  });

  it('MF_DROPOFF allows movement over large dropoff', () => {
    const { mapData, blocklinks } = makeDropoffMap();
    const mobj = createMobj({ x: 0, y: 0, z: 0, flags: MF_DROPOFF });
    const result = tryMove(mobj, 0, 0, mapData, blocklinks);
    expect(result.moved).toBe(true);
  });

  it('MF_FLOAT allows movement over large dropoff', () => {
    const { mapData, blocklinks } = makeDropoffMap();
    const mobj = createMobj({ x: 0, y: 0, z: 0, flags: MF_FLOAT });
    const result = tryMove(mobj, 0, 0, mapData, blocklinks);
    expect(result.moved).toBe(true);
  });
});

describe('tryMove — position callbacks', () => {
  it('calls unsetThingPosition before updating x/y', () => {
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ x: (1 * F) | 0, y: (2 * F) | 0, z: 0 });
    let capturedX = 0;
    let capturedY = 0;
    const callbacks: TryMoveCallbacks = {
      unsetThingPosition: (thing) => {
        capturedX = thing.x;
        capturedY = thing.y;
      },
      setThingPosition: () => {},
    };
    tryMove(mobj, (10 * F) | 0, (20 * F) | 0, mapData, blocklinks, callbacks);
    expect(capturedX).toBe((1 * F) | 0);
    expect(capturedY).toBe((2 * F) | 0);
  });

  it('calls setThingPosition after updating x/y', () => {
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ x: 0, y: 0, z: 0 });
    const targetX = (10 * F) | 0;
    const targetY = (20 * F) | 0;
    let capturedX = 0;
    let capturedY = 0;
    const callbacks: TryMoveCallbacks = {
      unsetThingPosition: () => {},
      setThingPosition: (thing) => {
        capturedX = thing.x;
        capturedY = thing.y;
      },
    };
    tryMove(mobj, targetX, targetY, mapData, blocklinks, callbacks);
    expect(capturedX).toBe(targetX);
    expect(capturedY).toBe(targetY);
  });

  it('calls unset before set', () => {
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ x: 0, y: 0, z: 0 });
    const callOrder: string[] = [];
    const callbacks: TryMoveCallbacks = {
      unsetThingPosition: () => {
        callOrder.push('unset');
      },
      setThingPosition: () => {
        callOrder.push('set');
      },
    };
    tryMove(mobj, (5 * F) | 0, (5 * F) | 0, mapData, blocklinks, callbacks);
    expect(callOrder).toEqual(['unset', 'set']);
  });

  it('does not call position callbacks on failed move', () => {
    const sectors: readonly MapSector[] = [
      Object.freeze({
        floorheight: (30 * F) | 0,
        ceilingheight: (200 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ x: 0, y: 0, z: 0 });
    let called = false;
    const callbacks: TryMoveCallbacks = {
      unsetThingPosition: () => {
        called = true;
      },
      setThingPosition: () => {
        called = true;
      },
    };
    tryMove(mobj, (5 * F) | 0, (5 * F) | 0, mapData, blocklinks, callbacks);
    expect(called).toBe(false);
  });

  it('does not update x/y on failed move', () => {
    const sectors: readonly MapSector[] = [
      Object.freeze({
        floorheight: (30 * F) | 0,
        ceilingheight: (200 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const originalX = (1 * F) | 0;
    const originalY = (2 * F) | 0;
    const mobj = createMobj({ x: originalX, y: originalY, z: 0 });
    tryMove(mobj, (5 * F) | 0, (5 * F) | 0, mapData, blocklinks);
    expect(mobj.x).toBe(originalX);
    expect(mobj.y).toBe(originalY);
  });
});

describe('tryMove — special line processing', () => {
  function makeSpecialLineMap(): {
    mapData: MapData;
    blocklinks: BlockThingsGrid;
  } {
    // Horizontal two-sided line at y=5*F with special=42.
    // Moving from y=0 to y=10*F crosses it.
    const vertexes: MapVertex[] = [Object.freeze({ x: (-100 * F) | 0, y: (5 * F) | 0 }), Object.freeze({ x: (100 * F) | 0, y: (5 * F) | 0 })];
    const linedefs = [makeLinedef(0, 1, vertexes[0]!.x, vertexes[0]!.y, vertexes[1]!.x, vertexes[1]!.y, 0, 42, 1)];
    const lineSectors: LineSectors[] = [{ frontsector: 0, backsector: 0 }];
    const cellLines = new Map<number, number[]>();
    cellLines.set(0, [0]);
    const blockmap = createBlockmapWithLines(1, 1, (-128 * F) | 0, (-128 * F) | 0, cellLines);
    const mapData = createTestMapData({
      vertexes,
      linedefs,
      lineSectors,
      blockmap,
    });
    return { mapData, blocklinks: createBlockThingsGrid(1, 1) };
  }

  it('calls crossSpecialLine when line is actually crossed', () => {
    const { mapData, blocklinks } = makeSpecialLineMap();
    const crossedLines: { linedefIndex: number; oldside: number }[] = [];
    const callbacks: TryMoveCallbacks = {
      crossSpecialLine: (linedefIndex, oldside) => {
        crossedLines.push({ linedefIndex, oldside });
      },
    };
    const mobj = createMobj({ x: 0, y: 0, z: 0 });
    tryMove(mobj, 0, (10 * F) | 0, mapData, blocklinks, callbacks);
    expect(crossedLines.length).toBe(1);
    expect(crossedLines[0]!.linedefIndex).toBe(0);
  });

  it('does not call crossSpecialLine when not actually crossing', () => {
    const { mapData, blocklinks } = makeSpecialLineMap();
    const crossedLines: number[] = [];
    const callbacks: TryMoveCallbacks = {
      crossSpecialLine: (linedefIndex) => {
        crossedLines.push(linedefIndex);
      },
    };
    // Move from y=0 to y=1*F — both on the same side of the line at y=5*F.
    const mobj = createMobj({ x: 0, y: 0, z: 0 });
    tryMove(mobj, 0, F, mapData, blocklinks, callbacks);
    expect(crossedLines.length).toBe(0);
  });

  it('processes special lines in reverse order (numspechit--)', () => {
    // Two horizontal two-sided lines: line 0 at y=3*F, line 1 at y=7*F.
    const vertexes: MapVertex[] = [
      Object.freeze({ x: (-100 * F) | 0, y: (3 * F) | 0 }),
      Object.freeze({ x: (100 * F) | 0, y: (3 * F) | 0 }),
      Object.freeze({ x: (-100 * F) | 0, y: (7 * F) | 0 }),
      Object.freeze({ x: (100 * F) | 0, y: (7 * F) | 0 }),
    ];
    const linedefs = [makeLinedef(0, 1, vertexes[0]!.x, vertexes[0]!.y, vertexes[1]!.x, vertexes[1]!.y, 0, 10, 1), makeLinedef(2, 3, vertexes[2]!.x, vertexes[2]!.y, vertexes[3]!.x, vertexes[3]!.y, 0, 20, 1)];
    const lineSectors: LineSectors[] = [
      { frontsector: 0, backsector: 0 },
      { frontsector: 0, backsector: 0 },
    ];
    const cellLines = new Map<number, number[]>();
    cellLines.set(0, [0, 1]);
    const blockmap = createBlockmapWithLines(1, 1, (-128 * F) | 0, (-128 * F) | 0, cellLines);
    const mapData = createTestMapData({
      vertexes,
      linedefs,
      lineSectors,
      blockmap,
    });
    const blocklinks = createBlockThingsGrid(1, 1);
    const crossOrder: number[] = [];
    const callbacks: TryMoveCallbacks = {
      crossSpecialLine: (linedefIndex) => {
        crossOrder.push(linedefIndex);
      },
    };
    // Move from y=0 to y=10*F — crosses both lines.
    const mobj = createMobj({ x: 0, y: 0, z: 0 });
    tryMove(mobj, 0, (10 * F) | 0, mapData, blocklinks, callbacks);
    // spechit adds line 0 first, then line 1.
    // numspechit-- processes in reverse: line 1 first, then line 0.
    expect(crossOrder).toEqual([1, 0]);
  });

  it('passes oldside to crossSpecialLine', () => {
    const { mapData, blocklinks } = makeSpecialLineMap();
    const oldsides: number[] = [];
    const callbacks: TryMoveCallbacks = {
      crossSpecialLine: (_linedefIndex, oldside) => {
        oldsides.push(oldside);
      },
    };
    const mobj = createMobj({ x: 0, y: 0, z: 0 });
    tryMove(mobj, 0, (10 * F) | 0, mapData, blocklinks, callbacks);
    expect(oldsides.length).toBe(1);
    // oldside is determined by P_PointOnLineSide(oldx, oldy, ld)
    expect(typeof oldsides[0]).toBe('number');
  });
});

describe('tryMove — parity-sensitive edge cases', () => {
  it('floatok is set to false initially, even for successful move', () => {
    // Verify that the result object starts with floatok=false and only
    // gets set to true during the constraint checks (not pre-set).
    const sectors: readonly MapSector[] = [
      Object.freeze({
        floorheight: 0,
        ceilingheight: (10 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    // Height 56*F > gap 10*F, so gap check fails, floatok stays false.
    const mobj = createMobj({ x: 0, y: 0, z: 0, height: (56 * F) | 0 });
    const result = tryMove(mobj, (5 * F) | 0, (5 * F) | 0, mapData, blocklinks);
    expect(result.moved).toBe(false);
    expect(result.floatok).toBe(false);
  });

  it('MAXSTEPHEIGHT uses strict greater-than comparison', () => {
    // Step exactly MAXSTEPHEIGHT: allowed.
    // Step exactly MAXSTEPHEIGHT + 1 fractional unit: blocked.
    const sectorsExact: readonly MapSector[] = [
      Object.freeze({
        floorheight: MAXSTEPHEIGHT,
        ceilingheight: (200 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      }),
    ];
    const sectorsOver: readonly MapSector[] = [
      Object.freeze({
        floorheight: (MAXSTEPHEIGHT + 1) | 0,
        ceilingheight: (200 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      }),
    ];

    const mapExact = createTestMapData({ sectors: sectorsExact });
    const mapOver = createTestMapData({ sectors: sectorsOver });
    const blocklinks = createBlockThingsGrid(4, 4);

    const mobj1 = createMobj({ x: 0, y: 0, z: 0 });
    const mobj2 = createMobj({ x: 0, y: 0, z: 0 });

    const resultExact = tryMove(mobj1, (5 * F) | 0, (5 * F) | 0, mapExact, blocklinks);
    const resultOver = tryMove(mobj2, (5 * F) | 0, (5 * F) | 0, mapOver, blocklinks);

    expect(resultExact.moved).toBe(true);
    expect(resultOver.moved).toBe(false);
  });

  it('ceiling check uses strict less-than', () => {
    // Thing at z=0, height=56. Ceiling at 56: allowed.
    // Ceiling at 55*F + (F-1): 55.999... * F still < 56*F: blocked.
    const sectorsFit: readonly MapSector[] = [
      Object.freeze({
        floorheight: 0,
        ceilingheight: (56 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      }),
    ];
    const sectorsTight: readonly MapSector[] = [
      Object.freeze({
        floorheight: 0,
        ceilingheight: (56 * F - 1) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      }),
    ];

    const mapFit = createTestMapData({ sectors: sectorsFit });
    const mapTight = createTestMapData({ sectors: sectorsTight });
    const blocklinks = createBlockThingsGrid(4, 4);

    const mobj1 = createMobj({ x: 0, y: 0, z: 0, height: (56 * F) | 0 });
    const mobj2 = createMobj({ x: 0, y: 0, z: 0, height: (56 * F) | 0 });

    const resultFit = tryMove(mobj1, (5 * F) | 0, (5 * F) | 0, mapFit, blocklinks);
    const resultTight = tryMove(mobj2, (5 * F) | 0, (5 * F) | 0, mapTight, blocklinks);

    expect(resultFit.moved).toBe(true);
    expect(resultTight.moved).toBe(false);
  });

  it('checkPosition callbacks flow through to underlying check', () => {
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ x: 0, y: 0, z: 0 });
    // The callbacks object extends CheckPositionCallbacks, so rng/damageMobj
    // should flow through. We just confirm it doesn't throw.
    const callbacks: TryMoveCallbacks = {};
    const result = tryMove(mobj, (5 * F) | 0, (5 * F) | 0, mapData, blocklinks, callbacks);
    expect(result.moved).toBe(true);
  });

  it('populates result.checkResult even when checkPosition blocks the move', () => {
    const blocklinks = createBlockThingsGrid(4, 4);
    const blocker = createMobj({
      x: (5 * F) | 0,
      y: (5 * F) | 0,
      z: 0,
      flags: MF_SOLID,
    });
    linkMobjToCell(blocker, 0, blocklinks);
    const mapData = createTestMapData();
    const mobj = createMobj({ x: 0, y: 0, z: 0 });
    const result = tryMove(mobj, (5 * F) | 0, (5 * F) | 0, mapData, blocklinks);
    expect(result.moved).toBe(false);
    expect(result.checkResult).not.toBeNull();
    expect(result.checkResult!.passed).toBe(false);
  });

  it('populates result.checkResult when step-up blocks the move (check passed, constraints failed)', () => {
    const sectors: readonly MapSector[] = [
      Object.freeze({
        floorheight: (30 * F) | 0,
        ceilingheight: (200 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ x: 0, y: 0, z: 0 });
    const result = tryMove(mobj, (5 * F) | 0, (5 * F) | 0, mapData, blocklinks);
    expect(result.moved).toBe(false);
    expect(result.checkResult).not.toBeNull();
    expect(result.checkResult!.passed).toBe(true);
    expect(result.checkResult!.floorz).toBe((30 * F) | 0);
  });

  it('integer overflow is clamped with bitwise OR 0', () => {
    // The C code uses `tmceilingz - tmfloorz < thing->height` with fixed_t (int32).
    // Our code uses `((checkResult.ceilingz - checkResult.floorz) | 0)`.
    // Confirm that large fixed values don't produce incorrect results.
    const sectors: readonly MapSector[] = [
      Object.freeze({
        floorheight: 0,
        ceilingheight: 0x7fff_0000,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ x: 0, y: 0, z: 0, height: (56 * F) | 0 });
    const result = tryMove(mobj, (5 * F) | 0, (5 * F) | 0, mapData, blocklinks);
    expect(result.moved).toBe(true);
  });

  it('dropoff check uses strict greater-than like step-up', () => {
    // floorz - dropoffz exactly at MAXSTEPHEIGHT: allowed.
    // floorz - dropoffz at MAXSTEPHEIGHT + 1: blocked.
    const vertexes: MapVertex[] = [Object.freeze({ x: (-100 * F) | 0, y: (5 * F) | 0 }), Object.freeze({ x: (100 * F) | 0, y: (5 * F) | 0 })];

    function makeDropoffSectors(dropoffAmount: Fixed): MapSector[] {
      return [
        Object.freeze({
          floorheight: 0,
          ceilingheight: (128 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        }),
        Object.freeze({
          floorheight: (-dropoffAmount | 0) as Fixed,
          ceilingheight: (128 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        }),
      ];
    }

    function makeDropoffMapWithAmount(amount: Fixed) {
      const sectors = makeDropoffSectors(amount);
      const linedefs = [makeLinedef(0, 1, vertexes[0]!.x, vertexes[0]!.y, vertexes[1]!.x, vertexes[1]!.y, 0, 0, 1)];
      const lineSectors: LineSectors[] = [{ frontsector: 0, backsector: 1 }];
      const cellLines = new Map<number, number[]>();
      for (let i = 0; i < 4; i++) cellLines.set(i, [0]);
      const blockmap = createBlockmapWithLines(2, 2, (-64 * F) | 0, (-64 * F) | 0, cellLines);
      return createTestMapData({
        sectors,
        vertexes,
        linedefs,
        lineSectors,
        blockmap,
        subsectorSectors: [0],
      });
    }

    const mapExact = makeDropoffMapWithAmount(MAXSTEPHEIGHT);
    const mapOver = makeDropoffMapWithAmount((MAXSTEPHEIGHT + 1) | 0);
    const blocklinks = createBlockThingsGrid(2, 2);

    const mobj1 = createMobj({ x: 0, y: 0, z: 0, flags: 0 });
    const mobj2 = createMobj({ x: 0, y: 0, z: 0, flags: 0 });

    const resultExact = tryMove(mobj1, 0, 0, mapExact, blocklinks);
    const resultOver = tryMove(mobj2, 0, 0, mapOver, createBlockThingsGrid(2, 2));

    expect(resultExact.moved).toBe(true);
    expect(resultOver.moved).toBe(false);
  });
});
