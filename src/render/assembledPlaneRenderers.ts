/**
 * Assembled plane-renderer factory — composes the committed
 * {@link makeSkyPlaneDrawer} / {@link makeRegularPlaneDrawer} bindings
 * into the per-frame `onSkyPlane` / `onRegularPlane`
 * {@link VisplaneRenderer}s `renderPlayerViewWalls` flushes the
 * visplane pool through (Chocolate Doom 2.2.1 r_main.c
 * `R_RenderPlayerView` → r_plane.c `R_DrawPlanes`).
 *
 * `R_DrawPlanes` runs after `R_RenderBSPNode`, reading the same
 * globals `R_SetupFrame` set; `R_ClearPlanes` derives the per-frame
 * `basexscale` / `baseyscale` from `viewangle`. So — exactly like the
 * subsector visitor — the plane drawers are frame-bound: this is the
 * plane-side analogue of {@link makeAssembledOnSubsector}. Per-level /
 * per-viewport pieces (sky texture, full-bright colormap, `zlight`
 * rows, flat source, the I1 `yslope`/`distscale` tables, the per-`y`
 * span scratch, the framebuffer) are captured once; the returned
 * factory derives the per-frame state from the {@link ViewFrame}.
 *
 * The `basexscale` / `baseyscale` derivation is transcribed verbatim
 * from r_plane.c `R_ClearPlanes` (verified against Chocolate Doom
 * 2.2.1 source — the local visplaneSpans doc's `FixedMul(viewsin,
 * iprojection)` phrasing is loose; the authoritative form is):
 *
 *   angle      = (viewangle - ANG90) >> ANGLETOFINESHIFT;
 *   basexscale =  FixedDiv(finecosine[angle], centerxfrac);
 *   baseyscale = -FixedDiv(finesine[angle],   centerxfrac);
 *
 * `viewangle` is `angle_t` (unsigned 32-bit): the subtraction wraps
 * mod 2^32 and the shift is logical (`>>> 0` then `>>> ANGLETOFINESHIFT`).
 *
 * Pure; no Win32 or runtime dependencies. Every composed piece is an
 * independently committed + tested module.
 */

import { ANG90 } from '../core/angle.ts';
import { fixedDiv } from '../core/fixed.ts';
import { ANGLETOFINESHIFT, finecosine, finesine } from '../core/trig.ts';

import type { VisplaneRenderer } from './drawPlanes.ts';
import type { Viewport } from './projection.ts';
import type { PlaneProjectionTables } from './renderInitTables.ts';
import { makeRegularPlaneDrawer } from './regularPlaneDrawer.ts';
import type { FlatSourceResolver, RegularPlaneDrawerHooks } from './regularPlaneDrawer.ts';
import type { ViewFrame } from './setupFrame.ts';
import { makeSkyPlaneDrawer } from './skyPlaneDrawer.ts';
import type { SkyPlaneDrawerHooks } from './skyPlaneDrawer.ts';
import type { PreparedWallTexture } from './wallColumns.ts';

/** Caller-owned per-`y` span scratch (vanilla `cached*` / `spanstart`). */
export interface PlaneSpanScratch {
  readonly cachedHeight: Int32Array;
  readonly cachedDistance: Int32Array;
  readonly cachedXStep: Int32Array;
  readonly cachedYStep: Int32Array;
  readonly spanStart: Int32Array;
}

/** The per-level / per-viewport inputs the assembled plane renderers bind. */
export interface AssembledPlaneRenderersConfig {
  /** Sky texture (prepared); full-bright, single texture per frame. */
  readonly skyTexture: PreparedWallTexture;
  /** `colormaps + 0` — the full-bright COLORMAP row sky columns pin. */
  readonly baseColormap: Uint8Array;
  /** `dc_iscale` for the sky column (`computeSkyIscale(...)`). */
  readonly skyIscale: number;
  /** `dc_texturemid` for the sky column (`SKY_TEXTURE_MID`). */
  readonly skyTextureMid: number;
  /** Loaded 32-ramp COLORMAP (for the `fixedcolormap` override). */
  readonly colormaps: readonly Uint8Array[];
  /** `zlight[LIGHTLEVELS][MAXLIGHTZ]` materialized against the COLORMAP. */
  readonly zlightRows: readonly (readonly Uint8Array[])[];
  /** `W_CacheLumpNum(firstflat + flattranslation[picnum])`. */
  readonly flatSource: FlatSourceResolver;
  /** Active viewport (`centerXFrac` / `centerY`). */
  readonly viewport: Viewport;
  /** I1 `xtoviewangle` table (`projectionAngles.xtoviewangle`). */
  readonly xToViewAngle: Int32Array;
  /** I1 `yslope` / `distscale` for the active viewport. */
  readonly planeTables: PlaneProjectionTables;
  /** Caller-owned per-`y` span scratch arrays. */
  readonly spanScratch: PlaneSpanScratch;
  /** Palette-indexed framebuffer (written in place by the committed passes). */
  readonly framebuffer: Uint8Array;
  /** Framebuffer row stride (defaults to the vanilla 320). */
  readonly screenWidth?: number;
}

