import type { DirectoryEntry } from '../wad/directory.ts';
import type { AssetLifetimeCategory, AssetPurgeTag } from './build-asset-cache-lifetime-policy.ts';
import type { DecodedPatchPicture, PatchPictureColumn } from './parse-patch-picture-format.ts';
import type { PnamesLump } from './parse-pnames-lump.ts';
import type { TextureOneEntry, TextureOneLump, TextureOneMappatch } from './parse-texture-one-lump.ts';
import type { TextureTwoEntry, TextureTwoLump, TextureTwoMappatch } from './parse-texture-two-when-present.ts';

import { LumpLookup } from '../wad/lumpLookup.ts';
import { classifyLifetimeCategory, getLifetimeTagForAsset } from './build-asset-cache-lifetime-policy.ts';
import { parsePatchPicture } from './parse-patch-picture-format.ts';

type TextureCompositionSource = 'TEXTURE1' | 'TEXTURE2';
type TextureEntry = TextureOneEntry | TextureTwoEntry;
type TextureMappatch = TextureOneMappatch | TextureTwoMappatch;

/** Input set needed to mirror vanilla R_InitTextures composition. */
export interface TextureCompositionCacheInput {
  /** Parsed WAD directory used for W_CheckNumForName-style patch lookup. */
  readonly directory: readonly DirectoryEntry[];
  /** Parsed PNAMES lump. */
  readonly pnames: PnamesLump;
  /** Parsed mandatory TEXTURE1 lump. */
  readonly textureOne: TextureOneLump;
  /** Parsed optional TEXTURE2 lump, or null/undefined when absent. */
  readonly textureTwo?: TextureTwoLump | null;
  /** Complete WAD byte buffer used to load referenced patch lumps. */
  readonly wadBuffer: Buffer;
}

/** One resolved patch reference inside a composed texture. */
export interface TextureCompositionPatch {
  /** Directory index of the resolved patch lump. */
  readonly directoryIndex: number;
  /** Signed x origin from mappatch_t.originx. */
  readonly originX: number;
  /** Signed y origin from mappatch_t.originy. */
  readonly originY: number;
  /** Zero-based PNAMES index from mappatch_t.patch. */
  readonly patchIndex: number;
  /** Uppercase patch lump name resolved from PNAMES. */
  readonly patchName: string;
}

/** Fully composed texture columns ready for renderer lookup. */
export interface TextureComposition {
  /** Composed texture columns; each column has exactly height palette-index bytes. */
  readonly columns: readonly Uint8Array[];
  /** Texture height in pixels. */
  readonly height: number;
  /** Texture name, uppercase and NUL-stripped. */
  readonly name: string;
  /** Number of mappatch entries in the source texture definition. */
  readonly patchCount: number;
  /** Resolved patch references in source order. */
  readonly patches: readonly TextureCompositionPatch[];
  /** Runtime texture index after TEXTURE1/TEXTURE2 aggregation. */
  readonly runtimeIndex: number;
  /** Source lump that contributed this texture. */
  readonly source: TextureCompositionSource;
  /** Texture width in pixels. */
  readonly width: number;
}

/** Runtime cache produced by the texture composition step. */
export interface TextureCompositionCache {
  /** Lifetime category inherited from TEXTURE1/TEXTURE2/PNAMES PU_STATIC policy. */
  readonly category: AssetLifetimeCategory;
  /** PNAMES patchlookup array: PNAMES index -> directory index, or -1 on miss. */
  readonly patchLookup: readonly number[];
  /** Purge tag inherited from TEXTURE1/TEXTURE2/PNAMES cache policy. */
  readonly tag: AssetPurgeTag;
  /** Uppercase texture name lookup, last duplicate wins. */
  readonly textureNameToIndex: ReadonlyMap<string, number>;
  /** Composed textures in runtime order. */
  readonly textures: readonly TextureComposition[];
}

/**
 * Build the static texture composition cache used by wall rendering.
 *
 * @param input - Parsed PNAMES, TEXTURE1/TEXTURE2, WAD directory, and WAD bytes.
 * @returns A frozen cache with patchlookup and composed texture columns.
 * @example
 * ```ts
 * const cache = buildTextureCompositionCache({ directory, pnames, textureOne, textureTwo: null, wadBuffer });
 * console.log(cache.textures[0]?.name);
 * ```
 */
