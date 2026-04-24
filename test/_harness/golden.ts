/**
 * Golden file loader for doom_codex test harness.
 *
 * Provides typed, cached access to reference manifest JSON files
 * stored under `reference/manifests/`. Centralizes path resolution
 * and validates file existence on first load.
 *
 * @example
 * ```ts
 * const manifest = await loadGolden('file-hashes');
 * ```
 */

import { resolve } from 'node:path';

/** Root of the doom_codex package (two levels up from test/_harness/). */
const PACKAGE_ROOT = resolve(import.meta.dir, '..', '..');

/** Directory containing all golden reference manifests. */
const MANIFESTS_DIRECTORY = resolve(PACKAGE_ROOT, 'reference', 'manifests');

/** Known golden manifest file basenames (without `.json`), ASCIIbetically sorted. */
export const GOLDEN_NAMES = Object.freeze([
  'compatibility-targets',
  'config-variable-summary',
  'demo-lump-summary',
  'file-hashes',
  'package-capability-matrix',
  'quirk-manifest',
  'source-catalog',
  'title-sequence',
  'vanilla-limit-summary',
  'wad-map-summary',
] as const);

/** Discriminated union of all known golden manifest names. */
export type GoldenName = (typeof GOLDEN_NAMES)[number];

/** In-memory cache keyed by golden name. */
const cache = new Map<GoldenName, unknown>();

/**
 * Resolves the absolute path for a golden manifest file.
 *
 * @param name - The golden manifest basename (without `.json`).
 * @returns Absolute file path.
 */
export function goldenPath(name: GoldenName): string {
  return resolve(MANIFESTS_DIRECTORY, `${name}.json`);
}

/**
 * Loads and caches a golden reference manifest by name.
 *
 * On first call for a given name, reads the JSON file from disk and
 * caches the parsed result. Subsequent calls return the cached value.
 * Throws if the file does not exist or contains invalid JSON.
 *
 * @param name - The golden manifest basename (without `.json`).
 * @returns The parsed JSON content.
 *
 * @example
 * ```ts
 * const hashes = await loadGolden('file-hashes');
 * ```
 */
export async function loadGolden<T = unknown>(name: GoldenName): Promise<T> {
  const cached = cache.get(name);
  if (cached !== undefined) {
    return cached as T;
  }

  const filePath = goldenPath(name);
  const file = Bun.file(filePath);
  const exists = await file.exists();
  if (!exists) {
    throw new Error(`Golden file not found: ${filePath}`);
  }

  const content = await file.json();
  cache.set(name, content);
  return content as T;
}

/**
 * Clears the golden file cache. Useful for test isolation when
 * verifying that loading actually reads from disk.
 */
export function clearGoldenCache(): void {
  cache.clear();
}

/** Returns the number of entries currently in the golden file cache. */
export function goldenCacheSize(): number {
  return cache.size;
}
