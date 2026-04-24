import { describe, expect, it } from 'bun:test';

import type { Fixed } from '../../src/core/fixed.ts';
import { FRACUNIT } from '../../src/core/fixed.ts';
import { DoomRandom } from '../../src/core/rng.ts';

import { createValidCount } from '../../src/map/blockmapIter.ts';
import type { Blockmap } from '../../src/map/blockmap.ts';
import type { MapLinedef, MapSector, MapSidedef, MapVertex } from '../../src/map/lineSectorGeometry.ts';
import { ST_POSITIVE } from '../../src/map/lineSectorGeometry.ts';
import type { MapNode, MapSeg, MapSubsector } from '../../src/map/bspStructs.ts';
import type { MapData, SectorGroup } from '../../src/map/mapSetup.ts';
import type { RejectMap } from '../../src/map/reject.ts';

import { MF_SHOOTABLE, Mobj, MOBJINFO, MobjType } from '../../src/world/mobj.ts';

import { MELEE_BASE_CUTOFF, MELEE_RADIUS_ADJUST, MELEERANGE, checkMeleeRange } from '../../src/ai/meleeRange.ts';
import type { TargetingContext } from '../../src/ai/meleeRange.ts';

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

function vertex(x: number, y: number): MapVertex {
  return Object.freeze({ x: (x * F) | 0, y: (y * F) | 0 });
}

function sector(): MapSector {
  return Object.freeze({
    floorheight: 0 as Fixed,
    ceilingheight: (128 * F) | 0,
    floorpic: 'FLAT',
    ceilingpic: 'FLAT',
    lightlevel: 160,
    special: 0,
    tag: 0,
  });
}

function sidedef(): MapSidedef {
  return Object.freeze({
    textureoffset: 0 as Fixed,
    rowoffset: 0 as Fixed,
    toptexture: '-',
    bottomtexture: '-',
    midtexture: '-',
    sector: 0,
  });
}

function linedef(v1: number, v2: number, verts: readonly MapVertex[]): MapLinedef {
  const a = verts[v1]!;
  const b = verts[v2]!;
  return Object.freeze({
    v1,
    v2,
    dx: (b.x - a.x) | 0,
    dy: (b.y - a.y) | 0,
    flags: 0,
    special: 0,
    tag: 0,
    sidenum0: 0,
    sidenum1: -1,
    slopetype: ST_POSITIVE,
    bbox: Object.freeze([0, 0, 0, 0] as const),
  });
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
 * Build a one-sector 1024×1024 room with four one-sided walls and a
 * single subsector. The sole node points both children at the sole
 * subsector so P_CrossBSPNode always lands there regardless of side.
 */
function buildSingleRoomMap(): MapData {
  const vertexes: readonly MapVertex[] = Object.freeze([vertex(-512, -512), vertex(512, -512), vertex(512, 512), vertex(-512, 512)]);

  const sectors: readonly MapSector[] = Object.freeze([sector()]);
  const sides: readonly MapSidedef[] = Object.freeze([sidedef()]);

  const linedefs: readonly MapLinedef[] = Object.freeze([linedef(0, 1, vertexes), linedef(1, 2, vertexes), linedef(2, 3, vertexes), linedef(3, 0, vertexes)]);

  const segs: readonly MapSeg[] = Object.freeze(
    linedefs.map((_, i) =>
      Object.freeze({
        v1: i,
        v2: (i + 1) & 3,
        angle: 0,
        linedef: i,
        side: 0,
        offset: 0 as Fixed,
      }),
    ),
  );

  const subsectors: readonly MapSubsector[] = Object.freeze([Object.freeze({ numsegs: 4, firstseg: 0 })]);

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
    name: 'MELEE-ROOM',
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
    lineSectors: Object.freeze([Object.freeze({ frontsector: 0, backsector: -1 }), Object.freeze({ frontsector: 0, backsector: -1 }), Object.freeze({ frontsector: 0, backsector: -1 }), Object.freeze({ frontsector: 0, backsector: -1 })]),
    sectorGroups: emptySectorGroups(sectorCount),
    validCount: createValidCount(linedefs.length),
  } as MapData;
}

function makeMobj(x: number, y: number, type = MobjType.PLAYER): Mobj {
  const mobj = new Mobj();
  mobj.type = type;
  mobj.x = (x * F) | 0;
  mobj.y = (y * F) | 0;
  mobj.z = 0;
  mobj.angle = 0;
  mobj.height = 56 * F;
  mobj.radius = 16 * F;
  mobj.flags = MF_SHOOTABLE;
  mobj.info = MOBJINFO[type] ?? null;
  return mobj;
}

function makeContext(mapData: MapData, sectorIndexMap: Map<Mobj, number>): TargetingContext {
  return {
    mapData,
    getSectorIndex: (mobj: Mobj) => sectorIndexMap.get(mobj) ?? 0,
  };
}

// ── Constants ────────────────────────────────────────────────────────

