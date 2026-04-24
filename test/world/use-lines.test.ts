import { describe, expect, it } from 'bun:test';

import type { Fixed } from '../../src/core/fixed.ts';
import { FRACBITS, FRACUNIT } from '../../src/core/fixed.ts';
import { ANG180 } from '../../src/core/angle.ts';
import { createValidCount } from '../../src/map/blockmapIter.ts';
import type { Blockmap } from '../../src/map/blockmap.ts';
import type { MapLinedef, MapSector, MapSidedef, MapVertex, SlopeType } from '../../src/map/lineSectorGeometry.ts';
import { ML_BLOCKING, ML_TWOSIDED } from '../../src/map/lineSectorGeometry.ts';
import type { MapData, LineSectors } from '../../src/map/mapSetup.ts';
import type { RejectMap } from '../../src/map/reject.ts';
import { checkPosition, createBlockThingsGrid } from '../../src/world/checkPosition.ts';
import { MOBJINFO, Mobj, MobjType } from '../../src/world/mobj.ts';
import { USERANGE, MAXSPECIALCROSS, MAXSPECIALCROSS_ORIGINAL, DEFAULT_SPECHIT_MAGIC, spechitOverrun, useLines } from '../../src/world/useLines.ts';
import type { SpechitOverrunState, UseLineCallbacks } from '../../src/world/useLines.ts';

// ── Helpers ──────────────────────────────────────────────────────────

const F = FRACUNIT;

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

function makeVertex(xUnits: number, yUnits: number): MapVertex {
  return Object.freeze({
    x: (xUnits << FRACBITS) | 0,
    y: (yUnits << FRACBITS) | 0,
  });
}

function makeLinedef(vertexIndex1: number, vertexIndex2: number, vertexes: readonly MapVertex[], overrides?: Partial<MapLinedef>): MapLinedef {
  const v1 = vertexes[vertexIndex1]!;
  const v2 = vertexes[vertexIndex2]!;
  const dx = (v2.x - v1.x) | 0;
  const dy = (v2.y - v1.y) | 0;

  let slopetype: SlopeType = 0;
  if (dx === 0) slopetype = 1;
  else if (dy === 0) slopetype = 0;
  else if ((dx ^ dy) >= 0) slopetype = 2;
  else slopetype = 3;

  const bbox: readonly [number, number, number, number] = Object.freeze([Math.max(v1.y, v2.y), Math.min(v1.y, v2.y), Math.min(v1.x, v2.x), Math.max(v1.x, v2.x)] as [number, number, number, number]);

  return Object.freeze({
    v1: vertexIndex1,
    v2: vertexIndex2,
    dx,
    dy,
    flags: overrides?.flags ?? ML_BLOCKING,
    special: overrides?.special ?? 0,
    tag: overrides?.tag ?? 0,
    sidenum0: overrides?.sidenum0 ?? 0,
    sidenum1: overrides?.sidenum1 ?? -1,
    slopetype,
    bbox,
  });
}

function makeSector(overrides?: Partial<MapSector>): MapSector {
  return Object.freeze({
    floorheight: overrides?.floorheight ?? 0,
    ceilingheight: overrides?.ceilingheight ?? (128 * F) | 0,
    floorpic: overrides?.floorpic ?? 'FLOOR4_8',
    ceilingpic: overrides?.ceilingpic ?? 'CEIL3_5',
    lightlevel: overrides?.lightlevel ?? 160,
    special: overrides?.special ?? 0,
    tag: overrides?.tag ?? 0,
  });
}

function makeSidedef(sector: number): MapSidedef {
  return Object.freeze({
    textureoffset: 0,
    rowoffset: 0,
    toptexture: '-',
    bottomtexture: '-',
    midtexture: '-',
    sector,
  });
}

