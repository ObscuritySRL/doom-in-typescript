import { describe, expect, test } from 'bun:test';

import { CeilingDirection, CeilingType, MAXCEILINGS } from '../../src/specials/ceilings.ts';
import type { ActiveCeilingsSnapshot, ActivePlatsSnapshot, ButtonListSnapshot } from '../../src/specials/activeSpecials.ts';
import { DoorDirection, VerticalDoorType } from '../../src/specials/doors.ts';
import { FloorDirection, FloorType } from '../../src/specials/floors.ts';
import { MAXPLATS, PlatStatus, PlatType } from '../../src/specials/platforms.ts';
import { MAXBUTTONS } from '../../src/specials/switches.ts';
import type { SaveGameSpecialArchive, SaveGameSpecialThinker } from '../../src/save/specialSerialization.ts';
import {
  SAVEGAME_SPECIAL_ACTIVE_CEILING_COUNT,
  SAVEGAME_SPECIAL_ACTIVE_CEILING_SNAPSHOT_SIZE,
  SAVEGAME_SPECIAL_ACTIVE_PLAT_COUNT,
  SAVEGAME_SPECIAL_ACTIVE_PLAT_SNAPSHOT_SIZE,
  SAVEGAME_SPECIAL_BUTTON_COUNT,
  SAVEGAME_SPECIAL_BUTTON_SNAPSHOT_SIZE,
  SAVEGAME_SPECIAL_DOOR_SIZE,
  SAVEGAME_SPECIAL_FLASH_SIZE,
  SAVEGAME_SPECIAL_FLOOR_SIZE,
  SAVEGAME_SPECIAL_GLOW_SIZE,
  SAVEGAME_SPECIAL_REFERENCE_SIZE,
  SAVEGAME_SPECIAL_SNAPSHOT_TABLE_SIZE,
  SAVEGAME_SPECIAL_STROBE_SIZE,
  SAVEGAME_SPECIAL_THINKER_CLASS_CEILING,
  SAVEGAME_SPECIAL_THINKER_CLASS_DOOR,
  SAVEGAME_SPECIAL_THINKER_CLASS_END,
  SAVEGAME_SPECIAL_THINKER_CLASS_FLASH,
  SAVEGAME_SPECIAL_THINKER_CLASS_FLOOR,
  SAVEGAME_SPECIAL_THINKER_CLASS_GLOW,
  SAVEGAME_SPECIAL_THINKER_CLASS_PLAT,
  SAVEGAME_SPECIAL_THINKER_CLASS_STROBE,
  SAVEGAME_SPECIAL_THINKER_SIZE,
  readArchivedSpecials,
  writeArchivedSpecials,
} from '../../src/save/specialSerialization.ts';

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

const THINKERS = Object.freeze([
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
]) satisfies readonly SaveGameSpecialThinker[];

const BASE_ARCHIVE = Object.freeze({
  activeCeilings: Object.freeze(ACTIVE_CEILINGS) as ActiveCeilingsSnapshot,
  activePlats: Object.freeze(ACTIVE_PLATS) as ActivePlatsSnapshot,
  buttons: Object.freeze(BUTTONS) as ButtonListSnapshot,
  thinkers: THINKERS,
}) satisfies SaveGameSpecialArchive;

describe('special serialization constants', () => {
  test('pin the canonical split-section sizes and counts', () => {
    expect(SAVEGAME_SPECIAL_ACTIVE_PLAT_COUNT).toBe(MAXPLATS);
    expect(SAVEGAME_SPECIAL_ACTIVE_CEILING_COUNT).toBe(MAXCEILINGS);
    expect(SAVEGAME_SPECIAL_BUTTON_COUNT).toBe(MAXBUTTONS);
    expect(SAVEGAME_SPECIAL_THINKER_SIZE).toBe(12);
    expect(SAVEGAME_SPECIAL_ACTIVE_PLAT_SNAPSHOT_SIZE).toBe(48);
    expect(SAVEGAME_SPECIAL_ACTIVE_CEILING_SNAPSHOT_SIZE).toBe(40);
    expect(SAVEGAME_SPECIAL_BUTTON_SNAPSHOT_SIZE).toBe(24);
    expect(SAVEGAME_SPECIAL_REFERENCE_SIZE).toBe(4);
    expect(SAVEGAME_SPECIAL_DOOR_SIZE).toBe(40);
    expect(SAVEGAME_SPECIAL_FLOOR_SIZE).toBe(42);
    expect(SAVEGAME_SPECIAL_FLASH_SIZE).toBe(36);
    expect(SAVEGAME_SPECIAL_STROBE_SIZE).toBe(36);
    expect(SAVEGAME_SPECIAL_GLOW_SIZE).toBe(28);
    expect(SAVEGAME_SPECIAL_SNAPSHOT_TABLE_SIZE).toBe(3_024);
  });

  test('pins the thinker class tags to the canonical p_saveg ordering', () => {
    expect(SAVEGAME_SPECIAL_THINKER_CLASS_CEILING).toBe(0);
    expect(SAVEGAME_SPECIAL_THINKER_CLASS_DOOR).toBe(1);
    expect(SAVEGAME_SPECIAL_THINKER_CLASS_FLOOR).toBe(2);
    expect(SAVEGAME_SPECIAL_THINKER_CLASS_PLAT).toBe(3);
    expect(SAVEGAME_SPECIAL_THINKER_CLASS_FLASH).toBe(4);
    expect(SAVEGAME_SPECIAL_THINKER_CLASS_STROBE).toBe(5);
    expect(SAVEGAME_SPECIAL_THINKER_CLASS_GLOW).toBe(6);
    expect(SAVEGAME_SPECIAL_THINKER_CLASS_END).toBe(7);
  });
});

