import { describe, expect, it } from 'bun:test';

import type { Fixed } from '../../src/core/fixed.ts';
import { FRACUNIT } from '../../src/core/fixed.ts';
import { DoomRandom } from '../../src/core/rng.ts';
import { createValidCount } from '../../src/map/blockmapIter.ts';
import type { Blockmap } from '../../src/map/blockmap.ts';
import type { MapSector } from '../../src/map/lineSectorGeometry.ts';
import type { LineSectors, MapData, SectorGroup } from '../../src/map/mapSetup.ts';
import type { RejectMap } from '../../src/map/reject.ts';
import { MF_DROPPED, MF_NOCLIP, MF_SHOOTABLE, MF_SOLID, MOBJINFO, Mobj, MobjType, STATES, StateNum } from '../../src/world/mobj.ts';
import { createBlockThingsGrid } from '../../src/world/checkPosition.ts';
import type { BlockThingsGrid } from '../../src/world/checkPosition.ts';
import { REMOVED, ThinkerList } from '../../src/world/thinkers.ts';
import { changeSector, thingHeightClip } from '../../src/world/sectorChange.ts';
import type { ChangeSectorCallbacks } from '../../src/world/sectorChange.ts';

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

function createTestMapData(overrides?: { sectors?: readonly MapSector[]; sectorGroups?: readonly SectorGroup[]; blockmap?: Blockmap; subsectorSectors?: readonly number[] }): MapData {
  const sectors: readonly MapSector[] = overrides?.sectors ?? [
    {
      floorheight: 0,
      ceilingheight: (128 * F) | 0,
      floorpic: 'FLOOR4_8',
      ceilingpic: 'CEIL3_5',
      lightlevel: 160,
      special: 0,
      tag: 0,
    },
  ];
  const blockmap = overrides?.blockmap ?? createEmptyBlockmap(4, 4);
  const validCount = createValidCount(0);
  const subsectorSectors = overrides?.subsectorSectors ?? [0];

  const sectorGroups: readonly SectorGroup[] = overrides?.sectorGroups ?? [
    Object.freeze({
      lineIndices: Object.freeze([]),
      bbox: Object.freeze([0, 0, 0, 0]) as readonly [Fixed, Fixed, Fixed, Fixed],
      soundOriginX: 0,
      soundOriginY: 0,
      blockbox: Object.freeze([blockmap.rows - 1, 0, 0, blockmap.columns - 1]) as readonly [number, number, number, number],
    }),
  ];

  const rejectMap: RejectMap = {
    sectorCount: sectors.length,
    totalBits: sectors.length * sectors.length,
    expectedSize: Math.ceil((sectors.length * sectors.length) / 8),
    data: Buffer.alloc(Math.ceil((sectors.length * sectors.length) / 8)),
  };

  return {
    name: 'TEST',
    vertexes: Object.freeze([]),
    sectors: Object.freeze(sectors),
    sidedefs: Object.freeze([]),
    linedefs: Object.freeze([]),
    segs: Object.freeze([]),
    subsectors: Object.freeze([]),
    nodes: Object.freeze([]),
    things: Object.freeze([]),
    blockmap,
    reject: rejectMap,
    subsectorSectors: Object.freeze(subsectorSectors),
    lineSectors: Object.freeze([]) as readonly LineSectors[],
    sectorGroups,
    validCount,
  } as MapData;
}

function createMobj(props: { x?: Fixed; y?: Fixed; z?: Fixed; radius?: Fixed; height?: Fixed; flags?: number; health?: number; type?: MobjType; floorz?: Fixed; ceilingz?: Fixed; info?: object | null; state?: object | null }): Mobj {
  const mobj = new Mobj();
  mobj.x = props.x ?? 0;
  mobj.y = props.y ?? 0;
  mobj.z = props.z ?? 0;
  mobj.radius = props.radius ?? (20 * F) | 0;
  mobj.height = props.height ?? (56 * F) | 0;
  mobj.flags = props.flags ?? 0;
  mobj.health = props.health ?? 100;
  mobj.type = props.type ?? MobjType.PLAYER;
  mobj.floorz = props.floorz ?? 0;
  mobj.ceilingz = props.ceilingz ?? (128 * F) | 0;
  if (props.info !== undefined) {
    mobj.info = props.info as Mobj['info'];
  }
  if (props.state !== undefined) {
    mobj.state = props.state as Mobj['state'];
  }
  return mobj;
}

