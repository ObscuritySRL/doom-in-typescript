import { describe, expect, it } from 'bun:test';

import type { Fixed } from '../../src/core/fixed.ts';
import { FRACBITS, FRACUNIT, fixedMul } from '../../src/core/fixed.ts';
import { DoomRandom } from '../../src/core/rng.ts';
import { createValidCount } from '../../src/map/blockmapIter.ts';
import type { Blockmap } from '../../src/map/blockmap.ts';
import type { MapLinedef, MapSector, MapSidedef, MapVertex } from '../../src/map/lineSectorGeometry.ts';
import type { SlopeType } from '../../src/map/lineSectorGeometry.ts';
import { ML_BLOCKING } from '../../src/map/lineSectorGeometry.ts';
import type { MapData, LineSectors } from '../../src/map/mapSetup.ts';
import type { RejectMap } from '../../src/map/reject.ts';
import { MF_CORPSE, MF_MISSILE, MF_NOCLIP, MF_NOGRAVITY, MF_SKULLFLY, MF_SOLID, MOBJINFO, Mobj, MobjType, STATES, StateNum } from '../../src/world/mobj.ts';
import { createBlockThingsGrid } from '../../src/world/checkPosition.ts';
import type { BlockThingsGrid } from '../../src/world/checkPosition.ts';
import { ThinkerList } from '../../src/world/thinkers.ts';
import { FRICTION, MAXMOVE, STOPSPEED, explodeMissile, xyMovement } from '../../src/world/xyMovement.ts';
import type { XYMovementCallbacks } from '../../src/world/xyMovement.ts';

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
  mobj.radius = props.radius ?? (20 * F) | 0;
  mobj.height = props.height ?? (56 * F) | 0;
  mobj.flags = props.flags ?? 0;
  mobj.type = props.type ?? MobjType.PLAYER;
  mobj.player = props.player ?? null;
  mobj.floorz = props.floorz ?? 0;
  mobj.ceilingz = props.ceilingz ?? (128 * F) | 0;
  mobj.momx = props.momx ?? 0;
  mobj.momy = props.momy ?? 0;
  mobj.momz = props.momz ?? 0;
  mobj.info = MOBJINFO[mobj.type] ?? null;
  return mobj;
}

/**
 * Create a blocking map with a one-sided wall that blocks movement.
 *
 * Wall is at x=48 map units, spanning y=[0, 128]. Blockmap origin at (0,0)
 * with 4x4 cells (each 128 map units). The line appears in cell 0
 * (col=0, row=0) where the mobj and target position both reside.
 */
