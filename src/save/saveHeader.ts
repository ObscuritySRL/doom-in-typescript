export const SAVEGAME_DESCRIPTION_SIZE = 24;
export const SAVEGAME_LEVELTIME_SIZE = 3;
export const SAVEGAME_PLAYER_COUNT = 4;
export const SAVEGAME_VERSION_CODE = 109;
export const SAVEGAME_VERSION_SIZE = 16;
export const SAVEGAME_VERSION_TEXT = `version ${SAVEGAME_VERSION_CODE}`;
export const SAVEGAME_HEADER_SIZE = SAVEGAME_DESCRIPTION_SIZE + SAVEGAME_VERSION_SIZE + 3 + SAVEGAME_PLAYER_COUNT + SAVEGAME_LEVELTIME_SIZE;

export type SaveGamePlayerPresence = readonly [number, number, number, number];

export interface SaveGameHeader {
  readonly description: string;
  readonly gameepisode: number;
  readonly gamemap: number;
  readonly gameskill: number;
  readonly leveltime: number;
  readonly playeringame: SaveGamePlayerPresence;
}

const SAVEGAME_VERSION_FIELD = createFixedField(SAVEGAME_VERSION_TEXT, SAVEGAME_VERSION_SIZE);

function assertByte(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new RangeError(`${name} must be an integer byte value.`);
  }
}

function assertBufferSize(source: Uint8Array): void {
  if (source.length < SAVEGAME_HEADER_SIZE) {
    throw new RangeError(`Savegame header requires ${SAVEGAME_HEADER_SIZE} bytes.`);
  }
}

function assertFixedFieldValue(name: string, value: string, size: number): void {
  if (value.length > size) {
    throw new RangeError(`${name} exceeds ${size} bytes.`);
  }

  for (let index = 0; index < value.length; index += 1) {
    const characterCode = value.charCodeAt(index);

    if (characterCode > 0xff) {
      throw new RangeError(`${name} contains a non-byte character.`);
    }
  }
}

function createFixedField(value: string, size: number): Uint8Array {
  assertFixedFieldValue('Savegame string field', value, size);

  const bytes = new Uint8Array(size);

  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index);
  }

  return bytes;
}

function readFixedField(source: Uint8Array, start: number, size: number): string {
  let value = '';

  for (let index = 0; index < size; index += 1) {
    const byte = source[start + index];

    if (byte === 0) {
      break;
    }

    value += String.fromCharCode(byte);
  }

  return value;
}

/**
 * Serialize the Doom 1.9 savegame header bytes used by `P_WriteSaveGameHeader`.
 * @param header Header values to encode into the canonical 50-byte layout.
 * @returns A byte buffer containing the savegame header.
 * @example
 * ```ts
 * const bytes = writeSaveGameHeader({
 *   description: 'E1M1',
 *   gameepisode: 1,
 *   gamemap: 1,
 *   gameskill: 2,
 *   leveltime: 0x12_34_56,
 *   playeringame: [1, 0, 0, 0],
 * });
 * ```
 */
export function writeSaveGameHeader(header: SaveGameHeader): Uint8Array {
  assertFixedFieldValue('Savegame description', header.description, SAVEGAME_DESCRIPTION_SIZE);
  assertByte('gameskill', header.gameskill);
  assertByte('gameepisode', header.gameepisode);
  assertByte('gamemap', header.gamemap);

  const output = new Uint8Array(SAVEGAME_HEADER_SIZE);
  const descriptionField = createFixedField(header.description, SAVEGAME_DESCRIPTION_SIZE);
  const leveltime = header.leveltime >>> 0;

  output.set(descriptionField, 0);
  output.set(SAVEGAME_VERSION_FIELD, SAVEGAME_DESCRIPTION_SIZE);

  let index = SAVEGAME_DESCRIPTION_SIZE + SAVEGAME_VERSION_SIZE;

  output[index] = header.gameskill;
  index += 1;
  output[index] = header.gameepisode;
  index += 1;
  output[index] = header.gamemap;
  index += 1;

  for (let playerIndex = 0; playerIndex < SAVEGAME_PLAYER_COUNT; playerIndex += 1) {
    const presence = header.playeringame[playerIndex];

    assertByte(`playeringame[${playerIndex}]`, presence);
    output[index] = presence;
    index += 1;
  }

  output[index] = (leveltime >>> 16) & 0xff;
  index += 1;
  output[index] = (leveltime >>> 8) & 0xff;
  index += 1;
  output[index] = leveltime & 0xff;

  return output;
}

/**
 * Parse the Doom 1.9 savegame header bytes used by `P_ReadSaveGameHeader`.
 * @param source A buffer whose first 50 bytes contain the savegame header.
 * @returns The parsed header, or `null` when the embedded version string does not match.
 * @example
 * ```ts
 * const header = readSaveGameHeader(bytes);
 *
 * if (header !== null) {
 *   console.log(header.leveltime);
 * }
 * ```
 */
export function readSaveGameHeader(source: Uint8Array): SaveGameHeader | null {
  assertBufferSize(source);

  const versionStart = SAVEGAME_DESCRIPTION_SIZE;

  for (let index = 0; index < SAVEGAME_VERSION_SIZE; index += 1) {
    if (source[versionStart + index] !== SAVEGAME_VERSION_FIELD[index]) {
      return null;
    }
  }

  const description = readFixedField(source, 0, SAVEGAME_DESCRIPTION_SIZE);
  let index = versionStart + SAVEGAME_VERSION_SIZE;

  const gameskill = source[index];
  index += 1;
  const gameepisode = source[index];
  index += 1;
  const gamemap = source[index];
  index += 1;
  const playeringame = Object.freeze([source[index], source[index + 1], source[index + 2], source[index + 3]]) as SaveGamePlayerPresence;

  index += SAVEGAME_PLAYER_COUNT;

  const leveltime = (source[index] << 16) | (source[index + 1] << 8) | source[index + 2];

  return Object.freeze({
    description,
    gameepisode,
    gamemap,
    gameskill,
    leveltime,
    playeringame,
  });
}
