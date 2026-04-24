/**
 * Blockmap binary lump loader.
 *
 * Parses the BLOCKMAP lump from a Doom map into a typed structure
 * matching the on-disk layout and the P_LoadBlockMap function in
 * Chocolate Doom's p_setup.c.
 *
 * The blockmap is a 2-D grid overlaid on the map at 128×128 map-unit
 * resolution. Each cell stores a word offset into the lump where a
 * block list begins. Block lists are sequences of signed int16 linedef
 * indices terminated by -1, with a leading 0 entry that vanilla Doom's
 * P_BlockLinesIterator does NOT skip (it processes linedef 0).
 *
 * @example
 * ```ts
 * import { parseBlockmap, MAPBLOCKSIZE } from "../src/map/blockmap.ts";
 * const blockmap = parseBlockmap(bundle.blockmap);
 * console.log(blockmap.columns, blockmap.rows); // grid dimensions
 * ```
 */

import type { Fixed } from '../core/fixed.ts';
import { FRACBITS } from '../core/fixed.ts';
import { BinaryReader } from '../core/binaryReader.ts';

/** Size of the blockmap header in bytes (4 signed int16 values). */
export const BLOCKMAP_HEADER_SIZE = 8;

/** Number of int16 words in the blockmap header. */
export const BLOCKMAP_HEADER_WORDS = 4;

/** Block size in map units. Each blockmap cell covers 128×128 map units. */
export const MAPBLOCKSIZE = 128;

/** Shift from map units to block grid coordinates (128 = 1 << 7). */
export const MAPBTOFRAC = 7;

/**
 * Shift from 16.16 fixed-point coordinates to block grid coordinates.
 * Combines FRACBITS (16) and MAPBTOFRAC (7) = 23.
 */
export const MAPBLOCKSHIFT = FRACBITS + MAPBTOFRAC;

/**
 * A parsed blockmap matching the layout produced by P_LoadBlockMap
 * in Chocolate Doom's p_setup.c.
 *
 * Header words 0–3 become originX/Y (fixed-point) and columns/rows.
 * The offset table (words 4 through 4+columns×rows-1) stores per-cell
 * absolute word indices into the lump data. The raw lump buffer is
 * retained for block-list traversal by later iteration code.
 */
export interface Blockmap {
  /** X origin of the grid in 16.16 fixed-point (header word 0 << FRACBITS). */
  readonly originX: Fixed;
  /** Y origin of the grid in 16.16 fixed-point (header word 1 << FRACBITS). */
  readonly originY: Fixed;
  /** Number of columns in the grid (header word 2). */
  readonly columns: number;
  /** Number of rows in the grid (header word 3). */
  readonly rows: number;
  /** Per-cell word offsets into lumpData (columns×rows entries). */
  readonly offsets: readonly number[];
  /** Raw lump data for block-list traversal (read int16LE at wordOffset × 2). */
  readonly lumpData: Buffer;
}

/**
 * Parse the BLOCKMAP lump into a typed blockmap structure.
 *
 * Reads the 4-word header (originX, originY, columns, rows), then
 * the columns×rows word-offset table. The raw lump buffer is
 * preserved for runtime block-list traversal by P_BlockLinesIterator.
 *
 * Matches the canonical P_LoadBlockMap in p_setup.c: header words are
 * signed int16 (short), offset-table values are read from the same
 * short* array, and origins are left-shifted by FRACBITS.
 *
 * @param lumpData - Raw BLOCKMAP lump buffer.
 * @returns Frozen Blockmap structure.
 * @throws {RangeError} If the lump is too small, has odd size, or
 *   declares invalid dimensions.
 */
export function parseBlockmap(lumpData: Buffer): Blockmap {
  if (lumpData.length < BLOCKMAP_HEADER_SIZE) {
    throw new RangeError(`BLOCKMAP lump size ${lumpData.length} is too small (minimum ${BLOCKMAP_HEADER_SIZE})`);
  }

  if (lumpData.length % 2 !== 0) {
    throw new RangeError(`BLOCKMAP lump size ${lumpData.length} is not a multiple of 2`);
  }

  const reader = new BinaryReader(lumpData);
  const rawOriginX = reader.readInt16();
  const rawOriginY = reader.readInt16();
  const columns = reader.readInt16();
  const rows = reader.readInt16();

  if (columns <= 0 || rows <= 0) {
    throw new RangeError(`BLOCKMAP dimensions ${columns}x${rows} must be positive`);
  }

  const cellCount = columns * rows;
  const minimumLumpSize = BLOCKMAP_HEADER_SIZE + cellCount * 2;

  if (lumpData.length < minimumLumpSize) {
    throw new RangeError(`BLOCKMAP lump size ${lumpData.length} is too small for ${columns}x${rows} grid (need at least ${minimumLumpSize})`);
  }

  const totalWords = lumpData.length / 2;
  const offsets: number[] = new Array(cellCount);

  for (let index = 0; index < cellCount; index++) {
    const wordOffset = reader.readInt16();

    if (wordOffset < 0 || wordOffset >= totalWords) {
      throw new RangeError(`BLOCKMAP cell ${index} has out-of-bounds offset ${wordOffset} (lump has ${totalWords} words)`);
    }

    offsets[index] = wordOffset;
  }

  return Object.freeze({
    originX: (rawOriginX << FRACBITS) | 0,
    originY: (rawOriginY << FRACBITS) | 0,
    columns,
    rows,
    offsets: Object.freeze(offsets),
    lumpData,
  });
}
