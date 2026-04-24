import { describe, expect, test } from 'bun:test';

import { CeilingDirection, CeilingType, MAXCEILINGS } from '../../src/specials/ceilings.ts';
import type { ActiveCeilingsSnapshot, ActivePlatsSnapshot, ButtonListSnapshot } from '../../src/specials/activeSpecials.ts';
import { DoorDirection, VerticalDoorType } from '../../src/specials/doors.ts';
import { FloorDirection, FloorType } from '../../src/specials/floors.ts';
import { MAXPLATS, PlatStatus, PlatType } from '../../src/specials/platforms.ts';
import { MAXBUTTONS } from '../../src/specials/switches.ts';
import type { SaveGameMobj, SaveGamePlayer, SaveGamePlayerArchive, SaveGameSide, SaveGameWorld } from '../../src/save/coreSerialization';
import type { SaveGameHeader } from '../../src/save/saveHeader';
import type { SaveGameSpecialArchive, SaveGameSpecialThinker } from '../../src/save/specialSerialization.ts';
import { writeArchivedMobjs, writeArchivedPlayers, writeArchivedWorld } from '../../src/save/coreSerialization';
import { readLoadGame, SAVEGAME_EOF } from '../../src/save/loadgame.ts';
import { SAVEGAME_HEADER_SIZE, writeSaveGameHeader } from '../../src/save/saveHeader';
import { writeArchivedSpecials } from '../../src/save/specialSerialization.ts';

const FRACUNIT = 1 << 16;

const BASE_HEADER = {
  description: 'E1M1 SAVE',
  gameepisode: 1,
  gamemap: 1,
  gameskill: 2,
  leveltime: 0x12_34_56,
  playeringame: [1, 0, 0, 0] as const,
} satisfies SaveGameHeader;

const BASE_SIDE = {
  bottomtexture: 12,
  midtexture: 34,
  rowoffset: -4 * FRACUNIT,
  textureoffset: 3 * FRACUNIT,
  toptexture: 56,
} satisfies SaveGameSide;

const BASE_MOBJ = {
  angle: 0x1234_5678,
  blockNextPointer: 0x1111_2222,
  blockPreviousPointer: 0x3333_4444,
  ceilingz: 12 * FRACUNIT,
  flags: 0x1357_9bdf,
  floorz: -2 * FRACUNIT,
  frame: 7,
  health: 88,
  height: 41 * FRACUNIT,
  infoPointer: 0x5555_6666,
  lastlook: 3,
  momx: 0x0100,
  momy: -0x0200,
  momz: 0x0300,
  moveCount: 9,
  moveDirection: 4,
  playerSlot: 1,
  radius: 16 * FRACUNIT,
  reactiontime: 12,
  sectorNextPointer: 0x7777_8888,
  sectorPreviousPointer: 0x9999_aaaa,
  spawnpoint: {
    angle: 90,
    options: 7,
    type: 3004,
    x: -128,
    y: 256,
  },
  sprite: 23,
  stateIndex: 456,
  subsectorPointer: 0xbbbb_cccc,
  targetPointer: 0xdddd_eeee,
  thinker: {
    functionPointer: 0x0123_4567,
    nextPointer: 0x89ab_cdef,
    previousPointer: 0xfedc_ba98,
  },
  threshold: 45,
  tics: 11,
  tracerPointer: 0x0fed_cba9,
  type: 15,
  validcount: 77,
  x: 10 * FRACUNIT,
  y: -20 * FRACUNIT,
  z: 30 * FRACUNIT,
} satisfies SaveGameMobj;

const BASE_PLAYER = {
  ammo: [50, 10, 20, 300],
  armorpoints: 100,
  armortype: 2,
  attackdown: 1,
  attackerPointer: 0xaabb_ccdd,
  backpack: 1,
  bob: FRACUNIT / 2,
  bonuscount: 3,
  cards: [1, 0, 1, 0, 1, 0],
  cheats: 0x40,
  colormap: 3,
  damagecount: 4,
  deltaviewheight: -0x0100,
  didsecret: 1,
  extralight: 2,
  fixedcolormap: 5,
  frags: [0, 1, 2, 3],
  health: 75,
  itemcount: 6,
  killcount: 7,
  maxammo: [200, 50, 300, 600],
  messagePointer: 0x0102_0304,
  mobjPointer: 0x0a0b_0c0d,
  pendingweapon: 4,
  playerstate: 2,
  powers: [0, 1, 2, 3, 4, 5],
  psprites: [
    {
      stateIndex: 10,
      sx: 0x12_0000,
      sy: 0x34_0000,
      tics: 7,
    },
    {
      stateIndex: null,
      sx: -0x08_0000,
      sy: 0x09_0000,
      tics: 0,
    },
  ],
  readyweapon: 3,
  refire: 8,
  secretcount: 9,
  ticcmd: {
    angleturn: -1024,
    buttons: 0xaa,
    chatchar: 0x55,
    consistancy: 0x1234,
    forwardmove: -12,
    sidemove: 11,
  },
  usedown: 1,
  viewheight: 41 * FRACUNIT,
  viewz: 48 * FRACUNIT,
  weaponowned: [1, 1, 1, 0, 0, 1, 0, 1, 0],
} satisfies SaveGamePlayer;

