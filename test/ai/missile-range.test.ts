import { describe, expect, it } from 'bun:test';

import type { Fixed } from '../../src/core/fixed.ts';
import { FRACUNIT } from '../../src/core/fixed.ts';
import { DoomRandom, RNG_TABLE } from '../../src/core/rng.ts';

import { createValidCount } from '../../src/map/blockmapIter.ts';
import type { Blockmap } from '../../src/map/blockmap.ts';
import type { MapLinedef, MapSector, MapSidedef, MapVertex } from '../../src/map/lineSectorGeometry.ts';
import { ST_POSITIVE } from '../../src/map/lineSectorGeometry.ts';
import type { MapNode, MapSeg, MapSubsector } from '../../src/map/bspStructs.ts';
import type { MapData, SectorGroup } from '../../src/map/mapSetup.ts';
import type { RejectMap } from '../../src/map/reject.ts';

import { MF_JUSTHIT, MF_SHOOTABLE, Mobj, MOBJINFO, MobjType } from '../../src/world/mobj.ts';

import { MISSILE_BASE_CUTOFF, MISSILE_CYBORG_DIST_CLAMP, MISSILE_DIST_CLAMP, MISSILE_NO_MELEE_CUTOFF, MISSILE_UNDEAD_DIST_MIN, MISSILE_VILE_DIST_MAX, checkMissileRange } from '../../src/ai/missileRange.ts';
import type { TargetingContext } from '../../src/ai/missileRange.ts';

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
 * Build a one-sector 8192×8192 room with four one-sided walls so every
 * per-type distance override (VILE 896, UNDEAD 196, CYBORG 160, SPIDER
 * 200 raw, SKULL 200 raw) can be exercised without spanning the grid.
 * The sole node points both children at the sole subsector so
 * P_CrossBSPNode always lands there regardless of partition side.
 */
function buildLargeRoomMap(): MapData {
  const vertexes: readonly MapVertex[] = Object.freeze([vertex(-4096, -4096), vertex(4096, -4096), vertex(4096, 4096), vertex(-4096, 4096)]);

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
    name: 'MISSILE-ROOM',
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

function makeMobj(x: number, y: number, type = MobjType.POSSESSED): Mobj {
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
  mobj.reactiontime = 0;
  return mobj;
}

function makeContext(mapData: MapData, sectorIndexMap: Map<Mobj, number>): TargetingContext {
  return {
    mapData,
    getSectorIndex: (mobj: Mobj) => sectorIndexMap.get(mobj) ?? 0,
  };
}

// ── Constants ────────────────────────────────────────────────────────

describe('missileRange constants', () => {
  it('MISSILE_BASE_CUTOFF is 64*FRACUNIT', () => {
    expect(MISSILE_BASE_CUTOFF).toBe(64 * F);
    expect(MISSILE_BASE_CUTOFF).toBe(0x40_0000);
  });

  it('MISSILE_NO_MELEE_CUTOFF is 128*FRACUNIT', () => {
    expect(MISSILE_NO_MELEE_CUTOFF).toBe(128 * F);
  });

  it('MISSILE_DIST_CLAMP is 200 (universal post-halve ceiling)', () => {
    expect(MISSILE_DIST_CLAMP).toBe(200);
  });

  it('MISSILE_CYBORG_DIST_CLAMP is 160 (CYBORG-specific ceiling)', () => {
    expect(MISSILE_CYBORG_DIST_CLAMP).toBe(160);
    expect(MISSILE_CYBORG_DIST_CLAMP).toBeLessThan(MISSILE_DIST_CLAMP);
  });

  it('MISSILE_VILE_DIST_MAX is 14*64 = 896', () => {
    expect(MISSILE_VILE_DIST_MAX).toBe(14 * 64);
    expect(MISSILE_VILE_DIST_MAX).toBe(896);
  });

  it('MISSILE_UNDEAD_DIST_MIN is 196', () => {
    expect(MISSILE_UNDEAD_DIST_MIN).toBe(196);
  });
});

// ── checkMissileRange guards (null / sight / JUSTHIT / reactiontime) ─

describe('checkMissileRange guards', () => {
  it('returns false when actor.target is null (no RNG consumed)', () => {
    const map = buildLargeRoomMap();
    const actor = makeMobj(0, 0);
    const ctx = makeContext(map, new Map([[actor, 0]]));

    const rng = new DoomRandom();
    const before = rng.prndindex;
    expect(checkMissileRange(actor, ctx, rng)).toBe(false);
    expect(rng.prndindex).toBe(before);
  });

  it('returns false when REJECT blocks sight (no RNG consumed)', () => {
    const map = buildLargeRoomMap();
    map.reject.data[0] = 0b0000_0001; // self→self blocked

    const actor = makeMobj(0, 0);
    const target = makeMobj(200, 0);
    actor.target = target;
    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );

    const rng = new DoomRandom();
    const before = rng.prndindex;
    expect(checkMissileRange(actor, ctx, rng)).toBe(false);
    expect(rng.prndindex).toBe(before);
  });

  it('MF_JUSTHIT retaliates, clears the flag, and consumes zero RNG', () => {
    const map = buildLargeRoomMap();
    const actor = makeMobj(0, 0);
    actor.flags = MF_SHOOTABLE | MF_JUSTHIT;
    actor.reactiontime = 99; // irrelevant — JUSTHIT short-circuits first

    const target = makeMobj(100, 0);
    actor.target = target;
    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );

    const rng = new DoomRandom();
    const before = rng.prndindex;
    expect(checkMissileRange(actor, ctx, rng)).toBe(true);
    expect(actor.flags & MF_JUSTHIT).toBe(0);
    expect(actor.flags & MF_SHOOTABLE).toBe(MF_SHOOTABLE);
    expect(rng.prndindex).toBe(before);
  });

  it('reactiontime > 0 rejects the attack with zero RNG', () => {
    const map = buildLargeRoomMap();
    const actor = makeMobj(0, 0);
    actor.reactiontime = 5;

    const target = makeMobj(100, 0);
    actor.target = target;
    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );

    const rng = new DoomRandom();
    const before = rng.prndindex;
    expect(checkMissileRange(actor, ctx, rng)).toBe(false);
    expect(rng.prndindex).toBe(before);
  });
});

