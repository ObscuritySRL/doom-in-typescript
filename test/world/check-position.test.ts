import { describe, expect, it } from 'bun:test';

import type { Fixed } from '../../src/core/fixed.ts';
import { FRACBITS, FRACUNIT } from '../../src/core/fixed.ts';
import { createValidCount } from '../../src/map/blockmapIter.ts';
import type { ValidCount } from '../../src/map/blockmapIter.ts';
import type { Blockmap } from '../../src/map/blockmap.ts';
import type { MapLinedef, MapSector, MapVertex } from '../../src/map/lineSectorGeometry.ts';
import { BOXTOP, BOXBOTTOM, BOXLEFT, BOXRIGHT, ML_BLOCKING, ML_BLOCKMONSTERS, ST_HORIZONTAL, ST_NEGATIVE, ST_POSITIVE, ST_VERTICAL } from '../../src/map/lineSectorGeometry.ts';
import type { MapData, LineSectors } from '../../src/map/mapSetup.ts';
import { MAXRADIUS } from '../../src/map/mapSetup.ts';
import type { RejectMap } from '../../src/map/reject.ts';
import { MF_MISSILE, MF_NOCLIP, MF_PICKUP, MF_SHOOTABLE, MF_SKULLFLY, MF_SOLID, MF_SPECIAL, Mobj, MobjType } from '../../src/world/mobj.ts';
import { blockThingsIterator, boxOnLineSide, checkPosition, createBlockThingsGrid, lineOpening } from '../../src/world/checkPosition.ts';
import type { BlockThingsGrid, CheckPositionResult } from '../../src/world/checkPosition.ts';

// ── Helpers ──────────────────────────────────────────────────────────

const F = FRACUNIT;

/** Create a minimal blockmap with no linedefs in any cell. */
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

/** Create a blockmap where specific cells contain specific linedef indices. */
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

/** Build a minimal MapData with one sector and no lines. */
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

/** Create a test mobj with specified properties. */
function createMobj(props: { x?: Fixed; y?: Fixed; z?: Fixed; radius?: Fixed; height?: Fixed; flags?: number; type?: MobjType; player?: unknown }): Mobj {
  const mobj = new Mobj();
  mobj.x = props.x ?? 0;
  mobj.y = props.y ?? 0;
  mobj.z = props.z ?? 0;
  mobj.radius = props.radius ?? (20 * F) | 0;
  mobj.height = props.height ?? (56 * F) | 0;
  mobj.flags = props.flags ?? 0;
  mobj.type = props.type ?? MobjType.PLAYER;
  mobj.player = props.player ?? null;
  return mobj;
}

/** Create a vertical linedef at a given x, spanning y1 to y2. */
function createVerticalLinedef(vertexIndex1: number, vertexIndex2: number, v1x: Fixed, v1y: Fixed, v2x: Fixed, v2y: Fixed, flags = 0, special = 0): MapLinedef {
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
    sidenum1: -1,
    slopetype,
    bbox: Object.freeze([bboxTop, bboxBottom, bboxLeft, bboxRight] as const),
  });
}

