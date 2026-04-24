/**
 * Patch and sprite catalogs.
 *
 * Builds catalogs of wall patch and sprite lumps from a WAD directory.
 * Patches are located between P_START/P_END markers (with P1_START/P1_END
 * inner markers). Sprites are located between S_START/S_END markers
 * (no inner markers in the shareware IWAD).
 *
 * Vanilla Doom resolves sprite ranges with the same pattern as flats:
 *
 *     firstspritelump = W_GetNumForName("S_START") + 1
 *     lastspritelump  = W_GetNumForName("S_END") - 1
 *     numspritelumps  = lastspritelump - firstspritelump + 1
 *
 * @example
 * ```ts
 * import { buildPatchCatalog, buildSpriteCatalog } from "../src/assets/patchCatalog.ts";
 * const patches = buildPatchCatalog(directory);
 * console.log(patches.count);           // 167 for DOOM1.WAD
 * const sprites = buildSpriteCatalog(directory);
 * console.log(sprites.count);           // 483 for DOOM1.WAD
 * ```
 */

import type { DirectoryEntry } from '../wad/directory.ts';
import { resolveMarkerRange } from '../wad/markerRange.ts';

/** A single entry in the patch catalog. */
export interface PatchEntry {
  /** Lump name (uppercase, null-stripped). */
  readonly name: string;
  /** Zero-based index in the WAD directory. */
  readonly directoryIndex: number;
  /** Patch number relative to firstPatchIndex (used by composite texture lookups). */
  readonly patchNumber: number;
  /** True if this entry is an inner marker (P1_START, P1_END) rather than pixel data. */
  readonly isMarker: boolean;
}

/** Catalog of all patch entries resolved from a WAD directory. */
export interface PatchCatalog {
  /** Directory index of the first patch entry (P_START + 1). */
  readonly firstPatchIndex: number;
  /** Directory index of the last patch entry (P_END - 1). */
  readonly lastPatchIndex: number;
  /** Total number of entries between the markers (including inner markers). */
  readonly count: number;
  /** Number of entries that are actual patch data (excludes inner markers). */
  readonly dataCount: number;
  /** Frozen array of patch entries in directory order. */
  readonly entries: readonly PatchEntry[];
}

/** A single entry in the sprite catalog. */
export interface SpriteEntry {
  /** Lump name (uppercase, null-stripped). */
  readonly name: string;
  /** Zero-based index in the WAD directory. */
  readonly directoryIndex: number;
  /** Sprite lump number relative to firstSpriteIndex (used by R_InitSpriteLumps). */
  readonly spriteNumber: number;
}

/** Catalog of all sprite entries resolved from a WAD directory. */
export interface SpriteCatalog {
  /** Directory index of the first sprite entry (S_START + 1). */
  readonly firstSpriteIndex: number;
  /** Directory index of the last sprite entry (S_END - 1). */
  readonly lastSpriteIndex: number;
  /** Total number of sprite entries between the markers. */
  readonly count: number;
  /** Frozen array of sprite entries in directory order. */
  readonly entries: readonly SpriteEntry[];
}

/** Names recognized as inner markers within the patch range. */
const PATCH_INNER_MARKERS = new Set(['P1_START', 'P1_END']);

/**
 * Build a patch catalog from a parsed WAD directory.
 *
 * Resolves the P_START / P_END marker range and catalogs every entry
 * between them, including inner markers P1_START and P1_END.
 *
 * @param directory - Parsed WAD directory entries.
 * @returns Frozen patch catalog.
 * @throws {Error} If P_START or P_END markers are missing or misordered.
 */
export function buildPatchCatalog(directory: readonly DirectoryEntry[]): PatchCatalog {
  const range = resolveMarkerRange(directory, 'P_START', 'P_END');

  const entries: PatchEntry[] = new Array(range.count);
  let dataCount = 0;

  for (let i = 0; i < range.count; i++) {
    const directoryIndex = range.firstContentIndex + i;
    const entry = directory[directoryIndex]!;
    const isMarker = PATCH_INNER_MARKERS.has(entry.name.toUpperCase());

    if (!isMarker) {
      dataCount++;
    }

    entries[i] = {
      name: entry.name,
      directoryIndex,
      patchNumber: i,
      isMarker,
    };
  }

  return Object.freeze({
    firstPatchIndex: range.firstContentIndex,
    lastPatchIndex: range.lastContentIndex,
    count: range.count,
    dataCount,
    entries: Object.freeze(entries),
  });
}

/**
 * Build a sprite catalog from a parsed WAD directory.
 *
 * Resolves the S_START / S_END marker range and catalogs every entry
 * between them, matching vanilla Doom's `R_InitSpriteLumps` semantics.
 *
 * @param directory - Parsed WAD directory entries.
 * @returns Frozen sprite catalog.
 * @throws {Error} If S_START or S_END markers are missing or misordered.
 */
export function buildSpriteCatalog(directory: readonly DirectoryEntry[]): SpriteCatalog {
  const range = resolveMarkerRange(directory, 'S_START', 'S_END');

  const entries: SpriteEntry[] = new Array(range.count);

  for (let i = 0; i < range.count; i++) {
    const directoryIndex = range.firstContentIndex + i;
    const entry = directory[directoryIndex]!;

    entries[i] = {
      name: entry.name,
      directoryIndex,
      spriteNumber: i,
    };
  }

  return Object.freeze({
    firstSpriteIndex: range.firstContentIndex,
    lastSpriteIndex: range.lastContentIndex,
    count: range.count,
    entries: Object.freeze(entries),
  });
}