export function buildTextureCompositionCache(input: TextureCompositionCacheInput): TextureCompositionCache {
  const tag = getLifetimeTagForAsset('TEXTURE1');
  if (tag === null) {
    throw new Error('buildTextureCompositionCache: TEXTURE1 lifetime policy is not audited');
  }

  const patchLookup = buildPatchLookup(input.directory, input.pnames);
  const patchPictures = new Map<number, DecodedPatchPicture>();
  const textureNameToIndex = new Map<string, number>();
  const textures: TextureComposition[] = [];

  appendTextureCompositions({
    cacheInput: input,
    patchLookup,
    patchPictures,
    source: 'TEXTURE1',
    textureNameToIndex,
    textures,
    textureEntries: input.textureOne.textures,
  });

  if (input.textureTwo !== null && input.textureTwo !== undefined) {
    appendTextureCompositions({
      cacheInput: input,
      patchLookup,
      patchPictures,
      source: 'TEXTURE2',
      textureNameToIndex,
      textures,
      textureEntries: input.textureTwo.textures,
    });
  }

  return Object.freeze({
    category: classifyLifetimeCategory(tag),
    patchLookup: Object.freeze(patchLookup),
    tag,
    textureNameToIndex,
    textures: Object.freeze(textures),
  });
}

/**
 * Resolve a composed texture by name using vanilla case-insensitive matching.
 *
 * @param cache - Texture composition cache built by {@link buildTextureCompositionCache}.
 * @param name - Texture name to resolve.
 * @returns Matching texture composition, or null when absent.
 * @example
 * ```ts
 * const texture = getTextureComposition(cache, 'BIGDOOR1');
 * console.log(texture?.width);
 * ```
 */
export function getTextureComposition(cache: TextureCompositionCache, name: string): TextureComposition | null {
  const textureIndex = cache.textureNameToIndex.get(name.toUpperCase());
  if (textureIndex === undefined) {
    return null;
  }
  return cache.textures[textureIndex] ?? null;
}

interface AppendTextureCompositionsInput {
  readonly cacheInput: TextureCompositionCacheInput;
  readonly patchLookup: readonly number[];
  readonly patchPictures: Map<number, DecodedPatchPicture>;
  readonly source: TextureCompositionSource;
  readonly textureEntries: readonly TextureEntry[];
  readonly textureNameToIndex: Map<string, number>;
  readonly textures: TextureComposition[];
}

function appendTextureCompositions(input: AppendTextureCompositionsInput): void {
  for (const textureEntry of input.textureEntries) {
    const runtimeIndex = input.textures.length;
    const texture = composeTexture({
      cacheInput: input.cacheInput,
      patchLookup: input.patchLookup,
      patchPictures: input.patchPictures,
      runtimeIndex,
      source: input.source,
      textureEntry,
    });
    input.textureNameToIndex.set(texture.name.toUpperCase(), runtimeIndex);
    input.textures.push(texture);
  }
}

interface ComposeTextureInput {
  readonly cacheInput: TextureCompositionCacheInput;
  readonly patchLookup: readonly number[];
  readonly patchPictures: Map<number, DecodedPatchPicture>;
  readonly runtimeIndex: number;
  readonly source: TextureCompositionSource;
  readonly textureEntry: TextureEntry;
}

function composeTexture(input: ComposeTextureInput): TextureComposition {
  validateTextureDimensions(input.textureEntry);

  const columns: Uint8Array[] = new Array(input.textureEntry.width);
  for (let columnIndex = 0; columnIndex < input.textureEntry.width; columnIndex += 1) {
    columns[columnIndex] = new Uint8Array(input.textureEntry.height);
  }

  if (input.textureEntry.patchCount !== input.textureEntry.patches.length) {
    throw new RangeError(`buildTextureCompositionCache: texture ${input.textureEntry.name} declares patchCount ${input.textureEntry.patchCount} but has ${input.textureEntry.patches.length} patches`);
  }

  const patches: TextureCompositionPatch[] = new Array(input.textureEntry.patches.length);
  for (let patchSlot = 0; patchSlot < input.textureEntry.patches.length; patchSlot += 1) {
    const texturePatch = input.textureEntry.patches[patchSlot]!;
    const resolvedPatch = resolveTexturePatch(input.cacheInput.directory, input.cacheInput.pnames, input.patchLookup, input.textureEntry, texturePatch);
    const patchPicture = getPatchPicture(input.cacheInput.directory, input.cacheInput.wadBuffer, input.patchPictures, resolvedPatch.directoryIndex);

    composePatchIntoTexture(columns, input.textureEntry.height, patchPicture, texturePatch);
    patches[patchSlot] = Object.freeze(resolvedPatch);
  }

  return Object.freeze({
    columns: Object.freeze(columns),
    height: input.textureEntry.height,
    name: input.textureEntry.name,
    patchCount: input.textureEntry.patchCount,
    patches: Object.freeze(patches),
    runtimeIndex: input.runtimeIndex,
    source: input.source,
    width: input.textureEntry.width,
  });
}

