/**
 * Per-seg `store` closure — Chocolate Doom 2.2.1 r_bsp.c
 * `R_ClipSolidWallSegment` / `R_ClipPassWallSegment` `store`
 * hand-off (which is `R_StoreWallRange`).
 *
 * The I3 {@link clipSolidWallSegment} / {@link clipPassWallSegment}
 * call `store(first, last)` for every accepted screen-column span of a
 * seg (vanilla passes `R_StoreWallRange`). This binds that callback to
 * the committed pipeline: assemble the I2 seg model for the projected
 * `[first, last]` range ({@link buildStoreWallRangeSeg}), derive the
 * `rw_*` parameters ({@link storeWallRange}), and dispatch the
 * one-sided / two-sided wall draw ({@link renderSeg}).
 *
 * The seg model + `rw_angle1` are produced by the I4a `R_AddLine`
 * projection before clipping; the {@link StoreWallRangeView} /
 * {@link StoreWallRangeTextures}, the `StoredWallRange` → resolved
 * texture/light/plane mapping (`resolve`), and the wall drawer
 * closures are the `R_Subsector` store-context (texture catalog, I1
 * `materializeColormapRows` scalelight rows, `R_FindPlane` planes,
 * bound render contexts) — all caller-injected, keeping this pure
 * composition glue.
 *
 * Pure; no Win32 or runtime dependencies.
 */

import type { Angle } from '../core/angle.ts';
import { renderSeg } from './renderSeg.ts';
import type { RenderSegResolved, SolidWallDrawer, TwoSidedWallDrawer } from './renderSeg.ts';
import type { SegRenderModel } from './segRenderModel.ts';
import { buildStoreWallRangeSeg } from './segRenderModel.ts';
import type { StoreWallRangeFn } from './solidSegs.ts';
import { storeWallRange } from './storeWallRange.ts';
import type { StoredWallRange, StoreWallRangeTextures, StoreWallRangeView } from './storeWallRange.ts';

/** Maps a derived {@link StoredWallRange} to the resolved render deps. */
export type ResolveRenderSegDeps = (stored: StoredWallRange) => RenderSegResolved;

/** Optional DI hooks (default to the committed pipeline). */
export interface WallStoreHooks {
  readonly storeWallRangeFn?: typeof storeWallRange;
  readonly renderSegFn?: typeof renderSeg;
}

/**
 * Build the `store(first, last)` closure for one projected seg. The
 * I3 clip routines call it per accepted column span; it threads
 * `[first, last]` through {@link buildStoreWallRangeSeg} →
 * {@link storeWallRange} → {@link renderSeg}.
 *
 * @example
 * ```ts
 * const store = makeWallStore(segModel, rwAngle1, view, textures, resolve, drawSolid, drawTwoSided);
 * clipSolidWallSegment(clipState, x1, last, store);
 * ```
 */
export function makeWallStore(
  model: SegRenderModel,
  rwAngle1: Angle,
  view: StoreWallRangeView,
  textures: StoreWallRangeTextures,
  resolve: ResolveRenderSegDeps,
  drawSolid: SolidWallDrawer,
  drawTwoSided: TwoSidedWallDrawer,
  hooks: WallStoreHooks = {},
): StoreWallRangeFn {
  const store = hooks.storeWallRangeFn ?? storeWallRange;
  const dispatch = hooks.renderSegFn ?? renderSeg;

  return (first: number, last: number): void => {
    const stored = store(buildStoreWallRangeSeg(model, first, last, rwAngle1), view, textures);
    dispatch(stored, resolve(stored), drawSolid, drawTwoSided);
  };
}