function createTestMapData(overrides?: {
  sectors?: readonly MapSector[];
  sidedefs?: readonly MapSidedef[];
  linedefs?: readonly MapLinedef[];
  vertexes?: readonly MapVertex[];
  lineSectors?: readonly LineSectors[];
  blockmap?: Blockmap;
}): MapData {
  const sectors: readonly MapSector[] = overrides?.sectors ?? [makeSector()];
  const linedefs = overrides?.linedefs ?? [];
  const vertexes = overrides?.vertexes ?? [];
  const sidedefs = overrides?.sidedefs ?? [makeSidedef(0)];
  const lineSectors = overrides?.lineSectors ?? [];
  const cellLines = new Map<number, number[]>();
  for (let i = 0; i < linedefs.length; i++) {
    const existing = cellLines.get(0) ?? [];
    existing.push(i);
    cellLines.set(0, existing);
  }
  const blockmap = overrides?.blockmap ?? createBlockmapWithLines(4, 4, 0, 0, cellLines);
  const validCount = createValidCount(linedefs.length);

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
    sidedefs: Object.freeze(sidedefs) as readonly MapSidedef[],
    linedefs: Object.freeze(linedefs) as readonly MapLinedef[],
    segs: Object.freeze([]),
    subsectors: Object.freeze([]),
    nodes: Object.freeze([]),
    things: Object.freeze([]),
    blockmap,
    reject: rejectMap,
    subsectorSectors: Object.freeze([0]),
    lineSectors: Object.freeze(lineSectors) as readonly LineSectors[],
    sectorGroups: Object.freeze([]),
    validCount,
  } as MapData;
}

function createMobj(props: { x?: Fixed; y?: Fixed; angle?: number; radius?: Fixed; height?: Fixed; flags?: number; type?: MobjType }): Mobj {
  const mobj = new Mobj();
  mobj.x = props.x ?? 0;
  mobj.y = props.y ?? 0;
  mobj.angle = props.angle ?? 0;
  mobj.radius = props.radius ?? (16 * F) | 0;
  mobj.height = props.height ?? (56 * F) | 0;
  mobj.flags = props.flags ?? 0;
  mobj.type = props.type ?? MobjType.PLAYER;
  mobj.info = MOBJINFO[mobj.type] ?? null;
  return mobj;
}

function freshState(): SpechitOverrunState {
  return {
    tmbbox: [0, 0, 0, 0],
    crushchange: 0,
    nofit: 0,
  };
}

/**
 * Vertical one-sided wall at x=wallX spanning y=[0,128].
 * v1=(wallX,128) → v2=(wallX,0), front side faces LEFT (x < wallX).
 */
function makeOneSidedWallMap(wallX: number, special: number = 0): MapData {
  const vertexes = [makeVertex(wallX, 128), makeVertex(wallX, 0)];
  const linedefs = [
    makeLinedef(0, 1, vertexes, {
      flags: ML_BLOCKING,
      special,
      sidenum0: 0,
      sidenum1: -1,
    }),
  ];
  const lineSectors: LineSectors[] = [{ frontsector: 0, backsector: -1 }];
  const cellLines = new Map<number, number[]>();
  cellLines.set(0, [0]);
  const blockmap = createBlockmapWithLines(4, 4, 0, 0, cellLines);
  return createTestMapData({
    vertexes,
    linedefs,
    lineSectors,
    blockmap,
  });
}

/**
 * Vertical two-sided line at x=lineX spanning y=[0,128], between
 * two open sectors with full 128-unit ceiling height.
 */
function makeTwoSidedOpeningMap(lineX: number, special: number = 0): MapData {
  const vertexes = [makeVertex(lineX, 128), makeVertex(lineX, 0)];
  const sectors = [makeSector(), makeSector()];
  const sidedefs = [makeSidedef(0), makeSidedef(1)];
  const linedefs = [
    makeLinedef(0, 1, vertexes, {
      flags: ML_TWOSIDED,
      special,
      sidenum0: 0,
      sidenum1: 1,
    }),
  ];
  const lineSectors: LineSectors[] = [{ frontsector: 0, backsector: 1 }];
  const cellLines = new Map<number, number[]>();
  cellLines.set(0, [0]);
  const blockmap = createBlockmapWithLines(4, 4, 0, 0, cellLines);
  return createTestMapData({
    sectors,
    sidedefs,
    vertexes,
    linedefs,
    lineSectors,
    blockmap,
  });
}

/**
 * Two vertical lines in the same cell: a non-special two-sided opening
 * at openingX, and a special one-sided wall at wallX.
 */
