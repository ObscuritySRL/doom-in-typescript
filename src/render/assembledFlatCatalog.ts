/**
 * Bit-exact flat catalog from a parsed WAD — the Chocolate Doom 2.2.1
 * r_data.c `R_FlatNumForName` + the r_plane.c `ds_source =
 * W_CacheLumpNum(firstflat + flattranslation[picnum])` flat fetch.
 *
 * Sectors store `floorpic` / `ceilingpic` as the `R_FlatNumForName`
 * result (lump index minus `firstflat`); the regular-plane span pass
 * needs the 4096-byte (64×64) flat for that number. This composes both
 * over the committed bit-exact {@link buildFlatCache} (whose
 * `flatNumber` is exactly the `i - firstflat` value and whose `pixels`
 * are the copied 64×64 palette bytes):
 *
 *   - `flatNumber(name)` = `R_FlatNumForName` — case-insensitive
 *     (`W_CheckNumForName`), a miss is `I_Error` (thrown, not a silent
 *     wrong flat).
 *   - `flatSource(picnum)` = the non-marker flat whose `flatNumber ===
 *     picnum`. `flattranslation` is identity here (animated flats —
 *     `P_InitPicAnims` / `P_UpdateSpecials` — are a deferred increment,
 *     consistent with the assembled renderer's documented deferrals);
 *     an out-of-range `picnum` is a wiring error and throws.
 *
 * Pure WAD parsing; no Win32 or runtime dependencies.
 */

import { buildFlatCache } from '../assets/build-flat-cache.ts';
import type { DirectoryEntry } from '../wad/directory.ts';

import type { FlatSourceResolver } from './regularPlaneDrawer.ts';
import type { FlatNumberResolver } from './segRenderModel.ts';

/** The flat-number resolver + flat-source resolver for one IWAD. */
export interface AssembledFlatCatalog {
  /** `R_FlatNumForName` (flat name → `i - firstflat`). */
  readonly flatNumber: FlatNumberResolver;
  /** `picnum` → its 4096-byte 64×64 flat (`ds_source`). */
  readonly flatSource: FlatSourceResolver;
}

/**
 * Build the bit-exact flat catalog from a parsed WAD directory +
 * buffer.
 *
 * @example
 * ```ts
 * const flats = buildAssembledFlatCatalog(wadDirectory, wadBuffer);
 * const picnum = flats.flatNumber('FLOOR4_8');
 * const dsSource = flats.flatSource(picnum); // 4096 bytes
 * ```
 */
export function buildAssembledFlatCatalog(directory: readonly DirectoryEntry[], wadBuffer: Buffer): AssembledFlatCatalog {
  const cache = buildFlatCache({ directory, wadBuffer });

  // Index the real (non-marker) flat pixels by their flat number.
  const flatByNumber: Uint8Array[] = [];
  for (const entry of cache.entries) {
    if (entry.isInnerMarker || entry.pixels === null) {
      continue;
    }
    flatByNumber[entry.flatNumber] = entry.pixels;
  }

  const flatNumber: FlatNumberResolver = (name: string): number => {
    const number = cache.flatNameToNumber.get(name.toUpperCase());
    if (number === undefined) {
      // R_FlatNumForName: W_CheckNumForName == -1 → I_Error.
      throw new Error(`R_FlatNumForName: ${name} not found`);
    }
    return number;
  };

  const flatSource: FlatSourceResolver = (picnum: number): Uint8Array => {
    const pixels = flatByNumber[picnum];
    if (pixels === undefined) {
      throw new RangeError(`buildAssembledFlatCatalog: flat number ${picnum} has no flat lump (outside 0..${flatByNumber.length - 1})`);
    }
    return pixels;
  };

  return Object.freeze({ flatNumber, flatSource });
}
