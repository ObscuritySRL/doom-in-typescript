import { describe, expect, it } from 'bun:test';

import type { Fixed } from '../../src/core/fixed.ts';
import { FRACUNIT } from '../../src/core/fixed.ts';
import { DoomRandom } from '../../src/core/rng.ts';

import { createValidCount } from '../../src/map/blockmapIter.ts';
import type { Blockmap } from '../../src/map/blockmap.ts';
import type { MapLinedef, MapSector, MapSidedef, MapVertex } from '../../src/map/lineSectorGeometry.ts';
import { ML_TWOSIDED, ST_POSITIVE } from '../../src/map/lineSectorGeometry.ts';
import type { MapNode, MapSeg, MapSubsector } from '../../src/map/bspStructs.ts';
import type { LineSectors, MapData, SectorGroup } from '../../src/map/mapSetup.ts';
import type { RejectMap } from '../../src/map/reject.ts';

import { MF_JUSTHIT, MF_SHOOTABLE, Mobj, MOBJINFO, MobjType } from '../../src/world/mobj.ts';
import { checkMeleeRange, checkMissileRange, checkSight, lookForPlayers } from '../../src/ai/targeting.ts';
import type { PlayerLike, TargetingContext } from '../../src/ai/targeting.ts';

// ── Helpers ──────────────────────────────────────────────────────────

const F = FRACUNIT;

function emptyBlockmap(): Blockmap {
  const lumpData = Buffer.alloc(2);
  lumpData.writeInt16LE(-1, 0);
  return {
    originX: 0,
    originY: 0,
    columns: 1,
    rows: 1,
    offsets: Object.freeze([0]),
    lumpData,
  };
}

interface VertexSpec {
  x: number;
  y: number;
}

function vertex(spec: VertexSpec): MapVertex {
  return Object.freeze({ x: (spec.x * F) | 0, y: (spec.y * F) | 0 });
}

interface SectorSpec {
  floor?: number;
  ceiling?: number;
}

function sector(spec: SectorSpec): MapSector {
  return Object.freeze({
    floorheight: ((spec.floor ?? 0) * F) | 0,
    ceilingheight: ((spec.ceiling ?? 128) * F) | 0,
    floorpic: 'FLAT',
    ceilingpic: 'FLAT',
    lightlevel: 160,
    special: 0,
    tag: 0,
  });
}

function sidedef(sec: number): MapSidedef {
  return Object.freeze({
    textureoffset: 0 as Fixed,
    rowoffset: 0 as Fixed,
    toptexture: '-',
    bottomtexture: '-',
    midtexture: '-',
    sector: sec,
  });
}

interface LineSpec {
  v1: number;
  v2: number;
  front: number;
  back: number;
  flags?: number;
}

function linedef(spec: LineSpec, verts: readonly MapVertex[], sides: readonly MapSidedef[]): MapLinedef {
  const front = verts[spec.v1]!;
  const back = verts[spec.v2]!;
  const flags = (spec.flags ?? 0) | (spec.back !== -1 ? ML_TWOSIDED : 0);

  const sidenum0 = sides.findIndex((s) => s.sector === spec.front);
  const sidenum1 = spec.back === -1 ? -1 : sides.findIndex((s) => s.sector === spec.back);

  return Object.freeze({
    v1: spec.v1,
    v2: spec.v2,
    dx: (back.x - front.x) | 0,
    dy: (back.y - front.y) | 0,
    flags,
    special: 0,
    tag: 0,
    sidenum0,
    sidenum1,
    slopetype: ST_POSITIVE,
    bbox: Object.freeze([0, 0, 0, 0] as const),
  });
}

function lineSectorsFor(spec: LineSpec): LineSectors {
  return Object.freeze({ frontsector: spec.front, backsector: spec.back });
}