function makeBlockingMap(): {
  mapData: MapData;
  blocklinks: BlockThingsGrid;
} {
  const vertexes = [makeVertex(48, 0), makeVertex(48, 128)];
  const linedefs = [
    makeLinedef(0, 1, vertexes, {
      flags: ML_BLOCKING,
      sidenum0: 0,
      sidenum1: -1,
    }),
  ];
  const lineSectors: LineSectors[] = [{ frontsector: 0, backsector: -1 }];
  // Line is in blockmap cell 0 (col=0, row=0).
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

// ── Constants ────────────────────────────────────────────────────────

describe('MAXMOVE', () => {
  it('equals 30 * FRACUNIT', () => {
    expect(MAXMOVE).toBe((30 * FRACUNIT) | 0);
  });

  it('is 0x1E0000', () => {
    expect(MAXMOVE).toBe(0x1e0000);
  });
});

describe('STOPSPEED', () => {
  it('equals FRACUNIT / 16', () => {
    expect(STOPSPEED).toBe(FRACUNIT >> 4);
  });

  it('is 0x1000', () => {
    expect(STOPSPEED).toBe(0x1000);
  });
});

describe('FRICTION', () => {
  it('is 0xE800', () => {
    expect(FRICTION).toBe(0xe800);
  });
});

// ── explodeMissile ───────────────────────────────────────────────────

describe('explodeMissile', () => {
  it('zeroes all momentum', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mobj = createMobj({
      type: MobjType.TROOPSHOT,
      flags: MF_MISSILE | MF_NOGRAVITY,
      momx: (10 * F) | 0,
      momy: (5 * F) | 0,
      momz: (3 * F) | 0,
    });
    list.add(mobj);

    explodeMissile(mobj, rng, list);

    expect(mobj.momx).toBe(0);
    expect(mobj.momy).toBe(0);
    expect(mobj.momz).toBe(0);
  });

  it('transitions to deathstate', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mobj = createMobj({
      type: MobjType.TROOPSHOT,
      flags: MF_MISSILE | MF_NOGRAVITY,
    });
    list.add(mobj);

    const deathstate = MOBJINFO[MobjType.TROOPSHOT]!.deathstate;
    explodeMissile(mobj, rng, list);

    expect(mobj.state).toBe(STATES[deathstate]);
  });

  it('consumes one P_Random call', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();

    const indexBefore = rng.prndindex;

    const mobj = createMobj({
      type: MobjType.TROOPSHOT,
      flags: MF_MISSILE | MF_NOGRAVITY,
    });
    list.add(mobj);

    explodeMissile(mobj, rng, list);

    expect(rng.prndindex).toBe((indexBefore + 1) & 0xff);
  });

  it('clamps tics to minimum 1 across all RNG seeds', () => {
    for (let seed = 0; seed < 256; seed++) {
      const list = new ThinkerList();
      list.init();
      const rng = new DoomRandom();
      for (let i = 0; i < seed; i++) rng.pRandom();

      const mobj = createMobj({
        type: MobjType.TROOPSHOT,
        flags: MF_MISSILE | MF_NOGRAVITY,
      });
      list.add(mobj);

      explodeMissile(mobj, rng, list);
      expect(mobj.tics).toBeGreaterThanOrEqual(1);
    }
  });

  it('clears MF_MISSILE flag', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mobj = createMobj({
      type: MobjType.TROOPSHOT,
      flags: MF_MISSILE | MF_NOGRAVITY,
    });
    list.add(mobj);

    explodeMissile(mobj, rng, list);

    expect(mobj.flags & MF_MISSILE).toBe(0);
  });

  it('preserves other flags besides MF_MISSILE', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mobj = createMobj({
      type: MobjType.TROOPSHOT,
      flags: MF_MISSILE | MF_NOGRAVITY,
    });
    list.add(mobj);

    explodeMissile(mobj, rng, list);

    expect(mobj.flags & MF_NOGRAVITY).toBe(MF_NOGRAVITY);
  });
});

// ── xyMovement: zero momentum ────────────────────────────────────────

describe('xyMovement: zero momentum', () => {
  it('returns immediately when momx and momy are both zero', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ momx: 0, momy: 0 });

    const oldX = mobj.x;
    const oldY = mobj.y;

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.x).toBe(oldX);
    expect(mobj.y).toBe(oldY);
  });

  it('skull-fly slam: clears MF_SKULLFLY and zeroes all momentum', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({
      type: MobjType.SKULL,
      flags: MF_SKULLFLY | MF_SOLID,
      momx: 0,
      momy: 0,
      momz: (5 * F) | 0,
    });
    list.add(mobj);

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.flags & MF_SKULLFLY).toBe(0);
    expect(mobj.momx).toBe(0);
    expect(mobj.momy).toBe(0);
    expect(mobj.momz).toBe(0);
  });

  it('skull-fly slam transitions to spawnstate', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({
      type: MobjType.SKULL,
      flags: MF_SKULLFLY | MF_SOLID,
      momx: 0,
      momy: 0,
    });
    list.add(mobj);

    const spawnstate = MOBJINFO[MobjType.SKULL]!.spawnstate;

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.state).toBe(STATES[spawnstate]);
  });
});

// ── xyMovement: momentum clamping ────────────────────────────────────

