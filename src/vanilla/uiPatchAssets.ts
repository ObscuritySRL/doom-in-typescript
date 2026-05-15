/**
 * Vanilla DOOM 1.9 UI / front-end / status-bar / intermission / finale /
 * ENDOOM patch resources.
 *
 * Plan_final step `05-004` (lane: wad-assets) wires the title-loop and
 * front-end patch lumps, the HUD font, the status-bar face/number/key
 * lumps, the intermission stat-table and background lumps, the menu
 * graphic lumps, and the optional ENDOOM text-mode quit screen into a
 * single frozen runtime artifact every UI-lane step consumes.  The
 * artifact wraps the read-only {@link resolveUiAssetLumps} surface from
 * `src/ui/assets.ts` (which already enumerates every shareware-safe UI
 * patch by name) and adds a dedicated ENDOOM lookup that
 * `resolveUiAssetLumps` does NOT cover (ENDOOM is a top-level lump, not
 * a UI patch).
 *
 * The artifact is built once per launch from the
 * {@link IwadResourceCache} produced by `05-001`.  No filesystem I/O
 * happens inside this module — every directory lookup goes through
 * `IwadResourceCache.findLump` / `hasLump`, so the focused test stays
 * deterministic against a stub cache.
 *
 * Behavioral contract:
 *
 *   - The full UI patch catalog is the verbatim result of
 *     {@link resolveUiAssetLumps}.  Missing lumps are reported via
 *     `catalog.missing`, NOT thrown.  Shareware-safe lumps that DOOM1.WAD
 *     ships should resolve to a non-negative `directoryIndex`; lumps the
 *     IWAD does not provide (e.g. `M_EPI4` retail-only) are surfaced via
 *     `catalog.missing` so the launch-error UI can decide whether to
 *     warn or fall back.
 *   - ENDOOM presence is reported as a separate boolean
 *     `endoomPresent` plus, when present, the directory index.  ENDOOM
 *     is absent from PWADs and some custom IWADs; the runtime quit
 *     handler must gracefully skip the ENDOOM display when this is
 *     false.
 *   - The Chocolate Doom 2.2.1 `show_endoom` extended-config toggle
 *     (`chocolate-doom.cfg`, default `1`) is intentionally NOT consulted
 *     here — gating on the toggle belongs to the quit-flow step.  This
 *     wrapper reports whether the lump is *available*, not whether the
 *     user opted to see it.
 *
 * @example
 * ```ts
 * import { buildUiPatchAssets } from './uiPatchAssets.ts';
 *
 * const resources = buildUiPatchAssets(resourceCache);
 * resources.uiAssetCatalog.totalCount;          // count of UI lumps
 * resources.uiAssetCatalog.missing.length;      // 0 on shareware
 * resources.endoomPresent;                      // true for vanilla DOOM1.WAD
 * resources.endoomDirectoryIndex;               // >= 0 when present
 * ```
 */

import { resolveUiAssetLumps, type UiAssetCatalog } from '../ui/assets.ts';
import type { IwadResourceCache } from './iwadResourceCache.ts';

/** Canonical name of the ENDOOM text-mode quit-screen lump. */
export const VANILLA_ENDOOM_LUMP_NAME = 'ENDOOM';

/**
 * Frozen runtime artifact assembled by {@link buildUiPatchAssets}.
 *
 * `uiAssetCatalog` carries every shareware-safe UI patch the front-end,
 * status bar, intermission, and menu code paths need; `endoomPresent`
 * and `endoomDirectoryIndex` carry the ENDOOM availability separately
 * because `resolveUiAssetLumps` deliberately excludes it.
 */
export interface UiPatchAssetsResources {
  readonly endoomDirectoryIndex: number;
  readonly endoomPresent: boolean;
  readonly uiAssetCatalog: UiAssetCatalog;
}

/**
 * Build a frozen {@link UiPatchAssetsResources} from the resolved
 * {@link IwadResourceCache}.  The returned artifact is `Object.freeze`d
 * at the top level; the nested `uiAssetCatalog` is already frozen by
 * {@link resolveUiAssetLumps}.
 *
 * The function performs no filesystem I/O of its own and never throws;
 * a missing ENDOOM lump is reported via `endoomPresent === false` and
 * a missing UI patch is reported via `uiAssetCatalog.missing`.  This
 * matches the vanilla startup pattern where the front-end gracefully
 * degrades when a non-essential lump is absent rather than aborting
 * the launch.
 */
export function buildUiPatchAssets(resourceCache: IwadResourceCache): UiPatchAssetsResources {
  const uiAssetCatalog = resolveUiAssetLumps(resourceCache.directory);
  const endoomEntry = resourceCache.findLump(VANILLA_ENDOOM_LUMP_NAME);
  return Object.freeze({
    endoomDirectoryIndex: endoomEntry === null ? -1 : resourceCache.directory.indexOf(endoomEntry),
    endoomPresent: endoomEntry !== null,
    uiAssetCatalog,
  });
}
