/**
 * Bit-exact texture / patch / sky / COLORMAP catalog from a parsed WAD
 * — the Chocolate Doom 2.2.1 `R_InitTextures` / `R_InitColormaps`
 * asset half of the assembled renderer's config.
 *
 * The launcher's `loadGameplayRenderResources` composes textures via a
 * simplified `composeTexture` (no `R_GenerateLookup` /
 * `R_GenerateComposite` non-pow2-wrap / negative-`originy` quirks), so
 * its `GameplayTexture` columns are not guaranteed bit-exact. This
 * builds the catalog the *assembled* (bit-exact) pipeline needs from
 * the same raw lumps: `PNAMES` + `TEXTURE1`(+`TEXTURE2`) →
 * {@link makeTextureNumberResolver} + the {@link makeTextureCatalog}
 * composite catalog (vanilla composition via {@link prepareWallTexture}
 * over {@link buildWallPatchPlacements}); the P_START..P_END patch
 * lumps decoded once (`W_CheckNumForName` is case-insensitive — keyed
 * upper-cased); `COLORMAP` via {@link parseColormap}; the sky texture
 * prepared through the identical bit-exact composite path.
 *
 * Pure WAD parsing + composition; no Win32 or runtime dependencies.
 * Flat numbering / flat source (the `firstflat`-relative
 * `R_FlatNumForName`) is a sibling concern (its own builder).
 */

import { parseColormap } from '../assets/colormap.ts';
import { buildPatchCatalog } from '../assets/patchCatalog.ts';
import { parsePnames } from '../assets/pnames.ts';
import { parseTextureLump } from '../assets/texture1.ts';
import type { TextureDefinition } from '../assets/texture1.ts';
import type { DirectoryEntry } from '../wad/directory.ts';
import { LumpLookup } from '../wad/lumpLookup.ts';

import { decodePatch } from './patchDraw.ts';
import type { DecodedPatch } from './patchDraw.ts';
import type { TextureResolver } from './resolveRenderSegDeps.ts';
import type { TextureNumberResolver } from './segRenderModel.ts';
import { makeTextureCatalog } from './textureCatalog.ts';
import { makeTextureNumberResolver } from './textureNumberResolver.ts';
import { prepareWallTexture } from './wallColumns.ts';
import type { PreparedWallTexture } from './wallColumns.ts';
import { buildWallPatchPlacements } from './wallPatchPlacements.ts';
import type { PatchByName } from './wallPatchPlacements.ts';

/** Episode-1 sky texture (shareware / registered DOOM1.WAD). */
const SKY_TEXTURE_NAME = 'SKY1';

/** The bit-exact texture/patch/sky/COLORMAP catalog for one IWAD. */
export interface AssembledTextureCatalog {
  /** Combined `TEXTURE1`(+`TEXTURE2`) defs; index = vanilla texture number. */
  readonly orderedDefinitions: readonly TextureDefinition[];
  /** `PNAMES` patch-name array. */
  readonly pnames: readonly string[];
  /** `W_CheckNumForName` + decoded-patch cache (`null` ⇒ missing). */
  readonly patchByName: PatchByName;
  /** `R_TextureNumForName` (sidedef name → texture number). */
  readonly textureNumber: TextureNumberResolver;
  /** Texture number → composited {@link PreparedWallTexture}. */
  readonly textureOf: TextureResolver;
  /** Loaded 32(+invuln/etc.)-ramp COLORMAP. */
  readonly colormaps: readonly Uint8Array[];
  /** `SKY1` prepared through the bit-exact composite path. */
  readonly skyTexture: PreparedWallTexture;
}

/**
 * Build the bit-exact texture/patch/sky/COLORMAP catalog from a parsed
 * WAD directory + buffer.
 *
 * @example
 * ```ts
 * const cat = buildAssembledTextureCatalog(wadDirectory, wadBuffer);
 * const sidedefTexNum = cat.textureNumber('STARTAN3');
 * const prepared = cat.textureOf(sidedefTexNum);
 * ```
 */
export function buildAssembledTextureCatalog(directory: readonly DirectoryEntry[], wadBuffer: Buffer): AssembledTextureCatalog {
  const lookup = new LumpLookup(directory);

  const pnames = parsePnames(lookup.getLumpData('PNAMES', wadBuffer));
  const orderedDefinitions: readonly TextureDefinition[] = Object.freeze([...parseTextureLump(lookup.getLumpData('TEXTURE1', wadBuffer)), ...(lookup.hasLump('TEXTURE2') ? parseTextureLump(lookup.getLumpData('TEXTURE2', wadBuffer)) : [])]);

  // R_InitPatches: decode each P_START..P_END patch lump once, keyed by
  // upper-cased name (W_CheckNumForName is case-insensitive).
  const patchCatalog = buildPatchCatalog(directory);
  const decodedByDirectoryIndex = new Map<number, DecodedPatch>();
  const patchByUpperName = new Map<string, DecodedPatch>();
  for (const entry of patchCatalog.entries) {
    if (entry.isMarker) {
      continue;
    }
    let decoded = decodedByDirectoryIndex.get(entry.directoryIndex);
    if (decoded === undefined) {
      const de = lookup.getEntry(entry.directoryIndex);
      decoded = decodePatch(wadBuffer.subarray(de.offset, de.offset + de.size));
      decodedByDirectoryIndex.set(entry.directoryIndex, decoded);
    }
    patchByUpperName.set(entry.name.toUpperCase(), decoded);
  }
  const patchByName: PatchByName = (name: string): DecodedPatch | null => patchByUpperName.get(name.toUpperCase()) ?? null;

  const textureNumber = makeTextureNumberResolver(orderedDefinitions);
  const textureOf = makeTextureCatalog(orderedDefinitions, pnames, patchByName);
  const colormaps = parseColormap(lookup.getLumpData('COLORMAP', wadBuffer));

  // Sky is an ordinary texture composited through the bit-exact path.
  const skyDef = orderedDefinitions.find((definition) => definition.name.toUpperCase() === SKY_TEXTURE_NAME);
  if (skyDef === undefined) {
    throw new Error(`buildAssembledTextureCatalog: ${SKY_TEXTURE_NAME} not found in TEXTURE1/TEXTURE2`);
  }
  const skyTexture = prepareWallTexture(skyDef.name, skyDef.width, skyDef.height, buildWallPatchPlacements(skyDef, pnames, patchByName));

  return Object.freeze({ orderedDefinitions, pnames, patchByName, textureNumber, textureOf, colormaps, skyTexture });
}
