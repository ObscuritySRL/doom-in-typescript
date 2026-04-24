import { describe, expect, it } from 'bun:test';

import type { Fixed } from '../../src/core/fixed.ts';
import { FRACUNIT } from '../../src/core/fixed.ts';
import { DoomRandom } from '../../src/core/rng.ts';
import type { Angle } from '../../src/core/angle.ts';

import { createValidCount } from '../../src/map/blockmapIter.ts';
import type { Blockmap } from '../../src/map/blockmap.ts';
import type { MapLinedef, MapSector, MapSidedef, MapVertex } from '../../src/map/lineSectorGeometry.ts';
import { ML_TWOSIDED, ST_POSITIVE } from '../../src/map/lineSectorGeometry.ts';
import type { MapNode, MapSeg, MapSubsector } from '../../src/map/bspStructs.ts';
import type { LineSectors, MapData, SectorGroup } from '../../src/map/mapSetup.ts';
import type { RejectMap } from '../../src/map/reject.ts';

import { MF_FLOAT, MF_INFLOAT, MF_JUSTATTACKED, MF_SHOOTABLE, Mobj, MobjType, STATES } from '../../src/world/mobj.ts';
import type { MobjInfo } from '../../src/world/mobj.ts';
import { createBlockThingsGrid } from '../../src/world/checkPosition.ts';
import type { BlockThingsGrid } from '../../src/world/checkPosition.ts';
import { ThinkerList } from '../../src/world/thinkers.ts';

import type { PlayerLike, TargetingContext } from '../../src/ai/targeting.ts';
import { chase, DirType, DIAGS, FLOATSPEED, move, newChaseDir, NUMDIRS, OPPOSITE, tryWalk, X_SPEED, Y_SPEED } from '../../src/ai/chase.ts';
import type { ChaseContext } from '../../src/ai/chase.ts';

// ── Helpers ──────────────────────────────────────────────────────────

const F = FRACUNIT;
const ANG45: Angle = 0x2000_0000;
const ANG90: Angle = 0x4000_0000;

