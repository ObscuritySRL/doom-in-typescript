/**
 * Vanilla DOOM 1.9 DEMO + map-bundle runtime resources.
 *
 * Plan_final step `05-007` (lane: wad-assets) wires the
 * `DEMO<n>`-named demo lumps (the attract-loop and benchmark recordings
 * vanilla `D_DoomMain` consults via `G_PlayDemo` / `G_DoPlayDemo` /
 * `G_TimeDemo`) and the per-map 10-lump bundles
 * (THINGS / LINEDEFS / SIDEDEFS / VERTEXES / SEGS / SSECTORS / NODES /
 * SECTORS / REJECT / BLOCKMAP) into a runtime catalog the
 * attract-loop scheduler and the per-level setup pipeline consume.
 *
 * The catalog is built once per launch from the
 * {@link IwadResourceCache} produced by `05-001`; it does NOT eagerly
 * parse the demo or map payloads — those remain inside the WAD buffer
 * and are decoded lazily by the demo player and `mapSetup` at level
 * load time.  The wrapper is therefore safe to commit to source
 * control with no embedded proprietary IWAD bytes.
 *
 * Behavioral contract:
 *
 *   - Demo lumps are enumerated by directory scan: every entry whose
 *     uppercased name starts with `DEMO` and whose remaining body is
 *     non-empty is reported as a {@link DemoLumpEntry}.  The `DEMO`
 *     prefix follows the linuxdoom-1.10 `i_sound.c` /
 *     `d_main.c G_RunDemo` lookup pattern.
 *   - Map names are enumerated via the read-only
 *     {@link findMapNames} helper, which detects both episodic
 *     (`E<episode>M<map>`) and commercial (`MAP<map>`) map-marker
 *     patterns inside the WAD directory.
 *   - Each map's 10-lump bundle is NOT parsed at build time — that
 *     concern belongs to `mapSetup` / `parseMapBundle` and happens at
 *     level-load time when the engine actually warps to the map.
 *   - The catalog is FROZEN; downstream subsystems cannot mutate it.
 *
 * @example
 * ```ts
 * import { buildDemoAndMapAssets } from './demoAndMapAssets.ts';
 *
 * const catalog = buildDemoAndMapAssets(resourceCache);
 * catalog.demoLumps.length;                              // 3 for shareware (DEMO1..DEMO3)
 * catalog.mapNames.includes('E1M1');                     // true for shareware
 * catalog.mapNames.length;                               // 9 for shareware E1M1..E1M9
 * ```
 */

import type { DirectoryEntry } from '../wad/directory.ts';
import { findMapNames } from '../map/mapBundle.ts';
import type { IwadResourceCache } from './iwadResourceCache.ts';

/** Four-byte prefix every demo lump name carries (`DEMO<digit>`). */
export const VANILLA_DEMO_LUMP_PREFIX = 'DEMO';

/**
 * A single demo lump in the IWAD directory.  `name` is the uppercased
 * lump name; `directoryEntry` carries the entry's `offset` and `size`
 * so the demo player can decode the payload directly from the WAD
 * buffer.
 */
export interface DemoLumpEntry {
  readonly directoryEntry: DirectoryEntry;
  readonly directoryIndex: number;
  readonly name: string;
}

/**
 * Frozen runtime catalog assembled by
 * {@link buildDemoAndMapAssets}.  The nested entry arrays are
 * frozen; the underlying {@link DirectoryEntry} references are the
 * exact objects the resource cache produced.
 */
export interface DemoAndMapAssetCatalog {
  readonly demoLumps: readonly DemoLumpEntry[];
  readonly mapNames: readonly string[];
}

/**
 * Walk the resource cache's directory and partition every committed
 * lump into the DEMO and map-marker buckets.  The walk is O(n) where
 * n = directory length; the resulting arrays preserve directory
 * order so callers that need stable indices can use the returned
 * `directoryIndex` directly.
 *
 * @param resourceCache The cache produced by `05-001`'s
 *   `buildIwadResourceCache`.
 * @returns A frozen {@link DemoAndMapAssetCatalog} ready for the
 *   attract-loop scheduler and the per-level setup pipeline.
 */
export function buildDemoAndMapAssets(resourceCache: IwadResourceCache): DemoAndMapAssetCatalog {
  const demoLumps: DemoLumpEntry[] = [];
  const directory = resourceCache.directory;
  for (let directoryIndex = 0; directoryIndex < directory.length; directoryIndex += 1) {
    const entry = directory[directoryIndex]!;
    const upperName = entry.name.toUpperCase();
    if (upperName.startsWith(VANILLA_DEMO_LUMP_PREFIX) && entry.size > 0) {
      demoLumps.push(Object.freeze({ directoryEntry: entry, directoryIndex, name: upperName }));
    }
  }
  const mapNames = findMapNames(directory);
  return Object.freeze({
    demoLumps: Object.freeze(demoLumps),
    mapNames: Object.freeze([...mapNames]),
  });
}
