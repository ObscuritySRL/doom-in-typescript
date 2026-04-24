/**
 * Blockmap iteration functions.
 *
 * Implements P_BlockLinesIterator from Chocolate Doom's p_maputl.c and
 * the coordinate-to-block-index conversions used throughout p_map.c.
 *
 * The validcount mechanism deduplicates linedef visits when a single
 * spatial query spans multiple blockmap cells. The caller increments
 * the generation counter once, then iterates cells; each linedef is
 * stamped on first visit and skipped thereafter.
 *
 * @example
 * ```ts
 * import { createValidCount, incrementValidCount, blockLinesIterator } from "../src/map/blockmapIter.ts";
 * const validCount = createValidCount(linedefCount);
 * incrementValidCount(validCount);
 * blockLinesIterator(bx, by, blockmap, validCount, (index) => { console.log(index); return true; });
 * ```
 */

import type { Fixed } from '../core/fixed.ts';
import type { Blockmap } from './blockmap.ts';
import { MAPBLOCKSHIFT } from './blockmap.ts';

/**
 * Mutable linedef-visit tracker for deduplicating line visits across
 * multiple blockmap cells within a single spatial query.
 *
 * Matches the validcount / ld->validcount mechanism in Chocolate Doom's
 * p_maputl.c. Before iterating a set of cells, the caller increments
 * `current`; blockLinesIterator stamps each visited line with `current`
 * and skips lines that already carry the current value.
 */
export interface ValidCount {
  /** Current query generation. Increment before each multi-cell pass. */
  current: number;
  /** Per-linedef stamp array. Index i holds the generation when linedef i was last visited. */
  readonly stamps: Int32Array;
}

/**
 * Create a ValidCount tracker sized for a given number of linedefs.
 *
 * @param linedefCount - Total number of linedefs in the map.
 * @returns A fresh ValidCount with all stamps at 0 and current at 0.
 *
 * @example
 * ```ts
 * const validCount = createValidCount(linedefs.length);
 * ```
 */
export function createValidCount(linedefCount: number): ValidCount {
  return {
    current: 0,
    stamps: new Int32Array(linedefCount),
  };
}

/**
 * Increment the valid-count generation before a new multi-cell query.
 *
 * Matches `validcount++` in Chocolate Doom before calling
 * P_BlockLinesIterator across multiple cells.
 *
 * @param validCount - Tracker to advance.
 *
 * @example
 * ```ts
 * incrementValidCount(validCount);
 * // now iterate cells — each linedef visited at most once
 * ```
 */
export function incrementValidCount(validCount: ValidCount): void {
  validCount.current = (validCount.current + 1) | 0;
}

/**
 * Convert a fixed-point world X coordinate to a blockmap column index.
 *
 * Matches the pattern `(x - bmaporgx) >> MAPBLOCKSHIFT` used throughout
 * Chocolate Doom's p_map.c and p_maputl.c.
 *
 * @param x - World X in 16.16 fixed-point.
 * @param blockmap - Parsed blockmap.
 * @returns Integer column index (may be negative or >= columns for out-of-bounds).
 */
export function worldToBlockX(x: Fixed, blockmap: Blockmap): number {
  return ((x - blockmap.originX) | 0) >> MAPBLOCKSHIFT;
}

/**
 * Convert a fixed-point world Y coordinate to a blockmap row index.
 *
 * Matches the pattern `(y - bmaporgy) >> MAPBLOCKSHIFT`.
 *
 * @param y - World Y in 16.16 fixed-point.
 * @param blockmap - Parsed blockmap.
 * @returns Integer row index (may be negative or >= rows for out-of-bounds).
 */
export function worldToBlockY(y: Fixed, blockmap: Blockmap): number {
  return ((y - blockmap.originY) | 0) >> MAPBLOCKSHIFT;
}

/**
 * Iterate linedef indices in a single blockmap cell.
 *
 * Reproduces P_BlockLinesIterator from Chocolate Doom's p_maputl.c
 * exactly:
 *
 * 1. Out-of-bounds cell coordinates return true (continue), matching
 *    the original bounds check.
 * 2. The block list in the lump includes a leading 0 entry that IS
 *    processed — linedef 0 is a real linedef, and vanilla Doom does
 *    not skip it. This is parity-critical.
 * 3. The validcount mechanism stamps each linedef on first visit and
 *    skips it on subsequent encounters within the same query generation.
 * 4. The callback receives linedef indices in lump order (the on-disk
 *    order of the BLOCKMAP lump's block list for this cell).
 * 5. If the callback returns false, iteration stops and the function
 *    returns false. Otherwise it returns true after the -1 terminator.
 *
 * @param blockX - Column index in blockmap grid.
 * @param blockY - Row index in blockmap grid.
 * @param blockmap - Parsed blockmap structure.
 * @param validCount - Deduplication tracker (mutated on each visit).
 * @param callback - Called with each unique linedef index; return false to stop early.
 * @returns true if all lines were checked, false if the callback stopped iteration.
 */
export function blockLinesIterator(blockX: number, blockY: number, blockmap: Blockmap, validCount: ValidCount, callback: (linedefIndex: number) => boolean): boolean {
  if (blockX < 0 || blockY < 0 || blockX >= blockmap.columns || blockY >= blockmap.rows) {
    return true;
  }

  const cellIndex = blockY * blockmap.columns + blockX;
  const wordOffset = blockmap.offsets[cellIndex]!;
  const lump = blockmap.lumpData;

  let cursor = wordOffset * 2;
  while (cursor + 2 <= lump.length) {
    const linedefIndex = lump.readInt16LE(cursor);
    cursor += 2;

    if (linedefIndex === -1) {
      break;
    }

    if (validCount.stamps[linedefIndex] === validCount.current) {
      continue;
    }
    validCount.stamps[linedefIndex] = validCount.current;

    if (!callback(linedefIndex)) {
      return false;
    }
  }

  return true;
}
