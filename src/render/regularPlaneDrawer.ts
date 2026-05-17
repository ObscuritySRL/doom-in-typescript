/**
 * Regular (flat) visplane-span drawer binding — the Chocolate Doom
 * 2.2.1 r_plane.c `R_DrawPlanes` non-sky per-plane prologue bound into
 * the {@link VisplaneRenderer} `renderPlayerViewWalls` invokes as
 * `onRegularPlane`.
 *
 * Verbatim r_plane.c per-plane prologue (the non-sky branch):
 *
 *   ds_source   = W_CacheLumpNum(firstflat + flattranslation[pl->picnum], …);
 *   planeheight = abs(pl->height - viewz);
 *   light = (pl->lightlevel >> LIGHTSEGSHIFT) + extralight;
 *   if (light >= LIGHTLEVELS) light = LIGHTLEVELS-1;
 *   if (light < 0)            light = 0;
 *   planezlight = zlight[light];
 *
 * Then `R_MakeSpans` / `R_MapPlane` draw the spans — the committed
 * bit-exact {@link renderVisplaneSpans}. Unlike the sky branch, the
 * per-plane `planeheight` / `planezlight` / `ds_source` *do* depend on
 * the individual visplane (its `height` / `lightlevel` / `picnum`), so
 * this derives them per plane from the frame-static remainder
 * (`viewx`/`viewy`/`viewangle`, `basexscale`/`baseyscale`, the
 * `yslope`/`distscale`/`xtoviewangle` tables, the per-`y` caches /
 * `spanstart`, the framebuffer). The `(pl->lightlevel >>
 * LIGHTSEGSHIFT)+extralight` clamp is the existing bit-exact
 * {@link computeVanillaWallLightLevel} with the no-adjustment
 * `'diagonal'` orientation (planes take no horizontal/vertical
 * light tweak — only walls do).
 *
 * `flatSource` is `W_CacheLumpNum(firstflat + flattranslation[picnum])`
 * (the 4096-byte 64×64 flat); `zlightRows` is
 * `materializeColormapRows(zlightLevels, LIGHTLEVELS, MAXLIGHTZ,
 * colormaps)`. Both are caller-injected (the texture/flat catalog and
 * the I1 light table), keeping this the pure per-plane prologue +
 * binding. A clamped light index that misses `zlightRows` is a
 * wiring error and throws — never a silent wrong colormap.
 *
 * Pure; no Win32 or runtime dependencies. The framebuffer is
 * caller-owned and written in place by the committed renderer.
 */

import type { VisplaneRenderer } from './drawPlanes.ts';
import { computeVanillaWallLightLevel } from './implement-light-level-and-colormap-selection.ts';
import type { Visplane } from './renderLimits.ts';
import { renderVisplaneSpans } from './visplaneSpans.ts';
import type { VisplaneSpanContext } from './visplaneSpans.ts';

/** Flat number → its 4096-byte (64×64) flat source bytes. */
export type FlatSourceResolver = (picnum: number) => Uint8Array;

/**
 * The frame-static span state + the per-plane prologue inputs the
 * regular-plane drawer needs. The frame-static fields are exactly the
 * {@link VisplaneSpanContext} members not derived from the individual
 * visplane.
 */
export interface RegularPlaneDrawerConfig {
  /** `viewz` global (fixed-point) — drives `planeheight = abs(pl->height - viewz)`. */
  readonly viewz: number;
  /** `extralight` global (gun-flash / IDBEHOLD add). */
  readonly extralight: number;
  /** `fixedcolormap` override (`null` for distance-based lighting). */
  readonly fixedColormap: Uint8Array | null;
  /** `zlight[LIGHTLEVELS][MAXLIGHTZ]` materialized against the loaded COLORMAP. */
  readonly zlightRows: readonly (readonly Uint8Array[])[];
  /** `W_CacheLumpNum(firstflat + flattranslation[picnum])`. */
  readonly flatSource: FlatSourceResolver;
  readonly viewX: number;
  readonly viewY: number;
  readonly viewAngle: number;
  readonly baseXScale: number;
  readonly baseYScale: number;
  readonly ySlope: Int32Array;
  readonly distScale: Int32Array;
  readonly xToViewAngle: Int32Array;
  readonly cachedHeight: Int32Array;
  readonly cachedDistance: Int32Array;
  readonly cachedXStep: Int32Array;
  readonly cachedYStep: Int32Array;
  readonly spanStart: Int32Array;
  readonly framebuffer: Uint8Array;
  readonly screenWidth?: number;
}

/** Optional DI hook (defaults to the committed bit-exact span pass). */
export interface RegularPlaneDrawerHooks {
  readonly renderVisplaneSpansFn?: typeof renderVisplaneSpans;
}

/**
 * Bind the frame-static span state into the `onRegularPlane`
 * {@link VisplaneRenderer} the R_DrawPlanes pool walk dispatches per
 * non-sky visplane; it runs the per-plane `R_DrawPlanes` prologue then
 * the committed span pass.
 *
 * @example
 * ```ts
 * const onRegularPlane = makeRegularPlaneDrawer({ viewz, extralight, fixedColormap, zlightRows, flatSource, viewX, viewY, viewAngle, baseXScale, baseYScale, ySlope, distScale, xToViewAngle, cachedHeight, cachedDistance, cachedXStep, cachedYStep, spanStart, framebuffer });
 * renderPlayerViewWalls(scene, player, angles, pool, viewWidth, skyflatnum, makeOnSubsector, onSkyPlane, onRegularPlane);
 * ```
 */
export function makeRegularPlaneDrawer(config: RegularPlaneDrawerConfig, hooks: RegularPlaneDrawerHooks = {}): VisplaneRenderer {
  const renderSpans = hooks.renderVisplaneSpansFn ?? renderVisplaneSpans;

  return (plane: Visplane): void => {
    // R_DrawPlanes per-plane prologue (non-sky branch).
    const light = computeVanillaWallLightLevel({ sectorLightLevel: plane.lightlevel, extralight: config.extralight, wallOrientation: 'diagonal' });
    const planeZLight = config.zlightRows[light];
    if (planeZLight === undefined) {
      throw new RangeError(`makeRegularPlaneDrawer: zlight row ${light} outside 0..${config.zlightRows.length - 1}`);
    }

    const ctx: VisplaneSpanContext = {
      planeHeight: Math.abs((plane.height - config.viewz) | 0),
      planeZLight,
      fixedColormap: config.fixedColormap,
      flatSource: config.flatSource(plane.picnum),
      viewX: config.viewX,
      viewY: config.viewY,
      viewAngle: config.viewAngle,
      baseXScale: config.baseXScale,
      baseYScale: config.baseYScale,
      ySlope: config.ySlope,
      distScale: config.distScale,
      xToViewAngle: config.xToViewAngle,
      cachedHeight: config.cachedHeight,
      cachedDistance: config.cachedDistance,
      cachedXStep: config.cachedXStep,
      cachedYStep: config.cachedYStep,
      spanStart: config.spanStart,
      framebuffer: config.framebuffer,
      screenWidth: config.screenWidth,
    };

    renderSpans(plane, ctx);
  };
}