/** The per-frame bound plane renderers. */
export interface AssembledPlaneRenderers {
  readonly onSkyPlane: VisplaneRenderer;
  readonly onRegularPlane: VisplaneRenderer;
}

/** Optional DI hooks (pass through to the committed bit-exact passes). */
export interface AssembledPlaneRenderersHooks extends SkyPlaneDrawerHooks, RegularPlaneDrawerHooks {}

/**
 * Build the assembled plane-renderer factory for one level/viewport.
 * Invoke per frame with the {@link ViewFrame} `R_SetupFrame` produced;
 * pass the results as `renderPlayerViewWalls`'s `onSkyPlane` /
 * `onRegularPlane`.
 *
 * @example
 * ```ts
 * const makePlanes = makeAssembledPlaneRenderers(config);
 * const { onSkyPlane, onRegularPlane } = makePlanes(frame);
 * ```
 */
export function makeAssembledPlaneRenderers(config: AssembledPlaneRenderersConfig, hooks: AssembledPlaneRenderersHooks = {}): (frame: ViewFrame) => AssembledPlaneRenderers {
  const centerxfrac = config.viewport.centerXFrac;
  const skyHooks: SkyPlaneDrawerHooks = { renderSkyVisplaneFn: hooks.renderSkyVisplaneFn };
  const regularHooks: RegularPlaneDrawerHooks = { renderVisplaneSpansFn: hooks.renderVisplaneSpansFn };

  return (frame: ViewFrame): AssembledPlaneRenderers => {
    // r_plane.c R_ClearPlanes (viewangle is angle_t — unsigned wrap).
    const angle = ((frame.viewangle - ANG90) >>> 0) >>> ANGLETOFINESHIFT;
    const baseXScale = fixedDiv(finecosine[angle]!, centerxfrac);
    const baseYScale = -fixedDiv(finesine[angle]!, centerxfrac);

    let fixedColormap: Uint8Array | null = null;
    if (frame.fixedColormapIndex !== null) {
      const ramp = config.colormaps[frame.fixedColormapIndex];
      if (ramp === undefined) {
        throw new RangeError(`makeAssembledPlaneRenderers: fixedColormapIndex ${frame.fixedColormapIndex} outside 0..${config.colormaps.length - 1}`);
      }
      fixedColormap = ramp;
    }

    const onSkyPlane = makeSkyPlaneDrawer(
      {
        skyTexture: config.skyTexture,
        viewAngle: frame.viewangle,
        xToViewAngle: config.xToViewAngle,
        baseColormap: config.baseColormap,
        iscale: config.skyIscale,
        textureMid: config.skyTextureMid,
        centerY: config.viewport.centerY,
        framebuffer: config.framebuffer,
        screenWidth: config.screenWidth,
      },
      skyHooks,
    );

    const onRegularPlane = makeRegularPlaneDrawer(
      {
        viewz: frame.viewz,
        extralight: frame.extralight,
        fixedColormap,
        zlightRows: config.zlightRows,
        flatSource: config.flatSource,
        viewX: frame.viewx,
        viewY: frame.viewy,
        viewAngle: frame.viewangle,
        baseXScale,
        baseYScale,
        ySlope: config.planeTables.yslope,
        distScale: config.planeTables.distscale,
        xToViewAngle: config.xToViewAngle,
        cachedHeight: config.spanScratch.cachedHeight,
        cachedDistance: config.spanScratch.cachedDistance,
        cachedXStep: config.spanScratch.cachedXStep,
        cachedYStep: config.spanScratch.cachedYStep,
        spanStart: config.spanScratch.spanStart,
        framebuffer: config.framebuffer,
        screenWidth: config.screenWidth,
      },
      regularHooks,
    );

    return { onSkyPlane, onRegularPlane };
  };
}
