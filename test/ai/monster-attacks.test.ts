import { describe, expect, it } from 'bun:test';

import type { Fixed } from '../../src/core/fixed.ts';
import { FRACUNIT, fixedMul } from '../../src/core/fixed.ts';
import { DoomRandom, RNG_TABLE } from '../../src/core/rng.ts';
import { ANGLETOFINESHIFT, finecosine, finesine } from '../../src/core/trig.ts';

import { createValidCount } from '../../src/map/blockmapIter.ts';
import type { Blockmap } from '../../src/map/blockmap.ts';
import type { MapLinedef, MapSector, MapSidedef, MapVertex } from '../../src/map/lineSectorGeometry.ts';
import { ST_POSITIVE } from '../../src/map/lineSectorGeometry.ts';
import type { MapNode, MapSeg, MapSubsector } from '../../src/map/bspStructs.ts';
import type { MapData, SectorGroup } from '../../src/map/mapSetup.ts';
import type { RejectMap } from '../../src/map/reject.ts';

import { MF_AMBUSH, MF_SHADOW, MF_SHOOTABLE, MF_SKULLFLY, Mobj, MOBJINFO, MobjType, STATES, StateNum, mobjThinker } from '../../src/world/mobj.ts';
import { ThinkerList, REMOVED } from '../../src/world/thinkers.ts';

import type { TargetingContext } from '../../src/ai/targeting.ts';

import {
  CPOS_REFIRE_THRESHOLD,
  FATSPREAD,
  FIRE_OFFSET,
  MAX_SKULLS_PER_LEVEL,
  MELEERANGE,
  MISSILE_TIC_JITTER_MASK,
  MISSILERANGE,
  MONSTER_ATTACK_ACTION_COUNT,
  PAIN_SKULL_KILL_DAMAGE,
  PAIN_SKULL_PRESTEP_BASE,
  PAIN_SKULL_Z_OFFSET,
  SFX_BAREXP,
  SFX_CLAW,
  SFX_FLAME,
  SFX_FLAMST,
  SFX_MANATK,
  SFX_PISTOL,
  SFX_SHOTGN,
  SFX_SKEPCH,
  SFX_SKESWG,
  SFX_VILATK,
  SKEL_MISSILE_Z_OFFSET,
  SKULLSPEED,
  SMOKE_MOMZ,
  SPID_REFIRE_THRESHOLD,
  TRACEANGLE,
  TRACER_SLOPE_STEP,
  TRACER_SLOPE_Z_OFFSET,
  TRACER_TIC_MASK,
  VILE_ATTACK_DAMAGE,
  VILE_RADIUS_ATTACK_DAMAGE,
  VILE_VICTIM_MOMZ_NUMERATOR,
  aBruisAttack,
  aBspiAttack,
  aCPosAttack,
  aCPosRefire,
  aCyberAttack,
  aFaceTarget,
  aFatAttack1,
  aFatAttack2,
  aFatAttack3,
  aFatRaise,
  aFire,
  aFireCrackle,
  aHeadAttack,
  aPainAttack,
  aPosAttack,
  aSPosAttack,
  aSargAttack,
  aSkelFist,
  aSkelMissile,
  aSkelWhoosh,
  aSkullAttack,
  aSpidRefire,
  aStartFire,
  aTracer,
  aTroopAttack,
  aVileAttack,
  aVileStart,
  aVileTarget,
  getMonsterAttackContext,
  painShootSkull,
  setMonsterAttackContext,
  wireMonsterAttackActions,
} from '../../src/ai/attacks.ts';
import type { AimLineAttackResult, MonsterAttackContext } from '../../src/ai/attacks.ts';

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

