/**
 * Texture-number → `PreparedWallTexture` — the
 * `texture` half of Chocolate Doom 2.2.1 r_data.c `R_InitTextures` +
 * `R_GenerateLookup` / `R_GenerateComposite`, exposed as the
 * {@link TextureResolver} {@link makeResolveRenderSegDeps} consumes.
 *
 * `R_InitTextures` builds the `textures[]` array in combined
 * `TEXTURE1`(+`TEXTURE2`) order with `textures[i]->index = i`; a
 * texture *number* is exactly that index (the value
 * {@link makeTextureNumberResolver} hands back, and the value the I2
 * {@link storeWallRange} emits in `mid/top/bottomTexture`). This builder
 * is the inverse map: index → the composited
 * {@link PreparedWallTexture}, via the {@link buildWallPatchPlacements}
 * `R_InitTextures` patch-resolution loop feeding {@link prepareWallTexture}'s
 * `R_GenerateLookup` / `R_GenerateComposite` passes.
 *
 * Vanilla generates a texture's composite lazily on first
 * `R_GetColumn` and caches it (`texturecomposite`); the produced column
 * data is identical whether built eagerly or lazily, so this memoizes
 * per number (a deterministic, parity-neutral cache — the same number
 * always yields the same frozen {@link PreparedWallTexture} instance).
 *
 * A number outside the definition list cannot name a vanilla texture
 * (`R_TextureNumForName` only ever yields a valid index, and `0` is the
 * real first texture — the seg path gates "no texture" as
 * `textureNumber === 0` *before* resolving, in {@link makeResolveRenderSegDeps},
 * so it never reaches here): an out-of-range number is a wiring error
 * and throws rather than fabricating an empty texture.
 *
 * Pure; no Win32 or runtime dependencies.
 */

import type { TextureDefinition } from '../assets/texture1.ts';

import type { TextureResolver } from './resolveRenderSegDeps.ts';
import { prepareWallTexture } from './wallColumns.ts';
import type { PreparedWallTexture } from './wallColumns.ts';
import { buildWallPatchPlacements } from './wallPatchPlacements.ts';
import type { PatchByName } from './wallPatchPlacements.ts';

/** Optional DI hooks (default to the committed composite pipeline). */
export interface TextureCatalogHooks {
  readonly buildWallPatchPlacementsFn?: typeof buildWallPatchPlacements;
  readonly prepareWallTextureFn?: typeof prepareWallTexture;
}

/**
 * Build the texture-number → {@link PreparedWallTexture} resolver from
 * the combined ordered `TEXTURE1`(+`TEXTURE2`) definition list (index =
 * vanilla `textures[i]->index` = texture number), `PNAMES`, and the
 * `W_CheckNumForName` + decoded-patch resolver. Composites are built on
 * first request and memoized (parity-neutral cache).
 *
 * @param orderedDefinitions - `[...parseTextureLump(TEXTURE1), ...(hasTexture2 ? parseTextureLump(TEXTURE2) : [])]`.
 * @param pnames - The {@link parsePnames} array.
 * @param patchByName - `W_CheckNumForName` + decoded-patch cache (`null` ⇒ missing lump).
 * @returns A {@link TextureResolver}: in-range number → its composite; out-of-range throws.
 * @throws {RangeError} (from the resolver) If asked for a number outside the definition list.
 *
 * @example
 * ```ts
 * const textureOf = makeTextureCatalog(orderedDefs, pnames, (n) => decodePatch(wad.lumpByName(n)));
 * const resolve = makeResolveRenderSegDeps(scalelightRows, textureOf, targets);
 * ```
 */
export function makeTextureCatalog(orderedDefinitions: readonly TextureDefinition[], pnames: readonly string[], patchByName: PatchByName, hooks: TextureCatalogHooks = {}): TextureResolver {
  const buildPlacements = hooks.buildWallPatchPlacementsFn ?? buildWallPatchPlacements;
  const prepare = hooks.prepareWallTextureFn ?? prepareWallTexture;
  const cache = new Map<number, PreparedWallTexture>();

  return (textureNumber: number): PreparedWallTexture => {
    const cached = cache.get(textureNumber);
    if (cached !== undefined) {
      return cached;
    }

    const def = orderedDefinitions[textureNumber];
    if (def === undefined) {
      throw new RangeError(`makeTextureCatalog: texture number ${textureNumber} outside 0..${orderedDefinitions.length - 1}`);
    }

    const prepared = prepare(def.name, def.width, def.height, buildPlacements(def, pnames, patchByName));
    cache.set(textureNumber, prepared);
    return prepared;
  };
}
