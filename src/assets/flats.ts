/**
 * Flat catalog.
 *
 * Builds a catalog of floor/ceiling flat textures from a WAD directory.
 * Flats are raw 64x64 palette-indexed pixel arrays (4096 bytes each)
 * located between the F_START and F_END markers.
 *
 * Vanilla Doom's `R_InitFlats` resolves the flat range as:
 *
 *     firstflat = W_GetNumForName("F_START") + 1
 *     lastflat  = W_GetNumForName("F_END") - 1
 *     numflats  = lastflat - firstflat + 1
 *
 * All entries between the markers are assigned sequential flat numbers,
 * including inner markers (F1_START, F1_END).  This is load-bearing:
 * the flat translation table and animated flat lookups use these numbers.
 *
 * @example
 * ```ts
 * import { buildFlatCatalog, FLAT_SIZE } from "../src/assets/flats.ts";
 * const catalog = buildFlatCatalog(directory);
 * console.log(catalog.count);           // 56 for DOOM1.WAD
 * console.log(catalog.entries[0].name); // "F1_START"
 * ```
 */

import type { DirectoryEntry } from '../wad/directory.ts';
import { resolveMarkerRange } from '../wad/markerRange.ts';

/** Width of a flat texture in pixels. */
export const FLAT_WIDTH = 64;

/** Height of a flat texture in pixels. */
export const FLAT_HEIGHT = 64;

/** Byte size of a single flat (64 x 64 raw palette-indexed pixels). */
export const FLAT_SIZE = FLAT_WIDTH * FLAT_HEIGHT;

/** A single entry in the flat catalog. */
export interface FlatEntry {
  /** Lump name (uppercase, null-stripped). */
  readonly name: string;
  /** Zero-based index in the WAD directory. */
  readonly directoryIndex: number;
  /** Flat number relative to firstflat (used by flat translation table). */
  readonly flatNumber: number;
  /** True if this entry is an inner marker (F1_START, F1_END) rather than pixel data. */
  readonly isMarker: boolean;
}

/** Catalog of all flat entries resolved from a WAD directory. */
export interface FlatCatalog {
  /** Directory index of the first flat entry (F_START + 1). */
  readonly firstFlatIndex: number;
  /** Directory index of the last flat entry (F_END - 1). */
  readonly lastFlatIndex: number;
  /** Total number of entries between the markers (including inner markers). */
  readonly count: number;
  /** Number of entries that are actual flat data (excludes inner markers). */
  readonly dataCount: number;
  /** Frozen array of flat entries in directory order. */
  readonly entries: readonly FlatEntry[];
}

/** Names recognized as inner markers within the flat range. */
const INNER_MARKER_NAMES = new Set(['F1_START', 'F1_END']);

/**
 * Build a flat catalog from a parsed WAD directory.
 *
 * Resolves the F_START / F_END marker range and catalogs every entry
 * between them, matching vanilla Doom's `R_InitFlats` semantics.
 *
 * @param directory - Parsed WAD directory entries.
 * @returns Frozen flat catalog.
 * @throws {Error} If F_START or F_END markers are missing or misordered.
 */
export function buildFlatCatalog(directory: readonly DirectoryEntry[]): FlatCatalog {
  const range = resolveMarkerRange(directory, 'F_START', 'F_END');

  const entries: FlatEntry[] = new Array(range.count);
  let dataCount = 0;

  for (let i = 0; i < range.count; i++) {
    const directoryIndex = range.firstContentIndex + i;
    const entry = directory[directoryIndex]!;
    const isMarker = INNER_MARKER_NAMES.has(entry.name.toUpperCase());

    if (!isMarker) {
      dataCount++;
    }

    entries[i] = {
      name: entry.name,
      directoryIndex,
      flatNumber: i,
      isMarker,
    };
  }

  return Object.freeze({
    firstFlatIndex: range.firstContentIndex,
    lastFlatIndex: range.lastContentIndex,
    count: range.count,
    dataCount,
    entries: Object.freeze(entries),
  });
}
