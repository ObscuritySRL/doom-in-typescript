/**
 * Flat-name → flat-number resolver (Chocolate Doom 2.2.1 r_data.c
 * `R_FlatNumForName` / `skyflatnum`).
 *
 * The assembled-renderer seg adapter (I4d {@link segRenderModel}) and
 * the I2 {@link storeWallRange} coordinator compare floor / ceiling
 * `picnum`s as integers and test them against `skyflatnum`. Vanilla
 * derives those numbers with `R_FlatNumForName`, which returns the
 * looked-up lump's `i - firstflat` (the `firstflat`-relative flat
 * number). The repo's {@link FlatCatalog} already assigns each
 * `F_START`..`F_END` entry exactly that number (`FlatEntry.flatNumber`
 * == `directoryIndex - firstFlatIndex`); this module exposes it as the
 * injected `flatNumber` resolver the renderer pipeline consumes.
 *
 * `W_CheckNumForName` (which `R_FlatNumForName` calls) searches the
 * directory backwards, so a duplicate flat name resolves to its LAST
 * (highest-index) occurrence; a missing flat triggers `I_Error`.
 *
 * Pure; no Win32 or runtime dependencies.
 */

import type { FlatCatalog } from '../assets/flats.ts';

import type { FlatNumberResolver } from './segRenderModel.ts';

/** Vanilla `SKYFLATNAME` (r_data.c) — the flat name that means "sky". */
export const SKY_FLAT_NAME = 'F_SKY1';

/**
 * Build a flat-name → flat-number resolver from a {@link FlatCatalog},
 * reproducing r_data.c `R_FlatNumForName`. Lookup is case-insensitive
 * (uppercased, like `W_CheckNumForName`); a duplicate name resolves to
 * its LAST occurrence (the directory is searched backwards); a missing
 * flat throws, modelling `R_FlatNumForName`'s `I_Error`.
 *
 * @example
 * ```ts
 * const flatNumber = makeFlatNumberResolver(buildFlatCatalog(directory));
 * const picnum = flatNumber('FLOOR4_8');
 * ```
 */
export function makeFlatNumberResolver(catalog: FlatCatalog): FlatNumberResolver {
  const numberByName = new Map<string, number>();
  // Forward iteration with overwrite → the last (highest directory
  // index) occurrence wins, matching W_CheckNumForName's backward scan.
  for (const entry of catalog.entries) {
    numberByName.set(entry.name.toUpperCase(), entry.flatNumber);
  }

  return (flatName: string): number => {
    const flatNumber = numberByName.get(flatName.toUpperCase());
    if (flatNumber === undefined) {
      throw new Error(`R_FlatNumForName: ${flatName} not found`);
    }
    return flatNumber;
  };
}

/** `skyflatnum = R_FlatNumForName(SKYFLATNAME)` (r_data.c R_InitData). */
export function skyFlatNumber(catalog: FlatCatalog): number {
  return makeFlatNumberResolver(catalog)(SKY_FLAT_NAME);
}