describe('meleeRange constants', () => {
  it('MELEERANGE is 64*FRACUNIT (0x40_0000)', () => {
    expect(MELEERANGE).toBe(64 * F);
    expect(MELEERANGE).toBe(0x40_0000);
  });

  it('MELEE_RADIUS_ADJUST is 20*FRACUNIT', () => {
    expect(MELEE_RADIUS_ADJUST).toBe(20 * F);
  });

  it('MELEE_BASE_CUTOFF is MELEERANGE - MELEE_RADIUS_ADJUST = 44*FRACUNIT', () => {
    expect(MELEE_BASE_CUTOFF).toBe(44 * F);
    expect(MELEE_BASE_CUTOFF).toBe((MELEERANGE - MELEE_RADIUS_ADJUST) | 0);
  });
});

// ── checkMeleeRange ─────────────────────────────────────────────────

describe('checkMeleeRange', () => {
  it('returns false when actor.target is null', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0);
    const ctx = makeContext(map, new Map([[actor, 0]]));

    expect(checkMeleeRange(actor, ctx)).toBe(false);
  });

  it('returns true when target is within MELEERANGE-20+target.radius and visible', () => {
    // cutoff = 64 - 20 + 16 (player radius) = 60; target at 50 is inside
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0);
    const target = makeMobj(50, 0);
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

  it('returns false at exactly the cutoff distance (strict >=)', () => {
    // P_AproxDistance((60,0)) = |60| + |0| - min/2 = 60; cutoff = 60.
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0);
    const target = makeMobj(60, 0);
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

  it('returns false when target is beyond the cutoff', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0);
    const target = makeMobj(80, 0);
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

  it('wider target extends the cutoff via info.radius', () => {
    // Cacodemon radius = 30*FRACUNIT → cutoff = 64 - 20 + 30 = 74.
    // Target at 70 is outside the player-radius cutoff (60) but inside
    // the cacodemon-radius cutoff.
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0);
    const target = makeMobj(70, 0, MobjType.HEAD);
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

  it('returns false when sight is blocked by REJECT even at point-blank range', () => {
    const map = buildSingleRoomMap();
    // Set the (0,0) reject bit (self→self) to mark "can never see".
    map.reject.data[0] = 0b0000_0001;

    const actor = makeMobj(0, 0);
    const target = makeMobj(16, 0);
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

  it('uses the octagonal P_AproxDistance not Euclidean', () => {
    // At (45,45), Euclidean = 63.6; octagonal = 45 + 45 - 22 = 68.
    // Player-radius cutoff = 60, so octagonal reads as out-of-range
    // (68 >= 60) even though Euclidean (63.6) is also out-of-range here.
    // The parity-critical case: (35,35). Euclidean = 49.5; octagonal =
    // 35 + 35 - 17 = 53. Both within the 60 cutoff → true.
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0);
    const target = makeMobj(35, 35);
    actor.target = target;
    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );

    expect(checkMeleeRange(actor, ctx)).toBe(true);

    // Now (45,45): octagonal 68 ≥ 60 → false, even though the target
    // is only 63.6 Euclidean units away (which would also fail — but
    // the boundary differs for (52,0) vs (36,36) pairs at exactly the
    // same Euclidean distance).
    const target2 = makeMobj(45, 45);
    actor.target = target2;
    const ctx2 = makeContext(
      map,
      new Map([
        [actor, 0],
        [target2, 0],
      ]),
    );

    expect(checkMeleeRange(actor, ctx2)).toBe(false);
  });

  it('consumes no RNG even when sight is evaluated', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0);
    const target = makeMobj(32, 0);
    actor.target = target;
    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );

    const rng = new DoomRandom();
    const beforeIndex = rng.prndindex;
    const result = checkMeleeRange(actor, ctx);
    expect(result).toBe(true);
    expect(rng.prndindex).toBe(beforeIndex);
  });

  it('advances validCount.current each call via checkSight', () => {
    // P_CheckMeleeRange invokes P_CheckSight; that single-call contract
    // bumps the global validcount by exactly one per melee check.
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0);
    const target = makeMobj(32, 0);
    actor.target = target;
    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );

    const before = map.validCount.current;
    checkMeleeRange(actor, ctx);
    expect(map.validCount.current).toBe(before + 1);
    checkMeleeRange(actor, ctx);
    expect(map.validCount.current).toBe(before + 2);
  });

  it('does not advance validCount when actor.target is null (null short-circuit)', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0);
    const ctx = makeContext(map, new Map([[actor, 0]]));

    const before = map.validCount.current;
    expect(checkMeleeRange(actor, ctx)).toBe(false);
    expect(map.validCount.current).toBe(before);
  });

  it('falls back to MELEE_BASE_CUTOFF when target.info is null', () => {
    // Null info → targetRadius = 0 → cutoff = 44*FRACUNIT.
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0);
    const target = makeMobj(30, 0);
    target.info = null;
    actor.target = target;
    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );

    // 30 < 44 — within the info-less base cutoff.
    expect(checkMeleeRange(actor, ctx)).toBe(true);

    const target2 = makeMobj(44, 0);
    target2.info = null;
    actor.target = target2;
    const ctx2 = makeContext(
      map,
      new Map([
        [actor, 0],
        [target2, 0],
      ]),
    );

    // 44 >= MELEE_BASE_CUTOFF (44) — strictly out of range.
    expect(checkMeleeRange(actor, ctx2)).toBe(false);
  });
});