const BASE_PLAYER_ARCHIVE = {
  playeringame: [1, 0, 0, 0],
  players: [BASE_PLAYER, null, null, null],
} satisfies SaveGamePlayerArchive;

const BASE_WORLD = {
  lines: [
    {
      flags: 0x1234,
      sides: [BASE_SIDE, null],
      sidenum: [0, -1],
      special: 9,
      tag: 11,
    },
  ],
  sectors: [
    {
      ceilingheight: 8 * FRACUNIT,
      ceilingpic: 22,
      floorheight: -2 * FRACUNIT,
      floorpic: 21,
      lightlevel: 160,
      special: 5,
      tag: 99,
    },
  ],
} satisfies SaveGameWorld;

const BASE_THINKER = Object.freeze({
  functionPointer: 0x0102_0304,
  nextPointer: 0x0506_0708,
  previousPointer: 0x0a0b_0c0d,
});

const ACTIVE_PLATS = Array.from({ length: MAXPLATS }, () => null) as ActivePlatsSnapshot[number][];
ACTIVE_PLATS[3] = Object.freeze({
  count: 11,
  crush: true,
  high: 64 << 16,
  inStasis: false,
  low: 8 << 16,
  oldstatus: PlatStatus.waiting,
  sectorIndex: 5,
  speed: 2 << 16,
  status: PlatStatus.up,
  tag: 99,
  type: PlatType.raiseAndChange,
  wait: 35,
});

const ACTIVE_CEILINGS = Array.from({ length: MAXCEILINGS }, () => null) as ActiveCeilingsSnapshot[number][];
ACTIVE_CEILINGS[2] = Object.freeze({
  bottomheight: 16 << 16,
  crush: true,
  direction: CeilingDirection.down,
  inStasis: false,
  olddirection: CeilingDirection.up,
  sectorIndex: 7,
  speed: 1 << 16,
  tag: 77,
  topheight: 80 << 16,
  type: CeilingType.crushAndRaise,
});

const BUTTONS = Array.from({ length: MAXBUTTONS }, () => null) as ButtonListSnapshot[number][];
BUTTONS[1] = Object.freeze({
  btexture: 123,
  btimer: 17,
  lineIndex: 4,
  sideIndex: -1,
  soundorgIndex: 9,
  where: 2,
});

const BASE_SPECIAL_ARCHIVE = Object.freeze({
  activeCeilings: Object.freeze(ACTIVE_CEILINGS) as ActiveCeilingsSnapshot,
  activePlats: Object.freeze(ACTIVE_PLATS) as ActivePlatsSnapshot,
  buttons: Object.freeze(BUTTONS) as ButtonListSnapshot,
  thinkers: Object.freeze([
    Object.freeze({
      kind: 'ceiling',
      slotIndex: 2,
    }),
    Object.freeze({
      direction: DoorDirection.waiting,
      kind: 'door',
      sectorIndex: 8,
      speed: 2 << 16,
      thinker: BASE_THINKER,
      topcountdown: 149,
      topheight: 96 << 16,
      topwait: 150,
      type: VerticalDoorType.close30ThenOpen,
    }),
    Object.freeze({
      crush: true,
      direction: FloorDirection.down,
      floordestheight: 12 << 16,
      kind: 'floor',
      newspecial: 31,
      sectorIndex: 6,
      speed: 4 << 16,
      texture: 0x2345,
      thinker: BASE_THINKER,
      type: FloorType.raiseFloorCrush,
    }),
    Object.freeze({
      kind: 'plat',
      slotIndex: 3,
    }),
    Object.freeze({
      count: 33,
      kind: 'flash',
      maxlight: 255,
      maxtime: 64,
      minlight: 96,
      mintime: 7,
      sectorIndex: 1,
      thinker: BASE_THINKER,
    }),
    Object.freeze({
      brighttime: 17,
      count: 21,
      darktime: 35,
      kind: 'strobe',
      maxlight: 255,
      minlight: 32,
      sectorIndex: 10,
      thinker: BASE_THINKER,
    }),
    Object.freeze({
      direction: -1,
      kind: 'glow',
      maxlight: 200,
      minlight: 80,
      sectorIndex: 12,
      thinker: BASE_THINKER,
    }),
  ]) as readonly SaveGameSpecialThinker[],
}) satisfies SaveGameSpecialArchive;

