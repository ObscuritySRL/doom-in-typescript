const FRACBITS = 16;

export const SAVEGAME_ALIGNMENT = 4;
export const SAVEGAME_AMMO_COUNT = 4;
export const SAVEGAME_CARD_COUNT = 6;
export const SAVEGAME_FRAG_COUNT = 4;
export const SAVEGAME_LINE_BASE_SIZE = 6;
export const SAVEGAME_MAPTHING_SIZE = 10;
export const SAVEGAME_MOBJ_SIZE = 154;
export const SAVEGAME_PLAYER_COUNT = 4;
export const SAVEGAME_PLAYER_SIZE = 280;
export const SAVEGAME_POWER_COUNT = 6;
export const SAVEGAME_PSPRITE_COUNT = 2;
export const SAVEGAME_PSPRITE_SIZE = 16;
export const SAVEGAME_SECTOR_SIZE = 14;
export const SAVEGAME_SIDE_SIZE = 10;
export const SAVEGAME_THINKER_CLASS_END = 0;
export const SAVEGAME_THINKER_CLASS_MOBJ = 1;
export const SAVEGAME_TICCMD_SIZE = 8;
export const SAVEGAME_WEAPON_COUNT = 9;

export type SaveGamePlayerPresence = readonly [number, number, number, number];
export type SaveGamePlayerSlots = readonly [SaveGamePlayer | null, SaveGamePlayer | null, SaveGamePlayer | null, SaveGamePlayer | null];
export type SaveGameSidePair = readonly [SaveGameSide | null, SaveGameSide | null];
export type SaveGameSidenumPair = readonly [number, number];

export interface SaveGameLine {
  readonly flags: number;
  readonly sides: SaveGameSidePair;
  readonly sidenum: SaveGameSidenumPair;
  readonly special: number;
  readonly tag: number;
}

export interface SaveGameMapThing {
  readonly angle: number;
  readonly options: number;
  readonly type: number;
  readonly x: number;
  readonly y: number;
}

export interface SaveGameMobj {
  readonly angle: number;
  readonly blockNextPointer: number;
  readonly blockPreviousPointer: number;
  readonly ceilingz: number;
  readonly flags: number;
  readonly floorz: number;
  readonly frame: number;
  readonly health: number;
  readonly height: number;
  readonly infoPointer: number;
  readonly lastlook: number;
  readonly momx: number;
  readonly momy: number;
  readonly momz: number;
  readonly moveCount: number;
  readonly moveDirection: number;
  readonly playerSlot: number;
  readonly radius: number;
  readonly reactiontime: number;
  readonly sectorNextPointer: number;
  readonly sectorPreviousPointer: number;
  readonly spawnpoint: SaveGameMapThing;
  readonly sprite: number;
  readonly stateIndex: number;
  readonly subsectorPointer: number;
  readonly targetPointer: number;
  readonly thinker: SaveGameThinker;
  readonly threshold: number;
  readonly tics: number;
  readonly tracerPointer: number;
  readonly type: number;
  readonly validcount: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SaveGamePlayer {
  readonly ammo: readonly number[];
  readonly armorpoints: number;
  readonly armortype: number;
  readonly attackdown: number;
  readonly attackerPointer: number;
  readonly backpack: number;
  readonly bob: number;
  readonly bonuscount: number;
  readonly cards: readonly number[];
  readonly cheats: number;
  readonly colormap: number;
  readonly damagecount: number;
  readonly deltaviewheight: number;
  readonly didsecret: number;
  readonly extralight: number;
  readonly fixedcolormap: number;
  readonly frags: readonly number[];
  readonly health: number;
  readonly itemcount: number;
  readonly killcount: number;
  readonly maxammo: readonly number[];
  readonly messagePointer: number;
  readonly mobjPointer: number;
  readonly pendingweapon: number;
  readonly playerstate: number;
  readonly powers: readonly number[];
  readonly psprites: readonly SaveGamePsprite[];
  readonly readyweapon: number;
  readonly refire: number;
  readonly secretcount: number;
  readonly ticcmd: SaveGameTiccmd;
  readonly usedown: number;
  readonly viewheight: number;
  readonly viewz: number;
  readonly weaponowned: readonly number[];
}

export interface SaveGamePlayerArchive {
  readonly playeringame: SaveGamePlayerPresence;
  readonly players: SaveGamePlayerSlots;
}

export interface SaveGamePsprite {
  readonly stateIndex: number | null;
  readonly sx: number;
  readonly sy: number;
  readonly tics: number;
}

export interface SaveGameReadResult<TValue> {
  readonly bytesRead: number;
  readonly nextOffset: number;
  readonly value: TValue;
}

export interface SaveGameSector {
  readonly ceilingheight: number;
  readonly ceilingpic: number;
  readonly floorheight: number;
  readonly floorpic: number;
  readonly lightlevel: number;
  readonly special: number;
  readonly tag: number;
}

export interface SaveGameSide {
  readonly bottomtexture: number;
  readonly midtexture: number;
  readonly rowoffset: number;
  readonly textureoffset: number;
  readonly toptexture: number;
}

export interface SaveGameThinker {
  readonly functionPointer: number;
  readonly nextPointer: number;
  readonly previousPointer: number;
}

export interface SaveGameTiccmd {
  readonly angleturn: number;
  readonly buttons: number;
  readonly chatchar: number;
  readonly consistancy: number;
  readonly forwardmove: number;
  readonly sidemove: number;
}

export interface SaveGameWorld {
  readonly lines: readonly SaveGameLine[];
  readonly sectors: readonly SaveGameSector[];
}

export interface SaveGameWorldLayout {
  readonly lines: readonly SaveGameWorldLineLayout[];
  readonly sectorCount: number;
}

export interface SaveGameWorldLineLayout {
  readonly sidenum: SaveGameSidenumPair;
}

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

