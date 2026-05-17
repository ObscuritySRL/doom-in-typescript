/**
 * `scalelight` rows — the Chocolate Doom 2.2.1 r_main.c
 * `R_ExecuteSetViewSize` light table bound to the loaded COLORMAP,
 * in the per-`lightnum` `Uint8Array[]` form the wall renderer consumes.
 *
 * Vanilla builds `scalelight[LIGHTLEVELS][MAXLIGHTSCALE]` as colormap
 * *indices* in `R_ExecuteSetViewSize` (the I1
 * {@link buildDiminishingLightLevelTables} `scalelightLevels` table),
 * then `R_StoreWallRange` sets `walllights = scalelight[lightnum]` — a
 * `lighttable_t**` row of `MAXLIGHTSCALE` `colormaps + level*256`
 * pointers. The I1 {@link materializeColormapRows} performs that
 * pointer binding once the IWAD COLORMAP is loaded.
 *
 * This is the single named composition of those two I1 halves: the
 * exact `scalelightRows` argument {@link makeResolveRenderSegDeps}
 * indexes by the vanilla-clamped `wallLightsIndex` (`scalelight[lightnum]`).
 * It is thin by design — the bit-exact derivation lives in the I1
 * primitives; this fixes their pairing (`scalelightLevels`,
 * `LIGHTLEVELS`, `MAXLIGHTSCALE`) so callers cannot mismatch the row /
 * column counts.
 *
 * Pure; no Win32 or runtime dependencies.
 */

import type { Viewport } from './projection.ts';
import { LIGHTLEVELS, MAXLIGHTSCALE } from './projection.ts';
import { buildDiminishingLightLevelTables, materializeColormapRows } from './renderInitTables.ts';

/**
 * Build the `scalelight` rows for `viewport`, bound to `colormaps`
 * (the loaded 32-ramp COLORMAP, `>= NUMCOLORMAPS` entries). The result
 * is indexed `rows[lightnum][rwScale >> LIGHTSCALESHIFT]` — i.e.
 * `rows[wallLightsIndex]` is the `walllights` row
 * {@link makeResolveRenderSegDeps} resolves.
 *
 * @param viewport - The active {@link Viewport} (drives the scale-light diminishing).
 * @param colormaps - The loaded COLORMAP ramps (`colormaps[level]` = 256-byte row).
 * @returns `LIGHTLEVELS` rows × `MAXLIGHTSCALE` colormap rows.
 * @throws {RangeError} (from {@link materializeColormapRows}) if `colormaps` has fewer than `NUMCOLORMAPS` ramps.
 *
 * @example
 * ```ts
 * const scalelightRows = buildScalelightRows(viewport, colormaps);
 * const resolve = makeResolveRenderSegDeps(scalelightRows, textureOf, targets);
 * ```
 */
export function buildScalelightRows(viewport: Viewport, colormaps: readonly Uint8Array[]): readonly (readonly Uint8Array[])[] {
  const { scalelightLevels } = buildDiminishingLightLevelTables(viewport);
  return materializeColormapRows(scalelightLevels, LIGHTLEVELS, MAXLIGHTSCALE, colormaps);
}
