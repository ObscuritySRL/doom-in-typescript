/**
 * WAD directory parser.
 *
 * Parses the lump directory that follows the header in a WAD file.
 * Each entry is 16 bytes: 4-byte file position, 4-byte size, 8-byte
 * null-padded ASCII name.
 *
 * @example
 * ```ts
 * import { parseWadHeader } from "../src/wad/header.ts";
 * import { parseWadDirectory } from "../src/wad/directory.ts";
 * const header = parseWadHeader(buffer);
 * const directory = parseWadDirectory(buffer, header);
 * console.log(directory[0].name); // "PLAYPAL"
 * ```
 */

import type { WadHeader } from './header.ts';

/** A single lump entry from the WAD directory. */
export interface DirectoryEntry {
  /** Byte offset from the start of the WAD file to this lump's data. */
  readonly offset: number;
  /** Size of this lump's data in bytes. */
  readonly size: number;
  /** Lump name, up to 8 ASCII characters, trailing nulls stripped. */
  readonly name: string;
}

/** Byte length of a single directory entry. */
export const DIRECTORY_ENTRY_SIZE = 16;

/**
 * Parse the lump directory from a WAD file buffer.
 *
 * @param buffer - Buffer containing the entire WAD file.
 * @param header - Previously parsed WAD header.
 * @returns Frozen array of directory entries in file order.
 * @throws {RangeError} If the buffer is too short to contain the full directory.
 */
export function parseWadDirectory(buffer: Buffer, header: WadHeader): readonly DirectoryEntry[] {
  if (header.lumpCount < 0) {
    throw new RangeError(`WAD directory lump count must be non-negative, got ${header.lumpCount}`);
  }

  if (header.directoryOffset < 0) {
    throw new RangeError(`WAD directory offset must be non-negative, got ${header.directoryOffset}`);
  }

  const requiredEnd = header.directoryOffset + header.lumpCount * DIRECTORY_ENTRY_SIZE;
  if (buffer.length < requiredEnd) {
    throw new RangeError(`WAD directory requires ${requiredEnd} bytes, buffer is ${buffer.length}`);
  }

  const entries: DirectoryEntry[] = new Array(header.lumpCount);
  for (let index = 0; index < header.lumpCount; index++) {
    const base = header.directoryOffset + index * DIRECTORY_ENTRY_SIZE;
    const offset = buffer.readInt32LE(base);
    const size = buffer.readInt32LE(base + 4);

    if (offset < 0) {
      throw new RangeError(`WAD directory entry ${index} has negative lump offset ${offset}`);
    }

    if (size < 0) {
      throw new RangeError(`WAD directory entry ${index} has negative lump size ${size}`);
    }

    if (offset + size > buffer.length) {
      throw new RangeError(`WAD directory entry ${index} exceeds buffer bounds: offset=${offset}, size=${size}, buffer=${buffer.length}`);
    }

    entries[index] = {
      offset,
      size,
      name: buffer
        .subarray(base + 8, base + 16)
        .toString('ascii')
        .replace(/\0+$/, ''),
    };
  }

  return Object.freeze(entries);
}