/** Link a mobj into a blocklinks cell. */
function linkMobjToCell(mobj: Mobj, cellIndex: number, blocklinks: BlockThingsGrid): void {
  mobj.blockNext = blocklinks[cellIndex] ?? null;
  if (mobj.blockNext !== null) {
    (mobj.blockNext as Mobj).blockPrev = mobj;
  }
  mobj.blockPrev = null;
  blocklinks[cellIndex] = mobj;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('createBlockThingsGrid', () => {
  it('creates a grid with the correct number of cells', () => {
    const grid = createBlockThingsGrid(3, 4);
    expect(grid.length).toBe(12);
  });

  it('initializes all cells to null', () => {
    const grid = createBlockThingsGrid(2, 2);
    for (const cell of grid) {
      expect(cell).toBeNull();
    }
  });
});

describe('blockThingsIterator', () => {
  const blockmap = createEmptyBlockmap(2, 2);

  it('returns true for out-of-bounds cell (negative x)', () => {
    const grid = createBlockThingsGrid(2, 2);
    expect(blockThingsIterator(-1, 0, blockmap, grid, () => false)).toBe(true);
  });

  it('returns true for out-of-bounds cell (exceeds columns)', () => {
    const grid = createBlockThingsGrid(2, 2);
    expect(blockThingsIterator(2, 0, blockmap, grid, () => false)).toBe(true);
  });

  it('returns true for empty cell', () => {
    const grid = createBlockThingsGrid(2, 2);
    const visited: Mobj[] = [];
    const result = blockThingsIterator(0, 0, blockmap, grid, (m) => {
      visited.push(m);
      return true;
    });
    expect(result).toBe(true);
    expect(visited.length).toBe(0);
  });

  it('visits all mobjs in the cell linked list', () => {
    const grid = createBlockThingsGrid(2, 2);
    const mobjA = createMobj({ x: 0, y: 0 });
    const mobjB = createMobj({ x: F, y: F });
    linkMobjToCell(mobjA, 0, grid);
    linkMobjToCell(mobjB, 0, grid);
    const visited: Mobj[] = [];
    blockThingsIterator(0, 0, blockmap, grid, (m) => {
      visited.push(m);
      return true;
    });
    expect(visited.length).toBe(2);
    expect(visited).toContain(mobjA);
    expect(visited).toContain(mobjB);
  });

  it('stops when callback returns false', () => {
    const grid = createBlockThingsGrid(2, 2);
    const mobjA = createMobj({});
    const mobjB = createMobj({});
    linkMobjToCell(mobjA, 0, grid);
    linkMobjToCell(mobjB, 0, grid);
    let count = 0;
    const result = blockThingsIterator(0, 0, blockmap, grid, () => {
      count++;
      return false;
    });
    expect(result).toBe(false);
    expect(count).toBe(1);
  });
});

describe('lineOpening', () => {
  it('returns openrange 0 for one-sided line', () => {
    const mapData = createTestMapData({
      lineSectors: [{ frontsector: 0, backsector: -1 }],
    });
    const opening = lineOpening(0, mapData);
    expect(opening.openrange).toBe(0);
  });

  it('computes correct opening for two sectors with equal ceilings', () => {
    const sector0: MapSector = Object.freeze({
      floorheight: 0,
      ceilingheight: (128 * F) | 0,
      floorpic: 'FLOOR4_8',
      ceilingpic: 'CEIL3_5',
      lightlevel: 160,
      special: 0,
      tag: 0,
    });
    const sector1: MapSector = Object.freeze({
      floorheight: (32 * F) | 0,
      ceilingheight: (128 * F) | 0,
      floorpic: 'FLOOR4_8',
      ceilingpic: 'CEIL3_5',
      lightlevel: 160,
      special: 0,
      tag: 0,
    });
    const mapData = createTestMapData({
      sectors: [sector0, sector1],
      lineSectors: [{ frontsector: 0, backsector: 1 }],
    });
    const opening = lineOpening(0, mapData);
    expect(opening.opentop).toBe((128 * F) | 0);
    expect(opening.openbottom).toBe((32 * F) | 0);
    expect(opening.openrange).toBe((96 * F) | 0);
    expect(opening.lowfloor).toBe(0);
  });

  it('picks lower ceiling when front is lower', () => {
    const sector0: MapSector = Object.freeze({
      floorheight: 0,
      ceilingheight: (100 * F) | 0,
      floorpic: 'F',
      ceilingpic: 'C',
      lightlevel: 160,
      special: 0,
      tag: 0,
    });
    const sector1: MapSector = Object.freeze({
      floorheight: 0,
      ceilingheight: (128 * F) | 0,
      floorpic: 'F',
      ceilingpic: 'C',
      lightlevel: 160,
      special: 0,
      tag: 0,
    });
    const mapData = createTestMapData({
      sectors: [sector0, sector1],
      lineSectors: [{ frontsector: 0, backsector: 1 }],
    });
    const opening = lineOpening(0, mapData);
    expect(opening.opentop).toBe((100 * F) | 0);
  });

  it('picks lower ceiling when back is lower', () => {
    const sector0: MapSector = Object.freeze({
      floorheight: 0,
      ceilingheight: (128 * F) | 0,
      floorpic: 'F',
      ceilingpic: 'C',
      lightlevel: 160,
      special: 0,
      tag: 0,
    });
    const sector1: MapSector = Object.freeze({
      floorheight: 0,
      ceilingheight: (80 * F) | 0,
      floorpic: 'F',
      ceilingpic: 'C',
      lightlevel: 160,
      special: 0,
      tag: 0,
    });
    const mapData = createTestMapData({
      sectors: [sector0, sector1],
      lineSectors: [{ frontsector: 0, backsector: 1 }],
    });
    const opening = lineOpening(0, mapData);
    expect(opening.opentop).toBe((80 * F) | 0);
  });

  it('lowfloor is the lower of the two floors', () => {
    const sector0: MapSector = Object.freeze({
      floorheight: (16 * F) | 0,
      ceilingheight: (128 * F) | 0,
      floorpic: 'F',
      ceilingpic: 'C',
      lightlevel: 160,
      special: 0,
      tag: 0,
    });
    const sector1: MapSector = Object.freeze({
      floorheight: (48 * F) | 0,
      ceilingheight: (128 * F) | 0,
      floorpic: 'F',
      ceilingpic: 'C',
      lightlevel: 160,
      special: 0,
      tag: 0,
    });
    const mapData = createTestMapData({
      sectors: [sector0, sector1],
      lineSectors: [{ frontsector: 0, backsector: 1 }],
    });
    const opening = lineOpening(0, mapData);
    expect(opening.openbottom).toBe((48 * F) | 0);
    expect(opening.lowfloor).toBe((16 * F) | 0);
  });
});

describe('boxOnLineSide', () => {
  it('returns 0 or 1 when box is entirely on one side of a vertical line', () => {
    const vx = (64 * F) | 0;
    const vertexes: MapVertex[] = [Object.freeze({ x: vx, y: 0 }), Object.freeze({ x: vx, y: (128 * F) | 0 })];
    const linedef = createVerticalLinedef(0, 1, vx, 0, vx, (128 * F) | 0);
    const mapData = createTestMapData({
      vertexes,
      linedefs: [linedef],
      lineSectors: [{ frontsector: 0, backsector: -1 }],
    });

    // Box entirely left of the vertical line.
    const bboxLeft: [Fixed, Fixed, Fixed, Fixed] = [
      (80 * F) | 0, // top
      (40 * F) | 0, // bottom
      (10 * F) | 0, // left
      (50 * F) | 0, // right
    ];
    const sideLeft = boxOnLineSide(bboxLeft, 0, mapData);
    expect(sideLeft).not.toBe(-1);

    // Box entirely right of the vertical line.
    const bboxRight: [Fixed, Fixed, Fixed, Fixed] = [(80 * F) | 0, (40 * F) | 0, (70 * F) | 0, (120 * F) | 0];
    const sideRight = boxOnLineSide(bboxRight, 0, mapData);
    expect(sideRight).not.toBe(-1);
    expect(sideRight).not.toBe(sideLeft);
  });

  it('returns -1 when box straddles a vertical line', () => {
    const vx = (64 * F) | 0;
    const vertexes: MapVertex[] = [Object.freeze({ x: vx, y: 0 }), Object.freeze({ x: vx, y: (128 * F) | 0 })];
    const linedef = createVerticalLinedef(0, 1, vx, 0, vx, (128 * F) | 0);
    const mapData = createTestMapData({
      vertexes,
      linedefs: [linedef],
      lineSectors: [{ frontsector: 0, backsector: -1 }],
    });

    const bbox: [Fixed, Fixed, Fixed, Fixed] = [(80 * F) | 0, (40 * F) | 0, (50 * F) | 0, (80 * F) | 0];
    expect(boxOnLineSide(bbox, 0, mapData)).toBe(-1);
  });

  it('handles horizontal line correctly', () => {
    const vy = (64 * F) | 0;
    const vertexes: MapVertex[] = [Object.freeze({ x: 0, y: vy }), Object.freeze({ x: (128 * F) | 0, y: vy })];
    const linedef = createVerticalLinedef(0, 1, 0, vy, (128 * F) | 0, vy);
    expect(linedef.slopetype).toBe(ST_HORIZONTAL);
    const mapData = createTestMapData({
      vertexes,
      linedefs: [linedef],
      lineSectors: [{ frontsector: 0, backsector: -1 }],
    });

    // Box entirely above the horizontal line.
    const bboxAbove: [Fixed, Fixed, Fixed, Fixed] = [(100 * F) | 0, (70 * F) | 0, (20 * F) | 0, (80 * F) | 0];
    const side = boxOnLineSide(bboxAbove, 0, mapData);
    expect(side).not.toBe(-1);
  });

  it('handles positive slope correctly', () => {
    const vertexes: MapVertex[] = [Object.freeze({ x: 0, y: 0 }), Object.freeze({ x: (128 * F) | 0, y: (128 * F) | 0 })];
    const linedef = createVerticalLinedef(0, 1, 0, 0, (128 * F) | 0, (128 * F) | 0);
    expect(linedef.slopetype).toBe(ST_POSITIVE);
    const mapData = createTestMapData({
      vertexes,
      linedefs: [linedef],
      lineSectors: [{ frontsector: 0, backsector: -1 }],
    });

    // Box entirely on one side of the diagonal.
    const bboxSide: [Fixed, Fixed, Fixed, Fixed] = [(20 * F) | 0, (10 * F) | 0, (100 * F) | 0, (120 * F) | 0];
    const side = boxOnLineSide(bboxSide, 0, mapData);
    expect(side).not.toBe(-1);
  });

  it('handles negative slope correctly', () => {
    const vertexes: MapVertex[] = [Object.freeze({ x: 0, y: (128 * F) | 0 }), Object.freeze({ x: (128 * F) | 0, y: 0 })];
    const linedef = createVerticalLinedef(0, 1, 0, (128 * F) | 0, (128 * F) | 0, 0);
    expect(linedef.slopetype).toBe(ST_NEGATIVE);
    const mapData = createTestMapData({
      vertexes,
      linedefs: [linedef],
      lineSectors: [{ frontsector: 0, backsector: -1 }],
    });

    // Box far below the descending line: at x=100–120 the line is at
    // y=28–8, so a box with top=4 is entirely below.
    const bboxSide: [Fixed, Fixed, Fixed, Fixed] = [(4 * F) | 0, (2 * F) | 0, (100 * F) | 0, (120 * F) | 0];
    const side = boxOnLineSide(bboxSide, 0, mapData);
    expect(side).not.toBe(-1);
  });
});

describe('checkPosition', () => {
  it('passes in open space with no things or lines', () => {
    const mapData = createTestMapData();
    const grid = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ x: (32 * F) | 0, y: (32 * F) | 0 });

    const result = checkPosition(mobj, (32 * F) | 0, (32 * F) | 0, mapData, grid);
    expect(result.passed).toBe(true);
    expect(result.ceilingline).toBe(-1);
    expect(result.specials.length).toBe(0);
  });

  it('sets floor/ceiling from the subsector sector', () => {
    const mapData = createTestMapData();
    const grid = createBlockThingsGrid(4, 4);
    const mobj = createMobj({});

    const result = checkPosition(mobj, 0, 0, mapData, grid);
    expect(result.floorz).toBe(0);
    expect(result.ceilingz).toBe((128 * F) | 0);
    expect(result.dropoffz).toBe(0);
  });

  it('MF_NOCLIP bypasses all checks', () => {
    const mapData = createTestMapData();
    const grid = createBlockThingsGrid(4, 4);

    // Place a solid obstacle in the grid at cell 0.
    const obstacle = createMobj({
      x: 0,
      y: 0,
      flags: MF_SOLID,
      radius: (20 * F) | 0,
    });
    linkMobjToCell(obstacle, 0, grid);

    // The noclip mobj overlaps the obstacle.
    const mobj = createMobj({
      x: 0,
      y: 0,
      flags: MF_NOCLIP,
      radius: (20 * F) | 0,
    });

    const result = checkPosition(mobj, 0, 0, mapData, grid);
    expect(result.passed).toBe(true);
  });

  it('is blocked by a solid thing within bounding distance', () => {
    const mapData = createTestMapData();
    const grid = createBlockThingsGrid(4, 4);

    const obstacle = createMobj({
      x: (10 * F) | 0,
      y: 0,
      flags: MF_SOLID,
      radius: (20 * F) | 0,
    });
    linkMobjToCell(obstacle, 0, grid);

    const mobj = createMobj({
      x: 0,
      y: 0,
      flags: 0,
      radius: (20 * F) | 0,
    });

    const result = checkPosition(mobj, 0, 0, mapData, grid);
    expect(result.passed).toBe(false);
  });

  it('ignores self-collision', () => {
    const mapData = createTestMapData();
    const grid = createBlockThingsGrid(4, 4);

    const mobj = createMobj({
      x: 0,
      y: 0,
      flags: MF_SOLID,
      radius: (20 * F) | 0,
    });
    linkMobjToCell(mobj, 0, grid);

    const result = checkPosition(mobj, 0, 0, mapData, grid);
    expect(result.passed).toBe(true);
  });

  it('ignores non-interactive things (no SOLID|SPECIAL|SHOOTABLE)', () => {
    const mapData = createTestMapData();
    const grid = createBlockThingsGrid(4, 4);

    const decoration = createMobj({
      x: 0,
      y: 0,
      flags: 0,
      radius: (20 * F) | 0,
    });
    linkMobjToCell(decoration, 0, grid);

    const mobj = createMobj({ x: 0, y: 0, radius: (20 * F) | 0 });
    const result = checkPosition(mobj, 0, 0, mapData, grid);
    expect(result.passed).toBe(true);
  });

  it('passes when things are outside bounding distance', () => {
    const mapData = createTestMapData();
    const grid = createBlockThingsGrid(4, 4);

    const farThing = createMobj({
      x: (100 * F) | 0,
      y: 0,
      flags: MF_SOLID,
      radius: (20 * F) | 0,
    });
    linkMobjToCell(farThing, 0, grid);

    const mobj = createMobj({ x: 0, y: 0, radius: (20 * F) | 0 });
    const result = checkPosition(mobj, 0, 0, mapData, grid);
    expect(result.passed).toBe(true);
  });

  it('is blocked by a one-sided line', () => {
    // Vertical wall at x=64 spanning y=0 to y=128 (in map units).
    const wallX = (64 * F) | 0;
    const vertexes: MapVertex[] = [Object.freeze({ x: wallX, y: 0 }), Object.freeze({ x: wallX, y: (128 * F) | 0 })];
    const linedef = createVerticalLinedef(0, 1, wallX, 0, wallX, (128 * F) | 0, ML_BLOCKING);

    // Place linedef 0 in blockmap cell 0 (which covers origin area).
    const blockmap = createBlockmapWithLines(4, 4, 0, 0, new Map([[0, [0]]]));

    const mapData = createTestMapData({
      vertexes,
      linedefs: [linedef],
      lineSectors: [{ frontsector: 0, backsector: -1 }],
      blockmap,
    });
    const grid = createBlockThingsGrid(4, 4);

    // Mobj with radius 20, testing at x=54 (bbox extends from 34 to 74,
    // straddling the wall at x=64).
    const mobj = createMobj({ radius: (20 * F) | 0 });
    const result = checkPosition(mobj, (54 * F) | 0, (64 * F) | 0, mapData, grid);
    expect(result.passed).toBe(false);
  });

  it('adjusts floor/ceiling from a two-sided line opening', () => {
    const sector0: MapSector = Object.freeze({
      floorheight: 0,
      ceilingheight: (128 * F) | 0,
      floorpic: 'F',
      ceilingpic: 'C',
      lightlevel: 160,
      special: 0,
      tag: 0,
    });
    const sector1: MapSector = Object.freeze({
      floorheight: (24 * F) | 0,
      ceilingheight: (96 * F) | 0,
      floorpic: 'F',
      ceilingpic: 'C',
      lightlevel: 160,
      special: 0,
      tag: 0,
    });

    const wallX = (64 * F) | 0;
    const vertexes: MapVertex[] = [Object.freeze({ x: wallX, y: 0 }), Object.freeze({ x: wallX, y: (256 * F) | 0 })];
    const linedef = createVerticalLinedef(0, 1, wallX, 0, wallX, (256 * F) | 0);

    const blockmap = createBlockmapWithLines(4, 4, 0, 0, new Map([[0, [0]]]));

    const mapData = createTestMapData({
      sectors: [sector0, sector1],
      vertexes,
      linedefs: [linedef],
      lineSectors: [{ frontsector: 0, backsector: 1 }],
      blockmap,
    });
    const grid = createBlockThingsGrid(4, 4);

    const mobj = createMobj({ radius: (20 * F) | 0 });
    const result = checkPosition(mobj, (54 * F) | 0, (64 * F) | 0, mapData, grid);
    expect(result.passed).toBe(true);
    expect(result.ceilingz).toBe((96 * F) | 0);
    expect(result.floorz).toBe((24 * F) | 0);
    expect(result.dropoffz).toBe(0);
    expect(result.ceilingline).toBe(0);
  });

  it('tracks special lines crossed', () => {
    const wallX = (64 * F) | 0;
    const vertexes: MapVertex[] = [Object.freeze({ x: wallX, y: 0 }), Object.freeze({ x: wallX, y: (256 * F) | 0 })];
    const linedef = createVerticalLinedef(0, 1, wallX, 0, wallX, (256 * F) | 0, 0, 97);

    const blockmap = createBlockmapWithLines(4, 4, 0, 0, new Map([[0, [0]]]));

    const mapData = createTestMapData({
      vertexes,
      linedefs: [linedef],
      lineSectors: [{ frontsector: 0, backsector: 0 }],
      blockmap,
    });
    const grid = createBlockThingsGrid(4, 4);

    const mobj = createMobj({ radius: (20 * F) | 0 });
    const result = checkPosition(mobj, (54 * F) | 0, (64 * F) | 0, mapData, grid);
    expect(result.passed).toBe(true);
    expect(result.specials).toContain(0);
  });

  it('ML_BLOCKING stops non-missile movement on a two-sided line', () => {
    const wallX = (64 * F) | 0;
    const vertexes: MapVertex[] = [Object.freeze({ x: wallX, y: 0 }), Object.freeze({ x: wallX, y: (256 * F) | 0 })];
    const linedef = createVerticalLinedef(0, 1, wallX, 0, wallX, (256 * F) | 0, ML_BLOCKING);

    const blockmap = createBlockmapWithLines(4, 4, 0, 0, new Map([[0, [0]]]));

    const mapData = createTestMapData({
      vertexes,
      linedefs: [linedef],
      lineSectors: [{ frontsector: 0, backsector: 0 }],
      blockmap,
    });
    const grid = createBlockThingsGrid(4, 4);

    const mobj = createMobj({ radius: (20 * F) | 0 });
    const result = checkPosition(mobj, (54 * F) | 0, (64 * F) | 0, mapData, grid);
    expect(result.passed).toBe(false);
  });

  it('ML_BLOCKMONSTERS blocks non-player mobjs', () => {
    const wallX = (64 * F) | 0;
    const vertexes: MapVertex[] = [Object.freeze({ x: wallX, y: 0 }), Object.freeze({ x: wallX, y: (256 * F) | 0 })];
    const linedef = createVerticalLinedef(0, 1, wallX, 0, wallX, (256 * F) | 0, ML_BLOCKMONSTERS);

    const blockmap = createBlockmapWithLines(4, 4, 0, 0, new Map([[0, [0]]]));

    const mapData = createTestMapData({
      vertexes,
      linedefs: [linedef],
      lineSectors: [{ frontsector: 0, backsector: 0 }],
      blockmap,
    });
    const grid = createBlockThingsGrid(4, 4);

    // Monster (no player field).
    const monster = createMobj({
      radius: (20 * F) | 0,
      type: MobjType.POSSESSED,
    });
    const resultMonster = checkPosition(monster, (54 * F) | 0, (64 * F) | 0, mapData, grid);
    expect(resultMonster.passed).toBe(false);

    // Player (player field set).
    const player = createMobj({
      radius: (20 * F) | 0,
      player: {
        /* non-null */
      },
    });
    const resultPlayer = checkPosition(player, (54 * F) | 0, (64 * F) | 0, mapData, grid);
    expect(resultPlayer.passed).toBe(true);
  });

  it('missiles skip ML_BLOCKING on two-sided lines', () => {
    const wallX = (64 * F) | 0;
    const vertexes: MapVertex[] = [Object.freeze({ x: wallX, y: 0 }), Object.freeze({ x: wallX, y: (256 * F) | 0 })];
    const linedef = createVerticalLinedef(0, 1, wallX, 0, wallX, (256 * F) | 0, ML_BLOCKING);

    const blockmap = createBlockmapWithLines(4, 4, 0, 0, new Map([[0, [0]]]));

    const mapData = createTestMapData({
      vertexes,
      linedefs: [linedef],
      lineSectors: [{ frontsector: 0, backsector: 0 }],
      blockmap,
    });
    const grid = createBlockThingsGrid(4, 4);

    const missile = createMobj({
      radius: (20 * F) | 0,
      flags: MF_MISSILE,
    });
    const result = checkPosition(missile, (54 * F) | 0, (64 * F) | 0, mapData, grid);
    expect(result.passed).toBe(true);
  });

  it('non-solid MF_SPECIAL thing does not block', () => {
    const mapData = createTestMapData();
    const grid = createBlockThingsGrid(4, 4);

    const pickup = createMobj({
      x: 0,
      y: 0,
      flags: MF_SPECIAL,
      radius: (20 * F) | 0,
    });
    linkMobjToCell(pickup, 0, grid);

    const mobj = createMobj({
      flags: MF_PICKUP,
      radius: (20 * F) | 0,
    });
    const result = checkPosition(mobj, 0, 0, mapData, grid);
    expect(result.passed).toBe(true);
  });

  it('solid MF_SPECIAL thing blocks', () => {
    const mapData = createTestMapData();
    const grid = createBlockThingsGrid(4, 4);

    const solidPickup = createMobj({
      x: 0,
      y: 0,
      flags: MF_SPECIAL | MF_SOLID,
      radius: (20 * F) | 0,
    });
    linkMobjToCell(solidPickup, 0, grid);

    const mobj = createMobj({ radius: (20 * F) | 0 });
    const result = checkPosition(mobj, 0, 0, mapData, grid);
    expect(result.passed).toBe(false);
  });
});

