/**
 * WAD marker range resolution.
 *
 * Resolves the contiguous block of lumps between a named start/end
 * marker pair, matching vanilla Doom's `R_InitFlats` / `R_InitSpriteLumps`
 * pattern: `first = W_GetNumForName(start) + 1`,
 * `last = W_GetNumForName(end) - 1`, `count = last - first + 1`.
 *
 * @example
 * ```ts
 * import { resolveMarkerRange } from "../src/wad/markerRange.ts";
 * const sprites = resolveMarkerRange(directory, "S_START", "S_END");
 * console.log(sprites.count); // 483
 * ```
 */

import type { DirectoryEntry } from './directory.ts';

/** A resolved range of lumps between two named markers. */
export interface MarkerRange {
  /** Directory index of the start marker lump. */
  readonly startMarkerIndex: number;
  /** Directory index of the end marker lump. */
  readonly endMarkerIndex: number;
  /** First content lump index (`startMarkerIndex + 1`). */
  readonly firstContentIndex: number;
  /** Last content lump index (`endMarkerIndex - 1`). */
  readonly lastContentIndex: number;
  /** Number of lumps between the markers (may include inner markers). */
  readonly count: number;
}

/**
 * Resolve the range of lumps between two named markers.
 *
 * Matches vanilla Doom's marker resolution semantics:
 * - Names are compared case-insensitively (uppercased).
 * - When multiple lumps share a marker name, the **last** one wins.
 * - The content range is `(startMarkerIndex + 1)` through `(endMarkerIndex - 1)`.
 * - Adjacent markers (empty range) are valid and produce `count === 0`.
 *
 * @param directory - Parsed WAD directory entries.
 * @param startMarker - Name of the start marker (e.g. `"S_START"`).
 * @param endMarker - Name of the end marker (e.g. `"S_END"`).
 * @throws {Error} If either marker is not found or end precedes/equals start.
 */
export function resolveMarkerRange(directory: readonly DirectoryEntry[], startMarker: string, endMarker: string): MarkerRange {
  const startUpper = startMarker.toUpperCase();
  const endUpper = endMarker.toUpperCase();

  let startIndex = -1;
  let endIndex = -1;

  for (let i = 0; i < directory.length; i++) {
    const name = directory[i]!.name.toUpperCase();
    if (name === startUpper) startIndex = i;
    if (name === endUpper) endIndex = i;
  }

  if (startIndex === -1) {
    throw new Error(`W_GetNumForName: ${startUpper} not found!`);
  }
  if (endIndex === -1) {
    throw new Error(`W_GetNumForName: ${endUpper} not found!`);
  }
  if (endIndex <= startIndex) {
    throw new Error(`Marker ${endUpper} at index ${endIndex} must come after ${startUpper} at index ${startIndex}`);
  }

  return Object.freeze({
    startMarkerIndex: startIndex,
    endMarkerIndex: endIndex,
    firstContentIndex: startIndex + 1,
    lastContentIndex: endIndex - 1,
    count: endIndex - startIndex - 1,
  });
}
