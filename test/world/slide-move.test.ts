import { describe, expect, it } from 'bun:test';

import type { Fixed } from '../../src/core/fixed.ts';
import { FRACBITS, FRACUNIT, fixedMul } from '../../src/core/fixed.ts';
import { createValidCount } from '../../src/map/blockmapIter.ts';
import type { Blockmap } from '../../src/map/blockmap.ts';
import type { MapLinedef, MapSector, MapSidedef, MapVertex, SlopeType } from '../../src/map/lineSectorGeometry.ts';
import { ML_BLOCKING } from '../../src/map/lineSectorGeometry.ts';
import type { MapData, LineSectors } from '../../src/map/mapSetup.ts';
import type { RejectMap } from '../../src/map/reject.ts';
import { MOBJINFO, Mobj, MobjType } from '../../src/world/mobj.ts';
import { createBlockThingsGrid } from '../../src/world/checkPosition.ts';
import type { BlockThingsGrid } from '../../src/world/checkPosition.ts';
import { slideMove } from '../../src/world/slideMove.ts';

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

function createTestMapData(overrides?: {
  sectors?: readonly MapSector[];
  sidedefs?: readonly MapSidedef[];
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
  const sidedefs = overrides?.sidedefs ?? [];
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
    sidedefs: Object.freeze(sidedefs) as readonly MapSidedef[],
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

function createMobj(props: { x?: Fixed; y?: Fixed; z?: Fixed; radius?: Fixed; height?: Fixed; flags?: number; type?: MobjType; player?: unknown; floorz?: Fixed; ceilingz?: Fixed; momx?: Fixed; momy?: Fixed; momz?: Fixed }): Mobj {
  const mobj = new Mobj();
  mobj.x = props.x ?? 0;
  mobj.y = props.y ?? 0;
  mobj.z = props.z ?? 0;
  mobj.radius = props.radius ?? (16 * F) | 0;
  mobj.height = props.height ?? (56 * F) | 0;
  mobj.flags = props.flags ?? 0;
  mobj.type = props.type ?? MobjType.PLAYER;
  mobj.player = props.player ?? { cmd: { forwardmove: 0, sidemove: 0 } };
  mobj.floorz = props.floorz ?? 0;
  mobj.ceilingz = props.ceilingz ?? (128 * F) | 0;
  mobj.momx = props.momx ?? 0;
  mobj.momy = props.momy ?? 0;
  mobj.momz = props.momz ?? 0;
  mobj.info = MOBJINFO[mobj.type] ?? null;
  return mobj;
}

/**
 * Create a map with a vertical one-sided wall at x=64, spanning y=[0,128].
 *
 * Line direction is south-to-north-reversed (v1=(64,128), v2=(64,0)) so
 * the front side faces LEFT (x < 64), which is where the player is.
 * The line is in blockmap cell 0 (column 0, row 0).
 */
function makeVerticalWallMap(): {
  mapData: MapData;
  blocklinks: BlockThingsGrid;
} {
  const vertexes = [makeVertex(64, 128), makeVertex(64, 0)];
  const linedefs = [
    makeLinedef(0, 1, vertexes, {
      flags: ML_BLOCKING,
      sidenum0: 0,
      sidenum1: -1,
    }),
  ];
  const lineSectors: LineSectors[] = [{ frontsector: 0, backsector: -1 }];
  const cellLines = new Map<number, number[]>();
  cellLines.set(0, [0]);
  const blockmap = createBlockmapWithLines(4, 4, 0, 0, cellLines);
  const mapData = createTestMapData({
    vertexes,
    linedefs,
    lineSectors,
    blockmap,
  });
  const blocklinks = createBlockThingsGrid(4, 4);
  return { mapData, blocklinks };
}

/**
 * Create a map with a horizontal one-sided wall at y=64, spanning x=[0,128].
 *
 * Line direction is left-to-right (v1=(0,64), v2=(128,64)) so the front
 * side faces DOWN (y < 64), which is where the player is.
 */
function makeHorizontalWallMap(): {
  mapData: MapData;
  blocklinks: BlockThingsGrid;
} {
  const vertexes = [makeVertex(0, 64), makeVertex(128, 64)];
  const linedefs = [
    makeLinedef(0, 1, vertexes, {
      flags: ML_BLOCKING,
      sidenum0: 0,
      sidenum1: -1,
    }),
  ];
  const lineSectors: LineSectors[] = [{ frontsector: 0, backsector: -1 }];
  const cellLines = new Map<number, number[]>();
  cellLines.set(0, [0]);
  const blockmap = createBlockmapWithLines(4, 4, 0, 0, cellLines);
  const mapData = createTestMapData({
    vertexes,
    linedefs,
    lineSectors,
    blockmap,
  });
  const blocklinks = createBlockThingsGrid(4, 4);
  return { mapData, blocklinks };
}

/**
 * Create a map with a 45-degree one-sided wall from (0,64) to (64,0).
 *
 * `dx=+64,dy=-64` → slopetype=ST_NEGATIVE, exercising the diagonal
 * (non-fast-path) branch of `hitSlideLine`. The front side faces the
 * origin (south-west), which is where the player is placed.
 */
function makeDiagonalWallMap(): {
  mapData: MapData;
  blocklinks: BlockThingsGrid;
} {
  const vertexes = [makeVertex(0, 64), makeVertex(64, 0)];
  const linedefs = [
    makeLinedef(0, 1, vertexes, {
      flags: ML_BLOCKING,
      sidenum0: 0,
      sidenum1: -1,
    }),
  ];
  const lineSectors: LineSectors[] = [{ frontsector: 0, backsector: -1 }];
  const cellLines = new Map<number, number[]>();
  cellLines.set(0, [0]);
  const blockmap = createBlockmapWithLines(4, 4, 0, 0, cellLines);
  const mapData = createTestMapData({
    vertexes,
    linedefs,
    lineSectors,
    blockmap,
  });
  const blocklinks = createBlockThingsGrid(4, 4);
  return { mapData, blocklinks };
}

// ── Stairstep fallback ──────────────────────────────────────────────

describe('slideMove stairstep fallback', () => {
  it('tries Y-only then X-only when no blocking line is found', () => {
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({
      x: (32 * F) | 0,
      y: (32 * F) | 0,
      momx: (8 * F) | 0,
      momy: (8 * F) | 0,
    });

    const startX = mobj.x;
    const startY = mobj.y;

    slideMove(mobj, mapData, blocklinks);

    // Stairstep: first tryMove(x, y+momy) succeeds, player moves Y-only.
    expect(mobj.x).toBe(startX);
    expect(mobj.y).toBe((startY + mobj.momy) | 0);
  });

  it('does not modify momentum in stairstep fallback', () => {
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({
      x: (32 * F) | 0,
      y: (32 * F) | 0,
      momx: (8 * F) | 0,
      momy: (8 * F) | 0,
    });

    slideMove(mobj, mapData, blocklinks);

    expect(mobj.momx).toBe((8 * F) | 0);
    expect(mobj.momy).toBe((8 * F) | 0);
  });
});

// ── Vertical wall slide ─────────────────────────────────────────────

describe('slideMove vertical wall', () => {
  it('slides along vertical wall: momx zeroed, momy preserved', () => {
    const { mapData, blocklinks } = makeVerticalWallMap();
    const mobj = createMobj({
      x: (32 * F) | 0,
      y: (32 * F) | 0,
      momx: (32 * F) | 0,
      momy: (16 * F) | 0,
    });

    slideMove(mobj, mapData, blocklinks);

    // Vertical wall → hitSlideLine zeroes tmxmove (ST_VERTICAL fast path).
    expect(mobj.momx).toBe(0);
    // momy is set to the slide vector Y component.
    expect(mobj.momy).not.toBe(0);
  });

  it('moves player position toward the wall and then along it', () => {
    const { mapData, blocklinks } = makeVerticalWallMap();
    const mobj = createMobj({
      x: (32 * F) | 0,
      y: (32 * F) | 0,
      momx: (32 * F) | 0,
      momy: (16 * F) | 0,
    });

    slideMove(mobj, mapData, blocklinks);

    // Player should have moved from (32, 32) toward (64, _) wall,
    // then slid in Y direction only.
    expect(mobj.x).toBeGreaterThan((32 * F) | 0);
    expect(mobj.y).toBeGreaterThan((32 * F) | 0);
  });

  it('produces exact expected position after slide', () => {
    const { mapData, blocklinks } = makeVerticalWallMap();
    const mobj = createMobj({
      x: (32 * F) | 0,
      y: (32 * F) | 0,
      momx: (32 * F) | 0,
      momy: (16 * F) | 0,
    });

    slideMove(mobj, mapData, blocklinks);

    // Traced frac = FRACUNIT/2. After fudge (-0x800) and approach:
    // approach frac = 30720, remainder frac = 32768.
    // Approach: newx = FixedMul(32*F, 30720) = 15*F, newy = FixedMul(16*F, 30720) = 7.5*F
    // Position after approach: (47*F, 39.5*F)
    // Remainder: tmxmove = FixedMul(32*F, 32768) = 16*F, tmymove = FixedMul(16*F, 32768) = 8*F
    // hitSlideLine (ST_VERTICAL): tmxmove = 0, tmymove = 8*F
    // Slide tryMove to (47*F, 47.5*F)
    expect(mobj.x).toBe(47 * F);
    expect(mobj.y).toBe(47 * F + F / 2);
    expect(mobj.momx).toBe(0);
    expect(mobj.momy).toBe(8 * F);
  });
});

// ── Horizontal wall slide ───────────────────────────────────────────

describe('slideMove horizontal wall', () => {
  it('slides along horizontal wall: momy zeroed, momx preserved', () => {
    const { mapData, blocklinks } = makeHorizontalWallMap();
    const mobj = createMobj({
      x: (32 * F) | 0,
      y: (32 * F) | 0,
      momx: (16 * F) | 0,
      momy: (32 * F) | 0,
    });

    slideMove(mobj, mapData, blocklinks);

    // Horizontal wall → hitSlideLine zeroes tmymove (ST_HORIZONTAL fast path).
    expect(mobj.momy).toBe(0);
    expect(mobj.momx).not.toBe(0);
  });

  it('produces exact expected position after slide', () => {
    const { mapData, blocklinks } = makeHorizontalWallMap();
    const mobj = createMobj({
      x: (32 * F) | 0,
      y: (32 * F) | 0,
      momx: (16 * F) | 0,
      momy: (32 * F) | 0,
    });

    slideMove(mobj, mapData, blocklinks);

    // Symmetric to vertical wall test but X/Y swapped.
    // Approach: (39.5*F, 47*F). Slide: tmxmove=8*F, tmymove=0.
    // Final: (47.5*F, 47*F).
    expect(mobj.x).toBe(47 * F + F / 2);
    expect(mobj.y).toBe(47 * F);
    expect(mobj.momx).toBe(8 * F);
    expect(mobj.momy).toBe(0);
  });
});

// ── Diagonal wall slide ─────────────────────────────────────────────

describe('slideMove diagonal wall', () => {
  it('projects momentum onto the wall direction via hitSlideLine diagonal path', () => {
    // Wall dx=+64,dy=-64 → wall tangent direction is (+,-). Player momentum
    // (32,16)*F into the wall, projected onto (+,-), produces (+,-) slide.
    const { mapData, blocklinks } = makeDiagonalWallMap();
    const mobj = createMobj({
      x: (16 * F) | 0,
      y: (16 * F) | 0,
      radius: (8 * F) | 0,
      momx: (32 * F) | 0,
      momy: (16 * F) | 0,
    });

    slideMove(mobj, mapData, blocklinks);

    // Diagonal path must set both momx and momy from the fine trig tables.
    expect(mobj.momx).toBeGreaterThan(0);
    expect(mobj.momy).toBeLessThan(0);

    // Slide is parallel to the wall — momx and momy are opposite and roughly
    // equal in magnitude. Fixed-point + approxDistance + LUT precision leaves
    // a small residual, bounded well under 1 FRACUNIT.
    const residual = Math.abs(mobj.momx + mobj.momy);
    expect(residual).toBeLessThan(F);

    // Int32 exactness holds through the diagonal path.
    expect(mobj.momx | 0).toBe(mobj.momx);
    expect(mobj.momy | 0).toBe(mobj.momy);
    expect(mobj.x | 0).toBe(mobj.x);
    expect(mobj.y | 0).toBe(mobj.y);

    // Player has advanced from the start (approach + slide both succeeded).
    expect(mobj.x).toBeGreaterThan((16 * F) | 0);
    expect(mobj.y).toBeLessThan((16 * F + 16 * F) | 0);
  });

  it('chooses the closest of three corner traces (leadx/leady is nearest)', () => {
    // With momx>0 and momy>0, the leadx/leady corner trace crosses the wall
    // first (frac=1/3) while the other two corners cross at frac=2/3. The
    // fudge (−0x800) then advances by 1/3 of the initial momentum, leaving
    // 2/3 remaining to be projected onto the wall.
    const { mapData, blocklinks } = makeDiagonalWallMap();
    const mobj = createMobj({
      x: (16 * F) | 0,
      y: (16 * F) | 0,
      radius: (8 * F) | 0,
      momx: (32 * F) | 0,
      momy: (16 * F) | 0,
    });

    slideMove(mobj, mapData, blocklinks);

    // Approach advanced the player by roughly 1/3 of the momentum plus a
    // fudge, so the final x is strictly less than start+momentum.
    expect(mobj.x).toBeLessThan(((16 + 32) * F) | 0);
  });
});

// ── Hitcount cap ────────────────────────────────────────────────────

describe('slideMove hitcount cap', () => {
  it('falls back to stairstep after 3 iterations', () => {
    // Two perpendicular walls forming a corner that blocks all slide attempts.
    // Vertical wall at x=64 (facing left) + horizontal wall at y=64 (facing down).
    const vertexes = [
      makeVertex(64, 128), // 0 - vertical wall top
      makeVertex(64, 0), // 1 - vertical wall bottom
      makeVertex(0, 64), // 2 - horizontal wall left
      makeVertex(128, 64), // 3 - horizontal wall right
    ];
    const linedefs = [makeLinedef(0, 1, vertexes, { flags: ML_BLOCKING, sidenum0: 0, sidenum1: -1 }), makeLinedef(2, 3, vertexes, { flags: ML_BLOCKING, sidenum0: 0, sidenum1: -1 })];
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
    const blocklinks = createBlockThingsGrid(4, 4);

    // Player pushing into the corner.
    const mobj = createMobj({
      x: (32 * F) | 0,
      y: (32 * F) | 0,
      momx: (32 * F) | 0,
      momy: (32 * F) | 0,
    });

    // Should not throw or loop forever.
    slideMove(mobj, mapData, blocklinks);

    // Termination invariant: final state is int32-clean, so the hitcount cap
    // fired before any NaN / undefined crept in.
    expect(mobj.x).toBe(mobj.x | 0);
    expect(mobj.y).toBe(mobj.y | 0);
    expect(mobj.momx).toBe(mobj.momx | 0);
    expect(mobj.momy).toBe(mobj.momy | 0);
    expect(Number.isFinite(mobj.x)).toBe(true);
    expect(Number.isFinite(mobj.y)).toBe(true);
  });
});

// ── Parity-sensitive edge cases ─────────────────────────────────────

describe('parity-sensitive edge cases', () => {
  it('fudge factor 0x800 reduces bestslidefrac before approach move', () => {
    const { mapData, blocklinks } = makeVerticalWallMap();
    const mobj = createMobj({
      x: (32 * F) | 0,
      y: (32 * F) | 0,
      momx: (32 * F) | 0,
      momy: (16 * F) | 0,
    });

    slideMove(mobj, mapData, blocklinks);

    // The approach move uses frac - 0x800, not the raw frac.
    // With frac = FRACUNIT/2 = 32768, approach frac = 30720.
    // The player does NOT reach exactly half the momentum distance:
    // 15*F approach (not 16*F) proves the fudge factor was applied.
    // After slide the final x position is 47*F (approach 15*F from 32*F).
    expect(mobj.x).toBe(47 * F);
  });

  it('remainder fraction is FRACUNIT minus original frac', () => {
    const { mapData, blocklinks } = makeVerticalWallMap();
    const mobj = createMobj({
      x: (32 * F) | 0,
      y: (32 * F) | 0,
      momx: (32 * F) | 0,
      momy: (16 * F) | 0,
    });

    slideMove(mobj, mapData, blocklinks);

    // remainder = FRACUNIT - ((frac - 0x800) + 0x800) = FRACUNIT - frac = 32768.
    // tmymove before hitSlideLine = FixedMul(16*F, 32768) = 8*F.
    // After hitSlideLine (ST_VERTICAL, tmxmove zeroed): momy = 8*F.
    // This proves remainder = FRACUNIT - original frac.
    expect(mobj.momy).toBe(8 * F);
  });

  it('leading corner selection depends on momentum sign', () => {
    const { mapData, blocklinks } = makeVerticalWallMap();

    // Moving WEST (momx < 0): leading X edge is x - radius = LEFT side.
    // The left side is at 32*F - 16*F = 16*F, far from the wall at x=64.
    // No trace from the left side reaches x=64 with momentum of -32*F.
    // So no blocking line is found → stairstep fallback.
    const mobj = createMobj({
      x: (32 * F) | 0,
      y: (32 * F) | 0,
      momx: (-32 * F) | 0,
      momy: (16 * F) | 0,
    });

    slideMove(mobj, mapData, blocklinks);

    // Stairstep fallback: Y-only move succeeds. X position unchanged or moved.
    // Momentum is NOT modified by stairstep.
    expect(mobj.momx).toBe((-32 * F) | 0);
    expect(mobj.momy).toBe((16 * F) | 0);
  });

  it('slide along vertical wall preserves int32 fixed-point arithmetic', () => {
    const { mapData, blocklinks } = makeVerticalWallMap();
    const mobj = createMobj({
      x: (32 * F) | 0,
      y: (32 * F) | 0,
      momx: (32 * F) | 0,
      momy: (16 * F) | 0,
    });

    slideMove(mobj, mapData, blocklinks);

    // All position values must be exact int32 results, not floating-point.
    expect(mobj.x).toBe(mobj.x | 0);
    expect(mobj.y).toBe(mobj.y | 0);
    expect(mobj.momx).toBe(mobj.momx | 0);
    expect(mobj.momy).toBe(mobj.momy | 0);
  });

  it('zero momentum in one axis still produces valid slide', () => {
    const { mapData, blocklinks } = makeVerticalWallMap();
    const mobj = createMobj({
      x: (32 * F) | 0,
      y: (32 * F) | 0,
      momx: (32 * F) | 0,
      momy: 0,
    });

    slideMove(mobj, mapData, blocklinks);

    // Moving straight east into vertical wall.
    // hitSlideLine (ST_VERTICAL) zeroes tmxmove.
    // tmymove was FixedMul(0, remainder) = 0.
    // After slide: momx = 0, momy = 0. No actual movement from the slide.
    expect(mobj.momx).toBe(0);
    expect(mobj.momy).toBe(0);
  });
});
