import type { DirectoryEntry } from '../wad/directory.ts';
import type { AssetLifetimeCategory, AssetPurgeTag } from './build-asset-cache-lifetime-policy.ts';
import type { DecodedPatchPicture } from './parse-patch-picture-format.ts';
import type { SpriteNamespace, SpritePatchHeaderFixed, SpritePatchHeaderRaw } from './parse-sprite-namespace.ts';

import { classifyLifetimeCategory, getLifetimeTagForAsset } from './build-asset-cache-lifetime-policy.ts';
import { PATCH_HEADER_BYTES, parsePatchPicture } from './parse-patch-picture-format.ts';
import { parseSpriteNamespace, spritePatchHeaderToFixed } from './parse-sprite-namespace.ts';

/** Input set needed to mirror vanilla R_InitSpriteLumps metadata caching. */
export interface SpriteFrameCacheInput {
  /** Parsed WAD directory used to resolve S_START / S_END and sprite lump offsets. */
  readonly directory: readonly DirectoryEntry[];
  /** Optional pre-parsed namespace. When omitted, the cache builds one from `directory`. */
  readonly namespace?: SpriteNamespace | null;
  /** Complete WAD byte buffer used to read sprite patch headers. */
  readonly wadBuffer: Buffer;
}

/** One cached sprite frame metadata entry in firstspritelump-relative order. */
export interface SpriteFrameCacheEntry {
  /** Directory index of the source sprite lump. */
  readonly directoryIndex: number;
  /** Raw patch header height in pixels. */
  readonly height: number;
  /** Lump name, uppercase and NUL-stripped. */
  readonly name: string;
  /** Byte offset of the sprite lump inside the WAD file. */
  readonly offset: number;
  /** Source lump byte size from the WAD directory. */
  readonly size: number;
  /** Zero-based sprite number relative to firstspritelump. */
  readonly spriteNumber: number;
  /** `spriteoffset[spriteNumber]`, the signed left offset shifted by FRACBITS. */
  readonly spriteOffset: SpritePatchHeaderFixed['spriteOffset'];
  /** `spritetopoffset[spriteNumber]`, the signed top offset shifted by FRACBITS. */
  readonly spriteTopOffset: SpritePatchHeaderFixed['spriteTopoffset'];
  /** `spritewidth[spriteNumber]`, the patch width shifted by FRACBITS. */
  readonly spriteWidth: SpritePatchHeaderFixed['spriteWidth'];
  /** Raw patch header width in pixels. */
  readonly width: number;
}

/** Runtime cache produced by the sprite frame cache step. */
export interface SpriteFrameCache {
  /** Lifetime category inherited from vanilla's PU_STATIC sprite metadata arrays. */
  readonly category: AssetLifetimeCategory;
  /** Cached sprite metadata entries in firstspritelump-relative order. */
  readonly entries: readonly SpriteFrameCacheEntry[];
  /** Resolved sprite namespace used to build the cache. */
  readonly namespace: SpriteNamespace;
  /** Lifetime category for sprite frame patch pixels loaded on demand. */
  readonly patchCategory: AssetLifetimeCategory;
  /** Purge tag for sprite frame patch pixels loaded by sprite number at draw time. */
  readonly patchTag: AssetPurgeTag;
  /** Uppercase sprite lump name lookup, last duplicate wins. */
  readonly spriteNameToNumber: ReadonlyMap<string, number>;
  /** Vanilla `spriteoffset` parallel array. */
  readonly spriteOffsets: readonly SpritePatchHeaderFixed['spriteOffset'][];
  /** Vanilla `spritetopoffset` parallel array. */
  readonly spriteTopOffsets: readonly SpritePatchHeaderFixed['spriteTopoffset'][];
  /** Vanilla `spritewidth` parallel array. */
  readonly spriteWidths: readonly SpritePatchHeaderFixed['spriteWidth'][];
  /** Purge tag inherited from vanilla's PU_STATIC sprite metadata arrays. */
  readonly tag: AssetPurgeTag;
}