function placeInBlocklinks(mobj: Mobj, blocklinks: BlockThingsGrid, cellIndex: number): void {
  mobj.blockNext = blocklinks[cellIndex] ?? null;
  if (blocklinks[cellIndex] !== null) {
    (blocklinks[cellIndex] as Mobj).blockPrev = mobj;
  }
  blocklinks[cellIndex] = mobj;
}

// ── thingHeightClip ──────────────────────────────────────────────────

describe('thingHeightClip', () => {
  it('returns true when thing fits vertically', () => {
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ z: 0, height: (56 * F) | 0 });
    mobj.floorz = 0;
    mobj.ceilingz = (128 * F) | 0;

    const fits = thingHeightClip(mobj, mapData, blocklinks);
    expect(fits).toBe(true);
  });

  it('returns false when thing does not fit (crush)', () => {
    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: 0,
          ceilingheight: (40 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);
    const mobj = createMobj({ z: 0, height: (56 * F) | 0 });

    const fits = thingHeightClip(mobj, mapData, blocklinks);
    expect(fits).toBe(false);
  });

  it('thing on floor follows floor upward', () => {
    const mobj = createMobj({ z: 0, height: (56 * F) | 0 });
    mobj.floorz = 0;
    mobj.ceilingz = (128 * F) | 0;

    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: (32 * F) | 0,
          ceilingheight: (128 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);

    thingHeightClip(mobj, mapData, blocklinks);
    expect(mobj.z).toBe((32 * F) | 0);
    expect(mobj.floorz).toBe((32 * F) | 0);
  });

  it('thing on floor follows floor downward', () => {
    const mobj = createMobj({ z: (32 * F) | 0, height: (56 * F) | 0 });
    mobj.floorz = (32 * F) | 0;
    mobj.ceilingz = (128 * F) | 0;

    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: (16 * F) | 0,
          ceilingheight: (128 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);

    thingHeightClip(mobj, mapData, blocklinks);
    expect(mobj.z).toBe((16 * F) | 0);
  });

  it('floating thing clamped to ceiling when exceeding', () => {
    const mobj = createMobj({
      z: (100 * F) | 0,
      height: (56 * F) | 0,
    });
    mobj.floorz = 0;
    mobj.ceilingz = (200 * F) | 0;

    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: 0,
          ceilingheight: (120 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);

    thingHeightClip(mobj, mapData, blocklinks);
    expect(mobj.z).toBe(((120 - 56) * F) | 0);
    expect(mobj.ceilingz).toBe((120 * F) | 0);
  });

  it('floating thing not on floor stays put if below ceiling', () => {
    const mobj = createMobj({
      z: (50 * F) | 0,
      height: (56 * F) | 0,
    });
    mobj.floorz = 0;
    mobj.ceilingz = (200 * F) | 0;

    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: (10 * F) | 0,
          ceilingheight: (200 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);

    thingHeightClip(mobj, mapData, blocklinks);
    expect(mobj.z).toBe((50 * F) | 0);
    expect(mobj.floorz).toBe((10 * F) | 0);
  });

  it('updates ceilingz from sector', () => {
    const mobj = createMobj({ z: 0, height: (56 * F) | 0 });
    mobj.floorz = 0;
    mobj.ceilingz = (128 * F) | 0;

    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: 0,
          ceilingheight: (200 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);

    thingHeightClip(mobj, mapData, blocklinks);
    expect(mobj.ceilingz).toBe((200 * F) | 0);
  });
});

// ── changeSector ─────────────────────────────────────────────────────

