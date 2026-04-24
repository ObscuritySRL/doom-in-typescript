import { describe, expect, it } from 'bun:test';

import type { Angle } from '../../src/core/angle.ts';
import { ANG45, ANG90, ANG180 } from '../../src/core/angle.ts';
import type { Fixed } from '../../src/core/fixed.ts';
import { FRACBITS, FRACUNIT } from '../../src/core/fixed.ts';
import { DoomRandom } from '../../src/core/rng.ts';
import { ANGLETOFINESHIFT, finecosine, finesine, FINEMASK } from '../../src/core/trig.ts';
import type { Blockmap } from '../../src/map/blockmap.ts';
import { MAPBLOCKSHIFT } from '../../src/map/blockmap.ts';
import { createValidCount } from '../../src/map/blockmapIter.ts';
import type { MapSector } from '../../src/map/lineSectorGeometry.ts';
import type { MapData, LineSectors } from '../../src/map/mapSetup.ts';
import type { RejectMap } from '../../src/map/reject.ts';
import { createBlockThingsGrid } from '../../src/world/checkPosition.ts';
import type { BlockThingsGrid } from '../../src/world/checkPosition.ts';
import { MF_MISSILE, MF_SHOOTABLE, MF_SOLID, MOBJINFO, Mobj, MobjType, mobjThinker, ONFLOORZ } from '../../src/world/mobj.ts';
import { ThinkerList } from '../../src/world/thinkers.ts';
import { TELEFOG_DELTA, TELEFRAG_DAMAGE, TELEPORT_REACTIONTIME, evTeleport, pitStompThing, teleportMove } from '../../src/world/teleport.ts';
import type { TeleportCallbacks } from '../../src/world/teleport.ts';

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

function createMobj(props: {
  x?: Fixed;
  y?: Fixed;
  z?: Fixed;
  radius?: Fixed;
  height?: Fixed;
  flags?: number;
  health?: number;
  type?: MobjType;
  player?: unknown;
  angle?: Angle;
  momx?: Fixed;
  momy?: Fixed;
  momz?: Fixed;
  floorz?: Fixed;
  ceilingz?: Fixed;
  reactiontime?: number;
}): Mobj {
  const mobj = new Mobj();
  mobj.x = props.x ?? 0;
  mobj.y = props.y ?? 0;
  mobj.z = props.z ?? 0;
  mobj.radius = props.radius ?? (20 * F) | 0;
  mobj.height = props.height ?? (56 * F) | 0;
  mobj.flags = props.flags ?? 0;
  mobj.health = props.health ?? 100;
  mobj.type = props.type ?? MobjType.POSSESSED;
  mobj.player = props.player ?? null;
  mobj.angle = props.angle ?? 0;
  mobj.momx = props.momx ?? 0;
  mobj.momy = props.momy ?? 0;
  mobj.momz = props.momz ?? 0;
  mobj.floorz = props.floorz ?? 0;
  mobj.ceilingz = props.ceilingz ?? (128 * F) | 0;
  mobj.reactiontime = props.reactiontime ?? 0;
  mobj.info = MOBJINFO[mobj.type] ?? null;
  return mobj;
}

function createTestMapData(overrides?: { sectors?: readonly MapSector[]; blockmap?: Blockmap; subsectorSectors?: readonly number[] }): MapData {
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
  const blockmap = overrides?.blockmap ?? createEmptyBlockmap(4, 4);
  const subsectorSectors = overrides?.subsectorSectors ?? [0];
  const validCount = createValidCount(0);

  const rejectMap: RejectMap = {
    sectorCount: sectors.length,
    totalBits: sectors.length * sectors.length,
    expectedSize: Math.ceil((sectors.length * sectors.length) / 8),
    data: Buffer.alloc(Math.ceil((sectors.length * sectors.length) / 8)),
  };

  return {
    name: 'TEST',
    vertexes: Object.freeze([]),
    sectors: Object.freeze(sectors) as readonly MapSector[],
    sidedefs: Object.freeze([]),
    linedefs: Object.freeze([]),
    segs: Object.freeze([]),
    subsectors: Object.freeze([]),
    nodes: Object.freeze([]),
    things: Object.freeze([]),
    blockmap,
    reject: rejectMap,
    subsectorSectors: Object.freeze(subsectorSectors) as readonly number[],
    lineSectors: Object.freeze([]) as readonly LineSectors[],
    sectorGroups: Object.freeze([]),
    validCount,
  } as MapData;
}