describe('missile collision', () => {
  it('missile passes over a thing (z overhead)', () => {
    const mapData = createTestMapData();
    const grid = createBlockThingsGrid(4, 4);

    const target = createMobj({
      x: 0,
      y: 0,
      z: 0,
      height: (56 * F) | 0,
      flags: MF_SOLID | MF_SHOOTABLE,
      radius: (20 * F) | 0,
    });
    linkMobjToCell(target, 0, grid);

    const missile = createMobj({
      z: (57 * F) | 0,
      height: (8 * F) | 0,
      flags: MF_MISSILE,
      radius: (11 * F) | 0,
    });

    const result = checkPosition(missile, 0, 0, mapData, grid);
    expect(result.passed).toBe(true);
  });

  it('missile passes under a thing (z underneath)', () => {
    const mapData = createTestMapData();
    const grid = createBlockThingsGrid(4, 4);

    const target = createMobj({
      x: 0,
      y: 0,
      z: (100 * F) | 0,
      height: (56 * F) | 0,
      flags: MF_SOLID | MF_SHOOTABLE,
      radius: (20 * F) | 0,
    });
    linkMobjToCell(target, 0, grid);

    const missile = createMobj({
      z: 0,
      height: (8 * F) | 0,
      flags: MF_MISSILE,
      radius: (11 * F) | 0,
    });

    const result = checkPosition(missile, 0, 0, mapData, grid);
    expect(result.passed).toBe(true);
  });

  it('missile blocked by shootable thing at same z', () => {
    const mapData = createTestMapData();
    const grid = createBlockThingsGrid(4, 4);

    const target = createMobj({
      x: 0,
      y: 0,
      z: 0,
      height: (56 * F) | 0,
      flags: MF_SOLID | MF_SHOOTABLE,
      radius: (20 * F) | 0,
    });
    linkMobjToCell(target, 0, grid);

    const missile = createMobj({
      z: (28 * F) | 0,
      height: (8 * F) | 0,
      flags: MF_MISSILE,
      radius: (11 * F) | 0,
    });

    const result = checkPosition(missile, 0, 0, mapData, grid);
    expect(result.passed).toBe(false);
  });

  it('missile does not hit same species as originator (not player)', () => {
    const mapData = createTestMapData();
    const grid = createBlockThingsGrid(4, 4);

    const originator = createMobj({
      type: MobjType.POSSESSED,
    });

    const sameSpecies = createMobj({
      x: 0,
      y: 0,
      z: 0,
      height: (56 * F) | 0,
      flags: MF_SOLID | MF_SHOOTABLE,
      radius: (20 * F) | 0,
      type: MobjType.POSSESSED,
    });
    linkMobjToCell(sameSpecies, 0, grid);

    const missile = createMobj({
      z: (28 * F) | 0,
      height: (8 * F) | 0,
      flags: MF_MISSILE,
      radius: (11 * F) | 0,
    });
    missile.target = originator;

    const result = checkPosition(missile, 0, 0, mapData, grid);
    // Same species non-player: missile is blocked but does no damage
    // (return false from PIT_CheckThing).
    expect(result.passed).toBe(false);
  });

  it('missile passes through its own originator', () => {
    const mapData = createTestMapData();
    const grid = createBlockThingsGrid(4, 4);

    const originator = createMobj({
      x: 0,
      y: 0,
      z: 0,
      height: (56 * F) | 0,
      flags: MF_SOLID | MF_SHOOTABLE,
      radius: (20 * F) | 0,
      type: MobjType.POSSESSED,
    });
    linkMobjToCell(originator, 0, grid);

    const missile = createMobj({
      z: (28 * F) | 0,
      height: (8 * F) | 0,
      flags: MF_MISSILE,
      radius: (11 * F) | 0,
    });
    missile.target = originator;

    const result = checkPosition(missile, 0, 0, mapData, grid);
    expect(result.passed).toBe(true);
  });

  it('knight/bruiser species equivalence', () => {
    const mapData = createTestMapData();
    const grid = createBlockThingsGrid(4, 4);

    const knight = createMobj({ type: MobjType.KNIGHT });

    const bruiser = createMobj({
      x: 0,
      y: 0,
      z: 0,
      height: (56 * F) | 0,
      flags: MF_SOLID | MF_SHOOTABLE,
      radius: (20 * F) | 0,
      type: MobjType.BRUISER,
    });
    linkMobjToCell(bruiser, 0, grid);

    const missile = createMobj({
      z: (28 * F) | 0,
      height: (8 * F) | 0,
      flags: MF_MISSILE,
      radius: (11 * F) | 0,
    });
    missile.target = knight;

    const result = checkPosition(missile, 0, 0, mapData, grid);
    // Knight missile hitting a bruiser = same species, blocked without damage.
    expect(result.passed).toBe(false);
  });
});

