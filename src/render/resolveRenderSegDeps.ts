/**
 * `StoredWallRange` → resolved render dependencies — the
 * `texturetranslation` / `walllights = scalelight[lightnum]` /
 * `ceilingplane` / `floorplane` resolution Chocolate Doom 2.2.1
 * r_segs.c `R_StoreWallRange` performs against globals.
 *
 * The I2 {@link storeWallRange} emits texture *numbers*
 * (`midTexture` / `topTexture` / `bottomTexture`, `0` = none) and the
 * clamped scalelight row index (`wallLightsIndex`, `null` when a fixed
 * colormap is active). {@link makeWallStore}'s `resolve` callback must
 * turn those into the concrete {@link PreparedWallTexture}s, the
 * `scalelight[lightnum]` row, and the per-subsector
 * `R_FindPlane`/`R_CheckPlane` planes the committed
 * {@link renderSeg} dispatch consumes. This builder is that pure
 * mapping with the texture catalog, the I1
 * {@link materializeColormapRows} scalelight rows, and the
 * subsector's planes / masked column injected by the caller (the
 * `R_Subsector` store context).
 *
 * `wallLightsIndex` is already the vanilla-clamped `[0,
 * LIGHTLEVELS-1]` row index `storeWallRange` produced (it owns the
 * `lightnum` clamp), so it indexes `scalelightRows` directly. It is
 * `null` in two distinct vanilla cases — r_segs.c assigns `walllights`
 * only inside `if (segtextured)`: (a) a *segtextured* seg with a fixed
 * colormap active (`walllights = scalelightfixed`), where the caller
 * supplies that row set as `fixedColormapRow`; (b) a *non-segtextured*
 * seg (e.g. a pure two-sided window), where vanilla never samples
 * `walllights` for that seg at all — an inert valid row is returned
 * (never read by `R_RenderSegLoop`). Resolving a one-sided seg whose
 * mid texture is absent, or a *segtextured* seg with the `null` light
 * index but no `fixedColormapRow`, is a wiring error and throws —
 * never a silent wrong fallback.
 *
 * Pure; no Win32 or runtime dependencies.
 */

import type { Visplane } from './renderLimits.ts';
import type { RenderSegResolved } from './renderSeg.ts';
import type { StoredWallRange } from './storeWallRange.ts';
import type { PreparedWallTexture } from './wallColumns.ts';

/** Texture number → prepared composite texture (`null` only if the catalog lacks it). */
export type TextureResolver = (textureNumber: number) => PreparedWallTexture | null;

/** Per-subsector planes + masked column the store closure threads in. */
export interface SubsectorRenderTargets {
  readonly ceilingPlane: Visplane | null;
  readonly floorPlane: Visplane | null;
  readonly maskedTextureCol: Int16Array | null;
  /** `scalelightfixed` row set when `player->fixedcolormap` is active. */
  readonly fixedColormapRow: readonly Uint8Array[] | null;
}

/**
 * Build the `resolve(stored) → RenderSegResolved` callback for one
 * subsector. `scalelightRows` is the I1
 * `materializeColormapRows(scalelightLevels, LIGHTLEVELS, MAXLIGHTSCALE,
 * colormaps)` result; `texture` maps a `texturetranslation` number to
 * its prepared composite; `targets` carries the subsector's
 * `R_FindPlane` planes, masked column, and fixed-colormap rows.
 *
 * @example
 * ```ts
 * const resolve = makeResolveRenderSegDeps(scalelightRows, textureOf, { ceilingPlane, floorPlane, maskedTextureCol: null, fixedColormapRow: null });
 * const store = makeWallStore(model, rwAngle1, view, textures, resolve, drawSolid, drawTwoSided);
 * ```
 */
export function makeResolveRenderSegDeps(scalelightRows: readonly (readonly Uint8Array[])[], texture: TextureResolver, targets: SubsectorRenderTargets): (stored: StoredWallRange) => RenderSegResolved {
  return (stored: StoredWallRange): RenderSegResolved => {
    let wallLights: readonly Uint8Array[];
    if (stored.wallLightsIndex !== null) {
      const row = scalelightRows[stored.wallLightsIndex];
      if (row === undefined) {
        throw new RangeError(`resolveRenderSegDeps: wallLightsIndex ${stored.wallLightsIndex} out of range 0..${scalelightRows.length - 1}`);
      }
      wallLights = row;
    } else if (targets.fixedColormapRow !== null) {
      wallLights = targets.fixedColormapRow;
    } else if (!stored.segtextured) {
      // Vanilla r_segs.c assigns `walllights` only inside `if
      // (segtextured)`; a non-segtextured seg (e.g. a pure two-sided
      // window with no upper/lower/mid texture) never samples it. The
      // typed RenderSegResolved still needs a value — supply an inert
      // valid row (never read by R_RenderSegLoop for this seg).
      const row = scalelightRows[0];
      if (row === undefined) {
        throw new RangeError('resolveRenderSegDeps: scalelightRows is empty');
      }
      wallLights = row;
    } else {
      throw new Error('resolveRenderSegDeps: segtextured seg has a null wallLightsIndex (fixed colormap active) but no fixedColormapRow was supplied');
    }

    return Object.freeze({
      midTexture: stored.midTexture !== 0 ? texture(stored.midTexture) : null,
      topTexture: stored.topTexture !== 0 ? texture(stored.topTexture) : null,
      bottomTexture: stored.bottomTexture !== 0 ? texture(stored.bottomTexture) : null,
      wallLights,
      ceilingPlane: targets.ceilingPlane,
      floorPlane: targets.floorPlane,
      maskedTextureCol: targets.maskedTextureCol,
    });
  };
}