describe('xyMovement: momentum clamping', () => {
  it('clamps positive momx exceeding MAXMOVE', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ momx: MAXMOVE + F, momy: 0 });

    xyMovement(mobj, mapData, blocklinks, list, rng);

    // After clamping to MAXMOVE then friction.
    expect(mobj.momx).toBe(fixedMul(MAXMOVE, FRICTION));
  });

  it('clamps negative momx below -MAXMOVE', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ momx: -MAXMOVE - F, momy: 0 });

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.momx).toBe(fixedMul(-MAXMOVE, FRICTION));
  });

  it('clamps momy similarly', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ momx: 0, momy: MAXMOVE + F });

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.momy).toBe(fixedMul(MAXMOVE, FRICTION));
  });
});

// ── xyMovement: simple movement ──────────────────────────────────────

describe('xyMovement: simple movement', () => {
  it('moves mobj by momentum in open space', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const momx = (5 * F) | 0;
    const mobj = createMobj({ x: 0, y: 0, momx, momy: 0 });

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.x).toBe(momx);
    expect(mobj.momx).toBe(fixedMul(momx, FRICTION));
  });

  it('applies friction to both axes', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const momx = (3 * F) | 0;
    const momy = (4 * F) | 0;
    const mobj = createMobj({ momx, momy });

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.momx).toBe(fixedMul(momx, FRICTION));
    expect(mobj.momy).toBe(fixedMul(momy, FRICTION));
  });
});

// ── xyMovement: sub-stepping ─────────────────────────────────────────

describe('xyMovement: sub-stepping', () => {
  it('halves movement when momentum exceeds MAXMOVE/2', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ x: 0, y: 0, momx: MAXMOVE, momy: 0 });

    xyMovement(mobj, mapData, blocklinks, list, rng);

    // Full MAXMOVE should reach target via two half-steps.
    expect(mobj.x).toBe(MAXMOVE);
  });

  it('momentum at exactly MAXMOVE/2 does not trigger sub-stepping', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const halfMax = MAXMOVE >> 1;
    const mobj = createMobj({ x: 0, y: 0, momx: halfMax, momy: 0 });

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.x).toBe(halfMax);
  });

  it('sub-stepping with odd momentum loses low bit via >>= 1', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const halfMaxPlus1 = (MAXMOVE >> 1) + 1;
    const mobj = createMobj({ x: 0, y: 0, momx: halfMaxPlus1, momy: 0 });

    xyMovement(mobj, mapData, blocklinks, list, rng);

    // >>= 1 truncates the low bit: total = 2 * (halfMaxPlus1 >> 1).
    const halfStep = halfMaxPlus1 >> 1;
    expect(mobj.x).toBe((halfStep + halfStep) | 0);
  });

  it('negative-dominant momentum does NOT sub-step (vanilla quirk)', () => {
    // Vanilla `if (xmove > MAXMOVE/2 || ymove > MAXMOVE/2)` tests only
    // positive overflow. A mobj with negative xmove (even near -MAXMOVE)
    // takes ONE tryMove step per tic. Previously we also tested
    // `xmove < -MAXMOVE/2`, splitting it into two calls and affecting
    // blockmap iteration / special-line triggering.
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    let setCount = 0;
    const callbacks: XYMovementCallbacks = {
      setThingPosition: () => {
        setCount++;
      },
    };
    const mobj = createMobj({
      x: (1000 * F) | 0,
      y: 0,
      momx: -MAXMOVE,
      momy: 0,
      flags: MF_MISSILE | MF_NOGRAVITY,
      type: MobjType.TROOPSHOT,
    });
    list.add(mobj);

    xyMovement(mobj, mapData, blocklinks, list, rng, '', callbacks);

    expect(setCount).toBe(1);
    expect(mobj.x).toBe((1000 * F - MAXMOVE) | 0);
  });

  it('paired-axis negative xmove with positive ymove uses xmove/2 asymmetry', () => {
    // When ymove > MAXMOVE/2 triggers sub-stepping but xmove is negative
    // odd, ptryx uses `xmove/2` (C trunc toward 0) while xmove is then
    // updated via `>>= 1` (arithmetic shift toward -inf). The asymmetry
    // preserves total displacement across the two sub-moves. If ptryx
    // used `>> 1` instead, negative-odd xmove would overshoot by 1.
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const bigPosY = (MAXMOVE >> 1) + 1;
    const negOddX = -3;
    const mobj = createMobj({
      x: (1000 * F) | 0,
      y: (1000 * F) | 0,
      momx: negOddX,
      momy: bigPosY,
      flags: MF_MISSILE | MF_NOGRAVITY,
      type: MobjType.TROOPSHOT,
    });
    list.add(mobj);

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.x).toBe((1000 * F + negOddX) | 0);
  });
});