describe('changeSector', () => {
  it('returns false when all things fit', () => {
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const rng = new DoomRandom();
    const thinkerList = new ThinkerList();

    const mobj = createMobj({
      z: 0,
      height: (56 * F) | 0,
      flags: MF_SOLID | MF_SHOOTABLE,
      health: 100,
    });
    thinkerList.add(mobj);
    placeInBlocklinks(mobj, blocklinks, 0);

    const nofit = changeSector(0, false, 0, mapData, blocklinks, rng, thinkerList);
    expect(nofit).toBe(false);
  });

  it('dead body converts to gibs', () => {
    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: 0,
          ceilingheight: (40 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);
    const rng = new DoomRandom();
    const thinkerList = new ThinkerList();

    const mobj = createMobj({
      z: 0,
      height: (56 * F) | 0,
      flags: MF_SOLID,
      health: 0,
    });
    thinkerList.add(mobj);
    placeInBlocklinks(mobj, blocklinks, 0);

    changeSector(0, false, 0, mapData, blocklinks, rng, thinkerList);

    expect(mobj.state).toBe(STATES[StateNum.GIBS]!);
    expect(mobj.height).toBe(0);
    expect(mobj.radius).toBe(0);
    expect(mobj.flags & MF_SOLID).toBe(0);
  });

  it('dead body with negative health converts to gibs', () => {
    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: 0,
          ceilingheight: (40 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);
    const rng = new DoomRandom();
    const thinkerList = new ThinkerList();

    const mobj = createMobj({
      z: 0,
      height: (56 * F) | 0,
      flags: MF_SOLID,
      health: -50,
    });
    thinkerList.add(mobj);
    placeInBlocklinks(mobj, blocklinks, 0);

    changeSector(0, false, 0, mapData, blocklinks, rng, thinkerList);
    expect(mobj.state).toBe(STATES[StateNum.GIBS]!);
    expect(mobj.height).toBe(0);
    expect(mobj.radius).toBe(0);
  });

  it('dropped item is removed when crushed', () => {
    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: 0,
          ceilingheight: (10 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);
    const rng = new DoomRandom();
    const thinkerList = new ThinkerList();

    const mobj = createMobj({
      z: 0,
      height: (16 * F) | 0,
      flags: MF_DROPPED,
      health: 1000,
    });
    thinkerList.add(mobj);
    placeInBlocklinks(mobj, blocklinks, 0);

    changeSector(0, false, 0, mapData, blocklinks, rng, thinkerList);
    expect(mobj.action).toBe(REMOVED);
  });

  it('non-shootable thing is ignored', () => {
    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: 0,
          ceilingheight: (10 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);
    const rng = new DoomRandom();
    const thinkerList = new ThinkerList();

    const mobj = createMobj({
      z: 0,
      height: (56 * F) | 0,
      flags: MF_SOLID,
      health: 100,
    });
    thinkerList.add(mobj);
    placeInBlocklinks(mobj, blocklinks, 0);

    const nofit = changeSector(0, false, 0, mapData, blocklinks, rng, thinkerList);
    expect(nofit).toBe(false);
  });

  it('living shootable thing sets nofit', () => {
    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: 0,
          ceilingheight: (40 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);
    const rng = new DoomRandom();
    const thinkerList = new ThinkerList();

    const mobj = createMobj({
      z: 0,
      height: (56 * F) | 0,
      flags: MF_SOLID | MF_SHOOTABLE,
      health: 100,
    });
    thinkerList.add(mobj);
    placeInBlocklinks(mobj, blocklinks, 0);

    const nofit = changeSector(0, true, 0, mapData, blocklinks, rng, thinkerList);
    expect(nofit).toBe(true);
  });

  it('crush damage fires when crunch=true and leveltime divisible by 4', () => {
    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: 0,
          ceilingheight: (40 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);
    const rng = new DoomRandom();
    const thinkerList = new ThinkerList();

    const mobj = createMobj({
      z: 0,
      height: (56 * F) | 0,
      flags: MF_SOLID | MF_SHOOTABLE,
      health: 100,
    });
    thinkerList.add(mobj);
    placeInBlocklinks(mobj, blocklinks, 0);

    let damageCalls = 0;
    let lastDamage = 0;
    const callbacks: ChangeSectorCallbacks = {
      damageMobj: (_target, _inflictor, _source, damage) => {
        damageCalls++;
        lastDamage = damage;
      },
    };

    changeSector(0, true, 0, mapData, blocklinks, rng, thinkerList, 'exe_doom_1_9', callbacks);
    expect(damageCalls).toBe(1);
    expect(lastDamage).toBe(10);
  });

  it('crush damage does not fire when leveltime & 3 is non-zero', () => {
    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: 0,
          ceilingheight: (40 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);
    const rng = new DoomRandom();
    const thinkerList = new ThinkerList();

    const mobj = createMobj({
      z: 0,
      height: (56 * F) | 0,
      flags: MF_SOLID | MF_SHOOTABLE,
      health: 100,
    });
    thinkerList.add(mobj);
    placeInBlocklinks(mobj, blocklinks, 0);

    let damageCalls = 0;
    const callbacks: ChangeSectorCallbacks = {
      damageMobj: () => {
        damageCalls++;
      },
    };

    changeSector(0, true, 1, mapData, blocklinks, rng, thinkerList, 'exe_doom_1_9', callbacks);
    expect(damageCalls).toBe(0);

    changeSector(0, true, 2, mapData, blocklinks, rng, thinkerList, 'exe_doom_1_9', callbacks);
    expect(damageCalls).toBe(0);

    changeSector(0, true, 3, mapData, blocklinks, rng, thinkerList, 'exe_doom_1_9', callbacks);
    expect(damageCalls).toBe(0);
  });

  it('crush damage does not fire when crunch=false', () => {
    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: 0,
          ceilingheight: (40 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);
    const rng = new DoomRandom();
    const thinkerList = new ThinkerList();

    const mobj = createMobj({
      z: 0,
      height: (56 * F) | 0,
      flags: MF_SOLID | MF_SHOOTABLE,
      health: 100,
    });
    thinkerList.add(mobj);
    placeInBlocklinks(mobj, blocklinks, 0);

    let damageCalls = 0;
    const callbacks: ChangeSectorCallbacks = {
      damageMobj: () => {
        damageCalls++;
      },
    };

    const result = changeSector(0, false, 0, mapData, blocklinks, rng, thinkerList, 'exe_doom_1_9', callbacks);
    expect(result).toBe(true);
    expect(damageCalls).toBe(0);
  });

  it('blood spawns at thing z + height/2', () => {
    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: 0,
          ceilingheight: (40 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);
    const rng = new DoomRandom();
    const thinkerList = new ThinkerList();

    const mobj = createMobj({
      x: (100 * F) | 0,
      y: (200 * F) | 0,
      z: (10 * F) | 0,
      height: (56 * F) | 0,
      flags: MF_SOLID | MF_SHOOTABLE,
      health: 100,
    });
    thinkerList.add(mobj);
    placeInBlocklinks(mobj, blocklinks, 0);

    changeSector(0, true, 0, mapData, blocklinks, rng, thinkerList);

    // Verify blood was spawned by checking thinker list has new entry
    let bloodFound = false;
    thinkerList.forEach((thinker) => {
      const obj = thinker as Mobj;
      if (obj.type === MobjType.BLOOD && obj !== mobj) {
        bloodFound = true;
        expect(obj.x).toBe((100 * F) | 0);
        expect(obj.y).toBe((200 * F) | 0);
      }
    });
    expect(bloodFound).toBe(true);
  });

  it('blood momentum uses pSubRandom << 12', () => {
    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: 0,
          ceilingheight: (40 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);
    const rng = new DoomRandom();
    const thinkerList = new ThinkerList();

    const mobj = createMobj({
      z: 0,
      height: (56 * F) | 0,
      flags: MF_SOLID | MF_SHOOTABLE,
      health: 100,
    });
    thinkerList.add(mobj);
    placeInBlocklinks(mobj, blocklinks, 0);

    changeSector(0, true, 0, mapData, blocklinks, rng, thinkerList);

    let blood: Mobj | null = null;
    thinkerList.forEach((thinker) => {
      const obj = thinker as Mobj;
      if (obj.type === MobjType.BLOOD && obj !== mobj) {
        blood = obj;
      }
    });
    expect(blood).not.toBeNull();
    // Blood momentum should be multiples of (1 << 12) = 4096
    // since it's pSubRandom() << 12
    expect(blood!.momx & 0xfff).toBe(0);
    expect(blood!.momy & 0xfff).toBe(0);
  });
});

