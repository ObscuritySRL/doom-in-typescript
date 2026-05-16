/**
 * Texture-name → texture-number resolver (Chocolate Doom 2.2.1
 * r_data.c `R_CheckTextureNumForName` / `R_TextureNumForName`).
 *
 * The assembled-renderer seg adapter (I4d {@link segRenderModel})
 * resolves sidedef top / bottom / mid texture names to integer texture
 * numbers for the I2 {@link storeWallRange} coordinator. Vanilla
 * `R_InitTextures` builds the texture array in combined
 * `TEXTURE1`(+`TEXTURE2`) order with `textures[i]->index = i`;
 * `R_CheckTextureNumForName` returns that index, with two parity-load-
 * bearing rules transcribed verbatim from the upstream source:
 *
 *   - the `"-"` NoTexture marker (`name[0] == '-'`) returns `0`;
 *   - a name match is case-insensitive over 8 characters
 *     (`strncasecmp(texture->name, name, 8)`);
 *   - a miss returns `-1` (`R_TextureNumForName` then `I_Error`s).
 *
 * The vanilla `textures_hashtable` is a lookup accelerator inserted
 * LIFO over `i = 0..numtextures`, so a duplicate name resolves to its
 * highest (last) index; a forward-iteration map with overwrite
 * reproduces that exactly.
 *
 * Pure; no Win32 or runtime dependencies.
 */

import type { TextureDefinition } from '../assets/texture1.ts';

import type { TextureNumberResolver } from './segRenderModel.ts';

const TEXTURE_NAME_COMPARE_LENGTH = 8;

function textureKey(name: string): string {
  return name.slice(0, TEXTURE_NAME_COMPARE_LENGTH).toUpperCase();
}

/**
 * Build a texture-name → texture-number resolver from the combined
 * ordered `TEXTURE1`(+`TEXTURE2`) definition list (index = position =
 * vanilla `textures[i]->index`), reproducing `R_TextureNumForName`
 * (which calls `R_CheckTextureNumForName`): `"-"` → `0`,
 * case-insensitive 8-char match → index, miss → `I_Error` (throw).
 *
 * @example
 * ```ts
 * const textureNumber = makeTextureNumberResolver([
 *   ...parseTextureLump(texture1Lump),
 *   ...(hasTexture2 ? parseTextureLump(texture2Lump) : []),
 * ]);
 * const sidedefTop = textureNumber('STARTAN3');
 * ```
 */
export function makeTextureNumberResolver(orderedDefinitions: readonly TextureDefinition[]): TextureNumberResolver {
  const indexByName = new Map<string, number>();
  // R_InitTextures assigns index = i over the combined order; the LIFO
  // hashtable means the highest-index duplicate wins → forward overwrite.
  for (let index = 0; index < orderedDefinitions.length; index += 1) {
    indexByName.set(textureKey(orderedDefinitions[index]!.name), index);
  }

  return (textureName: string): number => {
    // R_CheckTextureNumForName: "-" NoTexture marker → 0.
    if (textureName.charAt(0) === '-') {
      return 0;
    }
    const index = indexByName.get(textureKey(textureName));
    if (index === undefined) {
      // R_CheckTextureNumForName returns -1 → R_TextureNumForName I_Errors.
      throw new Error(`R_TextureNumForName: ${textureName} not found`);
    }
    return index;
  };
}