function placeInBlocklinks(mobj: Mobj, blocklinks: BlockThingsGrid, cellIndex: number): void {
  mobj.blockNext = blocklinks[cellIndex] ?? null;
  if (blocklinks[cellIndex] !== null) {
    (blocklinks[cellIndex] as Mobj).blockPrev = mobj;
  }
  blocklinks[cellIndex] = mobj;
}

function cellIndexFor(x: Fixed, y: Fixed, blockmap: Blockmap): number {
  const col = (x - blockmap.originX) >> MAPBLOCKSHIFT;
  const row = (y - blockmap.originY) >> MAPBLOCKSHIFT;
  return row * blockmap.columns + col;
}

/** Create a TELEPORTMAN mobj and add it to the thinker list. */
function spawnTeleportman(x: Fixed, y: Fixed, angle: Angle, thinkerList: ThinkerList): Mobj {
  const mobj = new Mobj();
  mobj.type = MobjType.TELEPORTMAN;
  mobj.x = x;
  mobj.y = y;
  mobj.angle = angle;
  mobj.info = MOBJINFO[MobjType.TELEPORTMAN] ?? null;
  mobj.radius = mobj.info?.radius ?? (20 * F) | 0;
  mobj.height = mobj.info?.height ?? (16 * F) | 0;
  mobj.flags = mobj.info?.flags ?? 0;
  mobj.action = mobjThinker;
  thinkerList.add(mobj);
  return mobj;
}

// ── Constants ────────────────────────────────────────────────────────

describe('teleport constants', () => {
  it('TELEFOG_DELTA is 20 map units in fixed-point', () => {
    expect(TELEFOG_DELTA).toBe((20 * FRACUNIT) | 0);
  });

  it('TELEFRAG_DAMAGE is 10000', () => {
    expect(TELEFRAG_DAMAGE).toBe(10_000);
  });

  it('TELEPORT_REACTIONTIME is 18 tics', () => {
    expect(TELEPORT_REACTIONTIME).toBe(18);
  });
});

// ── PIT_StompThing ───────────────────────────────────────────────────

describe('pitStompThing', () => {
  it('skips non-shootable things', () => {
    const thing = createMobj({ x: (64 * F) | 0, y: (64 * F) | 0, player: {} });
    const other = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      flags: MF_SOLID,
    });
    expect(pitStompThing(other, thing, thing.x, thing.y)).toBe(true);
  });

  it('skips things outside blockdist', () => {
    const thing = createMobj({
      x: 0,
      y: 0,
      radius: (16 * F) | 0,
      player: {},
    });
    const other = createMobj({
      x: (100 * F) | 0,
      y: (100 * F) | 0,
      radius: (16 * F) | 0,
      flags: MF_SHOOTABLE,
    });
    expect(pitStompThing(other, thing, thing.x, thing.y)).toBe(true);
  });

  it('skips self', () => {
    const thing = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      flags: MF_SHOOTABLE,
      player: {},
    });
    expect(pitStompThing(thing, thing, thing.x, thing.y)).toBe(true);
  });

  it('monsters cannot stomp on non-boss maps', () => {
    const monster = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      radius: (20 * F) | 0,
      player: null,
    });
    const other = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      radius: (20 * F) | 0,
      flags: MF_SHOOTABLE,
    });
    expect(pitStompThing(other, monster, monster.x, monster.y, { isBossMap: false })).toBe(false);
  });

  it('monsters can stomp on boss maps', () => {
    const monster = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      radius: (20 * F) | 0,
      player: null,
    });
    const other = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      radius: (20 * F) | 0,
      flags: MF_SHOOTABLE,
      health: 50,
    });
    let damaged = false;
    const callbacks: TeleportCallbacks = {
      isBossMap: true,
      damageMobj: (_target, _inflictor, _source, damage) => {
        damaged = true;
        expect(damage).toBe(TELEFRAG_DAMAGE);
      },
    };
    expect(pitStompThing(other, monster, monster.x, monster.y, callbacks)).toBe(true);
    expect(damaged).toBe(true);
  });

  it('players stomp shootable things with TELEFRAG_DAMAGE', () => {
    const player = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      radius: (16 * F) | 0,
      player: {},
    });
    const victim = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      radius: (20 * F) | 0,
      flags: MF_SHOOTABLE,
      health: 100,
    });
    let receivedDamage = 0;
    const callbacks: TeleportCallbacks = {
      damageMobj: (_target, _inflictor, _source, damage) => {
        receivedDamage = damage;
      },
    };
    expect(pitStompThing(victim, player, player.x, player.y, callbacks)).toBe(true);
    expect(receivedDamage).toBe(TELEFRAG_DAMAGE);
  });

  it('uses absolute distance for overlap check', () => {
    const thing = createMobj({
      x: 0,
      y: 0,
      radius: (16 * F) | 0,
      player: {},
    });
    const other = createMobj({
      x: (-10 * F) | 0,
      y: (-10 * F) | 0,
      radius: (16 * F) | 0,
      flags: MF_SHOOTABLE,
    });
    let stomped = false;
    const callbacks: TeleportCallbacks = {
      damageMobj: () => {
        stomped = true;
      },
    };
    expect(pitStompThing(other, thing, 0, 0, callbacks)).toBe(true);
    expect(stomped).toBe(true);
  });
});

