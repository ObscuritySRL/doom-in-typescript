/**
 * Per-seg `store` factory — the Chocolate Doom 2.2.1 r_bsp.c
 * `R_AddLine` → `R_StoreWallRange` per-`curline` binding.
 *
 * Vanilla `R_Subsector` walks a subsector's segs; for each, `R_AddLine`
 * sets the `curline` / `rw_angle1` globals and calls
 * `R_ClipSolidWallSegment` / `R_ClipPassWallSegment`, whose `store`
 * callback is `R_StoreWallRange` reading *those* per-seg globals. A
 * single shared {@link StoreWallRangeFn} cannot carry that per-seg
 * identity (the I3 clip list only passes `[first, last]`); the committed
 * I4c {@link rSubsector} took a stub store precisely because this
 * binding was not yet assembled.
 *
 * This factory is that binding: given the immutable subsector-render
 * context (the {@link SegRenderScene} map tables, the
 * `R_FlatNumForName` / `R_TextureNumForName` resolvers, the
 * {@link StoreWallRangeView} / {@link StoreWallRangeTextures}, the
 * `StoredWallRange` → resolved-deps `resolve`, and the wall drawers),
 * it returns `(segIndex, rwAngle1) → StoreWallRangeFn` — the exact
 * `curline`-bound `R_StoreWallRange` the subsector loop hands the clip
 * routine after `R_AddLine` (which yields `rwAngle1`). It composes the
 * I4d {@link segRenderModel} and the I3↔I2 {@link makeWallStore} glue;
 * the per-seg model + `rw_angle1` are the only things that vary per
 * `curline`, so everything else is captured once.
 *
 * Pure; no Win32 or runtime dependencies.
 */

import type { Angle } from '../core/angle.ts';

import type { SolidWallDrawer, TwoSidedWallDrawer } from './renderSeg.ts';
import { segRenderModel } from './segRenderModel.ts';
import type { FlatNumberResolver, SegRenderScene, TextureNumberResolver } from './segRenderModel.ts';
import type { StoreWallRangeFn } from './solidSegs.ts';
import type { StoreWallRangeTextures, StoreWallRangeView } from './storeWallRange.ts';
import { makeWallStore } from './wallStore.ts';
import type { ResolveRenderSegDeps, WallStoreHooks } from './wallStore.ts';

/**
 * `(segIndex, rwAngle1) → StoreWallRangeFn` — the `curline`-bound
 * `R_StoreWallRange` for one seg, built after `R_AddLine`.
 */
export type SegStore = (segIndex: number, rwAngle1: Angle) => StoreWallRangeFn;

/** Optional DI hooks (default to the committed pipeline). */
export interface SegStoreFactoryHooks extends WallStoreHooks {
  readonly segRenderModelFn?: typeof segRenderModel;
}

/**
 * Build the per-seg `store` factory for one subsector-render context.
 * Call the returned factory once per seg — with the seg's index and the
 * `rwAngle1` {@link addLine} produced — to get the `curline`-bound
 * {@link StoreWallRangeFn} to hand the I3 clip routine.
 *
 * @param scene - The map seg / sidedef / sector / vertex tables {@link segRenderModel} reads.
 * @param flatNumber - `R_FlatNumForName` (sector pic → flat number).
 * @param textureNumber - `R_TextureNumForName` (sidedef name → texture number).
 * @param view - The I2 {@link StoreWallRangeView} (frame view state).
 * @param textures - The I2 {@link StoreWallRangeTextures} sizing context.
 * @param resolve - `StoredWallRange` → resolved textures / scalelight row / planes.
 * @param drawSolid - Bound one-sided wall drawer.
 * @param drawTwoSided - Bound two-sided wall drawer.
 *
 * @example
 * ```ts
 * const segStore = makeSegStoreFactory(scene, flatNum, texNum, view, textures, resolve, drawSolid, drawTwoSided);
 * const d = addLine(scene.segs[i], frontsector, view);
 * if (d) (d.kind === 'solid' ? clipSolidWallSegment : clipPassWallSegment)(state, d.x1, d.last, segStore(i, d.rwAngle1));
 * ```
 */
export function makeSegStoreFactory(
  scene: SegRenderScene,
  flatNumber: FlatNumberResolver,
  textureNumber: TextureNumberResolver,
  view: StoreWallRangeView,
  textures: StoreWallRangeTextures,
  resolve: ResolveRenderSegDeps,
  drawSolid: SolidWallDrawer,
  drawTwoSided: TwoSidedWallDrawer,
  hooks: SegStoreFactoryHooks = {},
): SegStore {
  const buildModel = hooks.segRenderModelFn ?? segRenderModel;

  return (segIndex: number, rwAngle1: Angle): StoreWallRangeFn => makeWallStore(buildModel(scene, segIndex, flatNumber, textureNumber), rwAngle1, view, textures, resolve, drawSolid, drawTwoSided, hooks);
}