const LOADGAME_LAYOUT = Object.freeze({
  worldLayout: {
    lines: [{ sidenum: [0, -1] as const }],
    sectorCount: 1,
  },
});

function createLoadGameBytes(startOffset = 0): Uint8Array {
  const headerBytes = writeSaveGameHeader(BASE_HEADER);
  const playersOffset = startOffset + SAVEGAME_HEADER_SIZE;
  const playersBytes = writeArchivedPlayers(BASE_PLAYER_ARCHIVE, playersOffset);
  const worldOffset = playersOffset + playersBytes.length;
  const worldBytes = writeArchivedWorld(BASE_WORLD);
  const mobjsOffset = worldOffset + worldBytes.length;
  const mobjsBytes = writeArchivedMobjs([BASE_MOBJ], mobjsOffset);
  const specialsOffset = mobjsOffset + mobjsBytes.length;
  const specialsBytes = writeArchivedSpecials(BASE_SPECIAL_ARCHIVE, specialsOffset);

  return Uint8Array.from([...headerBytes, ...playersBytes, ...worldBytes, ...mobjsBytes, ...specialsBytes, SAVEGAME_EOF]);
}

describe('SAVEGAME_EOF', () => {
  test('pins the canonical savegame end marker', () => {
    expect(SAVEGAME_EOF).toBe(0x1d);
  });
});

describe('readLoadGame', () => {
  test('parses the full savegame in `G_DoLoadGame` section order and returns frozen restored sections', () => {
    const bytes = createLoadGameBytes();
    const restored = readLoadGame(bytes, LOADGAME_LAYOUT);

    expect(restored).not.toBeNull();
    expect(restored?.bytesRead).toBe(bytes.length);
    expect(restored?.nextOffset).toBe(bytes.length);
    expect(restored?.value).toEqual({
      header: BASE_HEADER,
      mobjs: [BASE_MOBJ],
      players: BASE_PLAYER_ARCHIVE,
      specials: BASE_SPECIAL_ARCHIVE,
      world: BASE_WORLD,
    });
    expect(Object.isFrozen(restored?.value)).toBe(true);
    expect(Object.isFrozen(restored?.value.header)).toBe(true);
    expect(Object.isFrozen(restored?.value.mobjs)).toBe(true);
    expect(Object.isFrozen(restored?.value.players)).toBe(true);
    expect(Object.isFrozen(restored?.value.specials)).toBe(true);
    expect(Object.isFrozen(restored?.value.world)).toBe(true);
  });

  test('uses the absolute savegame offset when downstream section readers compute alignment padding', () => {
    const startOffset = 1;
    const bytes = createLoadGameBytes(startOffset);
    const restored = readLoadGame(bytes, LOADGAME_LAYOUT, startOffset);

    expect(restored).not.toBeNull();
    expect(restored?.bytesRead).toBe(bytes.length);
    expect(restored?.nextOffset).toBe(startOffset + bytes.length);
    expect(restored?.value.players).toEqual(BASE_PLAYER_ARCHIVE);
    expect(restored?.value.mobjs).toEqual([BASE_MOBJ]);
    expect(restored?.value.specials).toEqual(BASE_SPECIAL_ARCHIVE);
  });

  test('returns null on a header version mismatch before attempting to restore later sections', () => {
    const bytes = writeSaveGameHeader(BASE_HEADER);

    bytes[24 + 'version 10'.length] = '8'.charCodeAt(0);

    expect(readLoadGame(bytes, LOADGAME_LAYOUT)).toBeNull();
  });

  test('throws the canonical bad-savegame error when the EOF marker is missing or wrong', () => {
    const bytes = createLoadGameBytes();

    bytes[bytes.length - 1] = 0;

    expect(() => readLoadGame(bytes, LOADGAME_LAYOUT)).toThrow('Bad savegame');
    expect(() => readLoadGame(bytes.subarray(0, bytes.length - 1), LOADGAME_LAYOUT)).toThrow('Bad savegame');
  });
});