function buildSingleRoomMap(): MapData {
  const vertexes: readonly MapVertex[] = Object.freeze([vertex(-1024, -1024), vertex(1024, -1024), vertex(1024, 1024), vertex(-1024, 1024)]);

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
    name: 'ATK-ROOM',
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

function makeMobj(x: number, y: number, type: MobjType = MobjType.TROOP): Mobj {
  const mobj = new Mobj();
  mobj.type = type;
  mobj.x = (x * F) | 0;
  mobj.y = (y * F) | 0;
  mobj.z = 0;
  mobj.angle = 0;
  mobj.flags = MF_SHOOTABLE;
  mobj.info = MOBJINFO[type] ?? null;
  if (mobj.info !== null) {
    mobj.radius = mobj.info.radius;
    mobj.height = mobj.info.height;
  } else {
    mobj.radius = 16 * F;
    mobj.height = 56 * F;
  }
  mobj.health = 100;
  return mobj;
}

interface MockRecord {
  spawnCalls: Array<{ x: Fixed; y: Fixed; z: Fixed; type: MobjType }>;
  spawned: Mobj[];
  tryMoveCalls: Array<{ mobj: Mobj; x: Fixed; y: Fixed }>;
  damageCalls: Array<{
    target: Mobj;
    inflictor: Mobj | null;
    source: Mobj | null;
    damage: number;
  }>;
  lineAttackCalls: Array<{
    shooter: Mobj;
    angle: number;
    range: Fixed;
    slope: Fixed;
    damage: number;
  }>;
  aimCalls: Array<{ shooter: Mobj; angle: number; range: Fixed }>;
  radiusCalls: Array<{ spot: Mobj; source: Mobj; damage: number }>;
  pointToAngleCalls: Array<{ x1: Fixed; y1: Fixed; x2: Fixed; y2: Fixed }>;
  soundCalls: Array<{ origin: Mobj | null; sfxId: number }>;
}

interface MockOptions {
  rng?: DoomRandom;
  thinkerList?: ThinkerList;
  gametic?: number;
  tryMoveResult?: boolean;
  aimSlope?: Fixed;
  aimTarget?: Mobj | null;
  pointToAngleResult?: number;
  sectorIndex?: Map<Mobj, number>;
}

function makeMockContext(mapData: MapData, sectorIndex: Map<Mobj, number>, opts: MockOptions = {}): { ctx: MonsterAttackContext; rec: MockRecord } {
  const rec: MockRecord = {
    spawnCalls: [],
    spawned: [],
    tryMoveCalls: [],
    damageCalls: [],
    lineAttackCalls: [],
    aimCalls: [],
    radiusCalls: [],
    pointToAngleCalls: [],
    soundCalls: [],
  };

  const targetingContext: TargetingContext = {
    mapData,
    getSectorIndex: (m: Mobj) => sectorIndex.get(m) ?? 0,
  };

  const ctx: MonsterAttackContext = {
    rng: opts.rng ?? new DoomRandom(),
    thinkerList: opts.thinkerList ?? new ThinkerList(),
    targetingContext,
    spawnMobj: (x, y, z, type) => {
      rec.spawnCalls.push({ x, y, z, type });
      const m = new Mobj();
      m.type = type;
      m.info = MOBJINFO[type] ?? null;
      m.x = x;
      m.y = y;
      m.z = z;
      m.angle = 0;
      m.radius = m.info?.radius ?? 0;
      m.height = m.info?.height ?? 0;
      m.flags = m.info?.flags ?? 0;
      m.health = m.info?.spawnhealth ?? 100;
      m.tics = 10;
      sectorIndex.set(m, 0);
      rec.spawned.push(m);
      return m;
    },
    tryMove: (mobj, x, y) => {
      rec.tryMoveCalls.push({ mobj, x, y });
      return opts.tryMoveResult ?? true;
    },
    damageMobj: (target, inflictor, source, damage) => {
      rec.damageCalls.push({ target, inflictor, source, damage });
    },
    lineAttack: (shooter, angle, range, slope, damage) => {
      rec.lineAttackCalls.push({ shooter, angle, range, slope, damage });
    },
    aimLineAttack: (shooter, angle, range): AimLineAttackResult => {
      rec.aimCalls.push({ shooter, angle, range });
      return {
        slope: opts.aimSlope ?? 0,
        target: opts.aimTarget ?? null,
      };
    },
    radiusAttack: (spot, source, damage) => {
      rec.radiusCalls.push({ spot, source, damage });
    },
    pointToAngle2: (x1, y1, x2, y2) => {
      rec.pointToAngleCalls.push({ x1, y1, x2, y2 });
      return opts.pointToAngleResult ?? 0;
    },
    startSound: (origin, sfxId) => {
      rec.soundCalls.push({ origin, sfxId });
    },
    gametic: () => opts.gametic ?? 0,
  };

  return { ctx, rec };
}

function install(ctx: MonsterAttackContext): void {
  setMonsterAttackContext(ctx);
}

// ── Constants ────────────────────────────────────────────────────────

describe('monster attack constants', () => {
  it('range constants match p_enemy.c/p_local.h', () => {
    expect(MISSILERANGE).toBe(2048 * F);
    expect(MELEERANGE).toBe(64 * F);
  });

  it('geometry constants match p_enemy.c', () => {
    expect(TRACEANGLE).toBe(0xc000000);
    expect(FATSPREAD).toBe(0x0800_0000);
    expect(FATSPREAD).toBe((0x4000_0000 / 8) | 0);
    expect(SKULLSPEED).toBe(20 * F);
    expect(SKEL_MISSILE_Z_OFFSET).toBe(16 * F);
    expect(FIRE_OFFSET).toBe(24 * F);
    expect(PAIN_SKULL_Z_OFFSET).toBe(8 * F);
    expect(PAIN_SKULL_PRESTEP_BASE).toBe(4 * F);
    expect(SMOKE_MOMZ).toBe(F);
    expect(TRACER_SLOPE_STEP).toBe((F / 8) | 0);
    expect(TRACER_SLOPE_Z_OFFSET).toBe(40 * F);
  });

  it('damage and threshold constants match p_enemy.c', () => {
    expect(VILE_ATTACK_DAMAGE).toBe(20);
    expect(VILE_RADIUS_ATTACK_DAMAGE).toBe(70);
    expect(VILE_VICTIM_MOMZ_NUMERATOR).toBe(1000 * F);
    expect(MAX_SKULLS_PER_LEVEL).toBe(20);
    expect(PAIN_SKULL_KILL_DAMAGE).toBe(10000);
    expect(MISSILE_TIC_JITTER_MASK).toBe(3);
    expect(CPOS_REFIRE_THRESHOLD).toBe(40);
    expect(SPID_REFIRE_THRESHOLD).toBe(10);
    expect(TRACER_TIC_MASK).toBe(3);
  });

  it('SFX constants match sounds.h indices', () => {
    expect(SFX_PISTOL).toBe(1);
    expect(SFX_SHOTGN).toBe(2);
    expect(SFX_SKEPCH).toBe(53);
    expect(SFX_VILATK).toBe(54);
    expect(SFX_CLAW).toBe(55);
    expect(SFX_SKESWG).toBe(56);
    expect(SFX_BAREXP).toBe(82);
    expect(SFX_FLAME).toBe(91);
    expect(SFX_FLAMST).toBe(92);
    expect(SFX_MANATK).toBe(99);
  });

  it('MONSTER_ATTACK_ACTION_COUNT is 105', () => {
    expect(MONSTER_ATTACK_ACTION_COUNT).toBe(105);
  });
});

// ── Context round-trip ─────────────────────────────────────────────

describe('monster attack context', () => {
  it('throws before context is installed', async () => {
    const freshModule = await import(`../../src/ai/attacks.ts?missing-context=${Date.now()}`);
    const actor = makeMobj(0, 0);
    actor.target = makeMobj(64, 0);
    expect(freshModule.getMonsterAttackContext()).toBeNull();
    expect(() => freshModule.aFaceTarget(actor)).toThrow('Monster attack context not set');
  });

  it('setMonsterAttackContext and getMonsterAttackContext round-trip', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0);
    const { ctx } = makeMockContext(map, new Map([[actor, 0]]));
    install(ctx);
    expect(getMonsterAttackContext()).toBe(ctx);
  });
});