// ── xyMovement: blocked move ─────────────────────────────────────────

describe('xyMovement: blocked move', () => {
  it('stops non-player non-missile mobj when blocked', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const { mapData, blocklinks } = makeBlockingMap();

    // Mobj at x=16, y=64 (in blockmap cell 0). Wall at x=48.
    // With radius=20, target x = 16 + 20 = 36, bbox right = 56 > 48 → blocked.
    const mobj = createMobj({
      x: (16 * F) | 0,
      y: (64 * F) | 0,
      momx: (20 * F) | 0,
      momy: 0,
      flags: MF_SOLID,
      type: MobjType.POSSESSED,
      player: null,
    });

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.momx).toBe(0);
    expect(mobj.momy).toBe(0);
  });

  it('calls slideMove callback for player when blocked', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const { mapData, blocklinks } = makeBlockingMap();

    let slideCalled = false;
    const callbacks: XYMovementCallbacks = {
      slideMove: () => {
        slideCalled = true;
      },
    };

    const mobj = createMobj({
      x: (16 * F) | 0,
      y: (64 * F) | 0,
      momx: (20 * F) | 0,
      momy: 0,
      flags: MF_SOLID,
      type: MobjType.PLAYER,
      player: {},
    });

    xyMovement(mobj, mapData, blocklinks, list, rng, '', callbacks);

    expect(slideCalled).toBe(true);
  });

  it('zeros player momentum when blocked without slideMove callback', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const { mapData, blocklinks } = makeBlockingMap();

    const mobj = createMobj({
      x: (16 * F) | 0,
      y: (64 * F) | 0,
      momx: (20 * F) | 0,
      momy: 0,
      flags: MF_SOLID,
      type: MobjType.PLAYER,
      player: {},
    });

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.momx).toBe(0);
    expect(mobj.momy).toBe(0);
  });
});

// ── xyMovement: missile blocked ──────────────────────────────────────