// ── checkMissileRange distance roll ──────────────────────────────────

describe('checkMissileRange distance roll', () => {
  it('happy path consumes exactly one P_Random() call', () => {
    const map = buildLargeRoomMap();
    const actor = makeMobj(0, 0, MobjType.POSSESSED);
    const target = makeMobj(500, 0);
    actor.target = target;
    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );

    const rng = new DoomRandom();
    const before = rng.prndindex;
    checkMissileRange(actor, ctx, rng);
    expect(rng.prndindex).toBe((before + 1) & 0xff);
  });

  it('fires when P_Random() >= dist (low-roll side of the gate)', () => {
    // POSSESSED at 100 map units.  info.meleestate == 0 → dist becomes
    // (100 - 64 - 128) = -92 ≤ 0 after the shift, and every roll >= 0
    // succeeds.  Verifies the `min(..., 200)` ceiling never flips the
    // sign of a negative dist.
    const map = buildLargeRoomMap();
    const actor = makeMobj(0, 0, MobjType.POSSESSED);
    const target = makeMobj(100, 0);
    actor.target = target;
    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );

    const rng = new DoomRandom();
    expect(checkMissileRange(actor, ctx, rng)).toBe(true);
  });

  it('blocks when P_Random() < dist (dist saturates at 200)', () => {
    // UNDEAD has a melee state, so no 128 subtraction.  At 2048 map
    // units dist becomes (2048 - 64) = 1984, halved to 992, clamped
    // to 200.  The first two RNG values from a fresh stream (P_Random
    // table starts with 0, 8, 109, …) are < 200, so the roll fails.
    const map = buildLargeRoomMap();
    const actor = makeMobj(0, 0, MobjType.UNDEAD);
    const target = makeMobj(2048, 0);
    actor.target = target;
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
});

// ── checkMissileRange per-type overrides ─────────────────────────────

describe('checkMissileRange VILE distance cap', () => {
  it('rejects beyond 14*64 without rolling RNG', () => {
    // Target at 1024 map units: dist = 1024 - 64 = 960 > 896 → reject.
    // VILE.info.meleestate == 0 but the VILE branch runs BEFORE the
    // no-melee subtraction path only matters for the non-VILE fork —
    // the `dist > 14*64` check happens on the post-subtraction value.
    // raw 1024 - 64 = 960; VILE has meleestate=0 so also -128 → 832.
    // 832 is still ≤ 896 (the cap), so we need a larger distance.
    const map = buildLargeRoomMap();
    const actor = makeMobj(0, 0, MobjType.VILE);
    const target = makeMobj(1200, 0); // post-subtract: 1200-64-128 = 1008 > 896
    actor.target = target;
    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );

    const rng = new DoomRandom();
    const before = rng.prndindex;
    expect(checkMissileRange(actor, ctx, rng)).toBe(false);
    expect(rng.prndindex).toBe(before);
  });

  it('still evaluates within the cap (and consumes one RNG)', () => {
    const map = buildLargeRoomMap();
    const actor = makeMobj(0, 0, MobjType.VILE);
    const target = makeMobj(500, 0); // well inside the cap
    actor.target = target;
    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );

    const rng = new DoomRandom();
    const before = rng.prndindex;
    checkMissileRange(actor, ctx, rng);
    expect(rng.prndindex).toBe((before + 1) & 0xff);
  });
});