function emptySectorGroups(count: number): readonly SectorGroup[] {
  const groups: SectorGroup[] = new Array(count);
  for (let i = 0; i < count; i++) {
    groups[i] = Object.freeze({
      lineIndices: Object.freeze([]),
      bbox: Object.freeze([0, 0, 0, 0] as const),
      soundOriginX: 0 as Fixed,
      soundOriginY: 0 as Fixed,
      blockbox: Object.freeze([0, 0, 0, 0] as const),
    });
  }
  return Object.freeze(groups);
}

/**
 * Build a one-sector square room map with four one-sided walls and a
 * single subsector. The sector fills the box (-256,-256)-(256,256).
 *
 * Vertices (CCW from SW):
 *   0: (-256,-256)
 *   1: ( 256,-256)
 *   2: ( 256, 256)
 *   3: (-256, 256)
 *
 * Segs form the boundary for the one subsector in seg-order 0..3.
 */
function buildSingleRoomMap(): MapData {
  const vertexes: readonly MapVertex[] = Object.freeze([vertex({ x: -256, y: -256 }), vertex({ x: 256, y: -256 }), vertex({ x: 256, y: 256 }), vertex({ x: -256, y: 256 })]);

  const sectors: readonly MapSector[] = Object.freeze([sector({ floor: 0, ceiling: 128 })]);

  const sides: readonly MapSidedef[] = Object.freeze([sidedef(0)]);

  const lineSpecs: readonly LineSpec[] = Object.freeze([
    { v1: 0, v2: 1, front: 0, back: -1 },
    { v1: 1, v2: 2, front: 0, back: -1 },
    { v1: 2, v2: 3, front: 0, back: -1 },
    { v1: 3, v2: 0, front: 0, back: -1 },
  ]);

  const linedefs = Object.freeze(lineSpecs.map((ls) => linedef(ls, vertexes, sides)));
  const lineSectors = Object.freeze(lineSpecs.map(lineSectorsFor));

  const segs: readonly MapSeg[] = Object.freeze(
    lineSpecs.map((_, i) =>
      Object.freeze({
        v1: lineSpecs[i]!.v1,
        v2: lineSpecs[i]!.v2,
        angle: 0,
        linedef: i,
        side: 0,
        offset: 0 as Fixed,
      }),
    ),
  );

  const subsectors: readonly MapSubsector[] = Object.freeze([Object.freeze({ numsegs: 4, firstseg: 0 })]);

  // One node pointing both children at subsector 0, so P_CrossBSPNode
  // always lands at the same subsector regardless of partition side.
  const nodes: readonly MapNode[] = Object.freeze([
    Object.freeze({
      x: 0 as Fixed,
      y: 0 as Fixed,
      dx: F,
      dy: 0 as Fixed,
      bbox: Object.freeze([Object.freeze([0, 0, 0, 0] as const), Object.freeze([0, 0, 0, 0] as const)] as const),
      children: Object.freeze([0x8000, 0x8000] as const),
    }),
  ]);

  const sectorCount = sectors.length;
  const rejectBytes = Math.ceil((sectorCount * sectorCount) / 8);
  const reject: RejectMap = {
    sectorCount,
    totalBits: sectorCount * sectorCount,
    expectedSize: rejectBytes,
    data: Buffer.alloc(rejectBytes),
  };

  return {
    name: 'TEST-ROOM',
    vertexes,
    sectors,
    sidedefs: sides,
    linedefs,
    segs,
    subsectors,
    nodes,
    things: Object.freeze([]),
    blockmap: emptyBlockmap(),
    reject,
    subsectorSectors: Object.freeze([0]),
    lineSectors,
    sectorGroups: emptySectorGroups(sectorCount),
    validCount: createValidCount(linedefs.length),
  } as MapData;
}

/**
 * Two-sector map split by a horizontal two-sided line at y=0.
 * Sectors:
 *   0 = north (y >= 0)
 *   1 = south (y <= 0)
 * The divider line's back-sector floor/ceiling are configurable to
 * exercise the sight-slope occlusion path.
 */