describe('xyMovement: missile blocked', () => {
  it('explodes missile when blocked by wall', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();

    // Wall at x=24, close enough for the missile's bbox to overlap.
    const vertexes = [makeVertex(24, 0), makeVertex(24, 128)];
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

    // Missile at x=16, radius=6, momx=10 → target x=26, bbox [20, 32].
    // Wall at x=24 overlaps [20, 32].
    const mobj = createMobj({
      x: (16 * F) | 0,
      y: (64 * F) | 0,
      momx: (10 * F) | 0,
      momy: 0,
      radius: (6 * F) | 0,
      height: (8 * F) | 0,
      flags: MF_MISSILE | MF_NOGRAVITY,
      type: MobjType.TROOPSHOT,
    });
    list.add(mobj);

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.flags & MF_MISSILE).toBe(0);
    expect(mobj.momx).toBe(0);
    expect(mobj.momy).toBe(0);
    expect(mobj.momz).toBe(0);
  });

  it('silently removes missile hitting sky ceiling (no RNG consumed)', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();

    // Two sectors: front with low ceiling, back with sky ceiling.
    const skySector = Object.freeze({
      floorheight: 0,
      ceilingheight: (128 * F) | 0,
      floorpic: 'FLOOR4_8',
      ceilingpic: 'F_SKY1',
      lightlevel: 160,
      special: 0,
      tag: 0,
    });
    const normalSector = Object.freeze({
      floorheight: 0,
      ceilingheight: (48 * F) | 0,
      floorpic: 'FLOOR4_8',
      ceilingpic: 'CEIL3_5',
      lightlevel: 160,
      special: 0,
      tag: 0,
    });

    const frontSidedef: MapSidedef = Object.freeze({
      textureoffset: 0,
      rowoffset: 0,
      toptexture: '-',
      bottomtexture: '-',
      midtexture: '-',
      sector: 1,
    });
    const backSidedef: MapSidedef = Object.freeze({
      textureoffset: 0,
      rowoffset: 0,
      toptexture: '-',
      bottomtexture: '-',
      midtexture: '-',
      sector: 0,
    });

    const vertexes = [makeVertex(48, 0), makeVertex(48, 128)];
    // Two-sided line — ceiling check blocks the missile.
    const linedefs = [
      makeLinedef(0, 1, vertexes, {
        flags: 0,
        sidenum0: 0,
        sidenum1: 1,
      }),
    ];
    const lineSectors: LineSectors[] = [{ frontsector: 1, backsector: 0 }];
    const cellLines = new Map<number, number[]>();
    cellLines.set(0, [0]);
    const blockmap = createBlockmapWithLines(4, 4, 0, 0, cellLines);
    const mapData = createTestMapData({
      sectors: [skySector, normalSector],
      sidedefs: [frontSidedef, backSidedef],
      vertexes,
      linedefs,
      lineSectors,
      blockmap,
    });
    const blocklinks = createBlockThingsGrid(4, 4);

    // Missile starts in the sky sector (back side), moves forward so
    // its bbox strictly straddles the line. z + height (50) exceeds
    // the front sector's ceiling (48), so the ceiling opening blocks
    // the move and records ceilingline. The line's back sector is sky,
    // so the missile is silently removed instead of exploding.
    const mobj = createMobj({
      x: (43 * F) | 0,
      y: (64 * F) | 0,
      z: (42 * F) | 0,
      height: (8 * F) | 0,
      radius: (6 * F) | 0,
      momx: (10 * F) | 0,
      momy: 0,
      flags: MF_MISSILE | MF_NOGRAVITY,
      type: MobjType.TROOPSHOT,
      ceilingz: (128 * F) | 0,
      floorz: 0,
    });
    list.add(mobj);

    const rngIndexBefore = rng.prndindex;
    const preMove = { x: mobj.x, y: mobj.y };

    xyMovement(mobj, mapData, blocklinks, list, rng, 'F_SKY1');

    // Sky hack: missile removed, no RNG consumed, position unchanged,
    // MF_MISSILE flag preserved (explodeMissile never ran).
    expect(rng.prndindex).toBe(rngIndexBefore);
    expect(mobj.x).toBe(preMove.x);
    expect(mobj.y).toBe(preMove.y);
    expect(mobj.flags & MF_MISSILE).toBe(MF_MISSILE);
  });
});

// ── xyMovement: friction ─────────────────────────────────────────────