// ── version-dependent behavior ───────────────────────────────────────

describe('version-dependent gibs', () => {
  it('exe_doom_1_2 does not clear MF_SOLID on gibs', () => {
    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: 0,
          ceilingheight: (40 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);
    const rng = new DoomRandom();
    const thinkerList = new ThinkerList();

    const mobj = createMobj({
      z: 0,
      height: (56 * F) | 0,
      flags: MF_SOLID,
      health: 0,
    });
    thinkerList.add(mobj);
    placeInBlocklinks(mobj, blocklinks, 0);

    changeSector(0, false, 0, mapData, blocklinks, rng, thinkerList, 'exe_doom_1_2');
    expect(mobj.flags & MF_SOLID).toBe(MF_SOLID);
  });

  it('exe_doom_1_9 clears MF_SOLID on gibs', () => {
    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: 0,
          ceilingheight: (40 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);
    const rng = new DoomRandom();
    const thinkerList = new ThinkerList();

    const mobj = createMobj({
      z: 0,
      height: (56 * F) | 0,
      flags: MF_SOLID,
      health: 0,
    });
    thinkerList.add(mobj);
    placeInBlocklinks(mobj, blocklinks, 0);

    changeSector(0, false, 0, mapData, blocklinks, rng, thinkerList, 'exe_doom_1_9');
    expect(mobj.flags & MF_SOLID).toBe(0);
  });
});

