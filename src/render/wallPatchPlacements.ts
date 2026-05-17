/**
 * `TextureDefinition` → `WallPatchPlacement[]` — the patch-resolution
 * half of Chocolate Doom 2.2.1 r_data.c `R_InitTextures`.
 *
 * `R_InitTextures` builds `patchlookup[i] = W_CheckNumForName(pnames[i])`
 * over the `PNAMES` array, then for every `mappatch_t` of every texture
 * copies `originx` / `originy` verbatim and binds
 * `patch->patch = patchlookup[SHORT(mpatch->patch)]`, `I_Error`ing
 * (`"R_InitTextures: Missing patch in texture %s"`) when that lookup is
 * `-1`. The composite passes (`R_GenerateLookup` /
 * `R_GenerateComposite`, with their non-power-of-two wrap and
 * negative-`originy` clipping quirks) live in {@link prepareWallTexture};
 * this builder is only the upstream placement resolution it consumes.
 *
 * `pnames` is the {@link parsePnames} result (patch name per patch
 * number). `patchByName` models `W_CheckNumForName` + the cached,
 * {@link decodePatch}-decoded graphic: it returns the {@link DecodedPatch}
 * for an existing patch lump, or `null` for `W_CheckNumForName == -1`
 * (the vanilla `patch->patch == -1` → `I_Error` case, rethrown here with
 * the upstream message — never a silent skip). A `patchIndex` outside
 * `PNAMES` (vanilla reads `patchlookup` out of bounds — undefined
 * behavior in C) is a malformed-lump wiring error and throws rather than
 * fabricating a placement.
 *
 * Pure; no Win32 or runtime dependencies.
 */

import type { TextureDefinition } from '../assets/texture1.ts';

import type { DecodedPatch } from './patchDraw.ts';
import type { WallPatchPlacement } from './wallColumns.ts';

/**
 * `W_CheckNumForName` + `W_CacheLumpNum` + {@link decodePatch} for one
 * `PNAMES` entry: the decoded patch graphic, or `null` when the patch
 * lump does not exist (vanilla `W_CheckNumForName == -1`).
 */
export type PatchByName = (patchLumpName: string) => DecodedPatch | null;

/**
 * Resolve one combined-order {@link TextureDefinition} into the
 * `WallPatchPlacement[]` {@link prepareWallTexture} consumes,
 * reproducing the `R_InitTextures` per-`mappatch_t` loop: `originx` /
 * `originy` copied verbatim (already signed by `parseTextureLump`),
 * `patchIndex` mapped through `PNAMES` then `patchByName`, a `-1`
 * lookup raised as the upstream `I_Error`.
 *
 * @param def - A texture definition from the combined `TEXTURE1`(+`TEXTURE2`) list.
 * @param pnames - The {@link parsePnames} array (patch name by patch number).
 * @param patchByName - `W_CheckNumForName` + decoded-patch cache; `null` ⇒ missing lump.
 * @throws {RangeError} If a `patchIndex` is outside the `PNAMES` array.
 * @throws {Error} `R_InitTextures: Missing patch in texture <name>` if `patchByName` returns `null`.
 *
 * @example
 * ```ts
 * const pnames = parsePnames(pnamesLump);
 * const placements = buildWallPatchPlacements(def, pnames, (n) => decodePatch(wad.lumpByName(n)));
 * const texture = prepareWallTexture(def.name, def.width, def.height, placements);
 * ```
 */
export function buildWallPatchPlacements(def: TextureDefinition, pnames: readonly string[], patchByName: PatchByName): readonly WallPatchPlacement[] {
  const placements: WallPatchPlacement[] = new Array(def.patches.length);

  for (let patchIndex = 0; patchIndex < def.patches.length; patchIndex += 1) {
    const mappatch = def.patches[patchIndex]!;
    const patchName = pnames[mappatch.patchIndex];
    if (patchName === undefined) {
      // Vanilla indexes patchlookup[SHORT(mpatch->patch)] unguarded —
      // an out-of-range PNAMES index is undefined behavior in C; a
      // faithful re-implementation hard-errors instead of fabricating.
      throw new RangeError(`buildWallPatchPlacements: texture ${def.name} patch ${patchIndex} references PNAMES index ${mappatch.patchIndex} outside 0..${pnames.length - 1}`);
    }

    const patch = patchByName(patchName);
    if (patch === null) {
      // patchlookup[i] == -1 → I_Error in R_InitTextures.
      throw new Error(`R_InitTextures: Missing patch in texture ${def.name}`);
    }

    placements[patchIndex] = Object.freeze({
      originX: mappatch.originX,
      originY: mappatch.originY,
      patch,
    });
  }

  return Object.freeze(placements);
}