describe('xyMovement: friction', () => {
  it('does not apply friction to missiles', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const momx = (5 * F) | 0;
    const mobj = createMobj({
      momx,
      momy: 0,
      flags: MF_MISSILE | MF_NOGRAVITY,
      type: MobjType.TROOPSHOT,
    });

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.momx).toBe(momx);
  });

  it('does not apply friction to skull-fliers', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const momx = (5 * F) | 0;
    const mobj = createMobj({
      momx,
      momy: 0,
      flags: MF_SKULLFLY | MF_SOLID,
      type: MobjType.SKULL,
    });

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.momx).toBe(momx);
  });

  it('does not apply friction when airborne (z > floorz)', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    // Sector floor at 0 — after tryMove, floorz will be 0.
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const momx = (5 * F) | 0;
    // z = 10*F, floorz starts at 0. After tryMove floorz stays 0.
    // z(10*F) > floorz(0) → airborne.
    const mobj = createMobj({ momx, momy: 0, z: (10 * F) | 0, floorz: 0 });

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.momx).toBe(momx);
  });

  it('applies friction when on the floor', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const momx = (5 * F) | 0;
    // z = 0, sector floor = 0 → after tryMove floorz = 0, z = 0 → grounded.
    const mobj = createMobj({ momx, momy: 0, z: 0, floorz: 0 });

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.momx).toBe(fixedMul(momx, FRICTION));
  });

  it('stops mobj when momentum below STOPSPEED', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ momx: STOPSPEED - 1, momy: 0, z: 0, floorz: 0 });

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.momx).toBe(0);
    expect(mobj.momy).toBe(0);
  });

  it('applies friction when momx equals STOPSPEED (not below)', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ momx: STOPSPEED, momy: 0, z: 0, floorz: 0 });

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.momx).toBe(fixedMul(STOPSPEED, FRICTION));
  });

  it('applies friction when momx equals -STOPSPEED (strict > -STOPSPEED boundary)', () => {
    // Vanilla stop-check is `momx > -STOPSPEED` (strict). At exactly
    // -STOPSPEED the comparison is false, so we take the else branch and
    // apply friction — not the stop branch.
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ momx: -STOPSPEED, momy: 0, z: 0, floorz: 0 });

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.momx).toBe(fixedMul(-STOPSPEED, FRICTION));
  });
});

// ── xyMovement: corpse sliding ───────────────────────────────────────

describe('xyMovement: corpse sliding', () => {
  it('skips friction for corpse on a step with meaningful momentum', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData(); // sector floorheight = 0
    const blocklinks = createBlockThingsGrid(4, 4);
    const momx = F; // > FRACUNIT/4
    // z = 0, floorz = 0 → grounded. After tryMove, floorz = 0 (from sector).
    // But subsector floor differs → corpse is "on a step".
    const mobj = createMobj({
      momx,
      momy: 0,
      z: 0,
      floorz: 0,
      flags: MF_CORPSE,
    });
    // Subsector floor is different from what floorz will be after the move.
    mobj.subsector = { sector: { floorheight: (-16 * F) | 0, ceilingheight: (128 * F) | 0 } };

    xyMovement(mobj, mapData, blocklinks, list, rng);

    // Corpse exemption: floorz(0) != subsector floor(-16*F) → no friction.
    expect(mobj.momx).toBe(momx);
  });

  it('applies friction for corpse on flat floor', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData(); // sector floorheight = 0
    const blocklinks = createBlockThingsGrid(4, 4);
    const momx = F; // > FRACUNIT/4
    const mobj = createMobj({
      momx,
      momy: 0,
      z: 0,
      floorz: 0,
      flags: MF_CORPSE,
    });
    // Subsector floor matches sector (both 0) → no step → friction applies.
    mobj.subsector = { sector: { floorheight: 0, ceilingheight: (128 * F) | 0 } };

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.momx).toBe(fixedMul(momx, FRICTION));
  });

  it('applies friction for corpse with low momentum on a step', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    // Momentum exactly at FRACUNIT/4: NOT > threshold → exemption doesn't apply.
    const momx = FRACUNIT >> 2;
    const mobj = createMobj({
      momx,
      momy: 0,
      z: 0,
      floorz: 0,
      flags: MF_CORPSE,
    });
    mobj.subsector = { sector: { floorheight: (-16 * F) | 0, ceilingheight: (128 * F) | 0 } };

    xyMovement(mobj, mapData, blocklinks, list, rng);

    // Low momentum: corpse exemption does NOT trigger, friction applies.
    expect(mobj.momx).toBe(fixedMul(momx, FRICTION));
  });

  it('skips friction for corpse on a step with meaningful NEGATIVE momentum', () => {
    // Vanilla corpse-slide exemption checks both positive and negative
    // momentum on either axis: `momx > FRACUNIT/4 || momx < -FRACUNIT/4
    // || momy > FRACUNIT/4 || momy < -FRACUNIT/4`. Reverse direction on
    // a step must still trigger the skip.
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const momx = -F;
    const mobj = createMobj({
      x: (64 * F) | 0,
      momx,
      momy: 0,
      z: 0,
      floorz: 0,
      flags: MF_CORPSE,
    });
    mobj.subsector = { sector: { floorheight: (-16 * F) | 0, ceilingheight: (128 * F) | 0 } };

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.momx).toBe(momx);
  });

  it('skips friction for corpse on a step driven by momy alone', () => {
    // The sliding exemption triggers on either axis independently.
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const momy = F;
    const mobj = createMobj({
      y: (64 * F) | 0,
      momx: 0,
      momy,
      z: 0,
      floorz: 0,
      flags: MF_CORPSE,
    });
    mobj.subsector = { sector: { floorheight: (-16 * F) | 0, ceilingheight: (128 * F) | 0 } };

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.momy).toBe(momy);
  });
});

