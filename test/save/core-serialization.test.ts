import { describe, expect, test } from 'bun:test';

import type { SaveGameMobj, SaveGamePlayer, SaveGamePlayerArchive, SaveGameSide, SaveGameWorld } from '../../src/save/coreSerialization';

import { SAVEGAME_HEADER_SIZE } from '../../src/save/saveHeader';
import {
  SAVEGAME_LINE_BASE_SIZE,
  SAVEGAME_MAPTHING_SIZE,
  SAVEGAME_MOBJ_SIZE,
  SAVEGAME_PLAYER_SIZE,
  SAVEGAME_PSPRITE_SIZE,
  SAVEGAME_SECTOR_SIZE,
  SAVEGAME_SIDE_SIZE,
  SAVEGAME_THINKER_CLASS_END,
  SAVEGAME_THINKER_CLASS_MOBJ,
  SAVEGAME_TICCMD_SIZE,
  readArchivedMobjs,
  readArchivedPlayers,
  readArchivedWorld,
  writeArchivedMobjs,
  writeArchivedPlayers,
  writeArchivedWorld,
} from '../../src/save/coreSerialization';

const FRACUNIT = 1 << 16;

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
  playerSlot: 2,
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

describe('savegame core serialization constants', () => {
  test('pin the canonical structure sizes', () => {
    expect(SAVEGAME_TICCMD_SIZE).toBe(8);
    expect(SAVEGAME_MAPTHING_SIZE).toBe(10);
    expect(SAVEGAME_PSPRITE_SIZE).toBe(16);
    expect(SAVEGAME_SECTOR_SIZE).toBe(14);
    expect(SAVEGAME_SIDE_SIZE).toBe(10);
    expect(SAVEGAME_LINE_BASE_SIZE).toBe(6);
    expect(SAVEGAME_PLAYER_SIZE).toBe(280);
    expect(SAVEGAME_MOBJ_SIZE).toBe(154);
  });
});

describe('writeArchivedPlayers', () => {
  test('pads the first active player to a 4-byte boundary after the 50-byte header and round-trips the canonical bytes', () => {
    const bytes = writeArchivedPlayers(BASE_PLAYER_ARCHIVE, SAVEGAME_HEADER_SIZE);
    const parsed = readArchivedPlayers(bytes, BASE_PLAYER_ARCHIVE.playeringame, SAVEGAME_HEADER_SIZE);

    expect(bytes.length).toBe(2 + SAVEGAME_PLAYER_SIZE);
    expect(Array.from(bytes.slice(0, 2))).toEqual([0, 0]);
    expect(parsed.bytesRead).toBe(bytes.length);
    expect(parsed.nextOffset).toBe(SAVEGAME_HEADER_SIZE + bytes.length);
    expect(parsed.value).toEqual(BASE_PLAYER_ARCHIVE);
    expect(Object.isFrozen(parsed.value)).toBe(true);
    expect(Object.isFrozen(parsed.value.playeringame)).toBe(true);
    expect(Object.isFrozen(parsed.value.players)).toBe(true);
    expect(Object.isFrozen(parsed.value.players[0])).toBe(true);
    expect(Object.isFrozen(parsed.value.players[0]?.ammo)).toBe(true);
  });

  test('rejects an active player slot with no player payload', () => {
    expect(() =>
      writeArchivedPlayers(
        {
          playeringame: [0, 1, 0, 0],
          players: [BASE_PLAYER, null, null, null],
        },
        SAVEGAME_HEADER_SIZE,
      ),
    ).toThrow(RangeError);
  });

  test('rejects non-null psprite state indices that vanilla would decode as null', () => {
    expect(() =>
      writeArchivedPlayers(
        {
          ...BASE_PLAYER_ARCHIVE,
          players: [
            {
              ...BASE_PLAYER,
              psprites: [
                {
                  ...BASE_PLAYER.psprites[0],
                  stateIndex: 0,
                },
                BASE_PLAYER.psprites[1],
              ],
            },
            null,
            null,
            null,
          ],
        },
        SAVEGAME_HEADER_SIZE,
      ),
    ).toThrow(RangeError);
  });
});

describe('writeArchivedMobjs', () => {
  test('writes thinker class markers and 4-byte alignment exactly once per mobj and round-trips the payload', () => {
    const bytes = writeArchivedMobjs([BASE_MOBJ]);
    const parsed = readArchivedMobjs(bytes);

    expect(bytes.length).toBe(1 + 3 + SAVEGAME_MOBJ_SIZE + 1);
    expect(Array.from(bytes.slice(0, 4))).toEqual([SAVEGAME_THINKER_CLASS_MOBJ, 0, 0, 0]);
    expect(bytes[bytes.length - 1]).toBe(SAVEGAME_THINKER_CLASS_END);
    expect(parsed.bytesRead).toBe(bytes.length);
    expect(parsed.nextOffset).toBe(bytes.length);
    expect(parsed.value).toEqual([BASE_MOBJ]);
    expect(Object.isFrozen(parsed.value)).toBe(true);
    expect(Object.isFrozen(parsed.value[0])).toBe(true);
  });

  test('rejects unknown thinker classes during readback', () => {
    expect(() => readArchivedMobjs(Uint8Array.from([2]))).toThrow(RangeError);
  });

  test('rejects negative mobj state indices that vanilla never serializes', () => {
    expect(() =>
      writeArchivedMobjs([
        {
          ...BASE_MOBJ,
          stateIndex: -1,
        },
      ]),
    ).toThrow(RangeError);
  });
});

describe('writeArchivedWorld', () => {
  test('round-trips sector heights and side offsets through the canonical 16-bit fixed-unit conversion', () => {
    const bytes = writeArchivedWorld(BASE_WORLD);
    const parsed = readArchivedWorld(
      bytes,
      {
        lines: [{ sidenum: [0, -1] }],
        sectorCount: 1,
      },
      SAVEGAME_HEADER_SIZE + 2 + SAVEGAME_PLAYER_SIZE,
    );

    expect(bytes.length).toBe(SAVEGAME_SECTOR_SIZE + SAVEGAME_LINE_BASE_SIZE + SAVEGAME_SIDE_SIZE);
    expect(Array.from(bytes.slice(0, 4))).toEqual([0xfe, 0xff, 0x08, 0x00]);
    expect(parsed.bytesRead).toBe(bytes.length);
    expect(parsed.nextOffset).toBe(SAVEGAME_HEADER_SIZE + 2 + SAVEGAME_PLAYER_SIZE + bytes.length);
    expect(parsed.value).toEqual(BASE_WORLD);
    expect(Object.isFrozen(parsed.value)).toBe(true);
    expect(Object.isFrozen(parsed.value.lines)).toBe(true);
    expect(Object.isFrozen(parsed.value.sectors)).toBe(true);
  });

  test('rejects a present side payload when the map layout marks the side as missing', () => {
    expect(() =>
      writeArchivedWorld({
        ...BASE_WORLD,
        lines: [
          {
            ...BASE_WORLD.lines[0],
            sides: [BASE_SIDE, BASE_SIDE],
          },
        ],
      }),
    ).toThrow(RangeError);
  });
});
