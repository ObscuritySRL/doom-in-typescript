import type { ActiveCeilingSnapshot, ActiveCeilingsSnapshot, ActivePlatSnapshot, ActivePlatsSnapshot, ButtonListSnapshot, ButtonSnapshot } from '../specials/activeSpecials.ts';
import { MAXCEILINGS } from '../specials/ceilings.ts';
import type { CeilingDirection, CeilingType } from '../specials/ceilings.ts';
import type { DoorDirection, VerticalDoorType } from '../specials/doors.ts';
import type { FloorDirection, FloorType } from '../specials/floors.ts';
import { MAXPLATS } from '../specials/platforms.ts';
import { MAXBUTTONS } from '../specials/switches.ts';
import type { SaveGameReadResult, SaveGameThinker } from './coreSerialization.ts';

export const SAVEGAME_SPECIAL_ACTIVE_CEILING_COUNT = MAXCEILINGS;
export const SAVEGAME_SPECIAL_ACTIVE_PLAT_COUNT = MAXPLATS;
export const SAVEGAME_SPECIAL_BUTTON_COUNT = MAXBUTTONS;
export const SAVEGAME_SPECIAL_THINKER_SIZE = 12;
export const SAVEGAME_SPECIAL_ACTIVE_PLAT_SNAPSHOT_SIZE = 48;
export const SAVEGAME_SPECIAL_ACTIVE_CEILING_SNAPSHOT_SIZE = 40;
export const SAVEGAME_SPECIAL_BUTTON_SNAPSHOT_SIZE = 24;
export const SAVEGAME_SPECIAL_REFERENCE_SIZE = 4;
export const SAVEGAME_SPECIAL_DOOR_SIZE = 40;
export const SAVEGAME_SPECIAL_FLOOR_SIZE = 42;
export const SAVEGAME_SPECIAL_FLASH_SIZE = 36;
export const SAVEGAME_SPECIAL_STROBE_SIZE = 36;
export const SAVEGAME_SPECIAL_GLOW_SIZE = 28;
export const SAVEGAME_SPECIAL_SNAPSHOT_TABLE_SIZE =
  SAVEGAME_SPECIAL_ACTIVE_PLAT_COUNT * SAVEGAME_SPECIAL_ACTIVE_PLAT_SNAPSHOT_SIZE +
  SAVEGAME_SPECIAL_ACTIVE_CEILING_COUNT * SAVEGAME_SPECIAL_ACTIVE_CEILING_SNAPSHOT_SIZE +
  SAVEGAME_SPECIAL_BUTTON_COUNT * SAVEGAME_SPECIAL_BUTTON_SNAPSHOT_SIZE;
export const SAVEGAME_SPECIAL_THINKER_CLASS_CEILING = 0;
export const SAVEGAME_SPECIAL_THINKER_CLASS_DOOR = 1;
export const SAVEGAME_SPECIAL_THINKER_CLASS_FLOOR = 2;
export const SAVEGAME_SPECIAL_THINKER_CLASS_PLAT = 3;
export const SAVEGAME_SPECIAL_THINKER_CLASS_FLASH = 4;
export const SAVEGAME_SPECIAL_THINKER_CLASS_STROBE = 5;
export const SAVEGAME_SPECIAL_THINKER_CLASS_GLOW = 6;
export const SAVEGAME_SPECIAL_THINKER_CLASS_END = 7;

export interface SaveGameSpecialArchive {
  readonly activeCeilings: ActiveCeilingsSnapshot;
  readonly activePlats: ActivePlatsSnapshot;
  readonly buttons: ButtonListSnapshot;
  readonly thinkers: readonly SaveGameSpecialThinker[];
}

export interface SaveGameSpecialCeilingReference {
  readonly kind: 'ceiling';
  readonly slotIndex: number;
}

export interface SaveGameSpecialDoor {
  readonly direction: DoorDirection;
  readonly kind: 'door';
  readonly sectorIndex: number;
  readonly speed: number;
  readonly thinker: SaveGameThinker;
  readonly topcountdown: number;
  readonly topheight: number;
  readonly topwait: number;
  readonly type: VerticalDoorType;
}

export interface SaveGameSpecialFloor {
  readonly crush: boolean;
  readonly direction: FloorDirection;
  readonly floordestheight: number;
  readonly kind: 'floor';
  readonly newspecial: number;
  readonly sectorIndex: number;
  readonly speed: number;
  readonly texture: number;
  readonly thinker: SaveGameThinker;
  readonly type: FloorType;
}