// ── aFaceTarget ─────────────────────────────────────────────────────

describe('aFaceTarget', () => {
  it('is a no-op when actor.target is null (MF_AMBUSH preserved, no RNG, no pointToAngle2)', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0);
    actor.flags = MF_SHOOTABLE | MF_AMBUSH;
    const { ctx, rec } = makeMockContext(map, new Map([[actor, 0]]));
    install(ctx);

    const before = ctx.rng.prndindex;
    aFaceTarget(actor);
    expect(rec.pointToAngleCalls).toHaveLength(0);
    expect(actor.flags & MF_AMBUSH).not.toBe(0);
    expect(ctx.rng.prndindex).toBe(before);
  });

  it('clears MF_AMBUSH and sets angle without consuming RNG (no MF_SHADOW)', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0);
    actor.flags = MF_SHOOTABLE | MF_AMBUSH;
    const target = makeMobj(100, 50);
    actor.target = target;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
      { pointToAngleResult: 0xdead_0000 >>> 0 },
    );
    install(ctx);

    const before = ctx.rng.prndindex;
    aFaceTarget(actor);

    expect(actor.flags & MF_AMBUSH).toBe(0);
    expect(actor.angle).toBe(0xdead_0000);
    expect(rec.pointToAngleCalls).toHaveLength(1);
    expect(rec.pointToAngleCalls[0]).toEqual({
      x1: 0,
      y1: 0,
      x2: 100 * F,
      y2: 50 * F,
    });
    expect(ctx.rng.prndindex).toBe(before);
  });

  it('consumes two RNG (one pSubRandom) and jitters angle when target has MF_SHADOW', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0);
    const target = makeMobj(100, 0);
    target.flags |= MF_SHADOW;
    actor.target = target;
    const { ctx } = makeMockContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
      { pointToAngleResult: 0 },
    );
    install(ctx);

    const before = ctx.rng.prndindex;
    aFaceTarget(actor);
    expect(ctx.rng.prndindex).toBe(before + 2);
  });
});

// ── aPosAttack ──────────────────────────────────────────────────────

describe('aPosAttack', () => {
  it('is a no-op with null target', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.POSSESSED);
    const { ctx, rec } = makeMockContext(map, new Map([[actor, 0]]));
    install(ctx);

    aPosAttack(actor);
    expect(rec.soundCalls).toHaveLength(0);
    expect(rec.lineAttackCalls).toHaveLength(0);
  });

  it('plays sfx_pistol, aims, and fires one line attack with damage in 3..15', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.POSSESSED);
    const target = makeMobj(200, 0);
    actor.target = target;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
      { aimSlope: 42 as Fixed },
    );
    install(ctx);

    aPosAttack(actor);
    expect(rec.soundCalls).toEqual([{ origin: actor, sfxId: SFX_PISTOL }]);
    expect(rec.aimCalls).toHaveLength(1);
    expect(rec.aimCalls[0]?.range).toBe(MISSILERANGE);
    expect(rec.lineAttackCalls).toHaveLength(1);
    const damage = rec.lineAttackCalls[0]!.damage;
    expect(damage).toBeGreaterThanOrEqual(3);
    expect(damage).toBeLessThanOrEqual(15);
    expect(damage % 3).toBe(0);
    expect(rec.lineAttackCalls[0]!.slope).toBe(42);
    expect(rec.lineAttackCalls[0]!.range).toBe(MISSILERANGE);
  });

  it('consumes three pRandom entries (angle pSubRandom + damage)', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.POSSESSED);
    const target = makeMobj(200, 0);
    actor.target = target;
    const { ctx } = makeMockContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    const before = ctx.rng.prndindex;
    aPosAttack(actor);
    expect(ctx.rng.prndindex).toBe(before + 3);
  });
});

// ── aSPosAttack ─────────────────────────────────────────────────────

describe('aSPosAttack', () => {
  it('fires three pellets sharing one aim and consumes nine RNG entries', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.POSSESSED);
    const target = makeMobj(200, 0);
    actor.target = target;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
      { aimSlope: 7 as Fixed },
    );
    install(ctx);

    const before = ctx.rng.prndindex;
    aSPosAttack(actor);
    expect(ctx.rng.prndindex).toBe(before + 9);
    expect(rec.aimCalls).toHaveLength(1);
    expect(rec.lineAttackCalls).toHaveLength(3);
    for (const call of rec.lineAttackCalls) {
      expect(call.slope).toBe(7);
      expect(call.range).toBe(MISSILERANGE);
      expect(call.damage).toBeGreaterThanOrEqual(3);
      expect(call.damage).toBeLessThanOrEqual(15);
    }
    expect(rec.soundCalls).toEqual([{ origin: actor, sfxId: SFX_SHOTGN }]);
  });
});

// ── aCPosAttack ─────────────────────────────────────────────────────

describe('aCPosAttack', () => {
  it('fires one bullet with sfx_shotgn and consumes three RNG', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.CHAINGUY);
    const target = makeMobj(200, 0);
    actor.target = target;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    const before = ctx.rng.prndindex;
    aCPosAttack(actor);
    expect(ctx.rng.prndindex).toBe(before + 3);
    expect(rec.soundCalls).toEqual([{ origin: actor, sfxId: SFX_SHOTGN }]);
    expect(rec.lineAttackCalls).toHaveLength(1);
  });
});

// ── aCPosRefire ─────────────────────────────────────────────────────