function buildTwoSectorMap(divider: { southFloor: number; southCeiling: number; northFloor: number; northCeiling: number }): MapData {
  const vertexes: readonly MapVertex[] = Object.freeze([vertex({ x: -256, y: -256 }), vertex({ x: 256, y: -256 }), vertex({ x: 256, y: 0 }), vertex({ x: 256, y: 256 }), vertex({ x: -256, y: 256 }), vertex({ x: -256, y: 0 })]);

  const sectors: readonly MapSector[] = Object.freeze([sector({ floor: divider.northFloor, ceiling: divider.northCeiling }), sector({ floor: divider.southFloor, ceiling: divider.southCeiling })]);

  const sides: readonly MapSidedef[] = Object.freeze([sidedef(0), sidedef(1), sidedef(0), sidedef(1)]);

  const lineSpecs: readonly LineSpec[] = Object.freeze([
    { v1: 0, v2: 1, front: 1, back: -1 },
    { v1: 1, v2: 2, front: 1, back: -1 },
    { v1: 2, v2: 5, front: 0, back: 1 },
    { v1: 2, v2: 3, front: 0, back: -1 },
    { v1: 3, v2: 4, front: 0, back: -1 },
    { v1: 4, v2: 5, front: 0, back: -1 },
  ]);

  const linedefs = Object.freeze(
    lineSpecs.map((ls, i) => {
      const front = vertexes[ls.v1]!;
      const back = vertexes[ls.v2]!;
      const flags = (ls.flags ?? 0) | (ls.back !== -1 ? ML_TWOSIDED : 0);
      return Object.freeze({
        v1: ls.v1,
        v2: ls.v2,
        dx: (back.x - front.x) | 0,
        dy: (back.y - front.y) | 0,
        flags,
        special: 0,
        tag: 0,
        sidenum0: i * (ls.back === -1 ? 1 : 2),
        sidenum1: ls.back === -1 ? -1 : i * 2 + 1,
        slopetype: ST_POSITIVE,
        bbox: Object.freeze([0, 0, 0, 0] as const),
      });
    }),
  );
  const lineSectors = Object.freeze(lineSpecs.map(lineSectorsFor));

  // Subsector 0 = north (sector 0) -> segs for lines 2..5
  // Subsector 1 = south (sector 1) -> segs for lines 0..2 (line 2 back side)
  const segs: readonly MapSeg[] = Object.freeze([
    Object.freeze({ v1: 2, v2: 5, angle: 0, linedef: 2, side: 0, offset: 0 as Fixed }),
    Object.freeze({ v1: 2, v2: 3, angle: 0, linedef: 3, side: 0, offset: 0 as Fixed }),
    Object.freeze({ v1: 3, v2: 4, angle: 0, linedef: 4, side: 0, offset: 0 as Fixed }),
    Object.freeze({ v1: 4, v2: 5, angle: 0, linedef: 5, side: 0, offset: 0 as Fixed }),
    Object.freeze({ v1: 0, v2: 1, angle: 0, linedef: 0, side: 0, offset: 0 as Fixed }),
    Object.freeze({ v1: 1, v2: 2, angle: 0, linedef: 1, side: 0, offset: 0 as Fixed }),
    Object.freeze({ v1: 5, v2: 2, angle: 0, linedef: 2, side: 1, offset: 0 as Fixed }),
  ]);

  const subsectors: readonly MapSubsector[] = Object.freeze([Object.freeze({ numsegs: 4, firstseg: 0 }), Object.freeze({ numsegs: 3, firstseg: 4 })]);

  // One node splitting on the y=0 line; right child = north subsector, left = south.
  const nodes: readonly MapNode[] = Object.freeze([
    Object.freeze({
      x: 0 as Fixed,
      y: 0 as Fixed,
      dx: F,
      dy: 0 as Fixed,
      bbox: Object.freeze([Object.freeze([0, 0, 0, 0] as const), Object.freeze([0, 0, 0, 0] as const)] as const),
      children: Object.freeze([0x8001, 0x8000] as const),
    }),
  ]);

  const sectorCount = sectors.length;
  const rejectBytes = Math.ceil((sectorCount * sectorCount) / 8);
  const reject: RejectMap = {
    sectorCount,
    totalBits: sectorCount * sectorCount,
    expectedSize: rejectBytes,
    data: Buffer.alloc(rejectBytes),
  };

  return {
    name: 'TWO-SECTOR',
    vertexes,
    sectors,
    sidedefs: sides,
    linedefs,
    segs,
    subsectors,
    nodes,
    things: Object.freeze([]),
    blockmap: emptyBlockmap(),
    reject,
    subsectorSectors: Object.freeze([0, 1]),
    lineSectors,
    sectorGroups: emptySectorGroups(sectorCount),
    validCount: createValidCount(linedefs.length),
  } as MapData;
}