// ── parity-sensitive edge cases ──────────────────────────────────────

describe('parity-sensitive edge cases', () => {
  it('crush damage is exactly 10', () => {
    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: 0,
          ceilingheight: (40 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);
    const rng = new DoomRandom();
    const thinkerList = new ThinkerList();

    const mobj = createMobj({
      flags: MF_SOLID | MF_SHOOTABLE,
      health: 100,
      height: (56 * F) | 0,
    });
    thinkerList.add(mobj);
    placeInBlocklinks(mobj, blocklinks, 0);

    let receivedDamage = 0;
    const callbacks: ChangeSectorCallbacks = {
      damageMobj: (_target, _inflictor, _source, damage) => {
        receivedDamage = damage;
      },
    };

    changeSector(0, true, 0, mapData, blocklinks, rng, thinkerList, 'exe_doom_1_9', callbacks);
    expect(receivedDamage).toBe(10);
  });

  it('damageMobj receives null inflictor and null source', () => {
    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: 0,
          ceilingheight: (40 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);
    const rng = new DoomRandom();
    const thinkerList = new ThinkerList();

    const mobj = createMobj({
      flags: MF_SOLID | MF_SHOOTABLE,
      health: 100,
      height: (56 * F) | 0,
    });
    thinkerList.add(mobj);
    placeInBlocklinks(mobj, blocklinks, 0);

    let capturedInflictor: Mobj | null | undefined;
    let capturedSource: Mobj | null | undefined;
    const callbacks: ChangeSectorCallbacks = {
      damageMobj: (_target, inflictor, source, _damage) => {
        capturedInflictor = inflictor;
        capturedSource = source;
      },
    };

    changeSector(0, true, 0, mapData, blocklinks, rng, thinkerList, 'exe_doom_1_9', callbacks);
    expect(capturedInflictor).toBeNull();
    expect(capturedSource).toBeNull();
  });

  it('leveltime & 3 throttle: fires at 0, 4, 8; skips 1, 2, 3, 5, 6, 7', () => {
    const sectors = [
      {
        floorheight: 0,
        ceilingheight: (40 * F) | 0,
        floorpic: 'FLOOR4_8',
        ceilingpic: 'CEIL3_5',
        lightlevel: 160,
        special: 0,
        tag: 0,
      },
    ];

    let totalDamageCalls = 0;

    for (let time = 0; time < 12; time++) {
      const mapData = createTestMapData({ sectors });
      const blocklinks = createBlockThingsGrid(4, 4);
      const rng = new DoomRandom();
      const thinkerList = new ThinkerList();

      const mobj = createMobj({
        flags: MF_SOLID | MF_SHOOTABLE,
        health: 100,
        height: (56 * F) | 0,
      });
      thinkerList.add(mobj);
      placeInBlocklinks(mobj, blocklinks, 0);

      let fired = false;
      const callbacks: ChangeSectorCallbacks = {
        damageMobj: () => {
          fired = true;
        },
      };

      changeSector(0, true, time, mapData, blocklinks, rng, thinkerList, 'exe_doom_1_9', callbacks);
      if (fired) totalDamageCalls++;

      const expected = (time & 3) === 0;
      expect(fired).toBe(expected);
    }

    expect(totalDamageCalls).toBe(3);
  });

  it('health check takes priority over MF_DROPPED when both apply', () => {
    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: 0,
          ceilingheight: (10 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);
    const rng = new DoomRandom();
    const thinkerList = new ThinkerList();

    // Dead AND dropped - health check triggers first
    const mobj = createMobj({
      flags: MF_DROPPED,
      health: -10,
      height: (56 * F) | 0,
    });
    thinkerList.add(mobj);
    placeInBlocklinks(mobj, blocklinks, 0);

    changeSector(0, false, 0, mapData, blocklinks, rng, thinkerList);

    // Dead check triggers before MF_DROPPED (health <= 0 checked first)
    expect(mobj.state).toBe(STATES[StateNum.GIBS]!);
  });

  it('PIT_ChangeSector always returns true (never stops iteration)', () => {
    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: 0,
          ceilingheight: (10 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);
    const rng = new DoomRandom();
    const thinkerList = new ThinkerList();

    const mobj1 = createMobj({
      flags: MF_SOLID | MF_SHOOTABLE,
      health: 100,
      height: (56 * F) | 0,
    });
    const mobj2 = createMobj({
      flags: MF_SOLID | MF_SHOOTABLE,
      health: 100,
      height: (56 * F) | 0,
    });
    thinkerList.add(mobj1);
    thinkerList.add(mobj2);
    placeInBlocklinks(mobj1, blocklinks, 0);
    placeInBlocklinks(mobj2, blocklinks, 0);

    let damageCount = 0;
    const callbacks: ChangeSectorCallbacks = {
      damageMobj: () => {
        damageCount++;
      },
    };

    changeSector(0, true, 0, mapData, blocklinks, rng, thinkerList, 'exe_doom_1_9', callbacks);
    // Both things should be damaged (iteration not stopped)
    expect(damageCount).toBe(2);
  });

  it('dead body height and radius both zeroed', () => {
    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: 0,
          ceilingheight: (10 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);
    const rng = new DoomRandom();
    const thinkerList = new ThinkerList();

    const mobj = createMobj({
      height: (56 * F) | 0,
      radius: (20 * F) | 0,
      flags: MF_SOLID,
      health: 0,
    });
    thinkerList.add(mobj);
    placeInBlocklinks(mobj, blocklinks, 0);

    changeSector(0, false, 0, mapData, blocklinks, rng, thinkerList);
    expect(mobj.height).toBe(0);
    expect(mobj.radius).toBe(0);
  });

  it('no blood or damage without damageMobj callback', () => {
    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: 0,
          ceilingheight: (40 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);
    const rng = new DoomRandom();
    const thinkerList = new ThinkerList();

    const mobj = createMobj({
      flags: MF_SOLID | MF_SHOOTABLE,
      health: 100,
      height: (56 * F) | 0,
    });
    thinkerList.add(mobj);
    placeInBlocklinks(mobj, blocklinks, 0);

    // Should not throw even without callbacks
    const nofit = changeSector(0, true, 0, mapData, blocklinks, rng, thinkerList);
    expect(nofit).toBe(true);

    // Blood still spawns (only damageMobj is optional callback)
    let bloodCount = 0;
    thinkerList.forEach((thinker) => {
      if ((thinker as Mobj).type === MobjType.BLOOD) bloodCount++;
    });
    expect(bloodCount).toBe(1);
  });

  it('empty sector (no things in blockbox) returns false', () => {
    const mapData = createTestMapData();
    const blocklinks = createBlockThingsGrid(4, 4);
    const rng = new DoomRandom();
    const thinkerList = new ThinkerList();

    const nofit = changeSector(0, true, 0, mapData, blocklinks, rng, thinkerList);
    expect(nofit).toBe(false);
  });

  it('MF_NOCLIP thing still processed by thingHeightClip', () => {
    const mapData = createTestMapData({
      sectors: [
        {
          floorheight: (32 * F) | 0,
          ceilingheight: (128 * F) | 0,
          floorpic: 'FLOOR4_8',
          ceilingpic: 'CEIL3_5',
          lightlevel: 160,
          special: 0,
          tag: 0,
        },
      ],
    });
    const blocklinks = createBlockThingsGrid(4, 4);
    const rng = new DoomRandom();
    const thinkerList = new ThinkerList();

    const mobj = createMobj({
      z: 0,
      height: (56 * F) | 0,
      flags: MF_NOCLIP | MF_SOLID | MF_SHOOTABLE,
      health: 100,
    });
    mobj.floorz = 0;
    thinkerList.add(mobj);
    placeInBlocklinks(mobj, blocklinks, 0);

    changeSector(0, false, 0, mapData, blocklinks, rng, thinkerList);
    // MF_NOCLIP in checkPosition makes the thing always fit
    // so thingHeightClip should return true (thing "fits")
    // but floorz/ceilingz still updated from sector
    expect(mobj.floorz).toBe((32 * F) | 0);
    expect(mobj.z).toBe((32 * F) | 0);
  });
});