describe('aCPosRefire', () => {
  it('stays when pRandom() < 40 (no state transition)', () => {
    // Fresh DoomRandom's first pRandom returns 8 (< 40).
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.CHAINGUY);
    const target = makeMobj(200, 0);
    actor.target = target;
    const { ctx } = makeMockContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    aCPosRefire(actor);
    expect(actor.action).not.toBe(REMOVED);
  });

  it('transitions to seestate (S_NULL via null info) when pRandom() >= 40 and target is null', () => {
    // Pre-consume 1 pRandom so next returns RNG_TABLE[2]=109 (>= 40).
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.CHAINGUY);
    actor.info = null; // seestate falls back to StateNum.NULL
    const rng = new DoomRandom();
    rng.pRandom(); // advance index to 1 → next returns RNG_TABLE[2]=109
    const list = new ThinkerList();
    list.add(actor);
    const { ctx } = makeMockContext(map, new Map([[actor, 0]]), { rng, thinkerList: list });
    install(ctx);

    aCPosRefire(actor);
    expect(actor.action).toBe(REMOVED);
  });

  it('keeps target when pRandom() >= 40 but sight holds and target alive', () => {
    // Pre-consume 1 pRandom so next returns 109.
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.CHAINGUY);
    const target = makeMobj(200, 0);
    actor.target = target;
    const rng = new DoomRandom();
    rng.pRandom();
    const list = new ThinkerList();
    list.add(actor);
    const { ctx } = makeMockContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
      { rng, thinkerList: list },
    );
    install(ctx);

    aCPosRefire(actor);
    expect(actor.action).not.toBe(REMOVED);
  });
});

// ── aSpidRefire ─────────────────────────────────────────────────────

describe('aSpidRefire', () => {
  it('stays when pRandom() < 10 (first pRandom=8 holds)', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.SPIDER);
    const target = makeMobj(400, 0);
    actor.target = target;
    const { ctx } = makeMockContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    aSpidRefire(actor);
    expect(actor.action).not.toBe(REMOVED);
  });

  it('transitions on pRandom() >= 10 when target lost', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.SPIDER);
    actor.info = null;
    const rng = new DoomRandom();
    rng.pRandom();
    const list = new ThinkerList();
    list.add(actor);
    const { ctx } = makeMockContext(map, new Map([[actor, 0]]), { rng, thinkerList: list });
    install(ctx);

    aSpidRefire(actor);
    expect(actor.action).toBe(REMOVED);
  });
});

// ── aBspiAttack ─────────────────────────────────────────────────────

describe('aBspiAttack', () => {
  it('spawns MT_ARACHPLAZ via spawnMissile', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.BABY);
    const target = makeMobj(200, 0);
    actor.target = target;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    aBspiAttack(actor);
    const plazSpawns = rec.spawnCalls.filter((c) => c.type === MobjType.ARACHPLAZ);
    expect(plazSpawns).toHaveLength(1);
  });

  it('is a no-op with null target', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.BABY);
    const { ctx, rec } = makeMockContext(map, new Map([[actor, 0]]));
    install(ctx);
    aBspiAttack(actor);
    expect(rec.spawnCalls).toHaveLength(0);
  });
});

// ── aTroopAttack ────────────────────────────────────────────────────

describe('aTroopAttack', () => {
  it('melee: in-range deals 3..24 claw damage with sfx_claw', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.TROOP);
    const target = makeMobj(50, 0);
    actor.target = target;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    aTroopAttack(actor);
    expect(rec.soundCalls.some((c) => c.sfxId === SFX_CLAW)).toBe(true);
    expect(rec.damageCalls).toHaveLength(1);
    const dmg = rec.damageCalls[0]!.damage;
    expect(dmg).toBeGreaterThanOrEqual(3);
    expect(dmg).toBeLessThanOrEqual(24);
    expect(dmg % 3).toBe(0);
    expect(rec.spawnCalls.filter((c) => c.type === MobjType.TROOPSHOT)).toHaveLength(0);
  });

  it('missile: out-of-range spawns MT_TROOPSHOT', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.TROOP);
    const target = makeMobj(500, 0);
    actor.target = target;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    aTroopAttack(actor);
    expect(rec.damageCalls).toHaveLength(0);
    expect(rec.spawnCalls.filter((c) => c.type === MobjType.TROOPSHOT)).toHaveLength(1);
  });
});

// ── aSargAttack ─────────────────────────────────────────────────────

describe('aSargAttack', () => {
  it('out of range: no damage, no RNG beyond aFaceTarget', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.SERGEANT);
    const target = makeMobj(500, 0);
    actor.target = target;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    const before = ctx.rng.prndindex;
    aSargAttack(actor);
    expect(rec.damageCalls).toHaveLength(0);
    expect(ctx.rng.prndindex).toBe(before);
  });

  it('in range: 4..40 damage (multiple of 4)', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.SERGEANT);
    const target = makeMobj(40, 0);
    actor.target = target;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    aSargAttack(actor);
    expect(rec.damageCalls).toHaveLength(1);
    const dmg = rec.damageCalls[0]!.damage;
    expect(dmg).toBeGreaterThanOrEqual(4);
    expect(dmg).toBeLessThanOrEqual(40);
    expect(dmg % 4).toBe(0);
  });
});

// ── aHeadAttack ─────────────────────────────────────────────────────

describe('aHeadAttack', () => {
  it('melee: 10..60 damage in range', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.HEAD);
    const target = makeMobj(40, 0);
    actor.target = target;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    aHeadAttack(actor);
    expect(rec.damageCalls).toHaveLength(1);
    const dmg = rec.damageCalls[0]!.damage;
    expect(dmg).toBeGreaterThanOrEqual(10);
    expect(dmg).toBeLessThanOrEqual(60);
    expect(dmg % 10).toBe(0);
  });

  it('missile: out-of-range spawns MT_HEADSHOT', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.HEAD);
    const target = makeMobj(500, 0);
    actor.target = target;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    aHeadAttack(actor);
    expect(rec.damageCalls).toHaveLength(0);
    expect(rec.spawnCalls.filter((c) => c.type === MobjType.HEADSHOT)).toHaveLength(1);
  });
});

// ── aCyberAttack ────────────────────────────────────────────────────

