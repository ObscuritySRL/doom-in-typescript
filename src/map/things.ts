/**
 * THINGS lump loader.
 *
 * Parses the binary THINGS lump from a Doom map into an array of
 * mapthing_t entries. Each entry is 10 bytes: five signed 16-bit
 * little-endian fields (x, y, angle, type, options), matching the
 * struct layout in Chocolate Doom's doomdata.h and the P_LoadThings
 * function in p_setup.c.
 *
 * @example
 * ```ts
 * import { parseThings, MAPTHING_SIZE } from "../src/map/things.ts";
 * const things = parseThings(bundle.things);
 * console.log(things.length);     // 138 for E1M1
 * console.log(things[0]!.type);   // 1 (player 1 start)
 * ```
 */

import { BinaryReader } from '../core/binaryReader.ts';

/** Size of a single mapthing_t entry in the WAD binary format (bytes). */
export const MAPTHING_SIZE = 10;

/** Thing appears on skill 1-2 (I'm too young to die / Hey, not too rough). */
export const MTF_EASY = 1;

/** Thing appears on skill 3 (Hurt me plenty). */
export const MTF_NORMAL = 2;

/** Thing appears on skill 4-5 (Ultra-Violence / Nightmare!). */
export const MTF_HARD = 4;

/** Thing is deaf/ambush — only wakes on sight, not sound. */
export const MTF_AMBUSH = 8;

/** Thing does not appear in single-player mode (multiplayer only). */
export const MTF_NOT_SINGLE = 16;

/**
 * A parsed map thing entry matching mapthing_t from doomdata.h.
 *
 * All fields are signed 16-bit integers matching the C `short` type.
 */
export interface MapThing {
  /** X position in map units. */
  readonly x: number;
  /** Y position in map units. */
  readonly y: number;
  /** Facing angle in degrees. */
  readonly angle: number;
  /** DoomedNum — editor thing type number. */
  readonly type: number;
  /** MTF_* option flags bitmask. */
  readonly options: number;
}

/**
 * Parse the THINGS lump into an array of map thing entries.
 *
 * Reads sequential 10-byte mapthing_t structs from the lump buffer,
 * matching vanilla Doom's P_LoadThings (p_setup.c). All five fields
 * are read as signed int16LE via the SHORT() macro equivalent.
 *
 * @param lumpData - Raw THINGS lump buffer.
 * @returns Frozen array of frozen MapThing entries.
 * @throws {RangeError} If the lump size is not a multiple of MAPTHING_SIZE.
 */
export function parseThings(lumpData: Buffer): readonly MapThing[] {
  if (lumpData.length % MAPTHING_SIZE !== 0) {
    throw new RangeError(`THINGS lump size ${lumpData.length} is not a multiple of ${MAPTHING_SIZE}`);
  }

  const count = lumpData.length / MAPTHING_SIZE;
  const reader = new BinaryReader(lumpData);
  const things: MapThing[] = new Array(count);

  for (let index = 0; index < count; index++) {
    things[index] = Object.freeze({
      x: reader.readInt16(),
      y: reader.readInt16(),
      angle: reader.readInt16(),
      type: reader.readInt16(),
      options: reader.readInt16(),
    });
  }

  return Object.freeze(things);
}
