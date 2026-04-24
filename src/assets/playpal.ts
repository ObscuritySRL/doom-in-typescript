/**
 * PLAYPAL lump parser.
 *
 * Parses the PLAYPAL lump from a WAD file into 14 discrete 256-color
 * RGB palettes.  Each palette is a flat Uint8Array of 768 bytes
 * (256 entries * 3 bytes per entry: R, G, B).
 *
 * Palette index assignments match vanilla Doom's st_stuff.c
 * ST_doPaletteStuff palette selection logic:
 *
 * | Index | Purpose                            |
 * | ----- | ---------------------------------- |
 * | 0     | Normal (no effect)                 |
 * | 1–8   | Damage / berserk red tint          |
 * | 9–12  | Bonus item pickup gold tint        |
 * | 13    | Radiation suit green tint          |
 *
 * @example
 * ```ts
 * import { parsePlaypal, PALETTE_COUNT } from "../src/assets/playpal.ts";
 * const palettes = parsePlaypal(playpalLumpData);
 * console.log(palettes.length); // 14
 * console.log(palettes[0].length); // 768
 * ```
 */

/** Number of palettes stored in the PLAYPAL lump. */
export const PALETTE_COUNT = 14;

/** Number of color entries per palette. */
export const COLORS_PER_PALETTE = 256;

/** Bytes per color entry (R, G, B). */
export const BYTES_PER_COLOR = 3;

/** Byte size of a single palette (256 * 3 = 768). */
export const PALETTE_SIZE = COLORS_PER_PALETTE * BYTES_PER_COLOR;

/** Expected total byte size of the PLAYPAL lump (14 * 768 = 10752). */
export const PLAYPAL_SIZE = PALETTE_COUNT * PALETTE_SIZE;

/** Index of the first damage/berserk red palette. */
export const STARTREDPALS = 1;

/** Number of damage/berserk red palettes. */
export const NUMREDPALS = 8;

/** Index of the first bonus item pickup palette. */
export const STARTBONUSPALS = 9;

/** Number of bonus item pickup palettes. */
export const NUMBONUSPALS = 4;

/** Index of the radiation suit palette. */
export const RADIATIONPAL = 13;

/**
 * Parse the PLAYPAL lump into an array of 14 palettes.
 *
 * Each returned palette is a Uint8Array of 768 bytes laid out as
 * 256 consecutive (R, G, B) triplets. The returned array is frozen,
 * but each palette remains a live view into `lumpData`.
 *
 * @param lumpData - Raw PLAYPAL lump data (must be exactly 10752 bytes).
 * @returns Frozen array of 14 Uint8Array palette views.
 * @throws {RangeError} If the lump data is not exactly 10752 bytes.
 */
export function parsePlaypal(lumpData: Buffer | Uint8Array): readonly Uint8Array[] {
  if (lumpData.length !== PLAYPAL_SIZE) {
    throw new RangeError(`PLAYPAL lump must be exactly ${PLAYPAL_SIZE} bytes, got ${lumpData.length}`);
  }

  const palettes: Uint8Array[] = new Array(PALETTE_COUNT);
  for (let index = 0; index < PALETTE_COUNT; index++) {
    const offset = index * PALETTE_SIZE;
    palettes[index] = new Uint8Array(lumpData.buffer, lumpData.byteOffset + offset, PALETTE_SIZE);
  }

  return Object.freeze(palettes);
}