function makeMobj(x: number, y: number, angle = 0, type = MobjType.PLAYER): Mobj {
  const mobj = new Mobj();
  mobj.type = type;
  mobj.x = (x * F) | 0;
  mobj.y = (y * F) | 0;
  mobj.z = 0;
  mobj.angle = angle;
  mobj.height = 56 * F;
  mobj.radius = 16 * F;
  mobj.flags = MF_SHOOTABLE;
  mobj.info = MOBJINFO[type] ?? null;
  return mobj;
}

/** Build a context where sector indices are driven by a map. */
function makeContext(mapData: MapData, sectorIndexMap: Map<Mobj, number>): TargetingContext {
  return {
    mapData,
    getSectorIndex: (mobj: Mobj) => sectorIndexMap.get(mobj) ?? 0,
  };
}

// ── Tests: checkSight ────────────────────────────────────────────────

describe('checkSight', () => {
  it('returns false when the REJECT bit blocks the pair', () => {
    const map = buildSingleRoomMap();
    // Set the (0,0) reject bit (self→self) to mark "can never see".
    map.reject.data[0] = 0b0000_0001;

    const a = makeMobj(0, 0);
    const b = makeMobj(64, 0);
    const ctx = makeContext(
      map,
      new Map([
        [a, 0],
        [b, 0],
      ]),
    );

    expect(checkSight(a, b, ctx)).toBe(false);
  });

  it('advances validCount.current exactly once per call', () => {
    const map = buildSingleRoomMap();
    const before = map.validCount.current;
    const a = makeMobj(0, 0);
    const b = makeMobj(32, 0);
    const ctx = makeContext(
      map,
      new Map([
        [a, 0],
        [b, 0],
      ]),
    );

    checkSight(a, b, ctx);
    expect(map.validCount.current).toBe(before + 1);

    checkSight(a, b, ctx);
    expect(map.validCount.current).toBe(before + 2);
  });

  it('returns true for two mobjs inside a one-sector room', () => {
    const map = buildSingleRoomMap();
    const a = makeMobj(-100, -100);
    const b = makeMobj(100, 100);
    const ctx = makeContext(
      map,
      new Map([
        [a, 0],
        [b, 0],
      ]),
    );

    expect(checkSight(a, b, ctx)).toBe(true);
  });

  it('returns false when the intervening line has a closed opening', () => {
    // North floor rises to meet ceiling → openrange <= 0 → sight blocked.
    const map = buildTwoSectorMap({
      northFloor: 128,
      northCeiling: 128,
      southFloor: 0,
      southCeiling: 128,
    });
    // Use non-zero x to avoid the vanilla "x == node->y" quirk when
    // divl.y happens to equal 0.
    const looker = makeMobj(50, -128);
    const target = makeMobj(50, 128);
    const ctx = makeContext(
      map,
      new Map([
        [looker, 1],
        [target, 0],
      ]),
    );

    expect(checkSight(looker, target, ctx)).toBe(false);
  });

  it('returns true when the intervening line has a clear opening', () => {
    // Matching heights -> no occluder, no slope update, sight passes.
    const map = buildTwoSectorMap({
      northFloor: 0,
      northCeiling: 128,
      southFloor: 0,
      southCeiling: 128,
    });
    const looker = makeMobj(50, -128);
    const target = makeMobj(50, 128);
    const ctx = makeContext(
      map,
      new Map([
        [looker, 1],
        [target, 0],
      ]),
    );

    expect(checkSight(looker, target, ctx)).toBe(true);
  });
});

