/**
 * Vanilla DOOM 1.9 level setup wiring.
 *
 * Plan_final step `08-001` (lane: map-world) bridges the IWAD
 * resource cache (built in `05-001`) into the canonical
 * P_SetupLevel pipeline that produces a frozen runtime
 * {@link MapData} snapshot.  The wrapper walks the read-only
 * primitives without modifying them:
 *
 *   1. `findMapNames(directory)` enumerates every map marker in the
 *      IWAD's lump directory (E1M1, E1M2, …, MAP01, …).
 *   2. `parseMapBundle(directory, wadBuffer, mapName)` extracts the
 *      ten canonical map lumps (THINGS, LINEDEFS, SIDEDEFS, VERTEXES,
 *      SEGS, SSECTORS, NODES, SECTORS, REJECT, BLOCKMAP) for the
 *      named map.
 *   3. `setupLevel(bundle)` runs the full P_SetupLevel orchestrator:
 *      parses every lump, runs the P_GroupLines equivalent that
 *      derives per-sector line lists, bounding boxes, sound origins,
 *      and blockmap bounding boxes, and returns a frozen
 *      {@link MapData}.
 *
 * Failure modes:
 *   - Empty or whitespace-only `mapName` → `WireLevelSetupError`
 *     with `reason: 'map-name-empty'`.
 *   - `mapName` not in `findMapNames(directory)` → `WireLevelSetupError`
 *     with `reason: 'map-not-found'`.
 *   - Any throw from `parseMapBundle` or `setupLevel` propagates
 *     verbatim (those primitives already produce typed errors).
 *
 * The returned {@link MapData} is the same frozen object
 * `setupLevel` produces; the wrapper does NOT re-wrap or modify
 * the snapshot.  Subsequent runtime-core steps will plug the
 * snapshot into the runtime context's `mapState.current` slot.
 *
 * @example
 * ```ts
 * import { wireLevelSetup } from './wireLevelSetup.ts';
 *
 * const mapData = wireLevelSetup(resourceCache, wadBuffer, 'E1M1');
 * mapData.name;                // 'E1M1'
 * mapData.sectors.length;      // ≥ 1
 * mapData.linedefs.length;     // ≥ 1
 * ```
 */

import { findMapNames, parseMapBundle } from '../map/mapBundle.ts';
import type { MapData } from '../map/mapSetup.ts';
import { setupLevel } from '../map/mapSetup.ts';
import type { IwadResourceCache } from './iwadResourceCache.ts';

/**
 * Stable discriminator for {@link WireLevelSetupError} failure
 * causes so callers can branch on the cause without parsing message
 * strings.
 */
export type WireLevelSetupErrorReason = 'map-name-empty' | 'map-not-found';

/**
 * Thrown by {@link wireLevelSetup} when the supplied map name is
 * empty/whitespace or is not present in the IWAD's directory.
 * Carries a stable {@link WireLevelSetupErrorReason} discriminator
 * and the offending map name.
 */
export class WireLevelSetupError extends Error {
  public readonly reason: WireLevelSetupErrorReason;
  public readonly requestedMapName: string;

  public constructor(reason: WireLevelSetupErrorReason, requestedMapName: string, message: string) {
    super(message);
    this.name = 'WireLevelSetupError';
    this.reason = reason;
    this.requestedMapName = requestedMapName;
  }
}

/**
 * Bridge {@link IwadResourceCache} + wad buffer + a map name into a
 * frozen runtime {@link MapData} snapshot via the canonical
 * P_SetupLevel pipeline.  See module docstring for the failure
 * modes.
 *
 * @param resourceCache The IWAD resource cache (05-001).
 * @param wadBuffer     The IWAD byte buffer the cache was built
 *                      from (parseMapBundle slices lump bodies out
 *                      of this buffer).
 * @param mapName       The map marker name to load (e.g. 'E1M1').
 * @returns A frozen {@link MapData} snapshot.
 * @throws {WireLevelSetupError} When `mapName` is empty or not found.
 */
export function wireLevelSetup(resourceCache: IwadResourceCache, wadBuffer: Buffer, mapName: string): MapData {
  const trimmedMapName = mapName.trim();
  if (trimmedMapName.length === 0) {
    throw new WireLevelSetupError('map-name-empty', mapName, 'wireLevelSetup rejected empty map name');
  }
  const availableMapNames = findMapNames(resourceCache.directory);
  if (!availableMapNames.includes(trimmedMapName)) {
    throw new WireLevelSetupError('map-not-found', mapName, `wireLevelSetup did not find map "${trimmedMapName}" in IWAD directory`);
  }
  const bundle = parseMapBundle(resourceCache.directory, wadBuffer, trimmedMapName);
  return setupLevel(bundle);
}