function buildPatchLookup(directory: readonly DirectoryEntry[], pnames: PnamesLump): number[] {
  const lookup = new LumpLookup(directory);
  const patchLookup: number[] = new Array(pnames.names.length);
  for (let patchIndex = 0; patchIndex < pnames.names.length; patchIndex += 1) {
    patchLookup[patchIndex] = lookup.checkNumForName(pnames.names[patchIndex]!);
  }
  return patchLookup;
}

function composePatchIntoTexture(columns: readonly Uint8Array[], textureHeight: number, patchPicture: DecodedPatchPicture, texturePatch: TextureMappatch): void {
  for (let sourceColumnIndex = 0; sourceColumnIndex < patchPicture.header.width; sourceColumnIndex += 1) {
    const targetColumnIndex = texturePatch.originX + sourceColumnIndex;
    if (targetColumnIndex < 0 || targetColumnIndex >= columns.length) {
      continue;
    }

    const targetColumn = columns[targetColumnIndex]!;
    const sourceColumn = patchPicture.columns[sourceColumnIndex]!;
    drawPatchColumnIntoTextureColumn(targetColumn, sourceColumn, texturePatch.originY, textureHeight);
  }
}

function drawPatchColumnIntoTextureColumn(targetColumn: Uint8Array, sourceColumn: PatchPictureColumn, originY: number, textureHeight: number): void {
  for (const post of sourceColumn) {
    let pixelCount = post.length;
    let sourcePixelOffset = 0;
    let targetRow = originY + post.topDelta;

    if (targetRow < 0) {
      sourcePixelOffset = -targetRow;
      pixelCount += targetRow;
      targetRow = 0;
    }

    if (targetRow + pixelCount > textureHeight) {
      pixelCount = textureHeight - targetRow;
    }

    if (pixelCount > 0) {
      targetColumn.set(post.pixels.subarray(sourcePixelOffset, sourcePixelOffset + pixelCount), targetRow);
    }
  }
}

function getPatchPicture(directory: readonly DirectoryEntry[], wadBuffer: Buffer, patchPictures: Map<number, DecodedPatchPicture>, directoryIndex: number): DecodedPatchPicture {
  const cachedPatch = patchPictures.get(directoryIndex);
  if (cachedPatch !== undefined) {
    return cachedPatch;
  }

  const entry = directory[directoryIndex];
  if (entry === undefined) {
    throw new RangeError(`buildTextureCompositionCache: patch directory index ${directoryIndex} is out of range`);
  }

  const patchPicture = parsePatchPicture(wadBuffer.subarray(entry.offset, entry.offset + entry.size));
  patchPictures.set(directoryIndex, patchPicture);
  return patchPicture;
}

function resolveTexturePatch(directory: readonly DirectoryEntry[], pnames: PnamesLump, patchLookup: readonly number[], texture: TextureEntry, texturePatch: TextureMappatch): TextureCompositionPatch {
  if (!Number.isInteger(texturePatch.patchIndex) || texturePatch.patchIndex < 0 || texturePatch.patchIndex >= pnames.names.length) {
    throw new RangeError(`buildTextureCompositionCache: texture ${texture.name} patch index ${texturePatch.patchIndex} is outside PNAMES count ${pnames.names.length}`);
  }

  const patchName = pnames.names[texturePatch.patchIndex]!;
  const directoryIndex = patchLookup[texturePatch.patchIndex]!;
  if (directoryIndex === -1) {
    throw new Error(`R_InitTextures: Missing patch in texture ${texture.name}`);
  }

  if (directory[directoryIndex] === undefined) {
    throw new RangeError(`buildTextureCompositionCache: patch lookup for ${patchName} resolved out-of-range directory index ${directoryIndex}`);
  }

  return {
    directoryIndex,
    originX: texturePatch.originX,
    originY: texturePatch.originY,
    patchIndex: texturePatch.patchIndex,
    patchName,
  };
}

function validateTextureDimensions(texture: TextureEntry): void {
  if (!Number.isInteger(texture.width) || texture.width < 0) {
    throw new RangeError(`buildTextureCompositionCache: texture ${texture.name} width must be a non-negative integer, got ${texture.width}`);
  }
  if (!Number.isInteger(texture.height) || texture.height < 0) {
    throw new RangeError(`buildTextureCompositionCache: texture ${texture.name} height must be a non-negative integer, got ${texture.height}`);
  }
}