// ── xyMovement: player stop and walk frame ───────────────────────────

describe('xyMovement: player stop and walk frame', () => {
  it('transitions player in running frame to standing when stopped', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({
      momx: STOPSPEED - 1,
      momy: 0,
      z: 0,
      floorz: 0,
      type: MobjType.PLAYER,
      player: {},
    });
    mobj.state = STATES[StateNum.PLAY_RUN1]!;

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.state).toBe(STATES[StateNum.PLAY]);
    expect(mobj.momx).toBe(0);
  });

  it('does not change state for non-running player frame', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({
      momx: STOPSPEED - 1,
      momy: 0,
      z: 0,
      floorz: 0,
      type: MobjType.PLAYER,
      player: {},
    });
    mobj.state = STATES[StateNum.PLAY]!;

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.state).toBe(STATES[StateNum.PLAY]);
    expect(mobj.momx).toBe(0);
  });

  it('does not stop player when cmd has movement input', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({
      momx: STOPSPEED - 1,
      momy: 0,
      z: 0,
      floorz: 0,
      type: MobjType.PLAYER,
      player: { cmd: { forwardmove: 25, sidemove: 0 } },
    });

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.momx).toBe(fixedMul(STOPSPEED - 1, FRICTION));
  });
});

// ── xyMovement: CF_NOMOMENTUM cheat ──────────────────────────────────

describe('xyMovement: CF_NOMOMENTUM cheat', () => {
  it('zeros momentum and skips friction when player.cheats has CF_NOMOMENTUM', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const startMom = (5 * F) | 0;
    const mobj = createMobj({
      x: 0,
      y: 0,
      momx: startMom,
      momy: startMom,
      z: 0,
      floorz: 0,
      type: MobjType.PLAYER,
      player: { cheats: 0x4 },
    });

    xyMovement(mobj, mapData, blocklinks, list, rng);

    // Move still applied (vanilla: P_TryMove runs first), but momentum
    // zeroed post-move and friction skipped.
    expect(mobj.x).toBe(startMom);
    expect(mobj.y).toBe(startMom);
    expect(mobj.momx).toBe(0);
    expect(mobj.momy).toBe(0);
  });

  it('CF_NOMOMENTUM is a no-op for non-player mobjs', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const startMom = (5 * F) | 0;
    const mobj = createMobj({
      momx: startMom,
      momy: 0,
      z: 0,
      floorz: 0,
      type: MobjType.POSSESSED,
      player: null,
    });

    xyMovement(mobj, mapData, blocklinks, list, rng);

    // Friction applied; cheat flag only consulted for players.
    expect(mobj.momx).toBe(fixedMul(startMom, FRICTION));
  });

  it('player without CF_NOMOMENTUM bit takes the normal friction path', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const startMom = (5 * F) | 0;
    const mobj = createMobj({
      momx: startMom,
      momy: 0,
      z: 0,
      floorz: 0,
      type: MobjType.PLAYER,
      player: { cheats: 0x1 | 0x2 },
    });

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.momx).toBe(fixedMul(startMom, FRICTION));
  });
});

// ── Parity-sensitive edge cases ──────────────────────────────────────