describe('writeArchivedSpecials', () => {
  test('round-trips the full snapshot tables and thinker stream', () => {
    const bytes = writeArchivedSpecials(BASE_ARCHIVE);
    const parsed = readArchivedSpecials(bytes);

    expect(bytes.length).toBe(SAVEGAME_SPECIAL_SNAPSHOT_TABLE_SIZE + 216 + 1);
    expect(parsed.bytesRead).toBe(bytes.length);
    expect(parsed.nextOffset).toBe(bytes.length);
    expect(parsed.value).toEqual(BASE_ARCHIVE);
    expect(Object.isFrozen(parsed.value)).toBe(true);
    expect(Object.isFrozen(parsed.value.activePlats)).toBe(true);
    expect(Object.isFrozen(parsed.value.activeCeilings)).toBe(true);
    expect(Object.isFrozen(parsed.value.buttons)).toBe(true);
    expect(Object.isFrozen(parsed.value.thinkers)).toBe(true);
    expect(Object.isFrozen(parsed.value.thinkers[1])).toBe(true);
    expect(Object.isFrozen((parsed.value.thinkers[1] as Extract<SaveGameSpecialThinker, { kind: 'door' }>).thinker)).toBe(true);
  });

  test('writes slot references for registry-owned ceilings and plats instead of duplicating their payloads', () => {
    const bytes = writeArchivedSpecials(BASE_ARCHIVE);
    const thinkerStreamStart = SAVEGAME_SPECIAL_SNAPSHOT_TABLE_SIZE;

    expect(Array.from(bytes.slice(thinkerStreamStart, thinkerStreamStart + 8))).toEqual([SAVEGAME_SPECIAL_THINKER_CLASS_CEILING, 0, 0, 0, 2, 0, 0, 0]);
    expect(Array.from(bytes.slice(thinkerStreamStart + 98, thinkerStreamStart + 104))).toEqual([SAVEGAME_SPECIAL_THINKER_CLASS_PLAT, 0, 3, 0, 0, 0]);
  });

  test('uses the absolute savegame offset when computing thinker padding', () => {
    const bytes = writeArchivedSpecials(BASE_ARCHIVE, 50);
    const thinkerStreamStart = SAVEGAME_SPECIAL_SNAPSHOT_TABLE_SIZE;

    expect(Array.from(bytes.slice(thinkerStreamStart, thinkerStreamStart + 6))).toEqual([SAVEGAME_SPECIAL_THINKER_CLASS_CEILING, 0, 2, 0, 0, 0]);

    const parsed = readArchivedSpecials(bytes, 50);

    expect(parsed.nextOffset).toBe(50 + bytes.length);
    expect(parsed.value).toEqual(BASE_ARCHIVE);
  });

  test('rejects thinker references to missing active-plat slots', () => {
    expect(() =>
      writeArchivedSpecials({
        ...BASE_ARCHIVE,
        thinkers: Object.freeze([
          Object.freeze({
            kind: 'plat',
            slotIndex: 4,
          }),
        ]),
      }),
    ).toThrow(RangeError);
  });

  test('rejects negative sector indexes in active-special snapshots and thinker payloads', () => {
    expect(() =>
      writeArchivedSpecials({
        ...BASE_ARCHIVE,
        activeCeilings: Object.freeze(
          ACTIVE_CEILINGS.map((entry, index) =>
            index === 2
              ? Object.freeze({
                  ...entry!,
                  sectorIndex: -1,
                })
              : entry,
          ),
        ) as ActiveCeilingsSnapshot,
      }),
    ).toThrow(/activeCeiling\.sectorIndex/);

    expect(() =>
      writeArchivedSpecials({
        ...BASE_ARCHIVE,
        thinkers: Object.freeze([
          Object.freeze({
            ...(THINKERS[1] as Extract<SaveGameSpecialThinker, { kind: 'door' }>),
            sectorIndex: -1,
          }),
        ]),
      }),
    ).toThrow(/door\.sectorIndex/);
  });
});

describe('readArchivedSpecials', () => {
  test('rejects unknown thinker classes', () => {
    const bytes = writeArchivedSpecials(BASE_ARCHIVE);

    bytes[SAVEGAME_SPECIAL_SNAPSHOT_TABLE_SIZE] = 0xff;

    expect(() => readArchivedSpecials(bytes)).toThrow(RangeError);
  });

  test('rejects thinker references to empty active-ceiling slots', () => {
    const bytes = writeArchivedSpecials(BASE_ARCHIVE);

    bytes[SAVEGAME_SPECIAL_SNAPSHOT_TABLE_SIZE + 4] = 9;

    expect(() => readArchivedSpecials(bytes)).toThrow(RangeError);
  });

  test('rejects negative sector indexes in the special thinker stream', () => {
    const bytes = writeArchivedSpecials(BASE_ARCHIVE);
    const doorSectorOffset = SAVEGAME_SPECIAL_SNAPSHOT_TABLE_SIZE + 8 + 20;

    bytes[doorSectorOffset] = 0xff;
    bytes[doorSectorOffset + 1] = 0xff;
    bytes[doorSectorOffset + 2] = 0xff;
    bytes[doorSectorOffset + 3] = 0xff;

    expect(() => readArchivedSpecials(bytes)).toThrow(/door\.sectorIndex/);
  });
});