// ── Tests: lookForPlayers ────────────────────────────────────────────

function buildPlayers(
  actor: Mobj,
  positions: readonly (readonly [number, number] | null)[],
): {
  players: PlayerLike[];
  playeringame: boolean[];
  mobjs: (Mobj | null)[];
  sectorIndexMap: Map<Mobj, number>;
} {
  const sectorIndexMap = new Map<Mobj, number>();
  sectorIndexMap.set(actor, 0);

  const mobjs: (Mobj | null)[] = [];
  const players: PlayerLike[] = [];
  const playeringame: boolean[] = [];

  for (let i = 0; i < 4; i++) {
    const pos = positions[i];
    if (pos === null || pos === undefined) {
      mobjs.push(null);
      players.push({ mo: null, health: 0 });
      playeringame.push(false);
      continue;
    }
    const mo = makeMobj(pos[0], pos[1]);
    sectorIndexMap.set(mo, 0);
    mobjs.push(mo);
    players.push({ mo, health: 100 });
    playeringame.push(true);
  }

  return { players, playeringame, mobjs, sectorIndexMap };
}

describe('lookForPlayers', () => {
  it('returns false and leaves target null when every in-game player is dead', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0);
    actor.lastlook = 0;

    const { players, playeringame, sectorIndexMap } = buildPlayers(actor, [
      [100, 0],
      [100, 0],
      [100, 0],
      [100, 0],
    ]);
    for (const p of players) {
      (p as { mo: Mobj | null; health: number }).health = 0;
    }

    const ctx: TargetingContext = {
      mapData: map,
      getSectorIndex: (m: Mobj) => sectorIndexMap.get(m) ?? 0,
    };

    const result = lookForPlayers(actor, true, players, playeringame, ctx);
    expect(result).toBe(false);
    expect(actor.target).toBeNull();
  });

  it('accepts the first visible live player and sets actor.target', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0);
    actor.lastlook = 0;

    const { players, playeringame, mobjs, sectorIndexMap } = buildPlayers(actor, [[100, 0], null, null, null]);
    const ctx: TargetingContext = {
      mapData: map,
      getSectorIndex: (m: Mobj) => sectorIndexMap.get(m) ?? 0,
    };

    const result = lookForPlayers(actor, true, players, playeringame, ctx);
    expect(result).toBe(true);
    expect(actor.target).toBe(mobjs[0]);
  });

  it('rejects a player behind the actor beyond MELEERANGE when allaround=false', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, 0); // facing east (angle 0)
    actor.lastlook = 0;

    // Player at (-200, 0) — directly behind the actor, 200 map units away.
    const { players, playeringame, sectorIndexMap } = buildPlayers(actor, [[-200, 0], null, null, null]);
    const ctx: TargetingContext = {
      mapData: map,
      getSectorIndex: (m: Mobj) => sectorIndexMap.get(m) ?? 0,
    };

    const result = lookForPlayers(actor, false, players, playeringame, ctx);
    expect(result).toBe(false);
    expect(actor.target).toBeNull();
  });

  it('accepts a player behind the actor within MELEERANGE when allaround=false', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, 0);
    actor.lastlook = 0;

    // Player at (-32, 0) — directly behind, 32 map units away (< MELEERANGE=64).
    const { players, playeringame, mobjs, sectorIndexMap } = buildPlayers(actor, [[-32, 0], null, null, null]);
    const ctx: TargetingContext = {
      mapData: map,
      getSectorIndex: (m: Mobj) => sectorIndexMap.get(m) ?? 0,
    };

    const result = lookForPlayers(actor, false, players, playeringame, ctx);
    expect(result).toBe(true);
    expect(actor.target).toBe(mobjs[0]);
  });

  it('skips dead players (health <= 0) and advances lastlook', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0);
    actor.lastlook = 0;

    const { players, playeringame, mobjs, sectorIndexMap } = buildPlayers(actor, [[100, 0], [64, 64], null, null]);
    // Kill player 0; player 1 should be selected.
    (players[0] as { mo: Mobj | null; health: number }).health = 0;

    const ctx: TargetingContext = {
      mapData: map,
      getSectorIndex: (m: Mobj) => sectorIndexMap.get(m) ?? 0,
    };

    const result = lookForPlayers(actor, true, players, playeringame, ctx);
    expect(result).toBe(true);
    expect(actor.target).toBe(mobjs[1]);
  });
});