describe('aCyberAttack', () => {
  it('spawns MT_ROCKET', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.CYBORG);
    const target = makeMobj(500, 0);
    actor.target = target;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    aCyberAttack(actor);
    expect(rec.spawnCalls.filter((c) => c.type === MobjType.ROCKET)).toHaveLength(1);
  });
});

// ── aBruisAttack (parity: skips aFaceTarget) ────────────────────────

describe('aBruisAttack', () => {
  it('melee branch does NOT call aFaceTarget (pointToAngle2 not invoked)', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.BRUISER);
    const target = makeMobj(40, 0);
    actor.target = target;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    aBruisAttack(actor);
    expect(rec.pointToAngleCalls).toHaveLength(0);
    expect(rec.damageCalls).toHaveLength(1);
    const dmg = rec.damageCalls[0]!.damage;
    expect(dmg).toBeGreaterThanOrEqual(10);
    expect(dmg).toBeLessThanOrEqual(80);
    expect(dmg % 10).toBe(0);
    expect(rec.soundCalls.some((c) => c.sfxId === SFX_CLAW)).toBe(true);
  });

  it('missile branch spawns MT_BRUISERSHOT', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.BRUISER);
    const target = makeMobj(500, 0);
    actor.target = target;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    aBruisAttack(actor);
    expect(rec.damageCalls).toHaveLength(0);
    expect(rec.spawnCalls.filter((c) => c.type === MobjType.BRUISERSHOT)).toHaveLength(1);
  });
});

// ── aSkelMissile ────────────────────────────────────────────────────

describe('aSkelMissile', () => {
  it('spawns MT_TRACER, restores actor.z, sets tracer.tracer = actor.target', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.UNDEAD);
    const target = makeMobj(400, 0);
    actor.target = target;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    const zBefore = actor.z;
    aSkelMissile(actor);

    expect(actor.z).toBe(zBefore); // restored after the raise+spawn
    const tracerSpawns = rec.spawnCalls.filter((c) => c.type === MobjType.TRACER);
    expect(tracerSpawns).toHaveLength(1);
    expect(tracerSpawns[0]!.z).toBe(zBefore + SKEL_MISSILE_Z_OFFSET + 32 * F);
    const spawnedTracer = rec.spawned.find((m) => m.type === MobjType.TRACER);
    expect(spawnedTracer?.tracer).toBe(target);
  });
});

// ── aTracer ─────────────────────────────────────────────────────────

describe('aTracer', () => {
  it('skips entirely when (gametic & 3) !== 0', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.TRACER);
    const { ctx, rec } = makeMockContext(map, new Map([[actor, 0]]), { gametic: 1 });
    install(ctx);

    aTracer(actor);
    expect(rec.spawnCalls).toHaveLength(0);
  });

  it('runs on (gametic & 3) === 0, spawning PUFF and SMOKE; smoke.momz = SMOKE_MOMZ', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.TRACER);
    const { ctx, rec } = makeMockContext(map, new Map([[actor, 0]]), { gametic: 4 });
    install(ctx);

    aTracer(actor);
    const puffSpawns = rec.spawnCalls.filter((c) => c.type === MobjType.PUFF);
    const smokeSpawns = rec.spawnCalls.filter((c) => c.type === MobjType.SMOKE);
    expect(puffSpawns).toHaveLength(1);
    expect(smokeSpawns).toHaveLength(1);
    const smoke = rec.spawned.find((m) => m.type === MobjType.SMOKE);
    expect(smoke?.momz).toBe(SMOKE_MOMZ);
  });
});

// ── aSkelWhoosh ─────────────────────────────────────────────────────

describe('aSkelWhoosh', () => {
  it('plays sfx_skeswg when target is not null', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.UNDEAD);
    const target = makeMobj(40, 0);
    actor.target = target;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    aSkelWhoosh(actor);
    expect(rec.soundCalls.some((c) => c.sfxId === SFX_SKESWG)).toBe(true);
  });

  it('no-op with null target', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.UNDEAD);
    const { ctx, rec } = makeMockContext(map, new Map([[actor, 0]]));
    install(ctx);

    aSkelWhoosh(actor);
    expect(rec.soundCalls).toHaveLength(0);
  });
});

// ── aSkelFist ───────────────────────────────────────────────────────

describe('aSkelFist', () => {
  it('in-range: plays sfx_skepch and deals 6..60 damage', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.UNDEAD);
    const target = makeMobj(40, 0);
    actor.target = target;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    aSkelFist(actor);
    expect(rec.soundCalls.some((c) => c.sfxId === SFX_SKEPCH)).toBe(true);
    expect(rec.damageCalls).toHaveLength(1);
    const dmg = rec.damageCalls[0]!.damage;
    expect(dmg).toBeGreaterThanOrEqual(6);
    expect(dmg).toBeLessThanOrEqual(60);
    expect(dmg % 6).toBe(0);
  });

  it('out-of-range: silent, no damage, no sfx_skepch', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.UNDEAD);
    const target = makeMobj(500, 0);
    actor.target = target;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [actor, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    aSkelFist(actor);
    expect(rec.damageCalls).toHaveLength(0);
    expect(rec.soundCalls.some((c) => c.sfxId === SFX_SKEPCH)).toBe(false);
  });
});

// ── aVileStart ──────────────────────────────────────────────────────

describe('aVileStart', () => {
  it('plays sfx_vilatk', () => {
    const map = buildSingleRoomMap();
    const actor = makeMobj(0, 0, MobjType.VILE);
    const { ctx, rec } = makeMockContext(map, new Map([[actor, 0]]));
    install(ctx);

    aVileStart(actor);
    expect(rec.soundCalls).toEqual([{ origin: actor, sfxId: SFX_VILATK }]);
  });
});

// ── aFire ───────────────────────────────────────────────────────────