export interface SaveGameSpecialGlow {
  readonly direction: number;
  readonly kind: 'glow';
  readonly maxlight: number;
  readonly minlight: number;
  readonly sectorIndex: number;
  readonly thinker: SaveGameThinker;
}

export interface SaveGameSpecialLightFlash {
  readonly count: number;
  readonly kind: 'flash';
  readonly maxlight: number;
  readonly maxtime: number;
  readonly minlight: number;
  readonly mintime: number;
  readonly sectorIndex: number;
  readonly thinker: SaveGameThinker;
}

export interface SaveGameSpecialPlatReference {
  readonly kind: 'plat';
  readonly slotIndex: number;
}

export interface SaveGameSpecialStrobe {
  readonly brighttime: number;
  readonly count: number;
  readonly darktime: number;
  readonly kind: 'strobe';
  readonly maxlight: number;
  readonly minlight: number;
  readonly sectorIndex: number;
  readonly thinker: SaveGameThinker;
}

export type SaveGameSpecialThinker = SaveGameSpecialCeilingReference | SaveGameSpecialDoor | SaveGameSpecialFloor | SaveGameSpecialGlow | SaveGameSpecialLightFlash | SaveGameSpecialPlatReference | SaveGameSpecialStrobe;

class SaveGameReader {
  #absoluteOffset: number;
  #sourceOffset = 0;
  #view: DataView;

  constructor(source: Uint8Array, startOffset: number) {
    this.#absoluteOffset = normalizeStartOffset(startOffset);
    this.#view = new DataView(source.buffer, source.byteOffset, source.byteLength);
  }

  get absoluteOffset(): number {
    return this.#absoluteOffset;
  }

  get bytesRead(): number {
    return this.#sourceOffset;
  }

  readInt16(name: string): number {
    this.#assertAvailable(name, 2);

    const value = this.#view.getInt16(this.#sourceOffset, true);

    this.#advance(2);

    return value;
  }

  readInt32(name: string): number {
    this.#assertAvailable(name, 4);

    const value = this.#view.getInt32(this.#sourceOffset, true);

    this.#advance(4);

    return value;
  }

  readPad(): void {
    const padding = calculatePadding(this.#absoluteOffset);

    this.#assertAvailable('Savegame padding', padding);
    this.#advance(padding);
  }

  readUint8(name: string): number {
    this.#assertAvailable(name, 1);

    const value = this.#view.getUint8(this.#sourceOffset);

    this.#advance(1);

    return value;
  }

  readUint32(name: string): number {
    this.#assertAvailable(name, 4);

    const value = this.#view.getUint32(this.#sourceOffset, true);

    this.#advance(4);

    return value;
  }

  #advance(byteCount: number): void {
    this.#absoluteOffset += byteCount;
    this.#sourceOffset += byteCount;
  }

  #assertAvailable(name: string, byteCount: number): void {
    if (this.#sourceOffset + byteCount > this.#view.byteLength) {
      throw new RangeError(`${name} requires ${byteCount} more bytes.`);
    }
  }
}

class SaveGameWriter {
  #absoluteOffset: number;
  #bytes: number[] = [];

  constructor(startOffset: number) {
    this.#absoluteOffset = normalizeStartOffset(startOffset);
  }

  get absoluteOffset(): number {
    return this.#absoluteOffset;
  }

  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.#bytes);
  }

  writeInt16(name: string, value: number): void {
    assertIntegerInRange(name, value, -0x8000, 0x7fff);

    const unsignedValue = value & 0xffff;

    this.#pushByte(unsignedValue & 0xff);
    this.#pushByte((unsignedValue >>> 8) & 0xff);
  }

  writeInt32(name: string, value: number): void {
    assertIntegerInRange(name, value, -0x8000_0000, 0x7fff_ffff);

    const unsignedValue = value >>> 0;

    this.#pushByte(unsignedValue & 0xff);
    this.#pushByte((unsignedValue >>> 8) & 0xff);
    this.#pushByte((unsignedValue >>> 16) & 0xff);
    this.#pushByte((unsignedValue >>> 24) & 0xff);
  }

  writePad(): void {
    const padding = calculatePadding(this.#absoluteOffset);

    for (let paddingIndex = 0; paddingIndex < padding; paddingIndex += 1) {
      this.#pushByte(0);
    }
  }

  writeUint8(name: string, value: number): void {
    assertIntegerInRange(name, value, 0, 0xff);
    this.#pushByte(value);
  }

  writeUint32(name: string, value: number): void {
    assertIntegerInRange(name, value, 0, 0xffff_ffff);

    this.#pushByte(value & 0xff);
    this.#pushByte((value >>> 8) & 0xff);
    this.#pushByte((value >>> 16) & 0xff);
    this.#pushByte((value >>> 24) & 0xff);
  }

  #pushByte(value: number): void {
    this.#bytes.push(value);
    this.#absoluteOffset += 1;
  }
}