function makeOpeningThenSpecialMap(openingX: number, wallX: number, wallSpecial: number): MapData {
  const vertexes = [
    makeVertex(openingX, 128), // 0
    makeVertex(openingX, 0), // 1
    makeVertex(wallX, 128), // 2
    makeVertex(wallX, 0), // 3
  ];
  const sectors = [makeSector(), makeSector()];
  const sidedefs = [makeSidedef(0), makeSidedef(1)];
  const linedefs = [
    // Line 0: two-sided opening, no special
    makeLinedef(0, 1, vertexes, {
      flags: ML_TWOSIDED,
      special: 0,
      sidenum0: 0,
      sidenum1: 1,
    }),
    // Line 1: one-sided wall with special
    makeLinedef(2, 3, vertexes, {
      flags: ML_BLOCKING,
      special: wallSpecial,
      sidenum0: 0,
      sidenum1: -1,
    }),
  ];
  const lineSectors: LineSectors[] = [
    { frontsector: 0, backsector: 1 },
    { frontsector: 0, backsector: -1 },
  ];
  const cellLines = new Map<number, number[]>();
  cellLines.set(0, [0, 1]);
  const blockmap = createBlockmapWithLines(4, 4, 0, 0, cellLines);
  return createTestMapData({
    sectors,
    sidedefs,
    vertexes,
    linedefs,
    lineSectors,
    blockmap,
  });
}

// ── Constants ────────────────────────────────────────────────────────

describe('constants', () => {
  it('USERANGE is 64 map units in fixed-point', () => {
    expect(USERANGE).toBe(64 * FRACUNIT);
    expect(USERANGE).toBe(0x400000);
  });

  it('MAXSPECIALCROSS is 20 (Chocolate Doom expanded)', () => {
    expect(MAXSPECIALCROSS).toBe(20);
  });

  it('MAXSPECIALCROSS_ORIGINAL is 8 (vanilla Doom buffer)', () => {
    expect(MAXSPECIALCROSS_ORIGINAL).toBe(8);
  });

  it('DEFAULT_SPECHIT_MAGIC matches PrBoom-plus', () => {
    expect(DEFAULT_SPECHIT_MAGIC).toBe(0x01c09c98);
  });
});

// ── spechitOverrun ───────────────────────────────────────────────────

describe('spechitOverrun', () => {
  it('index 9 corrupts tmbbox[0]', () => {
    const state = freshState();
    spechitOverrun(0, 9, state);
    expect(state.tmbbox[0]).toBe(DEFAULT_SPECHIT_MAGIC);
    expect(state.tmbbox[1]).toBe(0);
    expect(state.tmbbox[2]).toBe(0);
    expect(state.tmbbox[3]).toBe(0);
  });

  it('index 10 corrupts tmbbox[1]', () => {
    const state = freshState();
    spechitOverrun(0, 10, state);
    expect(state.tmbbox[1]).toBe(DEFAULT_SPECHIT_MAGIC);
    expect(state.tmbbox[0]).toBe(0);
  });

  it('index 11 corrupts tmbbox[2]', () => {
    const state = freshState();
    spechitOverrun(0, 11, state);
    expect(state.tmbbox[2]).toBe(DEFAULT_SPECHIT_MAGIC);
  });

  it('index 12 corrupts tmbbox[3]', () => {
    const state = freshState();
    spechitOverrun(0, 12, state);
    expect(state.tmbbox[3]).toBe(DEFAULT_SPECHIT_MAGIC);
  });

  it('index 13 corrupts crushchange', () => {
    const state = freshState();
    spechitOverrun(0, 13, state);
    expect(state.crushchange).toBe(DEFAULT_SPECHIT_MAGIC);
    expect(state.nofit).toBe(0);
  });

  it('index 14 corrupts nofit', () => {
    const state = freshState();
    spechitOverrun(0, 14, state);
    expect(state.nofit).toBe(DEFAULT_SPECHIT_MAGIC);
    expect(state.crushchange).toBe(0);
  });

  it('index 15 is a no-op', () => {
    const state = freshState();
    spechitOverrun(0, 15, state);
    expect(state.tmbbox).toEqual([0, 0, 0, 0]);
    expect(state.crushchange).toBe(0);
    expect(state.nofit).toBe(0);
  });

  it('address = baseAddress + lineIndex * 0x3E', () => {
    const state = freshState();
    spechitOverrun(10, 9, state);
    // 0x01C09C98 + 10 * 0x3E = 0x01C09C98 + 620 = 0x01C09F04
    expect(state.tmbbox[0]).toBe((DEFAULT_SPECHIT_MAGIC + 10 * 0x3e) | 0);
  });

  it('custom base address overrides default', () => {
    const state = freshState();
    spechitOverrun(0, 9, state, 0x12345678);
    expect(state.tmbbox[0]).toBe(0x12345678);
  });

  it('line index 0 produces baseAddress directly', () => {
    const state = freshState();
    spechitOverrun(0, 9, state);
    expect(state.tmbbox[0]).toBe(DEFAULT_SPECHIT_MAGIC);
  });
});

