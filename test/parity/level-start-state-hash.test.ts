import { describe, expect, it } from 'bun:test';

import { fileURLToPath } from 'node:url';

import { ANG45 } from '../../src/core/angle.ts';
import { FRACUNIT } from '../../src/core/fixed.ts';
import { DoomRandom } from '../../src/core/rng.ts';
import { parseMapBundle } from '../../src/map/mapBundle.ts';
import { setupLevel } from '../../src/map/mapSetup.ts';
import { sectorIndexAt } from '../../src/map/subsectorQuery.ts';
import { MTF_AMBUSH, MTF_EASY, MTF_HARD, MTF_NORMAL, MTF_NOT_SINGLE } from '../../src/map/things.ts';
import { REFERENCE_RUN_MANIFEST } from '../../src/oracles/referenceRunManifest.ts';
import type { StateHashComponent } from '../../src/oracles/stateHash.ts';
import { STATE_HASH_COMPONENTS } from '../../src/oracles/stateHash.ts';
import { createPlayer, playerReborn, setupPsprites } from '../../src/player/playerSpawn.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { createAutomapState } from '../../src/ui/automap.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { MF_AMBUSH, MF_SPAWNCEILING, MOBJINFO, Mobj, MobjType, ONCEILINGZ, ONFLOORZ, STATES, spawnMobj } from '../../src/world/mobj.ts';
import { ThinkerList } from '../../src/world/thinkers.ts';
import { VIEWHEIGHT } from '../../src/world/zMovement.ts';

const INDIVIDUAL_LEVEL_START_COMPONENTS = Object.freeze(['automap', 'player', 'rng', 'sectors', 'thinkers'] as const);
const SHAREWARE_MAP_NAMES = Object.freeze(['E1M1', 'E1M2', 'E1M3', 'E1M4', 'E1M5', 'E1M6', 'E1M7', 'E1M8', 'E1M9'] as const);

type IndividualLevelStartComponent = (typeof INDIVIDUAL_LEVEL_START_COMPONENTS)[number];
type SharewareMapName = (typeof SHAREWARE_MAP_NAMES)[number];

interface LevelStartHashFixtureEntry {
  readonly hashes: Readonly<Record<StateHashComponent, string>>;
  readonly prndindex: number;
  readonly thinkerCount: number;
}

interface LevelStartHashFixture {
  readonly components: readonly StateHashComponent[];
  readonly description: string;
  readonly maps: Readonly<Record<SharewareMapName, LevelStartHashFixtureEntry>>;
  readonly skill: number;
  readonly tic: number;
}

interface LinedefSnapshot {
  readonly flags: number;
  readonly sidenum0: number;
  readonly sidenum1: number;
  readonly special: number;
  readonly tag: number;
}

interface PlayerSnapshot {
  readonly ammo: readonly number[];
  readonly armorpoints: number;
  readonly armortype: number;
  readonly attackdown: boolean;
  readonly attackerIndex: null;
  readonly backpack: boolean;
  readonly bob: number;
  readonly bonuscount: number;
  readonly cards: readonly boolean[];
  readonly cheats: number;
  readonly cmd: {
    readonly angleturn: number;
    readonly buttons: number;
    readonly chatchar: number;
    readonly consistancy: number;
    readonly forwardmove: number;
    readonly sidemove: number;
  };
  readonly colormap: number;
  readonly damagecount: number;
  readonly deltaviewheight: number;
  readonly didsecret: boolean;
  readonly extralight: number;
  readonly fixedcolormap: number;
  readonly frags: readonly number[];
  readonly health: number;
  readonly itemcount: number;
  readonly killcount: number;
  readonly maxammo: readonly number[];
  readonly message: string | null;
  readonly moIndex: number;
  readonly pendingweapon: number;
  readonly playerstate: number;
  readonly powers: readonly number[];
  readonly psprites: readonly PspriteSnapshot[];
  readonly readyweapon: number;
  readonly refire: number;
  readonly secretcount: number;
  readonly usedown: boolean;
  readonly viewheight: number;
  readonly viewz: number;
  readonly weaponowned: readonly boolean[];
}

interface PspriteSnapshot {
  readonly stateIndex: number | null;
  readonly sx: number;
  readonly sy: number;
  readonly tics: number;
}

