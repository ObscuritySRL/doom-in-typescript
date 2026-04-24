/**
 * WAD file header parser.
 *
 * Parses the 12-byte header present at offset 0 of every WAD file,
 * extracting the identification tag, lump count, and directory offset.
 *
 * @example
 * ```ts
 * import { parseWadHeader } from "../src/wad/header.ts";
 * const header = parseWadHeader(buffer);
 * console.log(header.type); // "IWAD"
 * ```
 */

/** Discriminant for Internal WAD vs. Patch WAD. */
export type WadType = 'IWAD' | 'PWAD';

/** Parsed 12-byte WAD file header. */
export interface WadHeader {
  /** Whether this is an Internal WAD or a Patch WAD. */
  readonly type: WadType;
  /** Number of lumps recorded in the directory. */
  readonly lumpCount: number;
  /** Byte offset from the start of the file to the first directory entry. */
  readonly directoryOffset: number;
}

/** Byte length of the WAD file header. */
export const WAD_HEADER_SIZE = 12;

const VALID_TYPES = new Set<string>(['IWAD', 'PWAD']);

/**
 * Parse the 12-byte header from a WAD file buffer.
 *
 * @param buffer - Buffer containing at least the first 12 bytes of a WAD file.
 * @returns The parsed header fields.
 * @throws {RangeError} If the buffer is shorter than 12 bytes.
 * @throws {Error} If the identification bytes are not "IWAD" or "PWAD".
 */
export function parseWadHeader(buffer: Buffer): WadHeader {
  if (buffer.length < WAD_HEADER_SIZE) {
    throw new RangeError(`WAD header requires ${WAD_HEADER_SIZE} bytes, got ${buffer.length}`);
  }

  const identification = buffer.subarray(0, 4).toString('ascii');
  if (!VALID_TYPES.has(identification)) {
    throw new Error(`Invalid WAD identification: expected "IWAD" or "PWAD", got "${identification}"`);
  }

  const lumpCount = buffer.readInt32LE(4);
  if (lumpCount < 0) {
    throw new RangeError(`WAD header lump count must be non-negative, got ${lumpCount}`);
  }

  const directoryOffset = buffer.readInt32LE(8);
  if (directoryOffset < 0) {
    throw new RangeError(`WAD header directory offset must be non-negative, got ${directoryOffset}`);
  }

  return {
    type: identification as WadType,
    lumpCount,
    directoryOffset,
  };
}