describe('spechitOverrun integration', () => {
  it('corrupts later P_CheckPosition line tests after the ninth special hit', () => {
    const sectors = [makeSector(), makeSector()];
    const sidedefs = [makeSidedef(0), makeSidedef(1)];
    const vertexes: MapVertex[] = [];
    const linedefs: MapLinedef[] = [];
    const lineSectors: LineSectors[] = [];

    for (let lineIndex = 0; lineIndex < 12; lineIndex++) {
      const xUnits = 36 + lineIndex * 2;
      const vertexIndex = vertexes.length;

      vertexes.push(makeVertex(xUnits, 128), makeVertex(xUnits, 0));
      linedefs.push(
        makeLinedef(vertexIndex, vertexIndex + 1, vertexes, {
          flags: ML_TWOSIDED,
          special: 97,
          sidenum0: 0,
          sidenum1: 1,
        }),
      );
      lineSectors.push({ frontsector: 0, backsector: 1 });
    }

    const mapData = createTestMapData({
      sectors,
      sidedefs,
      vertexes,
      linedefs,
      lineSectors,
    });
    const mobj = createMobj({
      x: (54 * F) | 0,
      y: (64 * F) | 0,
      radius: (20 * F) | 0,
    });
    const blocklinks = createBlockThingsGrid(mapData.blockmap.columns, mapData.blockmap.rows);
    const result = checkPosition(mobj, mobj.x, mobj.y, mapData, blocklinks);

    expect(result.passed).toBe(true);
    expect(result.specials).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

// ── useLines: wall (noWaySound) ──────────────────────────────────────

describe('useLines wall blocking', () => {
  it('one-sided wall fires noWaySound', () => {
    const mapData = makeOneSidedWallMap(48);
    const mobj = createMobj({ x: (32 * F) | 0, y: (64 * F) | 0, angle: 0 });
    let noWayFired = false;

    useLines(mobj, mapData, {
      noWaySound: () => {
        noWayFired = true;
      },
    });

    expect(noWayFired).toBe(true);
  });

  it('one-sided wall does not fire useSpecialLine', () => {
    const mapData = makeOneSidedWallMap(48);
    const mobj = createMobj({ x: (32 * F) | 0, y: (64 * F) | 0, angle: 0 });
    let specialFired = false;

    useLines(mobj, mapData, {
      useSpecialLine: () => {
        specialFired = true;
      },
    });

    expect(specialFired).toBe(false);
  });

  it('noWaySound receives the using mobj', () => {
    const mapData = makeOneSidedWallMap(48);
    const mobj = createMobj({ x: (32 * F) | 0, y: (64 * F) | 0, angle: 0 });
    let received: Mobj | null = null;

    useLines(mobj, mapData, {
      noWaySound: (thing) => {
        received = thing;
      },
    });

    expect(received === mobj).toBe(true);
  });
});

// ── useLines: two-sided opening ──────────────────────────────────────

describe('useLines two-sided opening', () => {
  it('non-special opening does not fire any callback', () => {
    const mapData = makeTwoSidedOpeningMap(48);
    const mobj = createMobj({ x: (32 * F) | 0, y: (64 * F) | 0, angle: 0 });
    let anyFired = false;

    useLines(mobj, mapData, {
      noWaySound: () => {
        anyFired = true;
      },
      useSpecialLine: () => {
        anyFired = true;
      },
    });

    expect(anyFired).toBe(false);
  });
});

// ── useLines: special line activation ────────────────────────────────

describe('useLines special line activation', () => {
  it('special line fires useSpecialLine', () => {
    const mapData = makeOneSidedWallMap(48, /* special */ 1);
    const mobj = createMobj({ x: (32 * F) | 0, y: (64 * F) | 0, angle: 0 });
    let fired = false;

    useLines(mobj, mapData, {
      useSpecialLine: () => {
        fired = true;
      },
    });

    expect(fired).toBe(true);
  });

  it('passes correct linedefIndex', () => {
    const mapData = makeOneSidedWallMap(48, 97);
    const mobj = createMobj({ x: (32 * F) | 0, y: (64 * F) | 0, angle: 0 });
    let receivedIdx = -1;

    useLines(mobj, mapData, {
      useSpecialLine: (idx) => {
        receivedIdx = idx;
      },
    });

    expect(receivedIdx).toBe(0);
  });

  it('passes correct side (front = 0) when player faces line from front', () => {
    // Player at x=32 facing east, line at x=48 with dy<0 → front is left → side 0
    const mapData = makeOneSidedWallMap(48, 1);
    const mobj = createMobj({ x: (32 * F) | 0, y: (64 * F) | 0, angle: 0 });
    let receivedSide = -1;

    useLines(mobj, mapData, {
      useSpecialLine: (_idx, side) => {
        receivedSide = side;
      },
    });

    expect(receivedSide).toBe(0);
  });

  it('passes correct side (back = 1) when player faces line from back', () => {
    // Player at x=96 facing west (ANG180), line at x=48
    const mapData = makeOneSidedWallMap(48, 1);
    const mobj = createMobj({
      x: (96 * F) | 0,
      y: (64 * F) | 0,
      angle: ANG180,
    });
    let receivedSide = -1;

    useLines(mobj, mapData, {
      useSpecialLine: (_idx, side) => {
        receivedSide = side;
      },
    });

    expect(receivedSide).toBe(1);
  });

  it('passes the using mobj', () => {
    const mapData = makeOneSidedWallMap(48, 1);
    const mobj = createMobj({ x: (32 * F) | 0, y: (64 * F) | 0, angle: 0 });
    let receivedThing: Mobj | null = null;

    useLines(mobj, mapData, {
      useSpecialLine: (_idx, _side, thing) => {
        receivedThing = thing;
      },
    });

    expect(receivedThing === mobj).toBe(true);
  });

  it('does not fire noWaySound for special lines', () => {
    const mapData = makeOneSidedWallMap(48, 1);
    const mobj = createMobj({ x: (32 * F) | 0, y: (64 * F) | 0, angle: 0 });
    let noWayFired = false;

    useLines(mobj, mapData, {
      noWaySound: () => {
        noWayFired = true;
      },
      useSpecialLine: () => {},
    });

    expect(noWayFired).toBe(false);
  });
});

// ── useLines: traversal ordering ─────────────────────────────────────

describe('useLines traversal ordering', () => {
  it('non-special opening passes through to special behind', () => {
    const mapData = makeOpeningThenSpecialMap(40, 56, 42);
    const mobj = createMobj({ x: (32 * F) | 0, y: (64 * F) | 0, angle: 0 });
    let specialFired = false;

    useLines(mobj, mapData, {
      useSpecialLine: () => {
        specialFired = true;
      },
    });

    expect(specialFired).toBe(true);
  });

  it('wall before special blocks access', () => {
    // One-sided wall at x=40, special wall at x=56 — both non-special wall first
    const vertexes = [
      makeVertex(40, 128),
      makeVertex(40, 0), // wall line 0
      makeVertex(56, 128),
      makeVertex(56, 0), // special line 1
    ];
    const linedefs = [
      makeLinedef(0, 1, vertexes, {
        flags: ML_BLOCKING,
        special: 0,
        sidenum0: 0,
        sidenum1: -1,
      }),
      makeLinedef(2, 3, vertexes, {
        flags: ML_BLOCKING,
        special: 99,
        sidenum0: 0,
        sidenum1: -1,
      }),
    ];
    const lineSectors: LineSectors[] = [
      { frontsector: 0, backsector: -1 },
      { frontsector: 0, backsector: -1 },
    ];
    const cellLines = new Map<number, number[]>();
    cellLines.set(0, [0, 1]);
    const blockmap = createBlockmapWithLines(4, 4, 0, 0, cellLines);
    const mapData = createTestMapData({
      vertexes,
      linedefs,
      lineSectors,
      blockmap,
    });
    const mobj = createMobj({ x: (32 * F) | 0, y: (64 * F) | 0, angle: 0 });
    let specialFired = false;
    let noWayFired = false;

    useLines(mobj, mapData, {
      useSpecialLine: () => {
        specialFired = true;
      },
      noWaySound: () => {
        noWayFired = true;
      },
    });

    expect(noWayFired).toBe(true);
    expect(specialFired).toBe(false);
  });
});

// ── useLines: no callbacks ───────────────────────────────────────────

describe('useLines no callbacks', () => {
  it('no callbacks does not crash on wall', () => {
    const mapData = makeOneSidedWallMap(48);
    const mobj = createMobj({ x: (32 * F) | 0, y: (64 * F) | 0, angle: 0 });

    expect(() => useLines(mobj, mapData)).not.toThrow();
  });

  it('no callbacks does not crash on special line', () => {
    const mapData = makeOneSidedWallMap(48, 1);
    const mobj = createMobj({ x: (32 * F) | 0, y: (64 * F) | 0, angle: 0 });

    expect(() => useLines(mobj, mapData)).not.toThrow();
  });

  it('empty map does not crash', () => {
    const mapData = createTestMapData();
    const mobj = createMobj({ x: (32 * F) | 0, y: (64 * F) | 0, angle: 0 });

    expect(() => useLines(mobj, mapData)).not.toThrow();
  });
});

// ── Parity-sensitive edge cases ──────────────────────────────────────

describe('parity-sensitive edge cases', () => {
  it('USERANGE >> FRACBITS is exactly 64 (integer multiply in endpoint)', () => {
    expect(USERANGE >> FRACBITS).toBe(64);
  });

  it('openrange <= 0 triggers noWaySound (one-sided returns 0, not negative)', () => {
    // One-sided lines return openrange=0 from lineOpening.
    const mapData = makeOneSidedWallMap(48);
    const mobj = createMobj({ x: (32 * F) | 0, y: (64 * F) | 0, angle: 0 });
    let noWayFired = false;

    useLines(mobj, mapData, {
      noWaySound: () => {
        noWayFired = true;
      },
    });

    expect(noWayFired).toBe(true);
  });

  it('spechit address uses int32 truncation', () => {
    const state = freshState();
    // Large lineIndex that overflows when multiplied by 0x3E
    const largeIndex = 0x4000000;
    spechitOverrun(largeIndex, 9, state);
    const expected = (DEFAULT_SPECHIT_MAGIC + largeIndex * 0x3e) | 0;
    expect(state.tmbbox[0]).toBe(expected);
  });

  it('index 8 is within bounds and not emulated', () => {
    // numspechit=8 means the 9th entry (0-indexed), which is still within
    // the MAXSPECIALCROSS_ORIGINAL limit. Overflow starts at 9.
    const state = freshState();
    spechitOverrun(0, 8, state);
    expect(state.tmbbox).toEqual([0, 0, 0, 0]);
    expect(state.crushchange).toBe(0);
    expect(state.nofit).toBe(0);
  });

  it('spechit overflow writes are cumulative across calls', () => {
    const state = freshState();
    spechitOverrun(1, 9, state);
    spechitOverrun(2, 10, state);
    expect(state.tmbbox[0]).toBe((DEFAULT_SPECHIT_MAGIC + 1 * 0x3e) | 0);
    expect(state.tmbbox[1]).toBe((DEFAULT_SPECHIT_MAGIC + 2 * 0x3e) | 0);
  });

  it('special line with special=0 is treated as non-special', () => {
    // A line with special=0 and no opening should fire noWaySound, not useSpecialLine.
    const mapData = makeOneSidedWallMap(48, 0);
    const mobj = createMobj({ x: (32 * F) | 0, y: (64 * F) | 0, angle: 0 });
    let specialFired = false;
    let noWayFired = false;

    useLines(mobj, mapData, {
      useSpecialLine: () => {
        specialFired = true;
      },
      noWaySound: () => {
        noWayFired = true;
      },
    });

    expect(specialFired).toBe(false);
    expect(noWayFired).toBe(true);
  });

  it('two-sided special line activates before opening check', () => {
    // A two-sided line with a special should activate, not check the opening.
    const mapData = makeTwoSidedOpeningMap(48, /* special */ 55);
    const mobj = createMobj({ x: (32 * F) | 0, y: (64 * F) | 0, angle: 0 });
    let specialFired = false;
    let noWayFired = false;

    useLines(mobj, mapData, {
      useSpecialLine: () => {
        specialFired = true;
      },
      noWaySound: () => {
        noWayFired = true;
      },
    });

    expect(specialFired).toBe(true);
    expect(noWayFired).toBe(false);
  });

  it('VANILLA_LINE_T_SIZE is 0x3E (62 bytes)', () => {
    // Verify the struct size by checking address computation for line index 1.
    const state = freshState();
    spechitOverrun(1, 9, state);
    expect(state.tmbbox[0] - DEFAULT_SPECHIT_MAGIC).toBe(0x3e);
  });
});
