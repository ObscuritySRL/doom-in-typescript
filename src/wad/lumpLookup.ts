/**
 * WAD lump name lookup.
 *
 * Provides fast name-based lump lookup over a parsed WAD directory,
 * matching vanilla Doom's W_CheckNumForName / W_GetNumForName semantics:
 *
 * - Names are compared case-insensitively (uppercased).
 * - When multiple lumps share a name, the **last** one wins (PWAD override).
 * - W_CheckNumForName returns -1 on miss; W_GetNumForName throws.
 *
 * @example
 * ```ts
 * import { LumpLookup } from "../src/wad/lumpLookup.ts";
 * const lookup = new LumpLookup(directory);
 * const idx = lookup.checkNumForName("PLAYPAL"); // 0
 * const data = lookup.getLumpData("E1M1", wadBuffer); // Buffer slice
 * ```
 */

import type { DirectoryEntry } from './directory.ts';

/**
 * Fast lump-name lookup table built from a parsed WAD directory.
 *
 * The internal hash map stores the index of the **last** directory entry
 * for each unique uppercased name, reproducing vanilla Doom's override
 * semantics where later lumps (e.g. from a PWAD appended to the search
 * order) shadow earlier ones.
 */
export class LumpLookup {
  /** Map from uppercased lump name to the last directory index with that name. */
  private readonly nameToIndex: Map<string, number>;

  /** The underlying directory entries (same reference, not copied). */
  private readonly entries: readonly DirectoryEntry[];

  /**
   * Build a lookup table from a parsed WAD directory.
   *
   * @param directory - Frozen array of directory entries from `parseWadDirectory`.
   */
  constructor(directory: readonly DirectoryEntry[]) {
    this.entries = directory;
    this.nameToIndex = new Map();
    for (let i = 0; i < directory.length; i++) {
      this.nameToIndex.set(directory[i]!.name.toUpperCase(), i);
    }
  }

  /** Number of unique lump names in the lookup table. */
  get uniqueCount(): number {
    return this.nameToIndex.size;
  }

  /** Total number of directory entries (including duplicates). */
  get totalCount(): number {
    return this.entries.length;
  }

  /**
   * Look up a lump by name, returning its directory index or -1 if not found.
   *
   * Matches vanilla Doom's `W_CheckNumForName` semantics:
   * - Case-insensitive comparison.
   * - Returns the index of the **last** directory entry with the given name.
   * - Returns -1 if no entry matches.
   *
   * @param name - Lump name to search for (max 8 chars, case-insensitive).
   */
  checkNumForName(name: string): number {
    return this.nameToIndex.get(name.toUpperCase()) ?? -1;
  }

  /**
   * Look up a lump by name, returning its directory index or throwing if not found.
   *
   * Matches vanilla Doom's `W_GetNumForName` semantics.
   *
   * @param name - Lump name to search for (max 8 chars, case-insensitive).
   * @throws {Error} If no lump with the given name exists.
   */
  getNumForName(name: string): number {
    const idx = this.checkNumForName(name);
    if (idx === -1) {
      throw new Error(`W_GetNumForName: ${name.toUpperCase()} not found!`);
    }
    return idx;
  }

  /**
   * Get the directory entry for a lump by index.
   *
   * @param index - Zero-based directory index.
   * @throws {RangeError} If index is out of bounds.
   */
  getEntry(index: number): DirectoryEntry {
    if (index < 0 || index >= this.entries.length) {
      throw new RangeError(`Lump index ${index} out of range [0, ${this.entries.length})`);
    }
    return this.entries[index]!;
  }

  /**
   * Get the raw lump data for a named lump.
   *
   * @param name - Lump name to search for (case-insensitive).
   * @param wadBuffer - Buffer containing the entire WAD file.
   * @returns A Buffer slice of the lump's data.
   * @throws {Error} If the lump name is not found.
   */
  getLumpData(name: string, wadBuffer: Buffer): Buffer {
    const idx = this.getNumForName(name);
    const entry = this.entries[idx]!;
    return wadBuffer.subarray(entry.offset, entry.offset + entry.size);
  }

  /**
   * Check whether a lump with the given name exists.
   *
   * @param name - Lump name (case-insensitive).
   */
  hasLump(name: string): boolean {
    return this.nameToIndex.has(name.toUpperCase());
  }

  /**
   * Get all directory indices for entries matching the given name.
   *
   * Unlike `checkNumForName` which returns only the last match,
   * this returns every index in directory order. Useful for iterating
   * all instances of a lump (e.g. multiple REJECT lumps across maps).
   *
   * @param name - Lump name (case-insensitive).
   */
  getAllIndicesForName(name: string): readonly number[] {
    const upper = name.toUpperCase();
    const indices: number[] = [];
    for (let i = 0; i < this.entries.length; i++) {
      if (this.entries[i]!.name.toUpperCase() === upper) {
        indices.push(i);
      }
    }
    return indices;
  }
}