/**
 * Build the static sprite frame metadata cache used by sprite rendering.
 *
 * @param input - Parsed WAD directory, WAD bytes, and optional pre-parsed sprite namespace.
 * @returns A frozen cache with firstspritelump-relative entries and fixed-point parallel arrays.
 * @example
 * ```ts
 * const cache = buildSpriteFrameCache({ directory, wadBuffer });
 * console.log(cache.entries[0]?.name); // "CHGGA0" for DOOM1.WAD
 * ```
 */
export function buildSpriteFrameCache(input: SpriteFrameCacheInput): SpriteFrameCache {
  const tag = requireSharedSpriteMetadataTag();
  const patchTag = getLifetimeTagForAsset('sprite-frame-patch');
  if (patchTag === null) {
    throw new Error('buildSpriteFrameCache: sprite frame patch lifetime policy is not audited');
  }

  const namespace = input.namespace ?? parseSpriteNamespace(input.directory);
  const entries: SpriteFrameCacheEntry[] = new Array(namespace.entries.length);
  const spriteNameToNumber = new Map<string, number>();
  const spriteOffsets: SpritePatchHeaderFixed['spriteOffset'][] = new Array(namespace.entries.length);
  const spriteTopOffsets: SpritePatchHeaderFixed['spriteTopoffset'][] = new Array(namespace.entries.length);
  const spriteWidths: SpritePatchHeaderFixed['spriteWidth'][] = new Array(namespace.entries.length);

  for (let spriteNumber = 0; spriteNumber < namespace.entries.length; spriteNumber += 1) {
    const namespaceEntry = namespace.entries[spriteNumber]!;
    const entry = buildSpriteFrameCacheEntry(input.directory, input.wadBuffer, namespaceEntry);
    entries[spriteNumber] = entry;
    spriteNameToNumber.set(entry.name.toUpperCase(), entry.spriteNumber);
    spriteOffsets[spriteNumber] = entry.spriteOffset;
    spriteTopOffsets[spriteNumber] = entry.spriteTopOffset;
    spriteWidths[spriteNumber] = entry.spriteWidth;
  }

  return Object.freeze({
    category: classifyLifetimeCategory(tag),
    entries: Object.freeze(entries),
    namespace,
    patchCategory: classifyLifetimeCategory(patchTag),
    patchTag,
    spriteNameToNumber,
    spriteOffsets: Object.freeze(spriteOffsets),
    spriteTopOffsets: Object.freeze(spriteTopOffsets),
    spriteWidths: Object.freeze(spriteWidths),
    tag,
  });
}

export function getSpriteFrameCacheEntry(cache: SpriteFrameCache, name: string): SpriteFrameCacheEntry | null;
export function getSpriteFrameCacheEntry(cache: SpriteFrameCache, spriteNumber: number): SpriteFrameCacheEntry | null;

/**
 * Resolve a cached sprite frame entry by sprite number or lump name.
 *
 * @param cache - Sprite frame cache built by {@link buildSpriteFrameCache}.
 * @param selector - Firstspritelump-relative sprite number, or a case-insensitive lump name.
 * @returns Matching sprite frame entry, or null when absent.
 * @example
 * ```ts
 * const frame = getSpriteFrameCacheEntry(cache, "PLAYA1");
 * console.log(frame?.spriteNumber);
 * ```
 */
export function getSpriteFrameCacheEntry(cache: SpriteFrameCache, selector: number | string): SpriteFrameCacheEntry | null {
  if (typeof selector === 'string') {
    const spriteNumber = cache.spriteNameToNumber.get(selector.slice(0, 8).toUpperCase());
    if (spriteNumber === undefined) {
      return null;
    }
    return cache.entries[spriteNumber] ?? null;
  }

  if (!Number.isInteger(selector) || selector < 0) {
    return null;
  }
  return cache.entries[selector] ?? null;
}

/**
 * Load a sprite frame patch by sprite number using vanilla's purgable patch policy.
 *
 * @param cache - Sprite frame cache built by {@link buildSpriteFrameCache}.
 * @param wadBuffer - Complete WAD byte buffer containing the sprite lump bytes.
 * @param spriteNumber - Firstspritelump-relative sprite number.
 * @returns Decoded patch picture for the requested sprite frame.
 * @example
 * ```ts
 * const patch = loadSpriteFramePatch(cache, wadBuffer, 0);
 * console.log(patch.header.width);
 * ```
 */
