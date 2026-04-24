/**
 * PNAMES lump parser.
 *
 * Parses the PNAMES lump from a WAD file into an ordered array of patch
 * name strings.  Each name is a null-padded 8-byte ASCII field matching
 * the WAD directory name format.
 *
 * PNAMES provides the patch-name-to-index mapping consumed by the
 * TEXTURE1 / TEXTURE2 composite texture definitions.  Each texture
 * patch reference stores a numeric index into this array rather than
 * the name directly.
 *
 * Binary layout:
 *
 * | Offset | Size        | Field                              |
 * | ------ | ----------- | ---------------------------------- |
 * | 0      | 4           | int32LE count of patch names       |
 * | 4      | count × 8   | null-padded 8-byte ASCII names     |
 *
 * @example
 * ```ts
 * import { parsePnames, PNAMES_NAME_SIZE } from "../src/assets/pnames.ts";
 * const names = parsePnames(pnamesLumpData);
 * console.log(names[0]); // "WALL00_3"
 * ```
 */

import { BinaryReader } from '../core/binaryReader.ts';

/** Byte size of the count field at the start of the PNAMES lump. */
export const PNAMES_HEADER_SIZE = 4;

/** Byte size of each patch name entry (null-padded ASCII). */
export const PNAMES_NAME_SIZE = 8;

/**
 * Parse the PNAMES lump into a frozen array of uppercase patch name strings.
 *
 * Names are read as 8-byte null-padded ASCII fields and uppercased to
 * match vanilla Doom's case-insensitive name comparisons.  Trailing
 * null bytes are stripped.
 *
 * @param lumpData - Raw PNAMES lump data.
 * @returns Frozen array of patch name strings, indexed by patch number.
 * @throws {RangeError} If the lump is too small for the header or the
 *   declared count exceeds the available data.
 */
export function parsePnames(lumpData: Buffer | Uint8Array): readonly string[] {
  if (lumpData.length < PNAMES_HEADER_SIZE) {
    throw new RangeError(`PNAMES lump must be at least ${PNAMES_HEADER_SIZE} bytes, got ${lumpData.length}`);
  }

  const buffer = lumpData instanceof Buffer ? lumpData : Buffer.from(lumpData);
  const reader = new BinaryReader(buffer);

  const count = reader.readInt32();
  if (count < 0) {
    throw new RangeError(`PNAMES count must be non-negative, got ${count}`);
  }

  const expectedSize = PNAMES_HEADER_SIZE + count * PNAMES_NAME_SIZE;
  if (lumpData.length < expectedSize) {
    throw new RangeError(`PNAMES lump too small: header declares ${count} names ` + `(${expectedSize} bytes needed), but lump is only ${lumpData.length} bytes`);
  }

  const names: string[] = new Array(count);
  for (let index = 0; index < count; index++) {
    names[index] = reader.readAscii(PNAMES_NAME_SIZE).toUpperCase();
  }

  return Object.freeze(names);
}