describe('parity-sensitive edge cases', () => {
  it('MAXMOVE matches 30*FRACUNIT (Chocolate Doom MAXMOVE in p_local.h)', () => {
    expect(MAXMOVE).toBe(30 * 0x10000);
  });

  it('STOPSPEED is FRACUNIT/16 = 0x1000', () => {
    expect(STOPSPEED).toBe(0x10000 >> 4);
  });

  it('FRICTION is 0xE800 matching p_mobj.c', () => {
    expect(FRICTION).toBe(0xe800);
  });

  it('arithmetic right shift preserves negative sign in sub-stepping', () => {
    const negMom = -MAXMOVE;
    expect(negMom >> 1).toBeLessThan(0);
  });

  it('sub-step halving threshold is strict greater-than MAXMOVE/2', () => {
    const halfMax = MAXMOVE >> 1;
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);

    // At halfMax: single step.
    const mobjExact = createMobj({ x: 0, y: 0, momx: halfMax, momy: 0 });
    xyMovement(mobjExact, mapData, blocklinks, list, rng);
    expect(mobjExact.x).toBe(halfMax);

    // At halfMax + 1: sub-stepped, low bit lost via >>= 1.
    const mobjPlus = createMobj({ x: 0, y: 0, momx: halfMax + 1, momy: 0 });
    xyMovement(mobjPlus, mapData, blocklinks, list, rng);
    const halfStep = (halfMax + 1) >> 1;
    expect(mobjPlus.x).toBe((halfStep + halfStep) | 0);
  });

  it('corpse sliding threshold is strict greater-than FRACUNIT/4', () => {
    expect(FRACUNIT >> 2).toBe(0x4000);
  });

  it('zero-momentum skull-fly slam zeroes momz as well', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({
      type: MobjType.SKULL,
      flags: MF_SKULLFLY | MF_SOLID,
      momx: 0,
      momy: 0,
      momz: (8 * F) | 0,
    });
    list.add(mobj);

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.momz).toBe(0);
  });

  it('explodeMissile order: momentum zero → state → tics adjust → flag clear', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mobj = createMobj({
      type: MobjType.TROOPSHOT,
      flags: MF_MISSILE | MF_NOGRAVITY,
      momx: F,
      momy: F,
      momz: F,
    });
    list.add(mobj);

    explodeMissile(mobj, rng, list);

    expect(mobj.momx).toBe(0);
    expect(mobj.momy).toBe(0);
    expect(mobj.momz).toBe(0);
    expect(mobj.state).toBe(STATES[MOBJINFO[MobjType.TROOPSHOT]!.deathstate]);
    expect(mobj.tics).toBeGreaterThanOrEqual(1);
    expect(mobj.flags & MF_MISSILE).toBe(0);
  });

  it('friction is strict greater-than for z > floorz airborne check', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const momx = (5 * F) | 0;

    // z === floorz: on ground — friction applies.
    const mobjOnFloor = createMobj({ momx, momy: 0, z: 0, floorz: 0 });
    xyMovement(mobjOnFloor, mapData, blocklinks, list, rng);
    expect(mobjOnFloor.momx).toBe(fixedMul(momx, FRICTION));

    // z > floorz: airborne — no friction.
    const mobjAir = createMobj({ momx, momy: 0, z: 1, floorz: 0 });
    xyMovement(mobjAir, mapData, blocklinks, list, rng);
    expect(mobjAir.momx).toBe(momx);
  });

  it('MF_NOCLIP mobj still undergoes movement and friction', () => {
    const list = new ThinkerList();
    list.init();
    const rng = new DoomRandom();
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const momx = (5 * F) | 0;
    const mobj = createMobj({ momx, momy: 0, flags: MF_NOCLIP, z: 0, floorz: 0 });

    xyMovement(mobj, mapData, blocklinks, list, rng);

    expect(mobj.x).toBe(momx);
    expect(mobj.momx).toBe(fixedMul(momx, FRICTION));
  });
});