function emptyBlockmap(columns: number, rows: number): Blockmap {
  const cellCount = columns * rows;
  const offsets: number[] = [];
  for (let i = 0; i < cellCount; i++) offsets.push(i);

  const lumpData = Buffer.alloc(cellCount * 2);
  for (let i = 0; i < cellCount; i++) {
    lumpData.writeInt16LE(-1, i * 2);
  }
  return {
    originX: (-512 * F) | 0,
    originY: (-512 * F) | 0,
    columns,
    rows,
    offsets: Object.freeze(offsets),
    lumpData,
  };
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

/** Build a one-sector 1024×1024 room with no internal walls. */
function buildOpenRoom(floor = 0, ceiling = 512): MapData {
  const vertexes: readonly MapVertex[] = Object.freeze([
    Object.freeze({ x: (-512 * F) | 0, y: (-512 * F) | 0 }),
    Object.freeze({ x: (512 * F) | 0, y: (-512 * F) | 0 }),
    Object.freeze({ x: (512 * F) | 0, y: (512 * F) | 0 }),
    Object.freeze({ x: (-512 * F) | 0, y: (512 * F) | 0 }),
  ]);

  const sectors: readonly MapSector[] = Object.freeze([
    Object.freeze({
      floorheight: (floor * F) | 0,
      ceilingheight: (ceiling * F) | 0,
      floorpic: 'FLAT',
      ceilingpic: 'FLAT',
      lightlevel: 160,
      special: 0,
      tag: 0,
    }),
  ]);

  const sidedefs: readonly MapSidedef[] = Object.freeze([
    Object.freeze({
      textureoffset: 0 as Fixed,
      rowoffset: 0 as Fixed,
      toptexture: '-',
      bottomtexture: '-',
      midtexture: '-',
      sector: 0,
    }),
  ]);

  const makeLine = (v1: number, v2: number): MapLinedef => {
    const a = vertexes[v1]!;
    const b = vertexes[v2]!;
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
  };

  const linedefs: readonly MapLinedef[] = Object.freeze([makeLine(0, 1), makeLine(1, 2), makeLine(2, 3), makeLine(3, 0)]);

  const lineSectors: readonly LineSectors[] = Object.freeze(linedefs.map(() => Object.freeze({ frontsector: 0, backsector: -1 })));

  const segs: readonly MapSeg[] = Object.freeze(
    linedefs.map((_, i) =>
      Object.freeze({
        v1: linedefs[i]!.v1,
        v2: linedefs[i]!.v2,
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
    name: 'OPEN-ROOM',
    vertexes,
    sectors,
    sidedefs,
    linedefs,
    segs,
    subsectors,
    nodes,
    things: Object.freeze([]),
    blockmap: emptyBlockmap(16, 16),
    reject,
    subsectorSectors: Object.freeze([0]),
    lineSectors,
    sectorGroups: emptySectorGroups(sectorCount),
    validCount: createValidCount(linedefs.length),
  } as MapData;
}

interface MobjSpec {
  x?: number;
  y?: number;
  z?: number;
  floorz?: number;
  ceilingz?: number;
  angle?: Angle;
  movedir?: DirType;
  movecount?: number;
  flags?: number;
  health?: number;
  info?: MobjInfo | null;
  type?: MobjType;
  target?: Mobj | null;
  reactiontime?: number;
  threshold?: number;
}

function makeMobj(spec: MobjSpec = {}): Mobj {
  const m = new Mobj();
  m.x = ((spec.x ?? 0) * F) | 0;
  m.y = ((spec.y ?? 0) * F) | 0;
  m.z = ((spec.z ?? 0) * F) | 0;
  m.floorz = ((spec.floorz ?? 0) * F) | 0;
  m.ceilingz = ((spec.ceilingz ?? 512) * F) | 0;
  m.angle = spec.angle ?? 0;
  m.movedir = spec.movedir ?? DirType.EAST;
  m.movecount = spec.movecount ?? 0;
  m.radius = (20 * F) | 0;
  m.height = (56 * F) | 0;
  m.flags = spec.flags ?? MF_SHOOTABLE;
  m.health = spec.health ?? 100;
  m.type = spec.type ?? MobjType.TROOP;
  m.info = spec.info ?? null;
  m.target = spec.target ?? null;
  m.reactiontime = spec.reactiontime ?? 0;
  m.threshold = spec.threshold ?? 0;
  return m;
}

/** Clone-with-overrides: build a non-frozen MobjInfo from a base entry. */
function makeInfo(overrides: Partial<MobjInfo>): MobjInfo {
  const base: MobjInfo = {
    doomednum: 3001,
    spawnstate: 1,
    spawnhealth: 60,
    seestate: 0,
    seesound: 0,
    reactiontime: 8,
    attacksound: 0,
    painstate: 0,
    painchance: 0,
    painsound: 0,
    meleestate: 0,
    missilestate: 0,
    deathstate: 0,
    xdeathstate: 0,
    deathsound: 0,
    speed: 8,
    radius: (20 * F) | 0,
    height: (56 * F) | 0,
    mass: 100,
    damage: 0,
    activesound: 0,
    flags: 0,
    raisestate: 0,
  };
  return { ...base, ...overrides };
}

interface ContextSpec {
  mapData?: MapData;
  blocklinks?: BlockThingsGrid;
  rng?: DoomRandom;
  players?: readonly PlayerLike[];
  playeringame?: readonly boolean[];
  gameskill?: number;
  fastparm?: boolean;
  netgame?: boolean;
  thinkerList?: ThinkerList;
  targetingContext?: TargetingContext;
  useSpecialLine?: (actor: Mobj, linedefIndex: number, side: number) => boolean;
  startSound?: (origin: Mobj | null, sfxId: number) => void;
}

function makeChaseContext(spec: ContextSpec = {}): ChaseContext {
  const mapData = spec.mapData ?? buildOpenRoom();
  const blocklinks = spec.blocklinks ?? createBlockThingsGrid(mapData.blockmap.columns, mapData.blockmap.rows);
  const rng = spec.rng ?? new DoomRandom();
  const players = spec.players ?? ([] as PlayerLike[]);
  const playeringame = spec.playeringame ?? ([false, false, false, false] as const);
  const gameskill = spec.gameskill ?? 2;
  const fastparm = spec.fastparm ?? false;
  const netgame = spec.netgame ?? false;
  const thinkerList = spec.thinkerList ?? new ThinkerList();
  const targetingContext: TargetingContext = spec.targetingContext ?? {
    mapData,
    getSectorIndex: () => 0,
  };
  return {
    rng,
    mapData,
    blocklinks,
    thinkerList,
    targetingContext,
    players,
    playeringame,
    gameskill,
    fastparm,
    netgame,
    ...(spec.useSpecialLine !== undefined ? { useSpecialLine: spec.useSpecialLine } : {}),
    ...(spec.startSound !== undefined ? { startSound: spec.startSound } : {}),
  };
}

// ── Direction tables ─────────────────────────────────────────────────

describe('DirType and direction tables', () => {
  it('exposes nine direction slots (EAST..SOUTHEAST + NODIR)', () => {
    expect(NUMDIRS).toBe(9);
    expect(DirType.EAST).toBe(0);
    expect(DirType.NORTH).toBe(2);
    expect(DirType.WEST).toBe(4);
    expect(DirType.SOUTH).toBe(6);
    expect(DirType.NODIR).toBe(8);
  });

  it('OPPOSITE is a self-inverse involution on 0..7 and fixes NODIR', () => {
    expect(OPPOSITE.length).toBe(NUMDIRS);
    for (let i = 0; i < 8; i++) {
      expect(OPPOSITE[OPPOSITE[i]!]).toBe(i);
    }
    expect(OPPOSITE[DirType.NODIR]).toBe(DirType.NODIR);
    expect(OPPOSITE[DirType.EAST]).toBe(DirType.WEST);
    expect(OPPOSITE[DirType.NORTH]).toBe(DirType.SOUTH);
  });

  it('DIAGS indexed by (dy<0, dx>0) selects the four diagonals', () => {
    // Layout: idx = (deltay<0 ? 2 : 0) + (deltax>0 ? 1 : 0)
    expect(DIAGS[0]).toBe(DirType.NORTHWEST); // dy>=0, dx<=0
    expect(DIAGS[1]).toBe(DirType.NORTHEAST); // dy>=0, dx>0
    expect(DIAGS[2]).toBe(DirType.SOUTHWEST); // dy<0, dx<=0
    expect(DIAGS[3]).toBe(DirType.SOUTHEAST); // dy<0, dx>0
  });

  it('X_SPEED / Y_SPEED preserve the vanilla 47000 diagonal quirk', () => {
    expect(X_SPEED[DirType.EAST]).toBe(FRACUNIT);
    expect(X_SPEED[DirType.WEST]).toBe(-FRACUNIT);
    expect(X_SPEED[DirType.NORTHEAST]).toBe(47000);
    expect(X_SPEED[DirType.SOUTHEAST]).toBe(47000);
    expect(X_SPEED[DirType.NORTHWEST]).toBe(-47000);
    expect(X_SPEED[DirType.SOUTHWEST]).toBe(-47000);

    expect(Y_SPEED[DirType.NORTH]).toBe(FRACUNIT);
    expect(Y_SPEED[DirType.SOUTH]).toBe(-FRACUNIT);
    expect(Y_SPEED[DirType.NORTHEAST]).toBe(47000);
    expect(Y_SPEED[DirType.NORTHWEST]).toBe(47000);
    expect(Y_SPEED[DirType.SOUTHEAST]).toBe(-47000);
    expect(Y_SPEED[DirType.SOUTHWEST]).toBe(-47000);

    // Cardinal axes carry zero on the other axis.
    expect(Y_SPEED[DirType.EAST]).toBe(0);
    expect(Y_SPEED[DirType.WEST]).toBe(0);
    expect(X_SPEED[DirType.NORTH]).toBe(0);
    expect(X_SPEED[DirType.SOUTH]).toBe(0);

    // The 47000 value is NOT cos(45°)·FRACUNIT=46340. Locking it here so a
    // well-meaning future "precision fix" cannot change the constant
    // silently.
    expect(X_SPEED[DirType.NORTHEAST]).not.toBe(46340);
  });

  it('FLOATSPEED equals 4·FRACUNIT', () => {
    expect(FLOATSPEED).toBe((4 * FRACUNIT) | 0);
  });
});

// ── P_Move ───────────────────────────────────────────────────────────

describe('move', () => {
  it('returns false when movedir is NODIR without reading info', () => {
    const actor = makeMobj({ movedir: DirType.NODIR, info: null });
    const ctx = makeChaseContext();
    expect(move(actor, ctx)).toBe(false);
  });

  it('returns false when info is null', () => {
    const actor = makeMobj({ movedir: DirType.EAST, info: null });
    const ctx = makeChaseContext();
    expect(move(actor, ctx)).toBe(false);
  });

  it('throws when movedir is out of range (0..7 + NODIR)', () => {
    const actor = makeMobj({
      movedir: 9 as DirType,
      info: makeInfo({ speed: 8 }),
    });
    const ctx = makeChaseContext();
    expect(() => move(actor, ctx)).toThrow(/Weird actor/);
  });

  it('advances the actor one info.speed·X_SPEED step eastward', () => {
    const actor = makeMobj({
      x: 0,
      y: 0,
      floorz: 0,
      movedir: DirType.EAST,
      info: makeInfo({ speed: 8 }),
    });
    const ctx = makeChaseContext();
    const moved = move(actor, ctx);
    expect(moved).toBe(true);
    // speed=8 · X_SPEED[EAST]=FRACUNIT → +8 map units along X.
    expect(actor.x).toBe((8 * F) | 0);
    expect(actor.y).toBe(0);
  });

  it('advances on the diagonal using the 47000 constant verbatim', () => {
    const actor = makeMobj({
      x: 0,
      y: 0,
      floorz: 0,
      movedir: DirType.NORTHEAST,
      info: makeInfo({ speed: 8 }),
    });
    const ctx = makeChaseContext();
    move(actor, ctx);
    // speed=8 · 47000 = 376000 (via Math.imul for int32 semantics).
    expect(actor.x).toBe(Math.imul(8, 47000));
    expect(actor.y).toBe(Math.imul(8, 47000));
  });

  it('clamps non-floating actors to floorz on a successful move', () => {
    const actor = makeMobj({
      x: 0,
      y: 0,
      z: 50,
      floorz: 16,
      movedir: DirType.EAST,
      info: makeInfo({ speed: 8 }),
    });
    // Sector floor at 16 so tryMove sets floorz=16; actor.z should snap down.
    const mapData = buildOpenRoom(16, 512);
    const ctx = makeChaseContext({ mapData });
    expect(move(actor, ctx)).toBe(true);
    expect(actor.z).toBe(actor.floorz);
  });

  it('clears MF_INFLOAT after a successful non-float move', () => {
    const actor = makeMobj({
      movedir: DirType.EAST,
      flags: MF_SHOOTABLE | MF_INFLOAT,
      info: makeInfo({ speed: 8 }),
    });
    const ctx = makeChaseContext();
    move(actor, ctx);
    expect(actor.flags & MF_INFLOAT).toBe(0);
  });

  it('leaves floating actor z untouched when the move succeeds', () => {
    const actor = makeMobj({
      x: 0,
      y: 0,
      z: 100,
      floorz: 0,
      movedir: DirType.EAST,
      flags: MF_SHOOTABLE | MF_FLOAT,
      info: makeInfo({ speed: 8, flags: MF_FLOAT }),
    });
    const ctx = makeChaseContext();
    expect(move(actor, ctx)).toBe(true);
    // Non-float actors snap to floorz. Float actors keep their z.
    expect(actor.z).toBe((100 * F) | 0);
  });
});

// ── P_TryWalk ────────────────────────────────────────────────────────

describe('tryWalk', () => {
  it('reseeds movecount from P_Random() & 15 on success', () => {
    const actor = makeMobj({
      movedir: DirType.EAST,
      movecount: 99,
      info: makeInfo({ speed: 8 }),
    });
    const rng = new DoomRandom();
    const ctx = makeChaseContext({ rng });
    const expected = new DoomRandom().pRandom() & 15;
    expect(tryWalk(actor, ctx)).toBe(true);
    expect(actor.movecount).toBe(expected);
  });

  it('does not touch movecount or RNG when the move fails', () => {
    const actor = makeMobj({
      movedir: DirType.NODIR,
      movecount: 42,
      info: makeInfo({ speed: 8 }),
    });
    const rng = new DoomRandom();
    const ctx = makeChaseContext({ rng });
    expect(tryWalk(actor, ctx)).toBe(false);
    expect(actor.movecount).toBe(42);
    // rng.pRandom() must NOT have been consumed — first call still returns 8.
    expect(rng.pRandom()).toBe(8);
  });
});

// ── P_NewChaseDir ────────────────────────────────────────────────────

describe('newChaseDir', () => {
  it('throws when called with a null target', () => {
    const actor = makeMobj({ target: null, info: makeInfo({ speed: 8 }) });
    const ctx = makeChaseContext();
    expect(() => newChaseDir(actor, ctx)).toThrow(/no target/);
  });

  it('picks the direct diagonal when both axes are outside the deadzone', () => {
    // Target is to the NE far enough that both |dx| and |dy| exceed 10*F.
    const target = makeMobj({ x: 200, y: 200, info: null });
    const actor = makeMobj({
      x: 0,
      y: 0,
      movedir: DirType.NODIR,
      target,
      info: makeInfo({ speed: 8 }),
    });
    const ctx = makeChaseContext();
    newChaseDir(actor, ctx);
    // The first candidate is the direct NE diagonal (deltax>0, deltay>0).
    expect(actor.movedir).toBe(DirType.NORTHEAST);
  });

  it('falls through to the cardinal candidate when diagonal equals turnaround', () => {
    // olddir=SW ⇒ turnaround=NE. Target is NE so the diagonal pick is
    // DirType.NORTHEAST — but that IS the turnaround, so vanilla skips it
    // and falls to the cardinal candidates.
    const target = makeMobj({ x: 200, y: 200, info: null });
    const actor = makeMobj({
      x: 0,
      y: 0,
      movedir: DirType.SOUTHWEST,
      target,
      info: makeInfo({ speed: 8 }),
    });
    const ctx = makeChaseContext();
    newChaseDir(actor, ctx);
    // One of the two cardinals (NORTH or EAST) must have been chosen; the
    // diagonal (NORTHEAST) is disqualified as turnaround.
    expect(actor.movedir).not.toBe(DirType.NORTHEAST);
    expect([DirType.NORTH, DirType.EAST]).toContain(actor.movedir);
  });

  it('sets NODIR when every candidate fails (target sits on top of actor)', () => {
    // With deltax=deltay=0, BOTH cardinal candidates are NODIR; olddir is
    // NODIR so the fourth branch is skipped; the full 0..7 scan tries to
    // walk in a direction, but we block every walk by forcing speed=0 so
    // X_SPEED·speed = 0 (the move still "succeeds" in tryMove because no
    // actual position change happens). To truly force the NODIR tail we
    // need all tryWalk calls to return false — use movedir=NODIR via
    // actor.info=null BEFORE any candidate survives.
    //
    // Simpler: place the target at the actor's position AND null the info
    // so every tryWalk → move() → info===null → false.
    const target = makeMobj({ x: 0, y: 0, info: null });
    const actor = makeMobj({
      x: 0,
      y: 0,
      movedir: DirType.NODIR,
      target,
      info: null,
    });
    const ctx = makeChaseContext();
    newChaseDir(actor, ctx);
    expect(actor.movedir).toBe(DirType.NODIR);
  });
});

// ── A_Chase ──────────────────────────────────────────────────────────

describe('chase', () => {
  it('decrements reactiontime and stops at zero', () => {
    const target = makeMobj({ x: 100, y: 0, info: null });
    const actor = makeMobj({
      reactiontime: 2,
      target,
      info: makeInfo({ speed: 8 }),
    });
    const ctx = makeChaseContext();
    chase(actor, ctx);
    expect(actor.reactiontime).toBe(1);
    chase(actor, ctx);
    expect(actor.reactiontime).toBe(0);
    chase(actor, ctx);
    // Clamped at zero; does not wrap negative.
    expect(actor.reactiontime).toBe(0);
  });

  it('clears threshold when the target is dead', () => {
    const target = makeMobj({ x: 100, y: 0, info: null, health: 0 });
    const actor = makeMobj({
      threshold: 50,
      target,
      info: makeInfo({ speed: 8 }),
    });
    const ctx = makeChaseContext();
    chase(actor, ctx);
    expect(actor.threshold).toBe(0);
  });

  it('decrements threshold toward zero when target is alive', () => {
    const target = makeMobj({ x: 100, y: 0, info: null, health: 100 });
    const actor = makeMobj({
      threshold: 3,
      target,
      info: makeInfo({ speed: 8 }),
    });
    const ctx = makeChaseContext();
    chase(actor, ctx);
    expect(actor.threshold).toBe(2);
  });

  it('turns angle by ANG45 toward movedir using the short-arc delta', () => {
    // movedir=NORTH → target snapped angle = 2·ANG45 = ANG90.
    // Starting from ANG45, snapped=ANG45, delta=ANG45-ANG90<0, so + ANG45.
    const target = makeMobj({ x: 0, y: 100, info: null });
    const actor = makeMobj({
      angle: ANG45,
      movedir: DirType.NORTH,
      target,
      info: makeInfo({ speed: 8 }),
    });
    const ctx = makeChaseContext();
    chase(actor, ctx);
    expect(actor.angle).toBe(ANG90);
  });

  it('turns the other way when delta is positive (angle > movedir·ANG45)', () => {
    // movedir=EAST (0) → target snapped = 0. Starting from ANG45 → delta>0,
    // so angle -= ANG45 → 0.
    const target = makeMobj({ x: 100, y: 0, info: null });
    const actor = makeMobj({
      angle: ANG45,
      movedir: DirType.EAST,
      target,
      info: makeInfo({ speed: 8 }),
    });
    const ctx = makeChaseContext();
    chase(actor, ctx);
    expect(actor.angle).toBe(0);
  });

  it('snaps angle to its top-3-bit quantum before the signed-delta check', () => {
    // Starting angle ANG90 + 1 — snap masks off the low 29 bits.
    const target = makeMobj({ x: 0, y: 100, info: null });
    const actor = makeMobj({
      angle: (ANG90 + 1) as Angle,
      movedir: DirType.NORTH,
      target,
      info: makeInfo({ speed: 8 }),
    });
    const ctx = makeChaseContext();
    chase(actor, ctx);
    // Snapped to ANG90, movedir·ANG45 = ANG90, delta=0 → no step.
    expect(actor.angle).toBe(ANG90);
  });

  it('drops back to spawnstate when target is dead and no players are visible', () => {
    // Dead target must have MF_SHOOTABLE cleared (death clears it), so the
    // "no shootable target" branch fires instead of proceeding to attack.
    // lookForPlayers requires at least one playeringame[i]=true (vanilla
    // infinite-loops otherwise); the sole player is dead (health=0) so
    // lookForPlayers fails and setMobjState(spawnstate) runs.
    const dead = makeMobj({ x: 100, y: 0, info: null, health: 0, flags: 0 });
    const actor = makeMobj({
      target: dead,
      info: makeInfo({ speed: 8, spawnstate: 2 }),
    });
    const deadPlayer: PlayerLike = { mo: null, health: 0 };
    const ctx = makeChaseContext({
      players: [deadPlayer, deadPlayer, deadPlayer, deadPlayer],
      playeringame: [true, false, false, false],
    });
    chase(actor, ctx);
    expect(actor.state).toBe(STATES[2]!);
  });

  it('clears MF_JUSTATTACKED and triggers newChaseDir on normal skill', () => {
    const target = makeMobj({ x: 200, y: 200, info: null });
    const actor = makeMobj({
      target,
      flags: MF_SHOOTABLE | MF_JUSTATTACKED,
      movedir: DirType.NODIR,
      info: makeInfo({ speed: 8, meleestate: 0, missilestate: 0 }),
    });
    const ctx = makeChaseContext({ gameskill: 2, fastparm: false });
    chase(actor, ctx);
    expect(actor.flags & MF_JUSTATTACKED).toBe(0);
    // newChaseDir picked a direct NE diagonal.
    expect(actor.movedir).toBe(DirType.NORTHEAST);
  });

  it('suppresses the newChaseDir after JUSTATTACKED on nightmare skill', () => {
    const target = makeMobj({ x: 200, y: 200, info: null });
    const actor = makeMobj({
      target,
      flags: MF_SHOOTABLE | MF_JUSTATTACKED,
      movedir: DirType.NODIR,
      info: makeInfo({ speed: 8 }),
    });
    const ctx = makeChaseContext({ gameskill: 4 /* SK_NIGHTMARE */ });
    chase(actor, ctx);
    expect(actor.flags & MF_JUSTATTACKED).toBe(0);
    expect(actor.movedir).toBe(DirType.NODIR);
  });

  it('suppresses the newChaseDir after JUSTATTACKED when fastparm is set', () => {
    const target = makeMobj({ x: 200, y: 200, info: null });
    const actor = makeMobj({
      target,
      flags: MF_SHOOTABLE | MF_JUSTATTACKED,
      movedir: DirType.NODIR,
      info: makeInfo({ speed: 8 }),
    });
    const ctx = makeChaseContext({ gameskill: 2, fastparm: true });
    chase(actor, ctx);
    expect(actor.movedir).toBe(DirType.NODIR);
  });

  it('transitions to meleestate when checkMeleeRange returns true', () => {
    // Target 30 units away (< MELEERANGE-20+radius ≈ 64-20+20 = 64),
    // same sector, visible → checkMeleeRange=true.
    const target = makeMobj({ x: 30, y: 0, info: makeInfo({ radius: (20 * F) | 0 }) });
    let emittedSound = -1;
    const actor = makeMobj({
      x: 0,
      y: 0,
      target,
      info: makeInfo({
        speed: 8,
        meleestate: 2,
        missilestate: 0,
        attacksound: 77,
      }),
    });
    const ctx = makeChaseContext({
      startSound: (_o, id) => {
        emittedSound = id;
      },
    });
    chase(actor, ctx);
    expect(actor.state).toBe(STATES[2]!);
    expect(emittedSound).toBe(77);
  });

  it('does not emit attack sound when info.attacksound is zero', () => {
    const target = makeMobj({ x: 30, y: 0, info: makeInfo({ radius: (20 * F) | 0 }) });
    let called = false;
    const actor = makeMobj({
      target,
      info: makeInfo({
        speed: 8,
        meleestate: 2,
        missilestate: 0,
        attacksound: 0,
      }),
    });
    const ctx = makeChaseContext({
      startSound: () => {
        called = true;
      },
    });
    chase(actor, ctx);
    expect(called).toBe(false);
    expect(actor.state).toBe(STATES[2]!);
  });

  it('skips the missile attack when movecount is nonzero on a normal skill', () => {
    // Target far enough for missile range but meleestate=0 so no melee.
    const target = makeMobj({ x: 200, y: 0, info: makeInfo({ radius: (20 * F) | 0 }) });
    const actor = makeMobj({
      target,
      movecount: 5,
      info: makeInfo({
        speed: 8,
        meleestate: 0,
        missilestate: 1,
        reactiontime: 0,
      }),
    });
    const ctx = makeChaseContext({ gameskill: 2, fastparm: false });
    chase(actor, ctx);
    // With movecount=5 → skip-by-movecount gate → no missile fire. Actor
    // drops into the walk path; the missilestate should NOT be entered.
    expect(actor.flags & MF_JUSTATTACKED).toBe(0);
  });

  it('falls back to newChaseDir when movecount underflows below zero', () => {
    const target = makeMobj({ x: 200, y: 200, info: null });
    const actor = makeMobj({
      target,
      movecount: 0,
      movedir: DirType.NODIR,
      info: makeInfo({
        speed: 8,
        meleestate: 0,
        missilestate: 0,
        reactiontime: 0,
      }),
    });
    const ctx = makeChaseContext();
    chase(actor, ctx);
    // movecount=0 → decrement → -1 → triggers newChaseDir.  Because the
    // target is NE and movedir=NODIR so turnaround=NODIR, direct diagonal
    // NE is picked and tryWalk succeeds.  After tryWalk, P_Random()&15
    // reseeds movecount.
    expect(actor.movedir).toBe(DirType.NORTHEAST);
    expect(actor.movecount).toBeGreaterThanOrEqual(0);
    expect(actor.movecount).toBeLessThanOrEqual(15);
  });

  it('short-circuits the activesound gate when info.activesound is zero', () => {
    // When activesound=0 the vanilla short-circuit prevents the P_Random()
    // call entirely, so the startSound callback must never fire regardless
    // of the RNG position.
    let calls = 0;
    const target = makeMobj({ x: 400, y: 0, info: null });
    const actor = makeMobj({
      target,
      movecount: 10,
      movedir: DirType.EAST,
      info: makeInfo({
        speed: 8,
        meleestate: 0,
        missilestate: 0,
        activesound: 0,
        reactiontime: 0,
      }),
    });
    const ctx = makeChaseContext({
      startSound: () => {
        calls += 1;
      },
    });
    chase(actor, ctx);
    expect(calls).toBe(0);
  });

  it('fires activesound only when P_Random() is below the threshold', () => {
    // DoomRandom's first pRandom() returns RNG_TABLE[1]=8 (≥ 3 → no fire).
    // Preseed 82 calls so the next index lands on RNG_TABLE[83]=0, which
    // is below ACTIVESOUND_THRESHOLD=3 and triggers the callback.
    const target = makeMobj({ x: 400, y: 0, info: null, health: 100 });
    const makeActor = () =>
      makeMobj({
        target,
        movecount: 10,
        movedir: DirType.EAST,
        info: makeInfo({
          speed: 8,
          meleestate: 0,
          missilestate: 0,
          activesound: 123,
          reactiontime: 0,
        }),
      });

    const highRng = new DoomRandom();
    let highSoundId = -1;
    const ctxHigh = makeChaseContext({
      rng: highRng,
      startSound: (_o, id) => {
        highSoundId = id;
      },
    });
    chase(makeActor(), ctxHigh);
    expect(highSoundId).toBe(-1);

    const lowRng = new DoomRandom();
    for (let i = 0; i < 82; i++) lowRng.pRandom();
    let lowSoundId = -1;
    const ctxLow = makeChaseContext({
      rng: lowRng,
      startSound: (_o, id) => {
        lowSoundId = id;
      },
    });
    chase(makeActor(), ctxLow);
    expect(lowSoundId).toBe(123);
  });

  it('does not re-look for players when netgame is false', () => {
    // Even with threshold=0 and checkSight false, single-player skips the
    // re-look branch entirely — the actor should walk normally.
    const target = makeMobj({ x: 400, y: 0, info: null, health: 100 });
    const actor = makeMobj({
      target,
      threshold: 0,
      movecount: 3,
      movedir: DirType.EAST,
      info: makeInfo({
        speed: 8,
        meleestate: 0,
        missilestate: 0,
        reactiontime: 0,
      }),
    });
    const ctx = makeChaseContext({ netgame: false });
    chase(actor, ctx);
    // Walked → x advanced by speed*FRACUNIT.
    expect(actor.x).toBe((8 * F) | 0);
  });

  it('skips the netgame re-look when threshold is nonzero', () => {
    // netgame=true but threshold != 0 → short-circuits the !checkSight
    // guard so the re-look branch is skipped and the actor walks normally.
    const target = makeMobj({ x: 400, y: 0, info: null, health: 100 });
    const actor = makeMobj({
      target,
      threshold: 5,
      movecount: 3,
      movedir: DirType.EAST,
      info: makeInfo({
        speed: 8,
        meleestate: 0,
        missilestate: 0,
        reactiontime: 0,
      }),
    });
    const ctx = makeChaseContext({ netgame: true });
    chase(actor, ctx);
    // threshold decremented by 1 before the re-look branch; walked one step.
    expect(actor.threshold).toBe(4);
    expect(actor.x).toBe((8 * F) | 0);
  });
});
