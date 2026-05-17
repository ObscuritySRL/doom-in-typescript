/**
 * Per-seg solid/two-sided dispatch — Chocolate Doom 2.2.1 r_segs.c
 * `R_StoreWallRange` → `R_RenderSegLoop` branch selection.
 *
 * Vanilla `R_StoreWallRange` sets `midtexture` for a one-sided line
 * (`if (!backsector) { midtexture = texturetranslation[...]; markfloor
 * = markceiling = true; ... }`) and leaves `midtexture == 0` with
 * `toptexture` / `bottomtexture` / masked-midtexture for a two-sided
 * line. `R_RenderSegLoop` then draws the one set that applies. The
 * committed bit-exact drawers are split per case
 * ({@link renderSolidWall} for one-sided, {@link renderTwoSidedWall}
 * for two-sided), so the seg-level dispatch is exactly: a
 * {@link StoredWallRange} with `midTexture !== 0` is the one-sided
 * (solid) path; otherwise it is the two-sided path.
 *
 * This module builds the committed segment record via the
 * {@link buildSolidWallSegment} / {@link buildTwoSidedWallSegment}
 * bridges and hands it to the caller-bound drawer closure (the
 * established closure-injection pattern — the `R_Subsector` store
 * closure binds the render context, prepared textures, scalelight row,
 * `R_FindPlane` planes, and `maskedtexturecol`). It stays pure
 * dispatch.
 *
 * Pure; no Win32 or runtime dependencies.
 */

import { buildSolidWallSegment } from './buildSolidWallSegment.ts';
import { buildTwoSidedWallSegment } from './buildTwoSidedWallSegment.ts';
import type { Visplane } from './renderLimits.ts';
import type { SolidWallSegment } from './solidWalls.ts';
import type { StoredWallRange } from './storeWallRange.ts';
import type { TwoSidedWallSegment } from './twoSidedWalls.ts';
import type { PreparedWallTexture } from './wallColumns.ts';

/** `'solid'` → one-sided drawer; `'twosided'` → two-sided drawer. */
export type RenderSegKind = 'solid' | 'twosided';

/** Caller-resolved render dependencies (textures / lights / planes / masked col). */
export interface RenderSegResolved {
  /** `texturetranslation`-resolved one-sided mid texture; required when `stored.midTexture !== 0`. */
  readonly midTexture: PreparedWallTexture | null;
  /** Two-sided upper texture (`null` when `stored.topTexture === 0`). */
  readonly topTexture: PreparedWallTexture | null;
  /** Two-sided lower texture (`null` when `stored.bottomTexture === 0`). */
  readonly bottomTexture: PreparedWallTexture | null;
  /** `scalelight[lightnum]` row. */
  readonly wallLights: readonly Uint8Array[];
  readonly ceilingPlane: Visplane | null;
  readonly floorPlane: Visplane | null;
  /** Two-sided masked-midtexture column buffer (`null` when no masked midtexture). */
  readonly maskedTextureCol: Int16Array | null;
}

/** Caller-bound one-sided wall drawer (binds `SolidWallRenderContext`). */
export type SolidWallDrawer = (seg: SolidWallSegment) => void;

/** Caller-bound two-sided wall drawer (binds `TwoSidedWallRenderContext`). */
export type TwoSidedWallDrawer = (seg: TwoSidedWallSegment) => void;

/**
 * r_segs.c `R_StoreWallRange`/`R_RenderSegLoop` seg dispatch: a
 * one-sided seg (`stored.midTexture !== 0`) is built via
 * {@link buildSolidWallSegment} and handed to `drawSolid`; otherwise
 * the two-sided seg is built via {@link buildTwoSidedWallSegment} and
 * handed to `drawTwoSided`. Returns which path ran.
 *
 * @example
 * ```ts
 * renderSeg(stored, resolved, (s) => renderSolidWall(s, solidCtx), (s) => renderTwoSidedWall(s, twoSidedCtx));
 * ```
 */
export function renderSeg(stored: StoredWallRange, resolved: RenderSegResolved, drawSolid: SolidWallDrawer, drawTwoSided: TwoSidedWallDrawer): RenderSegKind {
  if (stored.midTexture !== 0) {
    if (resolved.midTexture === null) {
      throw new Error('renderSeg: a single-sided seg (midTexture != 0) requires a resolved midTexture');
    }
    drawSolid(buildSolidWallSegment(stored, resolved.midTexture, resolved.wallLights, resolved.ceilingPlane, resolved.floorPlane));
    return 'solid';
  }

  drawTwoSided(buildTwoSidedWallSegment(stored, resolved.topTexture, resolved.bottomTexture, resolved.wallLights, resolved.ceilingPlane, resolved.floorPlane, resolved.maskedTextureCol));
  return 'twosided';
}