export function loadSpriteFramePatch(cache: SpriteFrameCache, wadBuffer: Buffer, spriteNumber: number): DecodedPatchPicture {
  const entry = getSpriteFrameCacheEntry(cache, spriteNumber);
  if (entry === null) {
    throw new RangeError(`loadSpriteFramePatch: sprite number ${spriteNumber} is outside [0, ${cache.entries.length})`);
  }
  return parsePatchPicture(wadBuffer.subarray(entry.offset, entry.offset + entry.size));
}

function buildSpriteFrameCacheEntry(directory: readonly DirectoryEntry[], wadBuffer: Buffer, namespaceEntry: SpriteNamespace['entries'][number]): SpriteFrameCacheEntry {
  const directoryEntry = directory[namespaceEntry.directoryIndex];
  if (directoryEntry === undefined) {
    throw new RangeError(`buildSpriteFrameCache: sprite ${namespaceEntry.name} directory index ${namespaceEntry.directoryIndex} is out of range`);
  }
  if (directoryEntry.size < PATCH_HEADER_BYTES) {
    throw new RangeError(`buildSpriteFrameCache: sprite ${namespaceEntry.name} must be at least ${PATCH_HEADER_BYTES} bytes, got ${directoryEntry.size}`);
  }
  if (directoryEntry.offset + PATCH_HEADER_BYTES > wadBuffer.length) {
    throw new RangeError(`buildSpriteFrameCache: sprite ${namespaceEntry.name} header exceeds WAD buffer bounds`);
  }

  const patchHeader = readSpritePatchHeader(wadBuffer, directoryEntry.offset);
  const fixedHeader = spritePatchHeaderToFixed(patchHeader);

  return Object.freeze({
    directoryIndex: namespaceEntry.directoryIndex,
    height: patchHeader.height,
    name: namespaceEntry.name,
    offset: directoryEntry.offset,
    size: directoryEntry.size,
    spriteNumber: namespaceEntry.spriteNumber,
    spriteOffset: fixedHeader.spriteOffset,
    spriteTopOffset: fixedHeader.spriteTopoffset,
    spriteWidth: fixedHeader.spriteWidth,
    width: patchHeader.width,
  });
}

function readSpritePatchHeader(wadBuffer: Buffer, offset: number): SpritePatchHeaderRaw {
  const view = new DataView(wadBuffer.buffer, wadBuffer.byteOffset + offset, PATCH_HEADER_BYTES);
  const patchHeader: SpritePatchHeaderRaw = {
    height: view.getInt16(2, true),
    leftoffset: view.getInt16(4, true),
    topoffset: view.getInt16(6, true),
    width: view.getInt16(0, true),
  };
  if (patchHeader.width < 0) {
    throw new RangeError(`buildSpriteFrameCache: sprite patch width must be non-negative, got ${patchHeader.width}`);
  }
  if (patchHeader.height < 0) {
    throw new RangeError(`buildSpriteFrameCache: sprite patch height must be non-negative, got ${patchHeader.height}`);
  }
  return patchHeader;
}

function requireSharedSpriteMetadataTag(): AssetPurgeTag {
  const spriteOffsetTag = getLifetimeTagForAsset('spriteoffset');
  const spriteTopoffsetTag = getLifetimeTagForAsset('spritetopoffset');
  const spriteWidthTag = getLifetimeTagForAsset('spritewidth');
  if (spriteOffsetTag === null || spriteTopoffsetTag === null || spriteWidthTag === null) {
    throw new Error('buildSpriteFrameCache: sprite metadata lifetime policy is not audited');
  }
  if (spriteOffsetTag !== spriteWidthTag || spriteTopoffsetTag !== spriteWidthTag) {
    throw new Error('buildSpriteFrameCache: sprite metadata arrays must share one lifetime tag');
  }
  return spriteWidthTag;
}