// ── Tests: checkMeleeRange ───────────────────────────────────────────

describe('checkMeleeRange', () => {
  it('returns false when actor.target is null', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0);
    const ctx = makeContext(map, new Map([[actor, 0]]));

    expect(checkMeleeRange(actor, ctx)).toBe(false);
  });

  it('returns true when target is within MELEERANGE - 20 + target.radius and visible', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0);
    const target = makeMobj(50, 0); // 50 map units — within 64-20+16=60? No, 50 < 60 so yes.
    actor.target = target;
    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );

    expect(checkMeleeRange(actor, ctx)).toBe(true);
  });

  it('returns false when target is beyond MELEERANGE - 20 + target.radius', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0);
    const target = makeMobj(80, 0); // 80 > 60 cutoff for radius=16.
    actor.target = target;
    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );

    expect(checkMeleeRange(actor, ctx)).toBe(false);
  });
});

// ── Tests: checkMissileRange ─────────────────────────────────────────

describe('checkMissileRange', () => {
  it('returns false when sight is blocked', () => {
    const map = buildSingleRoomMap();
    map.reject.data[0] = 0b0000_0001;

    const actor = makeMobj(0, 0);
    const target = makeMobj(200, 0);
    actor.target = target;
    actor.reactiontime = 0;
    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );

    const rng = new DoomRandom();
    expect(checkMissileRange(actor, ctx, rng)).toBe(false);
  });

  it('returns true and clears MF_JUSTHIT without rolling RNG', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0);
    const target = makeMobj(100, 0);
    actor.target = target;
    actor.reactiontime = 99; // irrelevant — JUSTHIT short-circuits first
    actor.flags = MF_SHOOTABLE | MF_JUSTHIT;

    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );
    const rng = new DoomRandom();
    const beforeIndex = rng.prndindex;

    expect(checkMissileRange(actor, ctx, rng)).toBe(true);
    expect(actor.flags & MF_JUSTHIT).toBe(0);
    expect(rng.prndindex).toBe(beforeIndex);
  });

  it('returns false when reactiontime > 0 (without consuming RNG)', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0);
    const target = makeMobj(100, 0);
    actor.target = target;
    actor.reactiontime = 5;

    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );
    const rng = new DoomRandom();
    const beforeIndex = rng.prndindex;

    expect(checkMissileRange(actor, ctx, rng)).toBe(false);
    expect(rng.prndindex).toBe(beforeIndex);
  });

  it('consumes exactly one P_Random() when reactiontime is 0 and JUSTHIT is clear', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, 0, MobjType.POSSESSED);
    const target = makeMobj(80, 0);
    actor.target = target;
    actor.reactiontime = 0;

    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );
    const rng = new DoomRandom();
    const beforeIndex = rng.prndindex;

    checkMissileRange(actor, ctx, rng);
    expect(rng.prndindex).toBe((beforeIndex + 1) & 0xff);
  });
});