interface RngSnapshot {
  readonly prndindex: number;
  readonly rndindex: number;
}

interface SectorSnapshot {
  readonly ceilingheight: number;
  readonly ceilingpic: string;
  readonly floorheight: number;
  readonly floorpic: string;
  readonly lightlevel: number;
  readonly special: number;
  readonly tag: number;
}

interface SectorsSnapshot {
  readonly linedefs: readonly LinedefSnapshot[];
  readonly sectors: readonly SectorSnapshot[];
  readonly sidedefs: readonly SidedefSnapshot[];
}

interface SidedefSnapshot {
  readonly bottomtexture: string;
  readonly midtexture: string;
  readonly rowoffset: number;
  readonly sector: number;
  readonly textureoffset: number;
  readonly toptexture: string;
}

interface ThinkerSnapshot {
  readonly angle: number;
  readonly ceilingz: number;
  readonly flags: number;
  readonly floorz: number;
  readonly frame: number;
  readonly health: number;
  readonly height: number;
  readonly lastlook: number;
  readonly momx: number;
  readonly momy: number;
  readonly momz: number;
  readonly movecount: number;
  readonly movedir: number;
  readonly playerSlot: number | null;
  readonly radius: number;
  readonly reactiontime: number;
  readonly sectorIndex: number;
  readonly spawnpoint: {
    readonly angle: number;
    readonly options: number;
    readonly type: number;
    readonly x: number;
    readonly y: number;
  };
  readonly sprite: number;
  readonly stateIndex: number | null;
  readonly targetIndex: null;
  readonly threshold: number;
  readonly tics: number;
  readonly tracerIndex: null;
  readonly type: number;
  readonly validcount: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface LevelStartSnapshot {
  readonly automap: ReturnType<typeof createAutomapState>;
  readonly player: PlayerSnapshot;
  readonly rng: RngSnapshot;
  readonly sectors: SectorsSnapshot;
  readonly thinkers: readonly ThinkerSnapshot[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseFixtureHash(name: string, value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9A-F]{64}$/.test(value)) {
    throw new TypeError(`${name} must be a 64-character upper-case SHA-256 hex string.`);
  }

  return value;
}

function parseFixtureEntry(value: unknown, mapName: SharewareMapName): LevelStartHashFixtureEntry {
  if (!isRecord(value)) {
    throw new TypeError(`${mapName} fixture entry must be an object.`);
  }

  return {
    hashes: {
      automap: parseFixtureHash(`${mapName}.hashes.automap`, value.hashes && isRecord(value.hashes) ? value.hashes.automap : undefined),
      combined: parseFixtureHash(`${mapName}.hashes.combined`, value.hashes && isRecord(value.hashes) ? value.hashes.combined : undefined),
      player: parseFixtureHash(`${mapName}.hashes.player`, value.hashes && isRecord(value.hashes) ? value.hashes.player : undefined),
      rng: parseFixtureHash(`${mapName}.hashes.rng`, value.hashes && isRecord(value.hashes) ? value.hashes.rng : undefined),
      sectors: parseFixtureHash(`${mapName}.hashes.sectors`, value.hashes && isRecord(value.hashes) ? value.hashes.sectors : undefined),
      thinkers: parseFixtureHash(`${mapName}.hashes.thinkers`, value.hashes && isRecord(value.hashes) ? value.hashes.thinkers : undefined),
    },
    prndindex: parseFixtureInteger(`${mapName}.prndindex`, value.prndindex),
    thinkerCount: parseFixtureInteger(`${mapName}.thinkerCount`, value.thinkerCount),
  };
}

function parseFixtureInteger(name: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new TypeError(`${name} must be an integer.`);
  }

  return value;
}