// ── teleportMove ─────────────────────────────────────────────────────

describe('teleportMove', () => {
  it('updates position to destination', () => {
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const thing = createMobj({ x: 0, y: 0, player: {} });

    const destX = (32 * F) | 0;
    const destY = (32 * F) | 0;
    const result = teleportMove(thing, destX, destY, mapData, blocklinks);

    expect(result).toBe(true);
    expect(thing.x).toBe(destX);
    expect(thing.y).toBe(destY);
  });

  it('updates floorz and ceilingz from destination sector', () => {
    const sectors: MapSector[] = [
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
    const thing = createMobj({ floorz: 0, ceilingz: (128 * F) | 0 });

    teleportMove(thing, 0, 0, mapData, blocklinks);

    expect(thing.floorz).toBe((16 * F) | 0);
    expect(thing.ceilingz).toBe((200 * F) | 0);
  });

  it('calls unsetThingPosition and setThingPosition', () => {
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const thing = createMobj({});

    const callOrder: string[] = [];
    const callbacks: TeleportCallbacks = {
      unsetThingPosition: () => {
        callOrder.push('unset');
      },
      setThingPosition: () => {
        callOrder.push('set');
      },
    };

    teleportMove(thing, (32 * F) | 0, (32 * F) | 0, mapData, blocklinks, callbacks);

    expect(callOrder).toEqual(['unset', 'set']);
  });

  it('returns false when stomping is blocked', () => {
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);

    const blocker = createMobj({
      x: (32 * F) | 0,
      y: (32 * F) | 0,
      radius: (20 * F) | 0,
      flags: MF_SHOOTABLE,
    });
    placeInBlocklinks(blocker, blocklinks, cellIndexFor(blocker.x, blocker.y, mapData.blockmap));

    // Monster with no player and not boss map — stomp blocked
    const monster = createMobj({
      x: 0,
      y: 0,
      radius: (20 * F) | 0,
      player: null,
    });

    const result = teleportMove(monster, (32 * F) | 0, (32 * F) | 0, mapData, blocklinks, { isBossMap: false });

    expect(result).toBe(false);
    // Position should NOT be updated when stomp fails
    expect(monster.x).toBe(0);
    expect(monster.y).toBe(0);
  });

  it('does not update position when stomp fails', () => {
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);

    const blocker = createMobj({
      x: (32 * F) | 0,
      y: (32 * F) | 0,
      radius: (20 * F) | 0,
      flags: MF_SHOOTABLE,
    });
    placeInBlocklinks(blocker, blocklinks, cellIndexFor(blocker.x, blocker.y, mapData.blockmap));

    const monster = createMobj({
      x: (10 * F) | 0,
      y: (10 * F) | 0,
      radius: (20 * F) | 0,
      player: null,
    });
    const originalX = monster.x;
    const originalY = monster.y;

    teleportMove(monster, (32 * F) | 0, (32 * F) | 0, mapData, blocklinks);

    expect(monster.x).toBe(originalX);
    expect(monster.y).toBe(originalY);
  });
});

// ── evTeleport ───────────────────────────────────────────────────────