  readInt8(name: string): number {
    this.#assertAvailable(name, 1);

    const value = this.#view.getInt8(this.#sourceOffset);

    this.#advance(1);

    return value;
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

  writeInt8(name: string, value: number): void {
    assertIntegerInRange(name, value, -0x80, 0x7f);
    this.#pushByte(value & 0xff);
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

function calculatePadding(absoluteOffset: number): number {
  return (SAVEGAME_ALIGNMENT - (absoluteOffset & (SAVEGAME_ALIGNMENT - 1))) & (SAVEGAME_ALIGNMENT - 1);
}

function freezeLinePair(firstSide: SaveGameSide | null, secondSide: SaveGameSide | null): SaveGameSidePair {
  return Object.freeze([firstSide, secondSide]) as SaveGameSidePair;
}

function freezePlayerPresence(values: readonly number[]): SaveGamePlayerPresence {
  return Object.freeze([getArrayValue('playeringame', values, 0), getArrayValue('playeringame', values, 1), getArrayValue('playeringame', values, 2), getArrayValue('playeringame', values, 3)]) as SaveGamePlayerPresence;
}

function freezePlayerSlots(values: readonly (SaveGamePlayer | null)[]): SaveGamePlayerSlots {
  return Object.freeze([getArrayValue('players', values, 0), getArrayValue('players', values, 1), getArrayValue('players', values, 2), getArrayValue('players', values, 3)]) as SaveGamePlayerSlots;
}

function freezeReadonlyArray<TValue>(values: readonly TValue[]): readonly TValue[] {
  return Object.freeze([...values]);
}

function freezeSidenum(values: readonly number[]): SaveGameSidenumPair {
  return Object.freeze([getArrayValue('sidenum', values, 0), getArrayValue('sidenum', values, 1)]) as SaveGameSidenumPair;
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

function readFixedUnitInt16(reader: SaveGameReader, name: string): number {
  return reader.readInt16(name) << FRACBITS;
}

function readMapThing(reader: SaveGameReader): SaveGameMapThing {
  const x = reader.readInt16('mapthing.x');
  const y = reader.readInt16('mapthing.y');
  const angle = reader.readInt16('mapthing.angle');
  const type = reader.readInt16('mapthing.type');
  const options = reader.readInt16('mapthing.options');

  return Object.freeze({
    angle,
    options,
    type,
    x,
    y,
  });
}

function readMobj(reader: SaveGameReader): SaveGameMobj {
  const thinker = readThinker(reader);
  const x = reader.readInt32('mobj.x');
  const y = reader.readInt32('mobj.y');
  const z = reader.readInt32('mobj.z');
  const sectorNextPointer = reader.readUint32('mobj.sectorNextPointer');
  const sectorPreviousPointer = reader.readUint32('mobj.sectorPreviousPointer');
  const angle = reader.readInt32('mobj.angle');
  const sprite = reader.readInt32('mobj.sprite');
  const frame = reader.readInt32('mobj.frame');
  const blockNextPointer = reader.readUint32('mobj.blockNextPointer');
  const blockPreviousPointer = reader.readUint32('mobj.blockPreviousPointer');
  const subsectorPointer = reader.readUint32('mobj.subsectorPointer');
  const floorz = reader.readInt32('mobj.floorz');
  const ceilingz = reader.readInt32('mobj.ceilingz');
  const radius = reader.readInt32('mobj.radius');
  const height = reader.readInt32('mobj.height');
  const momx = reader.readInt32('mobj.momx');
  const momy = reader.readInt32('mobj.momy');
  const momz = reader.readInt32('mobj.momz');
  const validcount = reader.readInt32('mobj.validcount');
  const type = reader.readInt32('mobj.type');
  const infoPointer = reader.readUint32('mobj.infoPointer');
  const tics = reader.readInt32('mobj.tics');
  const stateIndex = reader.readInt32('mobj.stateIndex');
  const flags = reader.readInt32('mobj.flags');
  const health = reader.readInt32('mobj.health');
  const moveDirection = reader.readInt32('mobj.moveDirection');
  const moveCount = reader.readInt32('mobj.moveCount');
  const targetPointer = reader.readUint32('mobj.targetPointer');
  const reactiontime = reader.readInt32('mobj.reactiontime');
  const threshold = reader.readInt32('mobj.threshold');
  const playerSlot = reader.readInt32('mobj.playerSlot');
  const lastlook = reader.readInt32('mobj.lastlook');
  const spawnpoint = readMapThing(reader);
  const tracerPointer = reader.readUint32('mobj.tracerPointer');

  return Object.freeze({
    angle,
    blockNextPointer,
    blockPreviousPointer,
    ceilingz,
    flags,
    floorz,
    frame,
    health,
    height,
    infoPointer,
    lastlook,
    momx,
    momy,
    momz,
    moveCount,
    moveDirection,
    playerSlot,
    radius,
    reactiontime,
    sectorNextPointer,
    sectorPreviousPointer,
    spawnpoint,
    sprite,
    stateIndex,
    subsectorPointer,
    targetPointer,
    thinker,
    threshold,
    tics,
    tracerPointer,
    type,
    validcount,
    x,
    y,
    z,
  });
}

function readPlayer(reader: SaveGameReader): SaveGamePlayer {
  const mobjPointer = reader.readUint32('player.mobjPointer');
  const playerstate = reader.readInt32('player.playerstate');
  const ticcmd = readTiccmd(reader);
  const viewz = reader.readInt32('player.viewz');
  const viewheight = reader.readInt32('player.viewheight');
  const deltaviewheight = reader.readInt32('player.deltaviewheight');
  const bob = reader.readInt32('player.bob');
  const health = reader.readInt32('player.health');
  const armorpoints = reader.readInt32('player.armorpoints');
  const armortype = reader.readInt32('player.armortype');
  const ammo: number[] = [];
  const cards: number[] = [];
  const frags: number[] = [];
  const maxammo: number[] = [];
  const powers: number[] = [];
  const psprites: SaveGamePsprite[] = [];
  const weaponowned: number[] = [];

  for (let powerIndex = 0; powerIndex < SAVEGAME_POWER_COUNT; powerIndex += 1) {
    powers.push(reader.readInt32(`player.powers[${powerIndex}]`));
  }

  for (let cardIndex = 0; cardIndex < SAVEGAME_CARD_COUNT; cardIndex += 1) {
    cards.push(reader.readInt32(`player.cards[${cardIndex}]`));
  }

  const backpack = reader.readInt32('player.backpack');

  for (let fragIndex = 0; fragIndex < SAVEGAME_FRAG_COUNT; fragIndex += 1) {
    frags.push(reader.readInt32(`player.frags[${fragIndex}]`));
  }

  const readyweapon = reader.readInt32('player.readyweapon');
  const pendingweapon = reader.readInt32('player.pendingweapon');

  for (let weaponIndex = 0; weaponIndex < SAVEGAME_WEAPON_COUNT; weaponIndex += 1) {
    weaponowned.push(reader.readInt32(`player.weaponowned[${weaponIndex}]`));
  }

  for (let ammoIndex = 0; ammoIndex < SAVEGAME_AMMO_COUNT; ammoIndex += 1) {
    ammo.push(reader.readInt32(`player.ammo[${ammoIndex}]`));
  }

  for (let ammoIndex = 0; ammoIndex < SAVEGAME_AMMO_COUNT; ammoIndex += 1) {
    maxammo.push(reader.readInt32(`player.maxammo[${ammoIndex}]`));
  }

  const attackdown = reader.readInt32('player.attackdown');
  const usedown = reader.readInt32('player.usedown');
  const cheats = reader.readInt32('player.cheats');
  const refire = reader.readInt32('player.refire');
  const killcount = reader.readInt32('player.killcount');
  const itemcount = reader.readInt32('player.itemcount');
  const secretcount = reader.readInt32('player.secretcount');
  const messagePointer = reader.readUint32('player.messagePointer');
  const damagecount = reader.readInt32('player.damagecount');
  const bonuscount = reader.readInt32('player.bonuscount');
  const attackerPointer = reader.readUint32('player.attackerPointer');
  const extralight = reader.readInt32('player.extralight');
  const fixedcolormap = reader.readInt32('player.fixedcolormap');
  const colormap = reader.readInt32('player.colormap');

  for (let pspriteIndex = 0; pspriteIndex < SAVEGAME_PSPRITE_COUNT; pspriteIndex += 1) {
    psprites.push(readPsprite(reader));
  }

  const didsecret = reader.readInt32('player.didsecret');

  return Object.freeze({
    ammo: freezeReadonlyArray(ammo),
    armorpoints,
    armortype,
    attackdown,
    attackerPointer,
    backpack,
    bob,
    bonuscount,
    cards: freezeReadonlyArray(cards),
    cheats,
    colormap,
    damagecount,
    deltaviewheight,
    didsecret,
    extralight,
    fixedcolormap,
    frags: freezeReadonlyArray(frags),
    health,
    itemcount,
    killcount,
    maxammo: freezeReadonlyArray(maxammo),
    messagePointer,
    mobjPointer,
    pendingweapon,
    playerstate,
    powers: freezeReadonlyArray(powers),
    psprites: freezeReadonlyArray(psprites),
    readyweapon,
    refire,
    secretcount,
    ticcmd,
    usedown,
    viewheight,
    viewz,
    weaponowned: freezeReadonlyArray(weaponowned),
  });
}

function readPsprite(reader: SaveGameReader): SaveGamePsprite {
  const stateIndex = reader.readInt32('psprite.stateIndex');
  const tics = reader.readInt32('psprite.tics');
  const sx = reader.readInt32('psprite.sx');
  const sy = reader.readInt32('psprite.sy');

  return Object.freeze({
    stateIndex: stateIndex === 0 ? null : stateIndex,
    sx,
    sy,
    tics,
  });
}

function readSide(reader: SaveGameReader): SaveGameSide {
  const textureoffset = readFixedUnitInt16(reader, 'side.textureoffset');
  const rowoffset = readFixedUnitInt16(reader, 'side.rowoffset');
  const toptexture = reader.readInt16('side.toptexture');
  const bottomtexture = reader.readInt16('side.bottomtexture');
  const midtexture = reader.readInt16('side.midtexture');

  return Object.freeze({
    bottomtexture,
    midtexture,
    rowoffset,
    textureoffset,
    toptexture,
  });
}

function readSector(reader: SaveGameReader): SaveGameSector {
  const floorheight = readFixedUnitInt16(reader, 'sector.floorheight');
  const ceilingheight = readFixedUnitInt16(reader, 'sector.ceilingheight');
  const floorpic = reader.readInt16('sector.floorpic');
  const ceilingpic = reader.readInt16('sector.ceilingpic');
  const lightlevel = reader.readInt16('sector.lightlevel');
  const special = reader.readInt16('sector.special');
  const tag = reader.readInt16('sector.tag');

  return Object.freeze({
    ceilingheight,
    ceilingpic,
    floorheight,
    floorpic,
    lightlevel,
    special,
    tag,
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

function readTiccmd(reader: SaveGameReader): SaveGameTiccmd {
  const forwardmove = reader.readInt8('ticcmd.forwardmove');
  const sidemove = reader.readInt8('ticcmd.sidemove');
  const angleturn = reader.readInt16('ticcmd.angleturn');
  const consistancy = reader.readInt16('ticcmd.consistancy');
  const chatchar = reader.readUint8('ticcmd.chatchar');
  const buttons = reader.readUint8('ticcmd.buttons');

  return Object.freeze({
    angleturn,
    buttons,
    chatchar,
    consistancy,
    forwardmove,
    sidemove,
  });
}

function validateFixedUnitField(name: string, value: number): number {
  assertIntegerInRange(name, value, -0x8000_0000, 0x7fff_ffff);

  return value >> FRACBITS;
}

function validateNumberArray(name: string, values: readonly number[], expectedLength: number): readonly number[] {
  assertArrayLength(name, values, expectedLength);

  for (let valueIndex = 0; valueIndex < expectedLength; valueIndex += 1) {
    assertIntegerInRange(`${name}[${valueIndex}]`, getArrayValue(name, values, valueIndex), -0x8000_0000, 0x7fff_ffff);
  }

  return values;
}

function writeFixedUnitInt16(writer: SaveGameWriter, name: string, value: number): void {
  writer.writeInt16(name, validateFixedUnitField(name, value));
}

function writeMapThing(writer: SaveGameWriter, mapThing: SaveGameMapThing): void {
  writer.writeInt16('mapthing.x', mapThing.x);
  writer.writeInt16('mapthing.y', mapThing.y);
  writer.writeInt16('mapthing.angle', mapThing.angle);
  writer.writeInt16('mapthing.type', mapThing.type);
  writer.writeInt16('mapthing.options', mapThing.options);
}

function writeMobj(writer: SaveGameWriter, mobj: SaveGameMobj): void {
  assertIntegerInRange('mobj.playerSlot', mobj.playerSlot, 0, SAVEGAME_PLAYER_COUNT);
  assertIntegerInRange('mobj.stateIndex', mobj.stateIndex, 0, 0x7fff_ffff);

  writeThinker(writer, mobj.thinker);
  writer.writeInt32('mobj.x', mobj.x);
  writer.writeInt32('mobj.y', mobj.y);
  writer.writeInt32('mobj.z', mobj.z);
  writer.writeUint32('mobj.sectorNextPointer', mobj.sectorNextPointer);
  writer.writeUint32('mobj.sectorPreviousPointer', mobj.sectorPreviousPointer);
  writer.writeInt32('mobj.angle', mobj.angle);
  writer.writeInt32('mobj.sprite', mobj.sprite);
  writer.writeInt32('mobj.frame', mobj.frame);
  writer.writeUint32('mobj.blockNextPointer', mobj.blockNextPointer);
  writer.writeUint32('mobj.blockPreviousPointer', mobj.blockPreviousPointer);
  writer.writeUint32('mobj.subsectorPointer', mobj.subsectorPointer);
  writer.writeInt32('mobj.floorz', mobj.floorz);
  writer.writeInt32('mobj.ceilingz', mobj.ceilingz);
  writer.writeInt32('mobj.radius', mobj.radius);
  writer.writeInt32('mobj.height', mobj.height);
  writer.writeInt32('mobj.momx', mobj.momx);
  writer.writeInt32('mobj.momy', mobj.momy);
  writer.writeInt32('mobj.momz', mobj.momz);
  writer.writeInt32('mobj.validcount', mobj.validcount);
  writer.writeInt32('mobj.type', mobj.type);
  writer.writeUint32('mobj.infoPointer', mobj.infoPointer);
  writer.writeInt32('mobj.tics', mobj.tics);
  writer.writeInt32('mobj.stateIndex', mobj.stateIndex);
  writer.writeInt32('mobj.flags', mobj.flags);
  writer.writeInt32('mobj.health', mobj.health);
  writer.writeInt32('mobj.moveDirection', mobj.moveDirection);
  writer.writeInt32('mobj.moveCount', mobj.moveCount);
  writer.writeUint32('mobj.targetPointer', mobj.targetPointer);
  writer.writeInt32('mobj.reactiontime', mobj.reactiontime);
  writer.writeInt32('mobj.threshold', mobj.threshold);
  writer.writeInt32('mobj.playerSlot', mobj.playerSlot);
  writer.writeInt32('mobj.lastlook', mobj.lastlook);
  writeMapThing(writer, mobj.spawnpoint);
  writer.writeUint32('mobj.tracerPointer', mobj.tracerPointer);
}

function writePlayer(writer: SaveGameWriter, player: SaveGamePlayer): void {
  const ammo = validateNumberArray('player.ammo', player.ammo, SAVEGAME_AMMO_COUNT);
  const cards = validateNumberArray('player.cards', player.cards, SAVEGAME_CARD_COUNT);
  const frags = validateNumberArray('player.frags', player.frags, SAVEGAME_FRAG_COUNT);
  const maxammo = validateNumberArray('player.maxammo', player.maxammo, SAVEGAME_AMMO_COUNT);
  const powers = validateNumberArray('player.powers', player.powers, SAVEGAME_POWER_COUNT);
  const psprites = player.psprites;
  const weaponowned = validateNumberArray('player.weaponowned', player.weaponowned, SAVEGAME_WEAPON_COUNT);

  assertArrayLength('player.psprites', psprites, SAVEGAME_PSPRITE_COUNT);

  writer.writeUint32('player.mobjPointer', player.mobjPointer);
  writer.writeInt32('player.playerstate', player.playerstate);
  writeTiccmd(writer, player.ticcmd);
  writer.writeInt32('player.viewz', player.viewz);
  writer.writeInt32('player.viewheight', player.viewheight);
  writer.writeInt32('player.deltaviewheight', player.deltaviewheight);
  writer.writeInt32('player.bob', player.bob);
  writer.writeInt32('player.health', player.health);
  writer.writeInt32('player.armorpoints', player.armorpoints);
  writer.writeInt32('player.armortype', player.armortype);

  for (let powerIndex = 0; powerIndex < SAVEGAME_POWER_COUNT; powerIndex += 1) {
    writer.writeInt32(`player.powers[${powerIndex}]`, getArrayValue('player.powers', powers, powerIndex));
  }

  for (let cardIndex = 0; cardIndex < SAVEGAME_CARD_COUNT; cardIndex += 1) {
    writer.writeInt32(`player.cards[${cardIndex}]`, getArrayValue('player.cards', cards, cardIndex));
  }

  writer.writeInt32('player.backpack', player.backpack);

  for (let fragIndex = 0; fragIndex < SAVEGAME_FRAG_COUNT; fragIndex += 1) {
    writer.writeInt32(`player.frags[${fragIndex}]`, getArrayValue('player.frags', frags, fragIndex));
  }

  writer.writeInt32('player.readyweapon', player.readyweapon);
  writer.writeInt32('player.pendingweapon', player.pendingweapon);

  for (let weaponIndex = 0; weaponIndex < SAVEGAME_WEAPON_COUNT; weaponIndex += 1) {
    writer.writeInt32(`player.weaponowned[${weaponIndex}]`, getArrayValue('player.weaponowned', weaponowned, weaponIndex));
  }

  for (let ammoIndex = 0; ammoIndex < SAVEGAME_AMMO_COUNT; ammoIndex += 1) {
    writer.writeInt32(`player.ammo[${ammoIndex}]`, getArrayValue('player.ammo', ammo, ammoIndex));
  }

  for (let ammoIndex = 0; ammoIndex < SAVEGAME_AMMO_COUNT; ammoIndex += 1) {
    writer.writeInt32(`player.maxammo[${ammoIndex}]`, getArrayValue('player.maxammo', maxammo, ammoIndex));
  }

  writer.writeInt32('player.attackdown', player.attackdown);
  writer.writeInt32('player.usedown', player.usedown);
  writer.writeInt32('player.cheats', player.cheats);
  writer.writeInt32('player.refire', player.refire);
  writer.writeInt32('player.killcount', player.killcount);
  writer.writeInt32('player.itemcount', player.itemcount);
  writer.writeInt32('player.secretcount', player.secretcount);
  writer.writeUint32('player.messagePointer', player.messagePointer);
  writer.writeInt32('player.damagecount', player.damagecount);
  writer.writeInt32('player.bonuscount', player.bonuscount);
  writer.writeUint32('player.attackerPointer', player.attackerPointer);
  writer.writeInt32('player.extralight', player.extralight);
  writer.writeInt32('player.fixedcolormap', player.fixedcolormap);
  writer.writeInt32('player.colormap', player.colormap);

  for (let pspriteIndex = 0; pspriteIndex < SAVEGAME_PSPRITE_COUNT; pspriteIndex += 1) {
    writePsprite(writer, getArrayValue('player.psprites', psprites, pspriteIndex));
  }

  writer.writeInt32('player.didsecret', player.didsecret);
}

function writePsprite(writer: SaveGameWriter, psprite: SaveGamePsprite): void {
  if (psprite.stateIndex !== null) {
    assertIntegerInRange('psprite.stateIndex', psprite.stateIndex, 1, 0x7fff_ffff);
  }

  writer.writeInt32('psprite.stateIndex', psprite.stateIndex ?? 0);
  writer.writeInt32('psprite.tics', psprite.tics);
  writer.writeInt32('psprite.sx', psprite.sx);
  writer.writeInt32('psprite.sy', psprite.sy);
}

function writeSide(writer: SaveGameWriter, side: SaveGameSide): void {
  writeFixedUnitInt16(writer, 'side.textureoffset', side.textureoffset);
  writeFixedUnitInt16(writer, 'side.rowoffset', side.rowoffset);
  writer.writeInt16('side.toptexture', side.toptexture);
  writer.writeInt16('side.bottomtexture', side.bottomtexture);
  writer.writeInt16('side.midtexture', side.midtexture);
}

function writeSector(writer: SaveGameWriter, sector: SaveGameSector): void {
  writeFixedUnitInt16(writer, 'sector.floorheight', sector.floorheight);
  writeFixedUnitInt16(writer, 'sector.ceilingheight', sector.ceilingheight);
  writer.writeInt16('sector.floorpic', sector.floorpic);
  writer.writeInt16('sector.ceilingpic', sector.ceilingpic);
  writer.writeInt16('sector.lightlevel', sector.lightlevel);
  writer.writeInt16('sector.special', sector.special);
  writer.writeInt16('sector.tag', sector.tag);
}

function writeThinker(writer: SaveGameWriter, thinker: SaveGameThinker): void {
  writer.writeUint32('thinker.previousPointer', thinker.previousPointer);
  writer.writeUint32('thinker.nextPointer', thinker.nextPointer);
  writer.writeUint32('thinker.functionPointer', thinker.functionPointer);
}

function writeTiccmd(writer: SaveGameWriter, ticcmd: SaveGameTiccmd): void {
  writer.writeInt8('ticcmd.forwardmove', ticcmd.forwardmove);
  writer.writeInt8('ticcmd.sidemove', ticcmd.sidemove);
  writer.writeInt16('ticcmd.angleturn', ticcmd.angleturn);
  writer.writeInt16('ticcmd.consistancy', ticcmd.consistancy);
  writer.writeUint8('ticcmd.chatchar', ticcmd.chatchar);
  writer.writeUint8('ticcmd.buttons', ticcmd.buttons);
}

/**
 * Parse the player archive section written by `P_ArchivePlayers`.
 * @param source Standalone bytes for the player section.
 * @param playeringame Presence flags that determine which player slots are serialized.
 * @param startOffset Absolute savegame offset where the section begins.
 * @returns Parsed players plus the consumed byte count and next absolute offset.
 * @example
 * ```ts
 * const result = readArchivedPlayers(bytes, [1, 0, 0, 0], 50);
 * ```
 */
export function readArchivedPlayers(source: Uint8Array, playeringame: readonly number[], startOffset = 0): SaveGameReadResult<SaveGamePlayerArchive> {
  assertArrayLength('playeringame', playeringame, SAVEGAME_PLAYER_COUNT);

  const reader = new SaveGameReader(source, startOffset);
  const players: (SaveGamePlayer | null)[] = [];

  for (let playerIndex = 0; playerIndex < SAVEGAME_PLAYER_COUNT; playerIndex += 1) {
    const presence = getArrayValue('playeringame', playeringame, playerIndex);

    if (presence === 0) {
      players.push(null);
      continue;
    }

    reader.readPad();
    players.push(readPlayer(reader));
  }

  return Object.freeze({
    bytesRead: reader.bytesRead,
    nextOffset: reader.absoluteOffset,
    value: Object.freeze({
      playeringame: freezePlayerPresence(playeringame),
      players: freezePlayerSlots(players),
    }),
  });
}

/**
 * Parse the thinker section written by `P_ArchiveThinkers` for mobj entries.
 * @param source Standalone bytes for the thinker section.
 * @param startOffset Absolute savegame offset where the section begins.
 * @returns Parsed mobjs plus the consumed byte count and next absolute offset.
 * @example
 * ```ts
 * const result = readArchivedMobjs(bytes);
 * ```
 */
export function readArchivedMobjs(source: Uint8Array, startOffset = 0): SaveGameReadResult<readonly SaveGameMobj[]> {
  const reader = new SaveGameReader(source, startOffset);
  const mobjs: SaveGameMobj[] = [];

  while (true) {
    const thinkerClass = reader.readUint8('thinker.class');

    if (thinkerClass === SAVEGAME_THINKER_CLASS_END) {
      break;
    }

    if (thinkerClass !== SAVEGAME_THINKER_CLASS_MOBJ) {
      throw new RangeError(`Unknown thinker class ${thinkerClass} in savegame.`);
    }

    reader.readPad();
    mobjs.push(readMobj(reader));
  }

  return Object.freeze({
    bytesRead: reader.bytesRead,
    nextOffset: reader.absoluteOffset,
    value: freezeReadonlyArray(mobjs),
  });
}

/**
 * Parse the world section written by `P_ArchiveWorld`.
 * @param source Standalone bytes for the world section.
 * @param layout Existing map layout that provides sector count and side presence.
 * @param startOffset Absolute savegame offset where the section begins.
 * @returns Parsed sectors and lines plus the consumed byte count and next absolute offset.
 * @example
 * ```ts
 * const result = readArchivedWorld(bytes, { lines: [{ sidenum: [0, -1] }], sectorCount: 1 });
 * ```
 */
export function readArchivedWorld(source: Uint8Array, layout: SaveGameWorldLayout, startOffset = 0): SaveGameReadResult<SaveGameWorld> {
  assertIntegerInRange('layout.sectorCount', layout.sectorCount, 0, Number.MAX_SAFE_INTEGER);

  const reader = new SaveGameReader(source, startOffset);
  const lines: SaveGameLine[] = [];
  const sectors: SaveGameSector[] = [];

  for (let sectorIndex = 0; sectorIndex < layout.sectorCount; sectorIndex += 1) {
    sectors.push(readSector(reader));
  }

  for (const lineLayout of layout.lines) {
    const firstSidenum = lineLayout.sidenum[0];
    const secondSidenum = lineLayout.sidenum[1];
    const flags = reader.readInt16('line.flags');
    const special = reader.readInt16('line.special');
    const tag = reader.readInt16('line.tag');
    let firstSide: SaveGameSide | null = null;
    let secondSide: SaveGameSide | null = null;

    if (firstSidenum !== -1) {
      firstSide = readSide(reader);
    }

    if (secondSidenum !== -1) {
      secondSide = readSide(reader);
    }

    lines.push(
      Object.freeze({
        flags,
        sides: freezeLinePair(firstSide, secondSide),
        sidenum: freezeSidenum(lineLayout.sidenum),
        special,
        tag,
      }),
    );
  }

  return Object.freeze({
    bytesRead: reader.bytesRead,
    nextOffset: reader.absoluteOffset,
    value: Object.freeze({
      lines: freezeReadonlyArray(lines),
      sectors: freezeReadonlyArray(sectors),
    }),
  });
}

/**
 * Serialize the player archive section written by `P_ArchivePlayers`.
 * @param archive Players plus the `playeringame` slots that should be written.
 * @param startOffset Absolute savegame offset where the section begins.
 * @returns Section bytes including any canonical alignment padding.
 * @example
 * ```ts
 * const bytes = writeArchivedPlayers(archive, 50);
 * ```
 */
export function writeArchivedPlayers(archive: SaveGamePlayerArchive, startOffset = 0): Uint8Array {
  const playeringame = archive.playeringame;
  const players = archive.players;

  assertArrayLength('playeringame', playeringame, SAVEGAME_PLAYER_COUNT);
  assertArrayLength('players', players, SAVEGAME_PLAYER_COUNT);

  const writer = new SaveGameWriter(startOffset);

  for (let playerIndex = 0; playerIndex < SAVEGAME_PLAYER_COUNT; playerIndex += 1) {
    const presence = getArrayValue('playeringame', playeringame, playerIndex);

    if (presence === 0) {
      continue;
    }

    const player = getArrayValue('players', players, playerIndex);

    if (player === null) {
      throw new RangeError(`players[${playerIndex}] must be present when playeringame[${playerIndex}] is non-zero.`);
    }

    writer.writePad();
    writePlayer(writer, player);
  }

  return writer.toUint8Array();
}

/**
 * Serialize the thinker section written by `P_ArchiveThinkers` for mobj entries.
 * @param mobjs Mobj records in thinker list order.
 * @param startOffset Absolute savegame offset where the section begins.
 * @returns Section bytes with thinker class markers and canonical padding.
 * @example
 * ```ts
 * const bytes = writeArchivedMobjs([mobj]);
 * ```
 */
export function writeArchivedMobjs(mobjs: readonly SaveGameMobj[], startOffset = 0): Uint8Array {
  const writer = new SaveGameWriter(startOffset);

  for (const mobj of mobjs) {
    writer.writeUint8('thinker.class', SAVEGAME_THINKER_CLASS_MOBJ);
    writer.writePad();
    writeMobj(writer, mobj);
  }

  writer.writeUint8('thinker.class', SAVEGAME_THINKER_CLASS_END);

  return writer.toUint8Array();
}

/**
 * Serialize the world section written by `P_ArchiveWorld`.
 * @param world Sectors and lines from the loaded map state.
 * @returns Section bytes for sectors followed by lines.
 * @example
 * ```ts
 * const bytes = writeArchivedWorld(world);
 * ```
 */
export function writeArchivedWorld(world: SaveGameWorld): Uint8Array {
  const writer = new SaveGameWriter(0);

  for (const sector of world.sectors) {
    writeSector(writer, sector);
  }

  for (const line of world.lines) {
    const firstSidenum = line.sidenum[0];
    const secondSidenum = line.sidenum[1];
    const firstSide = line.sides[0];
    const secondSide = line.sides[1];

    writer.writeInt16('line.flags', line.flags);
    writer.writeInt16('line.special', line.special);
    writer.writeInt16('line.tag', line.tag);

    if (firstSidenum === -1) {
      if (firstSide !== null) {
        throw new RangeError('line.sides[0] must be null when line.sidenum[0] is -1.');
      }
    } else {
      if (firstSide === null) {
        throw new RangeError('line.sides[0] must be present when line.sidenum[0] is not -1.');
      }

      writeSide(writer, firstSide);
    }

    if (secondSidenum === -1) {
      if (secondSide !== null) {
        throw new RangeError('line.sides[1] must be null when line.sidenum[1] is -1.');
      }
    } else {
      if (secondSide === null) {
        throw new RangeError('line.sides[1] must be present when line.sidenum[1] is not -1.');
      }

      writeSide(writer, secondSide);
    }
  }

  return writer.toUint8Array();
}