function parseLevelStartHashFixture(value: unknown): LevelStartHashFixture {
  if (!isRecord(value)) {
    throw new TypeError('Level-start hash fixture must be an object.');
  }

  if (typeof value.description !== 'string' || value.description.length === 0) {
    throw new TypeError('Level-start hash fixture description must be a non-empty string.');
  }

  if (!Array.isArray(value.components) || value.components.length !== STATE_HASH_COMPONENTS.length) {
    throw new TypeError('Level-start hash fixture components must match STATE_HASH_COMPONENTS.');
  }

  for (let componentIndex = 0; componentIndex < STATE_HASH_COMPONENTS.length; componentIndex += 1) {
    if (value.components[componentIndex] !== STATE_HASH_COMPONENTS[componentIndex]) {
      throw new TypeError('Level-start hash fixture components must match STATE_HASH_COMPONENTS in order.');
    }
  }

  if (!isRecord(value.maps)) {
    throw new TypeError('Level-start hash fixture maps must be an object.');
  }

  return {
    components: [...STATE_HASH_COMPONENTS],
    description: value.description,
    maps: {
      E1M1: parseFixtureEntry(value.maps.E1M1, 'E1M1'),
      E1M2: parseFixtureEntry(value.maps.E1M2, 'E1M2'),
      E1M3: parseFixtureEntry(value.maps.E1M3, 'E1M3'),
      E1M4: parseFixtureEntry(value.maps.E1M4, 'E1M4'),
      E1M5: parseFixtureEntry(value.maps.E1M5, 'E1M5'),
      E1M6: parseFixtureEntry(value.maps.E1M6, 'E1M6'),
      E1M7: parseFixtureEntry(value.maps.E1M7, 'E1M7'),
      E1M8: parseFixtureEntry(value.maps.E1M8, 'E1M8'),
      E1M9: parseFixtureEntry(value.maps.E1M9, 'E1M9'),
    },
    skill: parseFixtureInteger('skill', value.skill),
    tic: parseFixtureInteger('tic', value.tic),
  };
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`;
  }

  if (isRecord(value)) {
    const sortedEntries = Object.entries(value).sort(([leftKey], [rightKey]) => {
      if (leftKey < rightKey) return -1;
      if (leftKey > rightKey) return 1;
      return 0;
    });
    return `{${sortedEntries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

function sha256Hex(value: string): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex').toUpperCase();
}

function findMapObjectType(doomednum: number): MobjType | null {
  for (let mapObjectType = 0; mapObjectType < MOBJINFO.length; mapObjectType += 1) {
    if (MOBJINFO[mapObjectType]!.doomednum === doomednum) {
      return mapObjectType;
    }
  }

  return null;
}

function findStateIndex(state: (typeof STATES)[number] | null): number | null {
  if (state === null) {
    return null;
  }

  const stateIndex = STATES.indexOf(state);

  if (stateIndex < 0) {
    throw new RangeError('State table entry is missing from STATES.');
  }

  return stateIndex;
}

function skillFlagForGameskill(gameskill: number): number {
  if (gameskill <= 1) {
    return MTF_EASY;
  }

  if (gameskill === 2) {
    return MTF_NORMAL;
  }

  return MTF_HARD;
}

function hashLevelStartSnapshot(snapshot: LevelStartSnapshot): LevelStartHashFixtureEntry {
  const hashes: Record<IndividualLevelStartComponent, string> = {
    automap: sha256Hex(stableSerialize(snapshot.automap)),
    player: sha256Hex(stableSerialize(snapshot.player)),
    rng: sha256Hex(stableSerialize(snapshot.rng)),
    sectors: sha256Hex(stableSerialize(snapshot.sectors)),
    thinkers: sha256Hex(stableSerialize(snapshot.thinkers)),
  };

  return {
    hashes: {
      automap: hashes.automap,
      combined: sha256Hex(INDIVIDUAL_LEVEL_START_COMPONENTS.map((component) => hashes[component]).join('')),
      player: hashes.player,
      rng: hashes.rng,
      sectors: hashes.sectors,
      thinkers: hashes.thinkers,
    },
    prndindex: snapshot.rng.prndindex,
    thinkerCount: snapshot.thinkers.length,
  };
}

function buildLevelStartSnapshot(mapName: SharewareMapName, gameskill: number): LevelStartSnapshot {
  const mapData = setupLevel(parseMapBundle(wadDirectory, wadBuffer, mapName));
  const mutableSectors = mapData.sectors.map((sector) => ({
    ceilingheight: sector.ceilingheight,
    ceilingpic: sector.ceilingpic,
    floorheight: sector.floorheight,
    floorpic: sector.floorpic,
    lightlevel: sector.lightlevel,
    special: sector.special,
    tag: sector.tag,
  }));
  const mutableLinedefs = mapData.linedefs.map((linedef) => ({
    flags: linedef.flags,
    sidenum0: linedef.sidenum0,
    sidenum1: linedef.sidenum1,
    special: linedef.special,
    tag: linedef.tag,
  }));
  const thinkerList = new ThinkerList();
  const doomRandom = new DoomRandom();
  const player = createPlayer();
  const skillFlag = skillFlagForGameskill(gameskill);

  doomRandom.clearRandom();
  playerReborn(player);

  let playerSpawned = false;

  for (const mapThing of mapData.things) {
    if (mapThing.type === 1) {
      if (REFERENCE_RUN_MANIFEST.startup.playerCount > 0 && !playerSpawned) {
        const playerMapObject = spawnMapThing(mapThing, MobjType.PLAYER, mapData, mutableSectors, thinkerList, doomRandom, gameskill);
        playerMapObject.player = player;
        player.health = playerMapObject.health;
        player.mo = playerMapObject;
        player.viewheight = VIEWHEIGHT;
        player.deltaviewheight = 0;
        player.viewz = (playerMapObject.z + player.viewheight) | 0;
        setupPsprites(player);
        playerSpawned = true;
      }
      continue;
    }

    if (mapThing.type >= 2 && mapThing.type <= 4) {
      continue;
    }

    if (mapThing.type === 11) {
      continue;
    }

    if ((mapThing.options & MTF_NOT_SINGLE) !== 0) {
      continue;
    }

    if ((mapThing.options & skillFlag) === 0) {
      continue;
    }

    const mapObjectType = findMapObjectType(mapThing.type);

    if (mapObjectType === null) {
      throw new RangeError(`No map object type exists for doomednum ${mapThing.type}.`);
    }

    void spawnMapThing(mapThing, mapObjectType, mapData, mutableSectors, thinkerList, doomRandom, gameskill);
  }

  if (!playerSpawned || player.mo === null) {
    throw new Error(`Player 1 start was not spawned for ${mapName}.`);
  }

  const thinkerSnapshots: ThinkerSnapshot[] = [];

  thinkerList.forEach((thinker) => {
    if (!(thinker instanceof Mobj)) {
      throw new Error(`Unexpected non-mobj thinker in ${mapName}: ${thinker.constructor.name}.`);
    }

    thinkerSnapshots.push(snapshotThinker(thinker, player, mapData));
  });

  return {
    automap: createAutomapState(),
    player: {
      ammo: [...player.ammo],
      armorpoints: player.armorpoints,
      armortype: player.armortype,
      attackdown: player.attackdown,
      attackerIndex: null,
      backpack: player.backpack,
      bob: player.bob,
      bonuscount: player.bonuscount,
      cards: [...player.cards],
      cheats: player.cheats,
      cmd: {
        angleturn: player.cmd.angleturn,
        buttons: player.cmd.buttons,
        chatchar: player.cmd.chatchar,
        consistancy: player.cmd.consistancy,
        forwardmove: player.cmd.forwardmove,
        sidemove: player.cmd.sidemove,
      },
      colormap: player.colormap,
      damagecount: player.damagecount,
      deltaviewheight: player.deltaviewheight,
      didsecret: player.didsecret,
      extralight: player.extralight,
      fixedcolormap: player.fixedcolormap,
      frags: [...player.frags],
      health: player.health,
      itemcount: player.itemcount,
      killcount: player.killcount,
      maxammo: [...player.maxammo],
      message: player.message,
      moIndex: thinkerSnapshots.findIndex((thinkerSnapshot) => thinkerSnapshot.playerSlot === 0),
      pendingweapon: player.pendingweapon,
      playerstate: player.playerstate,
      powers: [...player.powers],
      psprites: player.psprites.map((playerSprite) => ({
        stateIndex: findStateIndex(playerSprite.state),
        sx: playerSprite.sx,
        sy: playerSprite.sy,
        tics: playerSprite.tics,
      })),
      readyweapon: player.readyweapon,
      refire: player.refire,
      secretcount: player.secretcount,
      usedown: player.usedown,
      viewheight: player.viewheight,
      viewz: player.viewz,
      weaponowned: [...player.weaponowned],
    },
    rng: {
      prndindex: doomRandom.prndindex,
      rndindex: doomRandom.rndindex,
    },
    sectors: {
      linedefs: mutableLinedefs,
      sectors: mutableSectors,
      sidedefs: mapData.sidedefs.map((sidedef) => ({
        bottomtexture: sidedef.bottomtexture,
        midtexture: sidedef.midtexture,
        rowoffset: sidedef.rowoffset,
        sector: sidedef.sector,
        textureoffset: sidedef.textureoffset,
        toptexture: sidedef.toptexture,
      })),
    },
    thinkers: thinkerSnapshots,
  };
}

function snapshotThinker(thinker: Mobj, player: ReturnType<typeof createPlayer>, mapData: ReturnType<typeof setupLevel>): ThinkerSnapshot {
  return {
    angle: thinker.angle >>> 0,
    ceilingz: thinker.ceilingz,
    flags: thinker.flags >>> 0,
    floorz: thinker.floorz,
    frame: thinker.frame,
    health: thinker.health,
    height: thinker.height,
    lastlook: thinker.lastlook,
    momx: thinker.momx,
    momy: thinker.momy,
    momz: thinker.momz,
    movecount: thinker.movecount,
    movedir: thinker.movedir,
    playerSlot: thinker.player === player ? 0 : null,
    radius: thinker.radius,
    reactiontime: thinker.reactiontime,
    sectorIndex: sectorIndexAt(thinker.x, thinker.y, mapData.nodes, mapData.subsectorSectors),
    spawnpoint: {
      angle: thinker.spawnpoint.angle,
      options: thinker.spawnpoint.options,
      type: thinker.spawnpoint.type,
      x: thinker.spawnpoint.x,
      y: thinker.spawnpoint.y,
    },
    sprite: thinker.sprite,
    stateIndex: findStateIndex(thinker.state),
    targetIndex: null,
    threshold: thinker.threshold,
    tics: thinker.tics,
    tracerIndex: null,
    type: thinker.type,
    validcount: thinker.validcount,
    x: thinker.x,
    y: thinker.y,
    z: thinker.z,
  };
}

function spawnMapThing(
  mapThing: {
    readonly angle: number;
    readonly options: number;
    readonly type: number;
    readonly x: number;
    readonly y: number;
  },
  mapObjectType: MobjType,
  mapData: ReturnType<typeof setupLevel>,
  mutableSectors: readonly SectorSnapshot[],
  thinkerList: ThinkerList,
  doomRandom: DoomRandom,
  gameskill: number,
): Mobj {
  const mapX = mapThing.x * FRACUNIT;
  const mapY = mapThing.y * FRACUNIT;
  const sectorIndex = sectorIndexAt(mapX, mapY, mapData.nodes, mapData.subsectorSectors);
  const sector = mutableSectors[sectorIndex]!;
  const mapObjectInfo = MOBJINFO[mapObjectType]!;
  const spawnZ = (mapObjectInfo.flags & MF_SPAWNCEILING) !== 0 ? ONCEILINGZ : ONFLOORZ;
  const mapObject = spawnMobj(mapX, mapY, spawnZ, mapObjectType, doomRandom, thinkerList, gameskill);

  mapObject.subsector = {
    sector: {
      ceilingheight: sector.ceilingheight,
      floorheight: sector.floorheight,
    },
  };
  mapObject.floorz = sector.floorheight;
  mapObject.ceilingz = sector.ceilingheight;
  mapObject.z = spawnZ === ONCEILINGZ ? (sector.ceilingheight - mapObject.height) | 0 : sector.floorheight;
  mapObject.angle = (((mapThing.angle / 45) | 0) * ANG45) >>> 0;
  mapObject.spawnpoint = {
    angle: mapThing.angle,
    options: mapThing.options,
    type: mapThing.type,
    x: mapThing.x,
    y: mapThing.y,
  };

  if ((mapThing.options & MTF_AMBUSH) !== 0) {
    mapObject.flags |= MF_AMBUSH;
  }

  return mapObject;
}

const fixturePath = fileURLToPath(new URL('./fixtures/levelStartHashes.json', import.meta.url));
const levelStartHashFixture = parseLevelStartHashFixture(await Bun.file(fixturePath).json());
const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const wadHeader = parseWadHeader(wadBuffer);
const wadDirectory = parseWadDirectory(wadBuffer, wadHeader);

describe('level-start state hash fixture', () => {
  it('uses the canonical state-hash component list and the reference startup skill', () => {
    expect(levelStartHashFixture.components).toEqual(STATE_HASH_COMPONENTS);
    expect(levelStartHashFixture.skill).toBe(REFERENCE_RUN_MANIFEST.startup.skill);
    expect(levelStartHashFixture.tic).toBe(0);
  });

  it('stores combined hashes derived from the individual component hashes in ASCII order', () => {
    for (const mapName of SHAREWARE_MAP_NAMES) {
      const fixtureEntry = levelStartHashFixture.maps[mapName];
      const combinedHash = sha256Hex(INDIVIDUAL_LEVEL_START_COMPONENTS.map((component) => fixtureEntry.hashes[component]).join(''));
      expect(fixtureEntry.hashes.combined).toBe(combinedHash);
    }
  });
});

describe('level-start state hashes', () => {
  it('match the shareware E1 tic-0 fixture for the reference startup skill', () => {
    for (const mapName of SHAREWARE_MAP_NAMES) {
      expect(hashLevelStartSnapshot(buildLevelStartSnapshot(mapName, levelStartHashFixture.skill))).toEqual(levelStartHashFixture.maps[mapName]);
    }
  });
});

describe('parity-sensitive edge cases', () => {
  it('changes the sectors hash when a sector special or linedef special changes', () => {
    const baselineSnapshot = buildLevelStartSnapshot('E1M1', levelStartHashFixture.skill);
    const baselineHash = hashLevelStartSnapshot(baselineSnapshot).hashes.sectors;
    const sectorIndex = baselineSnapshot.sectors.sectors.findIndex((sector) => sector.special !== 0);
    const linedefIndex = baselineSnapshot.sectors.linedefs.findIndex((linedef) => linedef.special !== 0);

    expect(sectorIndex).toBeGreaterThanOrEqual(0);
    expect(linedefIndex).toBeGreaterThanOrEqual(0);

    const sectorMutatedSnapshot: LevelStartSnapshot = {
      ...baselineSnapshot,
      sectors: {
        ...baselineSnapshot.sectors,
        sectors: baselineSnapshot.sectors.sectors.map((sector, index) => {
          if (index !== sectorIndex) {
            return sector;
          }

          return {
            ...sector,
            special: sector.special + 1,
          };
        }),
      },
    };
    const linedefMutatedSnapshot: LevelStartSnapshot = {
      ...baselineSnapshot,
      sectors: {
        ...baselineSnapshot.sectors,
        linedefs: baselineSnapshot.sectors.linedefs.map((linedef, index) => {
          if (index !== linedefIndex) {
            return linedef;
          }

          return {
            ...linedef,
            special: linedef.special + 1,
          };
        }),
      },
    };

    expect(hashLevelStartSnapshot(sectorMutatedSnapshot).hashes.sectors).not.toBe(baselineHash);
    expect(hashLevelStartSnapshot(linedefMutatedSnapshot).hashes.sectors).not.toBe(baselineHash);
  });

  it('changes the thinker and RNG hashes when skill filtering changes the spawn population', () => {
    const easySnapshot = buildLevelStartSnapshot('E1M1', 1);
    const normalSnapshot = buildLevelStartSnapshot('E1M1', levelStartHashFixture.skill);
    const easyHashes = hashLevelStartSnapshot(easySnapshot);
    const normalHashes = hashLevelStartSnapshot(normalSnapshot);

    expect(easyHashes.hashes.automap).toBe(normalHashes.hashes.automap);
    expect(easyHashes.hashes.player).toBe(normalHashes.hashes.player);
    expect(easyHashes.hashes.rng).not.toBe(normalHashes.hashes.rng);
    expect(easyHashes.hashes.thinkers).not.toBe(normalHashes.hashes.thinkers);
    expect(easyHashes.thinkerCount).toBeLessThan(normalHashes.thinkerCount);
  });
});