describe('aFire', () => {
  it('no-op with null tracer', () => {
    const map = buildSingleRoomMap();
    const fire = makeMobj(0, 0, MobjType.FIRE);
    const vile = makeMobj(10, 10, MobjType.VILE);
    fire.target = vile;
    const { ctx } = makeMockContext(
      map,
      new Map([
        [fire, 0],
        [vile, 0],
      ]),
    );
    install(ctx);

    const xBefore = fire.x;
    aFire(fire);
    expect(fire.x).toBe(xBefore);
  });

  it('no-op with null target', () => {
    const map = buildSingleRoomMap();
    const fire = makeMobj(0, 0, MobjType.FIRE);
    const victim = makeMobj(100, 0);
    fire.tracer = victim;
    const { ctx } = makeMockContext(
      map,
      new Map([
        [fire, 0],
        [victim, 0],
      ]),
    );
    install(ctx);

    const xBefore = fire.x;
    aFire(fire);
    expect(fire.x).toBe(xBefore);
  });

  it('positions self 24*F ahead of tracer when sight holds', () => {
    const map = buildSingleRoomMap();
    const fire = makeMobj(0, 0, MobjType.FIRE);
    const victim = makeMobj(100, 50);
    victim.angle = 0; // east → finecosine[0]=F, finesine[0]=0
    const vile = makeMobj(-100, 0, MobjType.VILE);
    fire.tracer = victim;
    fire.target = vile;
    const { ctx } = makeMockContext(
      map,
      new Map([
        [fire, 0],
        [victim, 0],
        [vile, 0],
      ]),
    );
    install(ctx);

    aFire(fire);
    const fi = (victim.angle >>> 0) >>> ANGLETOFINESHIFT;
    expect(fire.x).toBe((victim.x + fixedMul(FIRE_OFFSET, finecosine[fi]!)) | 0);
    expect(fire.y).toBe((victim.y + fixedMul(FIRE_OFFSET, finesine[fi]!)) | 0);
    expect(fire.z).toBe(victim.z);
  });
});

// ── aStartFire / aFireCrackle ───────────────────────────────────────

describe('aStartFire and aFireCrackle', () => {
  it('aStartFire plays sfx_flamst and delegates to aFire', () => {
    const map = buildSingleRoomMap();
    const fire = makeMobj(0, 0, MobjType.FIRE);
    const victim = makeMobj(100, 0);
    const vile = makeMobj(-100, 0, MobjType.VILE);
    fire.tracer = victim;
    fire.target = vile;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [fire, 0],
        [victim, 0],
        [vile, 0],
      ]),
    );
    install(ctx);

    aStartFire(fire);
    expect(rec.soundCalls).toEqual([{ origin: fire, sfxId: SFX_FLAMST }]);
    const fi = (victim.angle >>> 0) >>> ANGLETOFINESHIFT;
    expect(fire.x).toBe((victim.x + fixedMul(FIRE_OFFSET, finecosine[fi]!)) | 0);
  });

  it('aFireCrackle plays sfx_flame and delegates to aFire', () => {
    const map = buildSingleRoomMap();
    const fire = makeMobj(0, 0, MobjType.FIRE);
    const victim = makeMobj(100, 0);
    const vile = makeMobj(-100, 0, MobjType.VILE);
    fire.tracer = victim;
    fire.target = vile;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [fire, 0],
        [victim, 0],
        [vile, 0],
      ]),
    );
    install(ctx);

    aFireCrackle(fire);
    expect(rec.soundCalls).toEqual([{ origin: fire, sfxId: SFX_FLAME }]);
  });
});

// ── aVileTarget (parity: y = target.x typo) ─────────────────────────

describe('aVileTarget', () => {
  it('preserves vanilla typo: fog spawns with y = target.x (NOT target.y)', () => {
    const map = buildSingleRoomMap();
    const vile = makeMobj(0, 0, MobjType.VILE);
    const victim = makeMobj(100, 50);
    vile.target = victim;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [vile, 0],
        [victim, 0],
      ]),
    );
    install(ctx);

    aVileTarget(vile);
    const fireSpawns = rec.spawnCalls.filter((c) => c.type === MobjType.FIRE);
    expect(fireSpawns).toHaveLength(1);
    expect(fireSpawns[0]!.x).toBe(victim.x);
    expect(fireSpawns[0]!.y).toBe(victim.x); // the typo!
    expect(fireSpawns[0]!.y).not.toBe(victim.y);
    expect(fireSpawns[0]!.z).toBe(victim.z);
    expect(vile.tracer).toBe(rec.spawned.find((m) => m.type === MobjType.FIRE)!);
  });
});

// ── aVileAttack ─────────────────────────────────────────────────────

describe('aVileAttack', () => {
  it('applies 20 direct damage, mass-derived momz, radiusAttack(fire, actor, 70)', () => {
    const map = buildSingleRoomMap();
    const vile = makeMobj(0, 0, MobjType.VILE);
    const victim = makeMobj(100, 0, MobjType.POSSESSED); // mass=100
    const fire = makeMobj(50, 0, MobjType.FIRE);
    vile.target = victim;
    vile.tracer = fire;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [vile, 0],
        [victim, 0],
        [fire, 0],
      ]),
    );
    install(ctx);

    aVileAttack(vile);
    const directDmg = rec.damageCalls.find((c) => c.target === victim);
    expect(directDmg?.damage).toBe(VILE_ATTACK_DAMAGE);
    expect(victim.momz).toBe((VILE_VICTIM_MOMZ_NUMERATOR / 100) | 0);
    expect(victim.momz).toBe((10 * F) | 0);
    expect(rec.radiusCalls).toEqual([{ spot: fire, source: vile, damage: VILE_RADIUS_ATTACK_DAMAGE }]);
    expect(rec.soundCalls.some((c) => c.sfxId === SFX_BAREXP)).toBe(true);
  });
});

// ── aFatRaise ───────────────────────────────────────────────────────