function assertArrayLength(name: string, values: readonly unknown[], expectedLength: number): void {
  if (values.length !== expectedLength) {
    throw new RangeError(`${name} must contain ${expectedLength} entries.`);
  }
}

function assertIntegerInRange(name: string, value: number, minimum: number, maximum: number): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be an integer in [${minimum}, ${maximum}].`);
  }
}

function assertSnapshotReference(name: string, slotIndex: number, snapshots: readonly unknown[]): void {
  assertIntegerInRange(`${name}.slotIndex`, slotIndex, 0, snapshots.length - 1);

  if (getArrayValue(name, snapshots, slotIndex) === null) {
    throw new RangeError(`${name}[${slotIndex}] must exist when the thinker stream references it.`);
  }
}

function calculatePadding(absoluteOffset: number): number {
  return (4 - (absoluteOffset & 3)) & 3;
}

function freezeReadonlyArray<TValue>(values: readonly TValue[]): readonly TValue[] {
  return Object.freeze([...values]);
}

function getArrayValue<TValue>(name: string, values: readonly TValue[], index: number): TValue {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`${name}[${index}] is missing.`);
  }

  return value;
}

function normalizeStartOffset(startOffset: number): number {
  assertIntegerInRange('startOffset', startOffset, 0, Number.MAX_SAFE_INTEGER);

  return startOffset;
}

function readActiveCeilingSnapshot(reader: SaveGameReader): ActiveCeilingSnapshot | null {
  const sectorIndex = reader.readInt32('activeCeiling.sectorIndex');
  const type = reader.readInt32('activeCeiling.type') as CeilingType;
  const bottomheight = reader.readInt32('activeCeiling.bottomheight');
  const topheight = reader.readInt32('activeCeiling.topheight');
  const speed = reader.readInt32('activeCeiling.speed');
  const crush = reader.readInt32('activeCeiling.crush') !== 0;
  const direction = reader.readInt32('activeCeiling.direction') as CeilingDirection;
  const olddirection = reader.readInt32('activeCeiling.olddirection') as CeilingDirection;
  const tag = reader.readInt32('activeCeiling.tag');
  const inStasis = reader.readInt32('activeCeiling.inStasis') !== 0;

  if (sectorIndex === -1) {
    return null;
  }

  if (sectorIndex < 0) {
    throw new RangeError('activeCeiling.sectorIndex must be -1 or a non-negative integer.');
  }

  return Object.freeze({
    bottomheight,
    crush,
    direction,
    inStasis,
    olddirection,
    sectorIndex,
    speed,
    tag,
    topheight,
    type,
  });
}

function readActiveCeilings(reader: SaveGameReader): ActiveCeilingsSnapshot {
  const snapshots: (ActiveCeilingSnapshot | null)[] = [];

  for (let slotIndex = 0; slotIndex < SAVEGAME_SPECIAL_ACTIVE_CEILING_COUNT; slotIndex += 1) {
    snapshots.push(readActiveCeilingSnapshot(reader));
  }

  return Object.freeze(snapshots) as ActiveCeilingsSnapshot;
}

function readActivePlatSnapshot(reader: SaveGameReader): ActivePlatSnapshot | null {
  const sectorIndex = reader.readInt32('activePlat.sectorIndex');
  const type = reader.readInt32('activePlat.type');
  const speed = reader.readInt32('activePlat.speed');
  const low = reader.readInt32('activePlat.low');
  const high = reader.readInt32('activePlat.high');
  const wait = reader.readInt32('activePlat.wait');
  const count = reader.readInt32('activePlat.count');
  const status = reader.readInt32('activePlat.status');
  const oldstatus = reader.readInt32('activePlat.oldstatus');
  const crush = reader.readInt32('activePlat.crush') !== 0;
  const tag = reader.readInt32('activePlat.tag');
  const inStasis = reader.readInt32('activePlat.inStasis') !== 0;

  if (sectorIndex === -1) {
    return null;
  }

  if (sectorIndex < 0) {
    throw new RangeError('activePlat.sectorIndex must be -1 or a non-negative integer.');
  }

  return Object.freeze({
    count,
    crush,
    high,
    inStasis,
    low,
    oldstatus,
    sectorIndex,
    speed,
    status,
    tag,
    type,
    wait,
  }) as ActivePlatSnapshot;
}

function readActivePlats(reader: SaveGameReader): ActivePlatsSnapshot {
  const snapshots: (ActivePlatSnapshot | null)[] = [];

  for (let slotIndex = 0; slotIndex < SAVEGAME_SPECIAL_ACTIVE_PLAT_COUNT; slotIndex += 1) {
    snapshots.push(readActivePlatSnapshot(reader));
  }

  return Object.freeze(snapshots) as ActivePlatsSnapshot;
}

function readButtonSnapshot(reader: SaveGameReader): ButtonSnapshot | null {
  const lineIndex = reader.readInt32('button.lineIndex');
  const sideIndex = reader.readInt32('button.sideIndex');
  const where = reader.readInt32('button.where');
  const btexture = reader.readInt32('button.btexture');
  const btimer = reader.readInt32('button.btimer');
  const soundorgIndex = reader.readInt32('button.soundorgIndex');

  if (btimer === 0) {
    return null;
  }

  return Object.freeze({
    btexture,
    btimer,
    lineIndex,
    sideIndex,
    soundorgIndex,
    where,
  }) as ButtonSnapshot;
}

function readButtons(reader: SaveGameReader): ButtonListSnapshot {
  const buttons: (ButtonSnapshot | null)[] = [];

  for (let slotIndex = 0; slotIndex < SAVEGAME_SPECIAL_BUTTON_COUNT; slotIndex += 1) {
    buttons.push(readButtonSnapshot(reader));
  }

  return Object.freeze(buttons) as ButtonListSnapshot;
}

function readCeilingReference(reader: SaveGameReader, activeCeilings: ActiveCeilingsSnapshot): SaveGameSpecialCeilingReference {
  const slotIndex = reader.readInt32('specialThinker.ceiling.slotIndex');

  assertSnapshotReference('activeCeilings', slotIndex, activeCeilings);

  return Object.freeze({
    kind: 'ceiling',
    slotIndex,
  });
}

function readDoor(reader: SaveGameReader): SaveGameSpecialDoor {
  const thinker = readThinker(reader);
  const type = reader.readInt32('door.type') as VerticalDoorType;
  const sectorIndex = reader.readInt32('door.sectorIndex');
  const topheight = reader.readInt32('door.topheight');
  const speed = reader.readInt32('door.speed');
  const direction = reader.readInt32('door.direction') as DoorDirection;
  const topwait = reader.readInt32('door.topwait');
  const topcountdown = reader.readInt32('door.topcountdown');

  if (sectorIndex < 0) {
    throw new RangeError('door.sectorIndex must be a non-negative integer.');
  }

  return Object.freeze({
    direction,
    kind: 'door',
    sectorIndex,
    speed,
    thinker,
    topcountdown,
    topheight,
    topwait,
    type,
  });
}

function readFlash(reader: SaveGameReader): SaveGameSpecialLightFlash {
  const thinker = readThinker(reader);
  const sectorIndex = reader.readInt32('flash.sectorIndex');
  const count = reader.readInt32('flash.count');
  const maxlight = reader.readInt32('flash.maxlight');
  const minlight = reader.readInt32('flash.minlight');
  const maxtime = reader.readInt32('flash.maxtime');
  const mintime = reader.readInt32('flash.mintime');

  if (sectorIndex < 0) {
    throw new RangeError('flash.sectorIndex must be a non-negative integer.');
  }

  return Object.freeze({
    count,
    kind: 'flash',
    maxlight,
    maxtime,
    minlight,
    mintime,
    sectorIndex,
    thinker,
  });
}

function readFloor(reader: SaveGameReader): SaveGameSpecialFloor {
  const thinker = readThinker(reader);
  const type = reader.readInt32('floor.type') as FloorType;
  const crush = reader.readInt32('floor.crush') !== 0;
  const sectorIndex = reader.readInt32('floor.sectorIndex');
  const direction = reader.readInt32('floor.direction') as FloorDirection;
  const newspecial = reader.readInt32('floor.newspecial');
  const texture = reader.readInt16('floor.texture');
  const floordestheight = reader.readInt32('floor.floordestheight');
  const speed = reader.readInt32('floor.speed');

  if (sectorIndex < 0) {
    throw new RangeError('floor.sectorIndex must be a non-negative integer.');
  }

  return Object.freeze({
    crush,
    direction,
    floordestheight,
    kind: 'floor',
    newspecial,
    sectorIndex,
    speed,
    texture,
    thinker,
    type,
  });
}

function readGlow(reader: SaveGameReader): SaveGameSpecialGlow {
  const thinker = readThinker(reader);
  const sectorIndex = reader.readInt32('glow.sectorIndex');
  const minlight = reader.readInt32('glow.minlight');
  const maxlight = reader.readInt32('glow.maxlight');
  const direction = reader.readInt32('glow.direction');

  if (sectorIndex < 0) {
    throw new RangeError('glow.sectorIndex must be a non-negative integer.');
  }

  return Object.freeze({
    direction,
    kind: 'glow',
    maxlight,
    minlight,
    sectorIndex,
    thinker,
  });
}

function readPlatReference(reader: SaveGameReader, activePlats: ActivePlatsSnapshot): SaveGameSpecialPlatReference {
  const slotIndex = reader.readInt32('specialThinker.plat.slotIndex');

  assertSnapshotReference('activePlats', slotIndex, activePlats);

  return Object.freeze({
    kind: 'plat',
    slotIndex,
  });
}

function readSpecialThinkers(reader: SaveGameReader, activePlats: ActivePlatsSnapshot, activeCeilings: ActiveCeilingsSnapshot): readonly SaveGameSpecialThinker[] {
  const thinkers: SaveGameSpecialThinker[] = [];

  while (true) {
    const thinkerClass = reader.readUint8('specialThinker.class');

    switch (thinkerClass) {
      case SAVEGAME_SPECIAL_THINKER_CLASS_CEILING:
        reader.readPad();
        thinkers.push(readCeilingReference(reader, activeCeilings));
        break;

      case SAVEGAME_SPECIAL_THINKER_CLASS_DOOR:
        reader.readPad();
        thinkers.push(readDoor(reader));
        break;

      case SAVEGAME_SPECIAL_THINKER_CLASS_FLOOR:
        reader.readPad();
        thinkers.push(readFloor(reader));
        break;

      case SAVEGAME_SPECIAL_THINKER_CLASS_PLAT:
        reader.readPad();
        thinkers.push(readPlatReference(reader, activePlats));
        break;

      case SAVEGAME_SPECIAL_THINKER_CLASS_FLASH:
        reader.readPad();
        thinkers.push(readFlash(reader));
        break;

      case SAVEGAME_SPECIAL_THINKER_CLASS_STROBE:
        reader.readPad();
        thinkers.push(readStrobe(reader));
        break;

      case SAVEGAME_SPECIAL_THINKER_CLASS_GLOW:
        reader.readPad();
        thinkers.push(readGlow(reader));
        break;

      case SAVEGAME_SPECIAL_THINKER_CLASS_END:
        return freezeReadonlyArray(thinkers);

      default:
        throw new RangeError(`Unknown special thinker class ${thinkerClass} in savegame.`);
    }
  }
}

function readStrobe(reader: SaveGameReader): SaveGameSpecialStrobe {
  const thinker = readThinker(reader);
  const sectorIndex = reader.readInt32('strobe.sectorIndex');
  const count = reader.readInt32('strobe.count');
  const minlight = reader.readInt32('strobe.minlight');
  const maxlight = reader.readInt32('strobe.maxlight');
  const darktime = reader.readInt32('strobe.darktime');
  const brighttime = reader.readInt32('strobe.brighttime');

  if (sectorIndex < 0) {
    throw new RangeError('strobe.sectorIndex must be a non-negative integer.');
  }

  return Object.freeze({
    brighttime,
    count,
    darktime,
    kind: 'strobe',
    maxlight,
    minlight,
    sectorIndex,
    thinker,
  });
}

function readThinker(reader: SaveGameReader): SaveGameThinker {
  const previousPointer = reader.readUint32('thinker.previousPointer');
  const nextPointer = reader.readUint32('thinker.nextPointer');
  const functionPointer = reader.readUint32('thinker.functionPointer');

  return Object.freeze({
    functionPointer,
    nextPointer,
    previousPointer,
  });
}

function writeActiveCeilingSnapshot(writer: SaveGameWriter, snapshot: ActiveCeilingSnapshot | null): void {
  if (snapshot === null) {
    writer.writeInt32('activeCeiling.sectorIndex', -1);
    writer.writeInt32('activeCeiling.type', 0);
    writer.writeInt32('activeCeiling.bottomheight', 0);
    writer.writeInt32('activeCeiling.topheight', 0);
    writer.writeInt32('activeCeiling.speed', 0);
    writer.writeInt32('activeCeiling.crush', 0);
    writer.writeInt32('activeCeiling.direction', 0);
    writer.writeInt32('activeCeiling.olddirection', 0);
    writer.writeInt32('activeCeiling.tag', 0);
    writer.writeInt32('activeCeiling.inStasis', 0);
    return;
  }

  assertIntegerInRange('activeCeiling.sectorIndex', snapshot.sectorIndex, 0, 0x7fff_ffff);
  writer.writeInt32('activeCeiling.sectorIndex', snapshot.sectorIndex);
  writer.writeInt32('activeCeiling.type', snapshot.type);
  writer.writeInt32('activeCeiling.bottomheight', snapshot.bottomheight);
  writer.writeInt32('activeCeiling.topheight', snapshot.topheight);
  writer.writeInt32('activeCeiling.speed', snapshot.speed);
  writer.writeInt32('activeCeiling.crush', snapshot.crush ? 1 : 0);
  writer.writeInt32('activeCeiling.direction', snapshot.direction);
  writer.writeInt32('activeCeiling.olddirection', snapshot.olddirection);
  writer.writeInt32('activeCeiling.tag', snapshot.tag);
  writer.writeInt32('activeCeiling.inStasis', snapshot.inStasis ? 1 : 0);
}

function writeActiveCeilings(writer: SaveGameWriter, activeCeilings: ActiveCeilingsSnapshot): void {
  assertArrayLength('activeCeilings', activeCeilings, SAVEGAME_SPECIAL_ACTIVE_CEILING_COUNT);

  for (let slotIndex = 0; slotIndex < SAVEGAME_SPECIAL_ACTIVE_CEILING_COUNT; slotIndex += 1) {
    writeActiveCeilingSnapshot(writer, getArrayValue('activeCeilings', activeCeilings, slotIndex));
  }
}

function writeActivePlatSnapshot(writer: SaveGameWriter, snapshot: ActivePlatSnapshot | null): void {
  if (snapshot === null) {
    writer.writeInt32('activePlat.sectorIndex', -1);
    writer.writeInt32('activePlat.type', 0);
    writer.writeInt32('activePlat.speed', 0);
    writer.writeInt32('activePlat.low', 0);
    writer.writeInt32('activePlat.high', 0);
    writer.writeInt32('activePlat.wait', 0);
    writer.writeInt32('activePlat.count', 0);
    writer.writeInt32('activePlat.status', 0);
    writer.writeInt32('activePlat.oldstatus', 0);
    writer.writeInt32('activePlat.crush', 0);
    writer.writeInt32('activePlat.tag', 0);
    writer.writeInt32('activePlat.inStasis', 0);
    return;
  }

  assertIntegerInRange('activePlat.sectorIndex', snapshot.sectorIndex, 0, 0x7fff_ffff);
  writer.writeInt32('activePlat.sectorIndex', snapshot.sectorIndex);
  writer.writeInt32('activePlat.type', snapshot.type);
  writer.writeInt32('activePlat.speed', snapshot.speed);
  writer.writeInt32('activePlat.low', snapshot.low);
  writer.writeInt32('activePlat.high', snapshot.high);
  writer.writeInt32('activePlat.wait', snapshot.wait);
  writer.writeInt32('activePlat.count', snapshot.count);
  writer.writeInt32('activePlat.status', snapshot.status);
  writer.writeInt32('activePlat.oldstatus', snapshot.oldstatus);
  writer.writeInt32('activePlat.crush', snapshot.crush ? 1 : 0);
  writer.writeInt32('activePlat.tag', snapshot.tag);
  writer.writeInt32('activePlat.inStasis', snapshot.inStasis ? 1 : 0);
}

function writeActivePlats(writer: SaveGameWriter, activePlats: ActivePlatsSnapshot): void {
  assertArrayLength('activePlats', activePlats, SAVEGAME_SPECIAL_ACTIVE_PLAT_COUNT);

  for (let slotIndex = 0; slotIndex < SAVEGAME_SPECIAL_ACTIVE_PLAT_COUNT; slotIndex += 1) {
    writeActivePlatSnapshot(writer, getArrayValue('activePlats', activePlats, slotIndex));
  }
}

function writeButtonSnapshot(writer: SaveGameWriter, snapshot: ButtonSnapshot | null): void {
  if (snapshot === null) {
    writer.writeInt32('button.lineIndex', 0);
    writer.writeInt32('button.sideIndex', 0);
    writer.writeInt32('button.where', 0);
    writer.writeInt32('button.btexture', 0);
    writer.writeInt32('button.btimer', 0);
    writer.writeInt32('button.soundorgIndex', 0);
    return;
  }

  writer.writeInt32('button.lineIndex', snapshot.lineIndex);
  writer.writeInt32('button.sideIndex', snapshot.sideIndex);
  writer.writeInt32('button.where', snapshot.where);
  writer.writeInt32('button.btexture', snapshot.btexture);
  writer.writeInt32('button.btimer', snapshot.btimer);
  writer.writeInt32('button.soundorgIndex', snapshot.soundorgIndex);
}

function writeButtons(writer: SaveGameWriter, buttons: ButtonListSnapshot): void {
  assertArrayLength('buttons', buttons, SAVEGAME_SPECIAL_BUTTON_COUNT);

  for (let slotIndex = 0; slotIndex < SAVEGAME_SPECIAL_BUTTON_COUNT; slotIndex += 1) {
    writeButtonSnapshot(writer, getArrayValue('buttons', buttons, slotIndex));
  }
}

function writeDoor(writer: SaveGameWriter, thinker: SaveGameSpecialDoor): void {
  assertIntegerInRange('door.sectorIndex', thinker.sectorIndex, 0, 0x7fff_ffff);
  writeThinker(writer, thinker.thinker);
  writer.writeInt32('door.type', thinker.type);
  writer.writeInt32('door.sectorIndex', thinker.sectorIndex);
  writer.writeInt32('door.topheight', thinker.topheight);
  writer.writeInt32('door.speed', thinker.speed);
  writer.writeInt32('door.direction', thinker.direction);
  writer.writeInt32('door.topwait', thinker.topwait);
  writer.writeInt32('door.topcountdown', thinker.topcountdown);
}

function writeFlash(writer: SaveGameWriter, thinker: SaveGameSpecialLightFlash): void {
  assertIntegerInRange('flash.sectorIndex', thinker.sectorIndex, 0, 0x7fff_ffff);
  writeThinker(writer, thinker.thinker);
  writer.writeInt32('flash.sectorIndex', thinker.sectorIndex);
  writer.writeInt32('flash.count', thinker.count);
  writer.writeInt32('flash.maxlight', thinker.maxlight);
  writer.writeInt32('flash.minlight', thinker.minlight);
  writer.writeInt32('flash.maxtime', thinker.maxtime);
  writer.writeInt32('flash.mintime', thinker.mintime);
}

function writeFloor(writer: SaveGameWriter, thinker: SaveGameSpecialFloor): void {
  assertIntegerInRange('floor.sectorIndex', thinker.sectorIndex, 0, 0x7fff_ffff);
  writeThinker(writer, thinker.thinker);
  writer.writeInt32('floor.type', thinker.type);
  writer.writeInt32('floor.crush', thinker.crush ? 1 : 0);
  writer.writeInt32('floor.sectorIndex', thinker.sectorIndex);
  writer.writeInt32('floor.direction', thinker.direction);
  writer.writeInt32('floor.newspecial', thinker.newspecial);
  writer.writeInt16('floor.texture', thinker.texture);
  writer.writeInt32('floor.floordestheight', thinker.floordestheight);
  writer.writeInt32('floor.speed', thinker.speed);
}

function writeGlow(writer: SaveGameWriter, thinker: SaveGameSpecialGlow): void {
  assertIntegerInRange('glow.sectorIndex', thinker.sectorIndex, 0, 0x7fff_ffff);
  writeThinker(writer, thinker.thinker);
  writer.writeInt32('glow.sectorIndex', thinker.sectorIndex);
  writer.writeInt32('glow.minlight', thinker.minlight);
  writer.writeInt32('glow.maxlight', thinker.maxlight);
  writer.writeInt32('glow.direction', thinker.direction);
}

function writeSpecialThinker(writer: SaveGameWriter, thinker: SaveGameSpecialThinker, activePlats: ActivePlatsSnapshot, activeCeilings: ActiveCeilingsSnapshot): void {
  switch (thinker.kind) {
    case 'ceiling':
      assertSnapshotReference('activeCeilings', thinker.slotIndex, activeCeilings);
      writer.writeUint8('specialThinker.class', SAVEGAME_SPECIAL_THINKER_CLASS_CEILING);
      writer.writePad();
      writer.writeInt32('specialThinker.ceiling.slotIndex', thinker.slotIndex);
      return;

    case 'door':
      writer.writeUint8('specialThinker.class', SAVEGAME_SPECIAL_THINKER_CLASS_DOOR);
      writer.writePad();
      writeDoor(writer, thinker);
      return;

    case 'floor':
      writer.writeUint8('specialThinker.class', SAVEGAME_SPECIAL_THINKER_CLASS_FLOOR);
      writer.writePad();
      writeFloor(writer, thinker);
      return;

    case 'plat':
      assertSnapshotReference('activePlats', thinker.slotIndex, activePlats);
      writer.writeUint8('specialThinker.class', SAVEGAME_SPECIAL_THINKER_CLASS_PLAT);
      writer.writePad();
      writer.writeInt32('specialThinker.plat.slotIndex', thinker.slotIndex);
      return;

    case 'flash':
      writer.writeUint8('specialThinker.class', SAVEGAME_SPECIAL_THINKER_CLASS_FLASH);
      writer.writePad();
      writeFlash(writer, thinker);
      return;

    case 'strobe':
      writer.writeUint8('specialThinker.class', SAVEGAME_SPECIAL_THINKER_CLASS_STROBE);
      writer.writePad();
      writeStrobe(writer, thinker);
      return;

    case 'glow':
      writer.writeUint8('specialThinker.class', SAVEGAME_SPECIAL_THINKER_CLASS_GLOW);
      writer.writePad();
      writeGlow(writer, thinker);
      return;
  }
}

function writeSpecialThinkers(writer: SaveGameWriter, thinkers: readonly SaveGameSpecialThinker[], activePlats: ActivePlatsSnapshot, activeCeilings: ActiveCeilingsSnapshot): void {
  for (const thinker of thinkers) {
    writeSpecialThinker(writer, thinker, activePlats, activeCeilings);
  }

  writer.writeUint8('specialThinker.class', SAVEGAME_SPECIAL_THINKER_CLASS_END);
}

function writeStrobe(writer: SaveGameWriter, thinker: SaveGameSpecialStrobe): void {
  assertIntegerInRange('strobe.sectorIndex', thinker.sectorIndex, 0, 0x7fff_ffff);
  writeThinker(writer, thinker.thinker);
  writer.writeInt32('strobe.sectorIndex', thinker.sectorIndex);
  writer.writeInt32('strobe.count', thinker.count);
  writer.writeInt32('strobe.minlight', thinker.minlight);
  writer.writeInt32('strobe.maxlight', thinker.maxlight);
  writer.writeInt32('strobe.darktime', thinker.darktime);
  writer.writeInt32('strobe.brighttime', thinker.brighttime);
}

function writeThinker(writer: SaveGameWriter, thinker: SaveGameThinker): void {
  writer.writeUint32('thinker.previousPointer', thinker.previousPointer);
  writer.writeUint32('thinker.nextPointer', thinker.nextPointer);
  writer.writeUint32('thinker.functionPointer', thinker.functionPointer);
}

/**
 * Parse the split specials section used by the savegame layer.
 * @param source Standalone bytes for the specials section.
 * @param startOffset Absolute savegame offset where the section begins.
 * @returns Parsed snapshots and thinker stream plus the consumed byte count.
 * @example
 * ```ts
 * const result = readArchivedSpecials(bytes, 50);
 * ```
 */
export function readArchivedSpecials(source: Uint8Array, startOffset = 0): SaveGameReadResult<SaveGameSpecialArchive> {
  const reader = new SaveGameReader(source, startOffset);
  const activePlats = readActivePlats(reader);
  const activeCeilings = readActiveCeilings(reader);
  const buttons = readButtons(reader);
  const thinkers = readSpecialThinkers(reader, activePlats, activeCeilings);

  return Object.freeze({
    bytesRead: reader.bytesRead,
    nextOffset: reader.absoluteOffset,
    value: Object.freeze({
      activeCeilings,
      activePlats,
      buttons,
      thinkers,
    }),
  });
}

/**
 * Serialize the split specials section used by the savegame layer.
 * @param archive Active-special snapshots plus thinker records in thinker-list order.
 * @param startOffset Absolute savegame offset where the section begins.
 * @returns Section bytes for the snapshot tables followed by the thinker stream.
 * @example
 * ```ts
 * const bytes = writeArchivedSpecials({
 *   activeCeilings: Object.freeze(Array.from({ length: 30 }, () => null)),
 *   activePlats: Object.freeze(Array.from({ length: 30 }, () => null)),
 *   buttons: Object.freeze(Array.from({ length: 16 }, () => null)),
 *   thinkers: Object.freeze([]),
 * });
 * ```
 */
export function writeArchivedSpecials(archive: SaveGameSpecialArchive, startOffset = 0): Uint8Array {
  const writer = new SaveGameWriter(startOffset);

  writeActivePlats(writer, archive.activePlats);
  writeActiveCeilings(writer, archive.activeCeilings);
  writeButtons(writer, archive.buttons);
  writeSpecialThinkers(writer, archive.thinkers, archive.activePlats, archive.activeCeilings);

  return writer.toUint8Array();
}
