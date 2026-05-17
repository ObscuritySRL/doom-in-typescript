/**
 * Bind I2 `R_StoreWallRange` output to the committed bit-exact
 * `R_RenderSegLoop` single-sided wall drawer — Chocolate Doom 2.2.1
 * r_segs.c (the `R_StoreWallRange` → `R_RenderSegLoop` hand-off for a
 * one-sided line).
 *
 * {@link storeWallRange} returns a {@link StoredWallRange} with every
 * `rw_*` parameter `R_RenderSegLoop` reads; {@link renderSolidWall}
 * consumes a {@link SolidWallSegment}. This is the pure field-mapping
 * bridge for the single-sided (solid) wall path — the dominant case at
 * the E1M1 spawn. The texture / light / visplane references vanilla
 * resolves from globals (`texturetranslation[]` →
 * `R_GetColumn`-prepared texture, `walllights = scalelight[lightnum]`,
 * `ceilingplane` / `floorplane` from `R_FindPlane`/`R_CheckPlane`) are
 * injected by the caller (the `R_Subsector` store closure), keeping
 * this decoupled and pure: it only reshapes `StoredWallRange` into the
 * `SolidWallSegment` record, passing through the texture-column
 * closure `storeWallRange` already built.
 *
 * The two-sided (`renderTwoSidedWall`) variant + the
 * `R_RenderSegLoop` solid/two-sided dispatch are layered on next.
 *
 * Pure; no Win32 or runtime dependencies.
 */

import type { Visplane } from './renderLimits.ts';
import type { SolidWallSegment } from './solidWalls.ts';
import type { StoredWallRange } from './storeWallRange.ts';
import type { PreparedWallTexture } from './wallColumns.ts';

/**
 * Reshape a single-sided {@link StoredWallRange} into the
 * {@link SolidWallSegment} {@link renderSolidWall} consumes. `scale` /
 * `scaleStep` / `midTextureMid` come from `rwScale` / `rwScalestep` /
 * `rwMidtexturemid`; `midTexture` (the `texturetranslation`-resolved,
 * `R_GetColumn`-prepared mid texture), `wallLights` (the
 * `scalelight[lightnum]` row), and `ceilingPlane` / `floorPlane`
 * (`R_FindPlane`/`R_CheckPlane` results) are caller-supplied; the
 * `textureColumnFor` closure is the one `storeWallRange` already
 * derived.
 *
 * @example
 * ```ts
 * const seg = buildSolidWallSegment(stored, preparedMid, scalelightRow, ceilingPlane, floorPlane);
 * renderSolidWall(seg, solidWallContext);
 * ```
 */
export function buildSolidWallSegment(stored: StoredWallRange, midTexture: PreparedWallTexture, wallLights: readonly Uint8Array[], ceilingPlane: Visplane | null, floorPlane: Visplane | null): SolidWallSegment {
  return Object.freeze({
    rwX: stored.rwX,
    rwStopX: stored.rwStopX,
    topFrac: stored.topFrac,
    topStep: stored.topStep,
    bottomFrac: stored.bottomFrac,
    bottomStep: stored.bottomStep,
    midTexture,
    midTextureMid: stored.rwMidtexturemid,
    scale: stored.rwScale,
    scaleStep: stored.rwScalestep,
    wallLights,
    markCeiling: stored.markCeiling,
    ceilingPlane,
    markFloor: stored.markFloor,
    floorPlane,
    textureColumnFor: stored.textureColumnFor,
  });
}