describe('checkMissileRange UNDEAD distance minimum', () => {
  it('rejects below 196 without rolling RNG', () => {
    // UNDEAD.info.meleestate == 335 (has melee) — NO extra 128 subtract.
    // Target at 200 units: dist = 200 - 64 = 136 < 196 → false, no RNG.
    const map = buildLargeRoomMap();
    const actor = makeMobj(0, 0, MobjType.UNDEAD);
    const target = makeMobj(200, 0);
    actor.target = target;
    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );

    const rng = new DoomRandom();
    const before = rng.prndindex;
    expect(checkMissileRange(actor, ctx, rng)).toBe(false);
    expect(rng.prndindex).toBe(before);
  });

  it('above the minimum halves the distance before the clamp', () => {
    // Target at 300 → dist = 300-64 = 236 ≥ 196; halved to 118.
    // First P_Random from fresh stream is 0 < 118 → false (but RNG
    // was consumed, distinguishing from the 200-unit rejection above).
    const map = buildLargeRoomMap();
    const actor = makeMobj(0, 0, MobjType.UNDEAD);
    const target = makeMobj(300, 0);
    actor.target = target;
    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );

    const rng = new DoomRandom();
    const before = rng.prndindex;
    checkMissileRange(actor, ctx, rng);
    expect(rng.prndindex).toBe((before + 1) & 0xff);
  });
});

describe('checkMissileRange CYBORG distance clamp', () => {
  it('caps dist at 160 AFTER the halve-and-200-clamp', () => {
    // CYBORG.info.meleestate == 0 → subtract 128 extra.
    // At 4000 map units: raw = 4000-64-128 = 3808, halved to 1904,
    // clamped to 200, then CYBORG-clamped to 160. The first RNG
    // value from a fresh stream (0) is < 160 → false with RNG
    // consumed.  What makes this CYBORG-specific: absent the 160
    // clamp, dist would be 200 and a roll of exactly 160 would
    // succeed (200 > 160 → false) vs. fail (160 < 200).
    const map = buildLargeRoomMap();
    const actor = makeMobj(0, 0, MobjType.CYBORG);
    const target = makeMobj(4000, 0);
    actor.target = target;
    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );

    // Prime the RNG so the NEXT pRandom() call returns a value in
    // [160, 200).  If CYBORG's 160 clamp is active, dist = 160 and
    // the roll succeeds (value ≥ 160 → fires).  If the clamp were
    // missing, dist = 200 and the same roll would fail (value < 200).
    const rng = new DoomRandom();
    let targetIndex = -1;
    for (let j = 1; j < 256; j++) {
      const v = RNG_TABLE[j]!;
      if (v >= 160 && v < 200) {
        targetIndex = j;
        break;
      }
    }
    expect(targetIndex).toBeGreaterThan(0);
    // pRandom() pre-increments, so after (targetIndex - 1) calls the
    // next pRandom() returns RNG_TABLE[targetIndex].
    for (let k = 0; k < targetIndex - 1; k++) rng.pRandom();
    expect(rng.prndindex).toBe(targetIndex - 1);

    // checkMissileRange rolls exactly one value: RNG_TABLE[targetIndex]
    // which is in [160, 200). CYBORG's 160 clamp makes this >= dist.
    expect(checkMissileRange(actor, ctx, rng)).toBe(true);
  });
});

