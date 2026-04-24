/**
 * COLORMAP lump parser.
 *
 * Parses the COLORMAP lump from a WAD file into 34 discrete 256-byte
 * lookup tables.  Each colormap maps a palette index (0–255) to another
 * palette index, implementing light diminishing and special effects.
 *
 * Colormap assignments match vanilla Doom's R_InitColormaps / R_DrawColumn:
 *
 * | Index | Purpose                                     |
 * | ----- | ------------------------------------------- |
 * | 0     | Full brightness                             |
 * | 1–31  | Decreasing light levels (darker)            |
 * | 32    | Invulnerability inverse grayscale            |
 * | 33    | All-black (used internally by the renderer)  |
 *
 * @example
 * ```ts
 * import { parseColormap, COLORMAP_COUNT } from "../src/assets/colormap.ts";
 * const colormaps = parseColormap(colormapLumpData);
 * console.log(colormaps.length); // 34
 * console.log(colormaps[0].length); // 256
 * ```
 */

/** Number of colormaps stored in the COLORMAP lump. */
export const COLORMAP_COUNT = 34;

/** Number of entries per colormap (one per palette index). */
export const ENTRIES_PER_COLORMAP = 256;

/** Byte size of a single colormap. */
export const COLORMAP_SIZE = ENTRIES_PER_COLORMAP;

/** Expected total byte size of the COLORMAP lump (34 * 256 = 8704). */
export const COLORMAP_LUMP_SIZE = COLORMAP_COUNT * COLORMAP_SIZE;

/** Number of light-level colormaps (indices 0–31). */
export const LIGHTLEVEL_COUNT = 32;

/** Index of the invulnerability colormap. */
export const INVULNERABILITY_COLORMAP = 32;

/** Index of the all-black colormap. */
export const ALLBLACK_COLORMAP = 33;

/**
 * Parse the COLORMAP lump into an array of 34 colormaps.
 *
 * Each returned colormap is a Uint8Array of 256 bytes.  Entry `i` of
 * colormap `c` gives the palette index that palette index `i` maps to
 * under that colormap's light level or effect.
 *
 * The returned array is frozen. Individual colormap Uint8Array values
 * remain live views into `lumpData` and must be treated as read-only.
 *
 * @param lumpData - Raw COLORMAP lump data (must be exactly 8704 bytes).
 * @returns Frozen array of 34 Uint8Array colormap views.
 * @throws {RangeError} If the lump data is not exactly 8704 bytes.
 */
export function parseColormap(lumpData: Buffer | Uint8Array): readonly Uint8Array[] {
  if (lumpData.length !== COLORMAP_LUMP_SIZE) {
    throw new RangeError(`COLORMAP lump must be exactly ${COLORMAP_LUMP_SIZE} bytes, got ${lumpData.length}`);
  }

  const colormaps: Uint8Array[] = new Array(COLORMAP_COUNT);
  for (let index = 0; index < COLORMAP_COUNT; index++) {
    const offset = index * COLORMAP_SIZE;
    colormaps[index] = new Uint8Array(lumpData.buffer, lumpData.byteOffset + offset, COLORMAP_SIZE);
  }

  return Object.freeze(colormaps);
}
