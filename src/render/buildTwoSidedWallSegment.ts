/**
 * Bind I2 `R_StoreWallRange` output to the committed bit-exact
 * `R_RenderSegLoop` two-sided wall drawer — Chocolate Doom 2.2.1
 * r_segs.c (the `R_StoreWallRange` → `R_RenderSegLoop` hand-off for a
 * two-sided line: window / upper-step / lower-step / masked midtex).
 *
 * Mirror of {@link buildSolidWallSegment} for the two-sided path.
 * {@link storeWallRange} returns every `rw_*` / `pix*` parameter;
 * {@link renderTwoSidedWall} consumes a {@link TwoSidedWallSegment}.
 * The top/bottom textures (`texturetranslation`-resolved,
 * `R_GetColumn`-prepared, `null` when the sidedef texture is `0`), the
 * `scalelight[lightnum]` row, the `R_FindPlane`/`R_CheckPlane`
 * ceiling/floor planes, and the `maskedtexturecol` buffer slice
 * (`null` when no masked midtexture) are caller-injected (the
 * `R_Subsector` store closure), exactly as vanilla resolves its
 * globals. This module only reshapes `StoredWallRange` into the
 * `TwoSidedWallSegment` record.
 *
 * `pixhigh` / `pixhighstep` / `pixlow` / `pixlowstep` are
 * `Fixed | null` on {@link StoredWallRange} — vanilla leaves the
 * corresponding globals stale (and never reads them) when the
 * upper/lower texture is absent; mapping `null → 0` reproduces that
 * "unused" state since `renderTwoSidedWall` gates them behind the
 * `topTexture` / `bottomTexture` presence checks.
 *
 * Pure; no Win32 or runtime dependencies.
 */

import type { Visplane } from './renderLimits.ts';
import type { StoredWallRange } from './storeWallRange.ts';
import type { TwoSidedWallSegment } from './twoSidedWalls.ts';
import type { PreparedWallTexture } from './wallColumns.ts';

/**
 * Reshape a two-sided {@link StoredWallRange} into the
 * {@link TwoSidedWallSegment} {@link renderTwoSidedWall} consumes.
 *
 * @example
 * ```ts
 * const seg = buildTwoSidedWallSegment(stored, preparedTop, preparedBottom, scalelightRow, ceilingPlane, floorPlane, maskedTextureCol);
 * renderTwoSidedWall(seg, twoSidedWallContext);
 * ```
 */
export function buildTwoSidedWallSegment(
  stored: StoredWallRange,
  topTexture: PreparedWallTexture | null,
  bottomTexture: PreparedWallTexture | null,
  wallLights: readonly Uint8Array[],
  ceilingPlane: Visplane | null,
  floorPlane: Visplane | null,
  maskedTextureCol: Int16Array | null,
): TwoSidedWallSegment {
  return Object.freeze({
    rwX: stored.rwX,
    rwStopX: stored.rwStopX,
    topFrac: stored.topFrac,
    topStep: stored.topStep,
    bottomFrac: stored.bottomFrac,
    bottomStep: stored.bottomStep,
    topTexture,
    topTextureMid: stored.rwToptexturemid,
    pixHigh: stored.pixhigh ?? 0,
    pixHighStep: stored.pixhighstep ?? 0,
    bottomTexture,
    bottomTextureMid: stored.rwBottomtexturemid,
    pixLow: stored.pixlow ?? 0,
    pixLowStep: stored.pixlowstep ?? 0,
    scale: stored.rwScale,
    scaleStep: stored.rwScalestep,
    wallLights,
    markCeiling: stored.markCeiling,
    ceilingPlane,
    markFloor: stored.markFloor,
    floorPlane,
    textureColumnFor: stored.textureColumnFor,
    maskedTextureCol,
  });
}