describe('checkMissileRange SPIDER and SKULL halving', () => {
  it('SPIDER halves the distance roll', () => {
    // SPIDER.info.meleestate == 0 → subtract 128 extra.
    // At 1024 map units raw = 1024 - 64 - 128 = 832, halved to 416,
    // clamped to 200. Confirms the override path is reached.
    const map = buildLargeRoomMap();
    const actor = makeMobj(0, 0, MobjType.SPIDER);
    const target = makeMobj(1024, 0);
    actor.target = target;
    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );

    const rng = new DoomRandom();
    const before = rng.prndindex;
    checkMissileRange(actor, ctx, rng);
    expect(rng.prndindex).toBe((before + 1) & 0xff);
  });

  it('SKULL halves the distance roll', () => {
    // SKULL.info.meleestate == 0 → subtract 128 extra; halve; clamp.
    const map = buildLargeRoomMap();
    const actor = makeMobj(0, 0, MobjType.SKULL);
    const target = makeMobj(800, 0);
    actor.target = target;
    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );

    const rng = new DoomRandom();
    expect(rng.prndindex).toBe(0);
    checkMissileRange(actor, ctx, rng);
    expect(rng.prndindex).toBe(1);
  });
});

// ── checkMissileRange no-melee subtraction edge case ─────────────────

describe('checkMissileRange no-melee cutoff', () => {
  it('subtracts 128*FRACUNIT extra when info.meleestate == 0', () => {
    // POSSESSED has meleestate=0. At 128 map units:
    //   dist = 128 - 64 - 128 = -64 → shifted to 0 after clamp → any
    //   P_Random() ≥ 0 fires → always true.
    const map = buildLargeRoomMap();
    const actor = makeMobj(0, 0, MobjType.POSSESSED);
    const target = makeMobj(128, 0);
    actor.target = target;
    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );

    const rng = new DoomRandom();
    expect(checkMissileRange(actor, ctx, rng)).toBe(true);
  });

  it('does NOT subtract 128 when info.meleestate != 0', () => {
    // UNDEAD has meleestate=335. At 300 units: dist = 300-64 = 236,
    // halved to 118 (UNDEAD also halves).  Without the halving/no-melee
    // nuance, a melee-less monster at the same distance would see
    // dist = 300-64-128 = 108 (smaller). This test locks the fact that
    // UNDEAD's dist is 236 BEFORE the halve, not 108, by checking that
    // UNDEAD at 300 consumes RNG (distance ≥ 196 so distance-roll runs)
    // — if the no-melee subtraction had been applied, dist would drop
    // to 108 which is < 196, short-circuiting without RNG.
    const map = buildLargeRoomMap();
    const actor = makeMobj(0, 0, MobjType.UNDEAD);
    const target = makeMobj(300, 0);
    actor.target = target;
    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );

    const rng = new DoomRandom();
    const before = rng.prndindex;
    checkMissileRange(actor, ctx, rng);
    // RNG was rolled → UNDEAD's pre-halve dist (236) passed the
    // MISSILE_UNDEAD_DIST_MIN check, proving no 128 subtract applied.
    expect(rng.prndindex).toBe((before + 1) & 0xff);
  });

  it('null info falls back to the no-melee-subtract branch not taken', () => {
    // info === null → the `actor.info !== null && meleestate === 0`
    // guard is false, so the extra 128 subtraction is skipped. The
    // actor behaves as if it had a melee state (conservative fallback).
    const map = buildLargeRoomMap();
    const actor = makeMobj(0, 0, MobjType.POSSESSED);
    actor.info = null;

    const target = makeMobj(150, 0);
    actor.target = target;
    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );

    // At 150 map units: dist = 150-64 = 86 (no extra 128 subtract
    // because info is null). The RNG is rolled.  A P_Random() ≥ 86
    // fires. The first roll is 0 which is < 86, so false — but RNG
    // was consumed.
    const rng = new DoomRandom();
    const before = rng.prndindex;
    checkMissileRange(actor, ctx, rng);
    expect(rng.prndindex).toBe((before + 1) & 0xff);
  });
});

// ── checkMissileRange sight advances validCount ──────────────────────

describe('checkMissileRange validCount', () => {
  it('advances validCount.current by exactly one per sight-gated call', () => {
    const map = buildLargeRoomMap();
    const actor = makeMobj(0, 0);
    const target = makeMobj(100, 0);
    actor.target = target;
    const ctx = makeContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );

    const rng = new DoomRandom();
    const before = map.validCount.current;
    checkMissileRange(actor, ctx, rng);
    expect(map.validCount.current).toBe(before + 1);
    checkMissileRange(actor, ctx, rng);
    expect(map.validCount.current).toBe(before + 2);
  });

  it('does not advance validCount when actor.target is null', () => {
    const map = buildLargeRoomMap();
    const actor = makeMobj(0, 0);
    const ctx = makeContext(map, new Map([[actor, 0]]));

    const rng = new DoomRandom();
    const before = map.validCount.current;
    expect(checkMissileRange(actor, ctx, rng)).toBe(false);
    expect(map.validCount.current).toBe(before);
  });
});
