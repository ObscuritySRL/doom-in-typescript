import type { DirectoryEntry } from '../wad/directory.ts';
import type { AssetLifetimeCategory, AssetPurgeTag } from './build-asset-cache-lifetime-policy.ts';
import type { FlatNamespace, FlatNamespaceEntry } from './parse-flat-namespace.ts';

import { classifyLifetimeCategory, getLifetimeTagForAsset } from './build-asset-cache-lifetime-policy.ts';
import { FLAT_LUMP_BYTES, parseFlatNamespace } from './parse-flat-namespace.ts';

/** Input set needed to mirror vanilla R_InitFlats flat lump caching. */
export interface FlatCacheInput {
  /** Parsed WAD directory used to resolve F_START / F_END and flat lump offsets. */
  readonly directory: readonly DirectoryEntry[];
  /** Optional pre-parsed namespace. When omitted, the cache builds one from `directory`. */
  readonly namespace?: FlatNamespace | null;
  /** Complete WAD byte buffer used to copy flat lump pixels. */
  readonly wadBuffer: Buffer;
}

/** One cached flat entry in firstflat-relative order. */
export interface FlatCacheEntry {
  /** Directory index of the source lump. */
  readonly directoryIndex: number;
  /** Zero-based flat number relative to firstflat. */
  readonly flatNumber: number;
  /** True when this entry is an inner marker rather than 4096 bytes of flat pixels. */
  readonly isInnerMarker: boolean;
  /** Lump name, uppercase and NUL-stripped. */
  readonly name: string;
  /** Copied 64x64 palette-indexed pixels, or null for inner marker entries. */
  readonly pixels: Uint8Array | null;
  /** Source lump byte size from the WAD directory. */
  readonly size: number;
}

/** Runtime cache produced by the flat cache step. */
export interface FlatCache {
  /** Lifetime category inherited from vanilla's PU_STATIC flat data policy. */
  readonly category: AssetLifetimeCategory;
  /** Cached flat entries in firstflat-relative flat number order. */
  readonly entries: readonly FlatCacheEntry[];
  /** Uppercase flat name lookup, last duplicate wins. */
  readonly flatNameToNumber: ReadonlyMap<string, number>;
  /** Resolved flat namespace used to build the cache. */
  readonly namespace: FlatNamespace;
  /** Purge tag inherited from vanilla's W_CacheLumpNum(firstflat+i, PU_STATIC) policy. */
  readonly tag: AssetPurgeTag;
}

/**
 * Build the static flat cache used by plane rendering.
 *
 * @param input - Parsed WAD directory, WAD bytes, and optional pre-parsed flat namespace.
 * @returns A frozen cache with firstflat-relative entries and copied 64x64 flat pixels.
 * @example
 * ```ts
 * const cache = buildFlatCache({ directory, wadBuffer });
 * console.log(cache.entries[1]?.name); // "FLOOR0_1" for DOOM1.WAD
 * ```
 */
export function buildFlatCache(input: FlatCacheInput): FlatCache {
  const tag = getLifetimeTagForAsset('flat-data-lump');
  if (tag === null) {
    throw new Error('buildFlatCache: flat data lifetime policy is not audited');
  }

  const namespace = input.namespace ?? parseFlatNamespace(input.directory);
  const entries: FlatCacheEntry[] = new Array(namespace.entries.length);
  const flatNameToNumber = new Map<string, number>();

  for (let index = 0; index < namespace.entries.length; index += 1) {
    const namespaceEntry = namespace.entries[index]!;
    const entry = buildFlatCacheEntry(input.directory, input.wadBuffer, namespaceEntry);
    entries[index] = entry;
    flatNameToNumber.set(entry.name.toUpperCase(), entry.flatNumber);
  }

  return Object.freeze({
    category: classifyLifetimeCategory(tag),
    entries: Object.freeze(entries),
    flatNameToNumber,
    namespace,
    tag,
  });
}

/**
 * Resolve a cached flat entry by name using vanilla case-insensitive matching.
 *
 * @param cache - Flat cache built by {@link buildFlatCache}.
 * @param name - Flat name to resolve.
 * @returns Matching flat cache entry, or null when absent.
 * @example
 * ```ts
 * const flat = getFlatCacheEntry(cache, "floor0_1");
 * console.log(flat?.pixels?.length); // 4096
 * ```
 */
export function getFlatCacheEntry(cache: FlatCache, name: string): FlatCacheEntry | null {
  const flatNumber = cache.flatNameToNumber.get(name.slice(0, 8).toUpperCase());
  if (flatNumber === undefined) {
    return null;
  }
  return cache.entries[flatNumber] ?? null;
}

function buildFlatCacheEntry(directory: readonly DirectoryEntry[], wadBuffer: Buffer, namespaceEntry: FlatNamespaceEntry): FlatCacheEntry {
  const directoryEntry = directory[namespaceEntry.directoryIndex];
  if (directoryEntry === undefined) {
    throw new RangeError(`buildFlatCache: flat ${namespaceEntry.name} directory index ${namespaceEntry.directoryIndex} is out of range`);
  }

  let pixels: Uint8Array | null = null;
  if (!namespaceEntry.isInnerMarker) {
    if (directoryEntry.size !== FLAT_LUMP_BYTES) {
      throw new RangeError(`buildFlatCache: flat ${namespaceEntry.name} must be ${FLAT_LUMP_BYTES} bytes, got ${directoryEntry.size}`);
    }
    pixels = new Uint8Array(wadBuffer.subarray(directoryEntry.offset, directoryEntry.offset + directoryEntry.size));
  }

  return Object.freeze({
    directoryIndex: namespaceEntry.directoryIndex,
    flatNumber: namespaceEntry.flatNumber,
    isInnerMarker: namespaceEntry.isInnerMarker,
    name: namespaceEntry.name,
    pixels,
    size: directoryEntry.size,
  });
}