describe('aFatRaise', () => {
  it('plays sfx_manatk', () => {
    const map = buildSingleRoomMap();
    const fatso = makeMobj(0, 0, MobjType.FATSO);
    const target = makeMobj(300, 0);
    fatso.target = target;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [fatso, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    aFatRaise(fatso);
    expect(rec.soundCalls.some((c) => c.sfxId === SFX_MANATK)).toBe(true);
  });
});

// ── aFatAttack1 / aFatAttack2 / aFatAttack3 ─────────────────────────

describe('aFatAttack1', () => {
  it('mutates actor.angle by +FATSPREAD and spawns two FATSHOT missiles', () => {
    const map = buildSingleRoomMap();
    const fatso = makeMobj(0, 0, MobjType.FATSO);
    const target = makeMobj(500, 0);
    fatso.target = target;
    fatso.angle = 0;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [fatso, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    aFatAttack1(fatso);
    expect(fatso.angle).toBe(FATSPREAD);
    const shots = rec.spawnCalls.filter((c) => c.type === MobjType.FATSHOT);
    expect(shots).toHaveLength(2);
  });
});

describe('aFatAttack2', () => {
  it('mutates actor.angle by -FATSPREAD and spawns two FATSHOT missiles', () => {
    const map = buildSingleRoomMap();
    const fatso = makeMobj(0, 0, MobjType.FATSO);
    const target = makeMobj(500, 0);
    fatso.target = target;
    fatso.angle = 0;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [fatso, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    aFatAttack2(fatso);
    expect(fatso.angle).toBe((0 - FATSPREAD) >>> 0);
    const shots = rec.spawnCalls.filter((c) => c.type === MobjType.FATSHOT);
    expect(shots).toHaveLength(2);
  });
});

describe('aFatAttack3', () => {
  it('leaves actor.angle unchanged and spawns two FATSHOT missiles', () => {
    const map = buildSingleRoomMap();
    const fatso = makeMobj(0, 0, MobjType.FATSO);
    const target = makeMobj(500, 0);
    fatso.target = target;
    fatso.angle = 0;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [fatso, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    aFatAttack3(fatso);
    expect(fatso.angle).toBe(0); // unchanged
    const shots = rec.spawnCalls.filter((c) => c.type === MobjType.FATSHOT);
    expect(shots).toHaveLength(2);
  });
});

// ── aSkullAttack ────────────────────────────────────────────────────

describe('aSkullAttack', () => {
  it('sets MF_SKULLFLY, plays attacksound, computes momentum at SKULLSPEED', () => {
    const map = buildSingleRoomMap();
    const skull = makeMobj(0, 0, MobjType.SKULL);
    const target = makeMobj(200, 0);
    skull.target = target;
    skull.angle = 0;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [skull, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    aSkullAttack(skull);
    expect(skull.flags & MF_SKULLFLY).not.toBe(0);
    // MT_SKULL attacksound = 51 (sfx_sklatk)
    expect(rec.soundCalls.some((c) => c.sfxId === 51)).toBe(true);
    // finecosine[0] = FRACUNIT → momx = SKULLSPEED; finesine[0] = 0 → momy = 0
    const fineIdx = (skull.angle >>> 0) >>> ANGLETOFINESHIFT;
    expect(skull.momx).toBe(fixedMul(SKULLSPEED, finecosine[fineIdx]!));
    expect(skull.momy).toBe(fixedMul(SKULLSPEED, finesine[fineIdx]!));
  });
});

// ── painShootSkull ──────────────────────────────────────────────────

describe('painShootSkull', () => {
  it('aborts when thinker list already holds more than 20 MT_SKULL mobjs', () => {
    const map = buildSingleRoomMap();
    const pain = makeMobj(0, 0, MobjType.PAIN);
    const list = new ThinkerList();
    for (let i = 0; i < 21; i++) {
      const skull = new Mobj();
      skull.type = MobjType.SKULL;
      skull.action = mobjThinker;
      list.add(skull);
    }
    const { ctx, rec } = makeMockContext(map, new Map([[pain, 0]]), { thinkerList: list });
    install(ctx);

    painShootSkull(pain, 0);
    expect(rec.spawnCalls.filter((c) => c.type === MobjType.SKULL)).toHaveLength(0);
  });

  it('spawns a skull when count is exactly 20 (> strict, so 20 passes)', () => {
    const map = buildSingleRoomMap();
    const pain = makeMobj(0, 0, MobjType.PAIN);
    const list = new ThinkerList();
    for (let i = 0; i < 20; i++) {
      const skull = new Mobj();
      skull.type = MobjType.SKULL;
      skull.action = mobjThinker;
      list.add(skull);
    }
    const target = makeMobj(200, 0);
    pain.target = target;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [pain, 0],
        [target, 0],
      ]),
      { thinkerList: list },
    );
    install(ctx);

    painShootSkull(pain, 0);
    expect(rec.spawnCalls.filter((c) => c.type === MobjType.SKULL)).toHaveLength(1);
  });

  it('prestep offset and z: actor at (0,0) angle 0 spawns skull at (prestep, 0, PAIN_SKULL_Z_OFFSET)', () => {
    const map = buildSingleRoomMap();
    const pain = makeMobj(0, 0, MobjType.PAIN);
    const target = makeMobj(200, 0);
    pain.target = target;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [pain, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    painShootSkull(pain, 0);
    const spawn = rec.spawnCalls.find((c) => c.type === MobjType.SKULL);
    expect(spawn).toBeDefined();
    const skullRadius = 16 * F;
    const prestep = (PAIN_SKULL_PRESTEP_BASE + (((3 * (pain.info!.radius + skullRadius)) | 0) >> 1)) | 0;
    const fi = (0 >>> 0) >>> ANGLETOFINESHIFT;
    expect(spawn!.x).toBe((pain.x + fixedMul(prestep, finecosine[fi]!)) | 0);
    expect(spawn!.y).toBe((pain.y + fixedMul(prestep, finesine[fi]!)) | 0);
    expect(spawn!.z).toBe(pain.z + PAIN_SKULL_Z_OFFSET);
  });

  it('tryMove fail → skull takes PAIN_SKULL_KILL_DAMAGE (10000)', () => {
    const map = buildSingleRoomMap();
    const pain = makeMobj(0, 0, MobjType.PAIN);
    const target = makeMobj(200, 0);
    pain.target = target;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [pain, 0],
        [target, 0],
      ]),
      { tryMoveResult: false },
    );
    install(ctx);

    painShootSkull(pain, 0);
    expect(rec.damageCalls).toHaveLength(1);
    expect(rec.damageCalls[0]!.damage).toBe(PAIN_SKULL_KILL_DAMAGE);
  });

  it("success: new skull's target is set to actor.target (for A_SkullAttack chaining)", () => {
    const map = buildSingleRoomMap();
    const pain = makeMobj(0, 0, MobjType.PAIN);
    const target = makeMobj(200, 0);
    pain.target = target;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [pain, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    painShootSkull(pain, 0);
    const spawnedSkull = rec.spawned.find((m) => m.type === MobjType.SKULL);
    expect(spawnedSkull?.target).toBe(target);
  });
});

// ── aPainAttack ─────────────────────────────────────────────────────

describe('aPainAttack', () => {
  it('no-op with null target', () => {
    const map = buildSingleRoomMap();
    const pain = makeMobj(0, 0, MobjType.PAIN);
    const { ctx, rec } = makeMockContext(map, new Map([[pain, 0]]));
    install(ctx);

    aPainAttack(pain);
    expect(rec.spawnCalls).toHaveLength(0);
  });

  it('faces target and spits a skull', () => {
    const map = buildSingleRoomMap();
    const pain = makeMobj(0, 0, MobjType.PAIN);
    const target = makeMobj(200, 0);
    pain.target = target;
    const { ctx, rec } = makeMockContext(
      map,
      new Map([
        [pain, 0],
        [target, 0],
      ]),
    );
    install(ctx);

    aPainAttack(pain);
    expect(rec.pointToAngleCalls.length).toBeGreaterThanOrEqual(1);
    expect(rec.spawnCalls.filter((c) => c.type === MobjType.SKULL)).toHaveLength(1);
  });
});

// ── wireMonsterAttackActions ────────────────────────────────────────

describe('wireMonsterAttackActions', () => {
  it('installs action pointers for representative attack states', () => {
    wireMonsterAttackActions();

    expect(STATES[StateNum.POSS_ATK1]!.action).toBe(aFaceTarget);
    expect(STATES[StateNum.POSS_ATK2]!.action).toBe(aPosAttack);
    expect(STATES[StateNum.SPOS_ATK2]!.action).toBe(aSPosAttack);
    expect(STATES[StateNum.CPOS_ATK2]!.action).toBe(aCPosAttack);
    expect(STATES[StateNum.CPOS_ATK4]!.action).toBe(aCPosRefire);
    expect(STATES[StateNum.TROO_ATK3]!.action).toBe(aTroopAttack);
    expect(STATES[StateNum.SARG_ATK3]!.action).toBe(aSargAttack);
    expect(STATES[StateNum.HEAD_ATK3]!.action).toBe(aHeadAttack);
    expect(STATES[StateNum.VILE_ATK1]!.action).toBe(aVileStart);
    expect(STATES[StateNum.VILE_ATK3]!.action).toBe(aVileTarget);
    expect(STATES[StateNum.VILE_ATK10]!.action).toBe(aVileAttack);
    expect(STATES[StateNum.FIRE1]!.action).toBe(aStartFire);
    expect(STATES[StateNum.FIRE5]!.action).toBe(aFireCrackle);
    expect(STATES[StateNum.FIRE19]!.action).toBe(aFireCrackle);
    expect(STATES[StateNum.FIRE30]!.action).toBe(aFire);
    expect(STATES[StateNum.TRACER]!.action).toBe(aTracer);
    expect(STATES[StateNum.TRACER2]!.action).toBe(aTracer);
    expect(STATES[StateNum.SKEL_FIST2]!.action).toBe(aSkelWhoosh);
    expect(STATES[StateNum.SKEL_FIST4]!.action).toBe(aSkelFist);
    expect(STATES[StateNum.SKEL_MISS3]!.action).toBe(aSkelMissile);
    expect(STATES[StateNum.FATT_ATK1]!.action).toBe(aFatRaise);
    expect(STATES[StateNum.FATT_ATK2]!.action).toBe(aFatAttack1);
    expect(STATES[StateNum.FATT_ATK5]!.action).toBe(aFatAttack2);
    expect(STATES[StateNum.FATT_ATK8]!.action).toBe(aFatAttack3);
    expect(STATES[StateNum.BOSS_ATK3]!.action).toBe(aBruisAttack);
    expect(STATES[StateNum.SKULL_ATK2]!.action).toBe(aSkullAttack);
    expect(STATES[StateNum.SPID_ATK2]!.action).toBe(aSPosAttack);
    expect(STATES[StateNum.SPID_ATK4]!.action).toBe(aSpidRefire);
    expect(STATES[StateNum.BSPI_ATK2]!.action).toBe(aBspiAttack);
    expect(STATES[StateNum.CYBER_ATK2]!.action).toBe(aCyberAttack);
    expect(STATES[StateNum.PAIN_ATK3]!.action).toBe(aPainAttack);
  });

  it('is idempotent', () => {
    wireMonsterAttackActions();
    wireMonsterAttackActions();
    expect(STATES[StateNum.POSS_ATK2]!.action).toBe(aPosAttack);
  });
});

// ── RNG_TABLE sanity check used by refire tests ─────────────────────

describe('RNG_TABLE sanity', () => {
  it('first pRandom returns 8, second returns 109', () => {
    // Confirms the refire-threshold tests above: fresh pRandom=8 < 40 AND
    // < 10; after one pre-consume, next pRandom=109 >= 40 AND >= 10.
    expect(RNG_TABLE[1]).toBe(8);
    expect(RNG_TABLE[2]).toBe(109);
  });
});