describe('skull fly collision', () => {
  it('skull fly is blocked and clears momentum', () => {
    const mapData = createTestMapData();
    const grid = createBlockThingsGrid(4, 4);

    const target = createMobj({
      x: 0,
      y: 0,
      flags: MF_SOLID | MF_SHOOTABLE,
      radius: (20 * F) | 0,
    });
    linkMobjToCell(target, 0, grid);

    const skull = createMobj({
      flags: MF_SKULLFLY | MF_SOLID,
      radius: (16 * F) | 0,
    });
    skull.momx = (10 * F) | 0;
    skull.momy = (5 * F) | 0;
    skull.momz = (3 * F) | 0;

    const result = checkPosition(skull, 0, 0, mapData, grid);
    expect(result.passed).toBe(false);
    expect(skull.flags & MF_SKULLFLY).toBe(0);
    expect(skull.momx).toBe(0);
    expect(skull.momy).toBe(0);
    expect(skull.momz).toBe(0);
  });
});

describe('parity-sensitive edge cases', () => {
  it('blockdist uses integer addition for radius sum', () => {
    // Two things with radii that sum to exactly the distance apart:
    // blockdist = 20*F + 20*F = 40*F. If distance == blockdist, no hit.
    const mapData = createTestMapData();
    const grid = createBlockThingsGrid(4, 4);

    const obstacle = createMobj({
      x: (40 * F) | 0,
      y: 0,
      flags: MF_SOLID,
      radius: (20 * F) | 0,
    });
    linkMobjToCell(obstacle, 0, grid);

    const mobj = createMobj({ radius: (20 * F) | 0 });
    // Distance = 40*F, blockdist = 40*F. >= means no hit.
    const result = checkPosition(mobj, 0, 0, mapData, grid);
    expect(result.passed).toBe(true);
  });

  it('AABB line test uses <= and >= (edge-on does not cross)', () => {
    // Linedef bbox right edge == thing bbox left edge: no crossing.
    const wallX = (64 * F) | 0;
    const vertexes: MapVertex[] = [Object.freeze({ x: 0, y: 0 }), Object.freeze({ x: wallX, y: 0 })];
    // Horizontal line from (0,0) to (64,0). bbox right = 64*F.
    const linedef = createVerticalLinedef(0, 1, 0, 0, wallX, 0);
    const blockmap = createBlockmapWithLines(4, 4, 0, 0, new Map([[0, [0]]]));
    const mapData = createTestMapData({
      vertexes,
      linedefs: [linedef],
      lineSectors: [{ frontsector: 0, backsector: -1 }],
      blockmap,
    });
    const grid = createBlockThingsGrid(4, 4);

    // Mobj at x=84 with radius=20: bbox left = 64*F.
    // tmbbox[BOXLEFT] = 64*F >= linedef.bbox[BOXRIGHT] = 64*F → true → skip.
    const mobj = createMobj({ radius: (20 * F) | 0 });
    const result = checkPosition(mobj, (84 * F) | 0, (10 * F) | 0, mapData, grid);
    expect(result.passed).toBe(true);
  });

  it('validcount prevents duplicate line visits across cells', () => {
    const wallX = (64 * F) | 0;
    const vertexes: MapVertex[] = [Object.freeze({ x: wallX, y: 0 }), Object.freeze({ x: wallX, y: (256 * F) | 0 })];
    const linedef = createVerticalLinedef(0, 1, wallX, 0, wallX, (256 * F) | 0, 0, 42);

    // Put linedef 0 in two adjacent cells so it could be visited twice.
    const blockmap = createBlockmapWithLines(
      4,
      4,
      0,
      0,
      new Map([
        [0, [0]],
        [1, [0]],
      ]),
    );

    const mapData = createTestMapData({
      vertexes,
      linedefs: [linedef],
      lineSectors: [{ frontsector: 0, backsector: 0 }],
      blockmap,
    });
    const grid = createBlockThingsGrid(4, 4);

    const mobj = createMobj({ radius: (20 * F) | 0 });
    const result = checkPosition(mobj, (54 * F) | 0, (64 * F) | 0, mapData, grid);
    // Special should appear only once despite linedef being in two cells.
    const count = result.specials.filter((s) => s === 0).length;
    expect(count).toBe(1);
  });

  it('dropoffz tracks the lowest floor from all contacted lines', () => {
    const sector0: MapSector = Object.freeze({
      floorheight: (32 * F) | 0,
      ceilingheight: (128 * F) | 0,
      floorpic: 'F',
      ceilingpic: 'C',
      lightlevel: 160,
      special: 0,
      tag: 0,
    });
    const sector1: MapSector = Object.freeze({
      floorheight: 0,
      ceilingheight: (128 * F) | 0,
      floorpic: 'F',
      ceilingpic: 'C',
      lightlevel: 160,
      special: 0,
      tag: 0,
    });

    const wallX = (64 * F) | 0;
    const vertexes: MapVertex[] = [Object.freeze({ x: wallX, y: 0 }), Object.freeze({ x: wallX, y: (256 * F) | 0 })];
    const linedef = createVerticalLinedef(0, 1, wallX, 0, wallX, (256 * F) | 0);

    const blockmap = createBlockmapWithLines(4, 4, 0, 0, new Map([[0, [0]]]));

    const mapData = createTestMapData({
      sectors: [sector0, sector1],
      vertexes,
      linedefs: [linedef],
      lineSectors: [{ frontsector: 0, backsector: 1 }],
      blockmap,
    });
    const grid = createBlockThingsGrid(4, 4);

    const mobj = createMobj({ radius: (20 * F) | 0 });
    const result = checkPosition(mobj, (54 * F) | 0, (64 * F) | 0, mapData, grid);
    // dropoffz should be the lower of the two floors (sector1 at 0).
    expect(result.dropoffz).toBe(0);
    // floorz should be the higher floor (sector0 at 32*F).
    expect(result.floorz).toBe((32 * F) | 0);
  });

  it('missile z-check uses strict inequality (exactly at top = hit)', () => {
    const mapData = createTestMapData();
    const grid = createBlockThingsGrid(4, 4);

    const target = createMobj({
      x: 0,
      y: 0,
      z: 0,
      height: (56 * F) | 0,
      flags: MF_SOLID | MF_SHOOTABLE,
      radius: (20 * F) | 0,
    });
    linkMobjToCell(target, 0, grid);

    // Missile z exactly at target top: z == thing.z + thing.height.
    // The check is `>` not `>=`, so this IS a hit.
    const missile = createMobj({
      z: (56 * F) | 0,
      height: (8 * F) | 0,
      flags: MF_MISSILE,
      radius: (11 * F) | 0,
    });

    const result = checkPosition(missile, 0, 0, mapData, grid);
    expect(result.passed).toBe(false);
  });

  it('MAXRADIUS expansion on thing iteration vs no expansion on line iteration', () => {
    // MAXRADIUS is 32*FRACUNIT. Thing iteration expands the blockmap
    // range by MAXRADIUS; line iteration does not.
    expect(MAXRADIUS).toBe((32 << FRACBITS) | 0);
  });
});