describe('evTeleport', () => {
  it('rejects missiles', () => {
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const thinkerList = new ThinkerList();
    const rng = new DoomRandom();

    const missile = createMobj({ flags: MF_MISSILE });
    const result = evTeleport(1, 0, missile, mapData, blocklinks, thinkerList, rng);

    expect(result).toBe(false);
  });

  it('rejects back-side activation (side === 1)', () => {
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const thinkerList = new ThinkerList();
    const rng = new DoomRandom();

    const thing = createMobj({ player: {} });
    const result = evTeleport(1, 1, thing, mapData, blocklinks, thinkerList, rng);

    expect(result).toBe(false);
  });

  it('returns false when no matching sector tag', () => {
    const sectors: MapSector[] = [
      Object.freeze({
        floorheight: 0,
        ceilingheight: (128 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 5,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const thinkerList = new ThinkerList();
    const rng = new DoomRandom();

    spawnTeleportman(0, 0, 0, thinkerList);

    const thing = createMobj({ player: {} });
    // Line tag 99 does not match sector tag 5.
    const result = evTeleport(99, 0, thing, mapData, blocklinks, thinkerList, rng);

    expect(result).toBe(false);
  });

  it('returns false when no TELEPORTMAN in matching sector', () => {
    const sectors: MapSector[] = [
      Object.freeze({
        floorheight: 0,
        ceilingheight: (128 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 1,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const thinkerList = new ThinkerList();
    const rng = new DoomRandom();

    // Add a non-TELEPORTMAN thinker
    const notTeleporter = createMobj({ type: MobjType.POSSESSED });
    notTeleporter.action = mobjThinker;
    thinkerList.add(notTeleporter);

    const thing = createMobj({ player: {} });
    const result = evTeleport(1, 0, thing, mapData, blocklinks, thinkerList, rng);

    expect(result).toBe(false);
  });

  it('teleports to first TELEPORTMAN in matching sector', () => {
    const sectors: MapSector[] = [
      Object.freeze({
        floorheight: (32 * F) | 0,
        ceilingheight: (200 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 1,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const thinkerList = new ThinkerList();
    const rng = new DoomRandom();

    const destAngle: Angle = ANG90;
    const destX = (50 * F) | 0;
    const destY = (60 * F) | 0;
    spawnTeleportman(destX, destY, destAngle, thinkerList);

    const thing = createMobj({
      x: (10 * F) | 0,
      y: (10 * F) | 0,
      z: 0,
      momx: (5 * F) | 0,
      momy: (3 * F) | 0,
      momz: (1 * F) | 0,
      player: {},
    });

    const result = evTeleport(1, 0, thing, mapData, blocklinks, thinkerList, rng);

    expect(result).toBe(true);
    expect(thing.x).toBe(destX);
    expect(thing.y).toBe(destY);
    expect(thing.z).toBe((32 * F) | 0); // floorz
    expect(thing.angle).toBe(destAngle);
    expect(thing.momx).toBe(0);
    expect(thing.momy).toBe(0);
    expect(thing.momz).toBe(0);
  });

  it('sets reactiontime for players', () => {
    const sectors: MapSector[] = [
      Object.freeze({
        floorheight: 0,
        ceilingheight: (128 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 1,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const thinkerList = new ThinkerList();
    const rng = new DoomRandom();

    spawnTeleportman(0, 0, 0, thinkerList);

    const thing = createMobj({ player: {}, reactiontime: 0 });
    evTeleport(1, 0, thing, mapData, blocklinks, thinkerList, rng);

    expect(thing.reactiontime).toBe(TELEPORT_REACTIONTIME);
  });

  it('does not set reactiontime for non-players', () => {
    const sectors: MapSector[] = [
      Object.freeze({
        floorheight: 0,
        ceilingheight: (128 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 1,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const thinkerList = new ThinkerList();
    const rng = new DoomRandom();

    spawnTeleportman(0, 0, 0, thinkerList);

    const thing = createMobj({ player: null, reactiontime: 5 });
    evTeleport(1, 0, thing, mapData, blocklinks, thinkerList, rng);

    expect(thing.reactiontime).toBe(5);
  });

  it('spawns two TFOG thinkers (source and destination)', () => {
    const sectors: MapSector[] = [
      Object.freeze({
        floorheight: 0,
        ceilingheight: (128 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 1,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const thinkerList = new ThinkerList();
    const rng = new DoomRandom();

    spawnTeleportman((50 * F) | 0, (60 * F) | 0, 0, thinkerList);

    const thing = createMobj({
      x: (10 * F) | 0,
      y: (10 * F) | 0,
      z: (5 * F) | 0,
      player: {},
    });

    evTeleport(1, 0, thing, mapData, blocklinks, thinkerList, rng);

    // Count TFOG mobjs in the thinker list.
    let fogCount = 0;
    thinkerList.forEach((thinker) => {
      if ((thinker as Mobj).type === MobjType.TFOG) {
        fogCount++;
      }
    });

    expect(fogCount).toBe(2);
  });

  it('source fog spawns at the old position', () => {
    const sectors: MapSector[] = [
      Object.freeze({
        floorheight: 0,
        ceilingheight: (128 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 1,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const thinkerList = new ThinkerList();
    const rng = new DoomRandom();

    spawnTeleportman((50 * F) | 0, (60 * F) | 0, 0, thinkerList);

    const oldX = (10 * F) | 0;
    const oldY = (20 * F) | 0;
    const oldZ = (5 * F) | 0;
    const thing = createMobj({
      x: oldX,
      y: oldY,
      z: oldZ,
      player: {},
    });

    evTeleport(1, 0, thing, mapData, blocklinks, thinkerList, rng);

    // Collect TFOG positions.
    const fogs: Mobj[] = [];
    thinkerList.forEach((thinker) => {
      if ((thinker as Mobj).type === MobjType.TFOG) {
        fogs.push(thinker as Mobj);
      }
    });

    // First fog (source) is at the old position.
    expect(fogs[0]!.x).toBe(oldX);
    expect(fogs[0]!.y).toBe(oldY);
    expect(fogs[0]!.z).toBe(oldZ);
  });

  it('first matching TELEPORTMAN wins, not last', () => {
    const sectors: MapSector[] = [
      Object.freeze({
        floorheight: 0,
        ceilingheight: (128 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 1,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const thinkerList = new ThinkerList();
    const rng = new DoomRandom();

    const firstX = (30 * F) | 0;
    const secondX = (60 * F) | 0;
    spawnTeleportman(firstX, 0, ANG45, thinkerList);
    spawnTeleportman(secondX, 0, ANG180, thinkerList);

    const thing = createMobj({ x: (10 * F) | 0, player: {} });
    evTeleport(1, 0, thing, mapData, blocklinks, thinkerList, rng);

    expect(thing.x).toBe(firstX);
    expect(thing.angle).toBe(ANG45);
  });
});

// ── Parity-sensitive edge cases ──────────────────────────────────────

describe('parity-sensitive edge cases', () => {
  it('destination fog offset uses ANGLETOFINESHIFT and finecosine/finesine', () => {
    const sectors: MapSector[] = [
      Object.freeze({
        floorheight: 0,
        ceilingheight: (128 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 1,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const thinkerList = new ThinkerList();
    const rng = new DoomRandom();

    const destAngle: Angle = ANG90;
    const destX = (50 * F) | 0;
    const destY = (60 * F) | 0;
    spawnTeleportman(destX, destY, destAngle, thinkerList);

    const thing = createMobj({
      x: (10 * F) | 0,
      y: (20 * F) | 0,
      z: 0,
      player: {},
    });

    evTeleport(1, 0, thing, mapData, blocklinks, thinkerList, rng);

    const fogs: Mobj[] = [];
    thinkerList.forEach((thinker) => {
      if ((thinker as Mobj).type === MobjType.TFOG) {
        fogs.push(thinker as Mobj);
      }
    });

    // Destination fog (second one) should be offset 20 units along destAngle.
    const fineAngle = (destAngle >>> ANGLETOFINESHIFT) & FINEMASK;
    const expectedFogX = (destX + 20 * finecosine[fineAngle]!) | 0;
    const expectedFogY = (destY + 20 * finesine[fineAngle]!) | 0;

    expect(fogs[1]!.x).toBe(expectedFogX);
    expect(fogs[1]!.y).toBe(expectedFogY);
  });

  it('z is set to floorz (Doom 1.9 behavior, not exe_final)', () => {
    const floorHeight = (48 * F) | 0;
    const sectors: MapSector[] = [
      Object.freeze({
        floorheight: floorHeight,
        ceilingheight: (200 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 1,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const thinkerList = new ThinkerList();
    const rng = new DoomRandom();

    spawnTeleportman(0, 0, 0, thinkerList);

    const thing = createMobj({
      x: (10 * F) | 0,
      z: (100 * F) | 0,
      player: {},
    });

    evTeleport(1, 0, thing, mapData, blocklinks, thinkerList, rng);

    // z must equal floorz, not old z or ONFLOORZ sentinel.
    expect(thing.z).toBe(floorHeight);
  });

  it('TELEPORTMAN has MF_NOSECTOR|MF_NOBLOCKMAP flags', () => {
    const info = MOBJINFO[MobjType.TELEPORTMAN]!;
    expect(info.flags & 0x8).toBe(0x8); // MF_NOSECTOR
    expect(info.flags & 0x10).toBe(0x10); // MF_NOBLOCKMAP
  });

  it('TELEPORTMAN doomednum is 14', () => {
    const info = MOBJINFO[MobjType.TELEPORTMAN]!;
    expect(info.doomednum).toBe(14);
  });

  it('momentum is zeroed on all three axes', () => {
    const sectors: MapSector[] = [
      Object.freeze({
        floorheight: 0,
        ceilingheight: (128 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 1,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const thinkerList = new ThinkerList();
    const rng = new DoomRandom();

    spawnTeleportman(0, 0, 0, thinkerList);

    const thing = createMobj({
      momx: (10 * F) | 0,
      momy: (-7 * F) | 0,
      momz: (3 * F) | 0,
      player: {},
    });

    evTeleport(1, 0, thing, mapData, blocklinks, thinkerList, rng);

    expect(thing.momx).toBe(0);
    expect(thing.momy).toBe(0);
    expect(thing.momz).toBe(0);
  });

  it('multiple sectors with same tag: first match used', () => {
    const sectors: MapSector[] = [
      Object.freeze({
        floorheight: 0,
        ceilingheight: (128 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 1,
      }),
      Object.freeze({
        floorheight: (64 * F) | 0,
        ceilingheight: (256 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 1,
      }),
    ];
    // subsectorSectors maps subsector 0 → sector 0, subsector 1 → sector 1
    // Place a TELEPORTMAN only in sector 1 (at a position that maps to subsector index 1).
    // We need two subsectors; position determines which one via BSP traversal.
    // Since no BSP nodes are defined, pointInSubsector returns subsector 0 for
    // all positions. So we put the TELEPORTMAN in sector 0 (subsector 0) and
    // verify the first sector match is used.
    const mapData = createTestMapData({
      sectors,
      subsectorSectors: [0, 1],
    });
    const blocklinks = createBlockThingsGrid(4, 4);
    const thinkerList = new ThinkerList();
    const rng = new DoomRandom();

    // TELEPORTMAN at position that resolves to sector 0 (subsector 0).
    spawnTeleportman((10 * F) | 0, (10 * F) | 0, ANG45, thinkerList);

    const thing = createMobj({ x: (50 * F) | 0, player: {} });
    const result = evTeleport(1, 0, thing, mapData, blocklinks, thinkerList, rng);

    expect(result).toBe(true);
    expect(thing.x).toBe((10 * F) | 0);
    expect(thing.z).toBe(0); // sector 0 floorz
  });

  it('TELEPORTMAN in wrong sector is skipped', () => {
    const sectors: MapSector[] = [
      Object.freeze({
        floorheight: 0,
        ceilingheight: (128 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 1,
      }),
      Object.freeze({
        floorheight: (64 * F) | 0,
        ceilingheight: (256 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 2, // Different tag
      }),
    ];
    const mapData = createTestMapData({
      sectors,
      subsectorSectors: [0, 1],
    });
    const blocklinks = createBlockThingsGrid(4, 4);
    const thinkerList = new ThinkerList();
    const rng = new DoomRandom();

    // TELEPORTMAN is in sector 0 (tag=1), but we trigger with tag=2 (sector 1).
    // Since the TELEPORTMAN resolves to sector 0 via BSP, it won't match sector 1.
    spawnTeleportman((10 * F) | 0, (10 * F) | 0, 0, thinkerList);

    const thing = createMobj({ x: (50 * F) | 0, player: {} });
    const result = evTeleport(2, 0, thing, mapData, blocklinks, thinkerList, rng);

    expect(result).toBe(false);
  });

  it('non-mobjThinker thinkers are skipped', () => {
    const sectors: MapSector[] = [
      Object.freeze({
        floorheight: 0,
        ceilingheight: (128 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 1,
      }),
    ];
    const mapData = createTestMapData({ sectors });
    const blocklinks = createBlockThingsGrid(4, 4);
    const thinkerList = new ThinkerList();
    const rng = new DoomRandom();

    // Add a non-mobj thinker (action is a custom function, not mobjThinker).
    const fakeThinker = new Mobj();
    fakeThinker.type = MobjType.TELEPORTMAN;
    fakeThinker.action = () => {}; // Not mobjThinker
    thinkerList.add(fakeThinker);

    const thing = createMobj({ player: {} });
    const result = evTeleport(1, 0, thing, mapData, blocklinks, thinkerList, rng);

    expect(result).toBe(false);
  });
});
