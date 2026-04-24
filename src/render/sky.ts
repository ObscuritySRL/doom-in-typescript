/**
 * Sky rendering semantics — the sky branch of r_plane.c `R_DrawPlanes`
 * plus the r_sky.c `R_InitSkyMap` state it consumes.
 *
 * DOOM treats the sky as a vertical wall texture wrapped around a
 * 1024-column virtual cylinder (`256 * 4` — one 256-wide sky lump
 * repeated four times around a full rotation).  Every sector whose
 * `ceilingpic` matches the `F_SKY1` flat lump is flagged "sky" during
 * map load; r_bsp.c `R_Subsector` still allocates a ceiling visplane
 * for that sector even when the ceiling is below the view plane,
 * r_plane.c `R_FindPlane` collapses every sky-tagged plane into a
 * single pool entry with `height = 0` and `lightlevel = 0`, and
 * r_plane.c `R_DrawPlanes` branches on `picnum === skyflatnum` BEFORE
 * the usual `R_MakeSpans`/`R_MapPlane` pipeline to route every column
 * through {@link rDrawColumn} with the sky-specific draw state.
 *
 * Parity invariants locked here:
 *
 * - {@link SKY_FLAT_NAME} = `"F_SKY1"`.  r_sky.h `SKYFLATNAME`.  The
 *   W_CheckNumForName lookup at map-load time produces the
 *   `skyflatnum` the renderer compares every `picnum` against.
 * - {@link ANGLETOSKYSHIFT} = `22`.  r_sky.h.  The 32-bit BAM angle
 *   `(viewangle + xtoviewangle[x])` shifts right by 22 to produce a
 *   10-bit (1024-column) virtual sky column index; the texture's
 *   `widthMask` wraps it down to the underlying 256-column sky lump
 *   so a full rotation tiles the sky four times.
 * - {@link SKY_TEXTURE_MID} = `SCREENHEIGHT/2 * FRACUNIT` =
 *   `100 << 16` = `0x640000`.  r_sky.c `R_InitSkyMap` writes this
 *   once and NEVER updates it (the view-size changes called the
 *   function but the assignment is identical each time), so every
 *   frame's sky-column draws use the constant value.  The sky
 *   `dc_texturemid` is independent of setblocks / detailshift /
 *   view-height.
 * - {@link SKY_COLORMAP_INDEX} = `0`.  r_plane.c `R_DrawPlanes` sets
 *   `dc_colormap = colormaps;` — a pointer to the FIRST colormap (the
 *   full-bright / no-diminish 256-byte row) regardless of the
 *   sector's `lightlevel` or any `fixedcolormap` override.  Vanilla
 *   comments: "Sky is allways drawn full bright, i.e. colormaps[0]
 *   is used.  Because of this hack, sky is not affected by INVUL
 *   inverse mapping."  So the invulnerability-powerup's inverse
 *   colormap does NOT invert the sky — an intentional rendering
 *   quirk that {@link renderSkyVisplane} reproduces.
 * - Sky `dc_iscale` is `pspriteiscale >> detailshift`, NOT the
 *   perspective-derived inverse scale the solid-wall path uses.
 *   r_main.c `R_ExecuteSetViewSize` sets
 *   `pspriteiscale = FRACUNIT * SCREENWIDTH / viewwidth`, so the sky
 *   draws at unity vertical scale at `setblocks = 11`
 *   (`viewwidth = SCREENWIDTH` → `pspriteiscale = FRACUNIT` →
 *   `dc_iscale = FRACUNIT`) and stretches for smaller view windows.
 *   {@link computePspriteIscale} and {@link computeSkyIscale}
 *   reproduce the two-stage vanilla derivation.
 * - r_bsp.c `R_Subsector` allocates the ceiling visplane when
 *   `frontsector->ceilingheight > viewz || frontsector->ceilingpic
 *   === skyflatnum`.  The `|| skyflatnum` clause means a sky ceiling
 *   BELOW the view plane still produces a visplane — otherwise the
 *   player looking up inside a below-eye-level sky sector would see
 *   nothing.  Callers building the visplane allocation logic check
 *   `ceilingpic === skyflatnum` alongside the height comparison.
 * - r_bsp.c `R_AddLine` "window" reject: identical front/back
 *   floor/ceiling pics (including sky-to-sky) still produce a
 *   ceiling visplane because r_segs.c's `worldtop = worldhigh` hack
 *   for sky-to-sky ceilings runs in `R_StoreWallRange`, not in
 *   `R_AddLine`.
 * - r_segs.c "hack to allow height changes in outdoor areas": when
 *   BOTH front and back sectors have `ceilingpic === skyflatnum`,
 *   `worldtop = worldhigh` — the upper wall is not drawn and the
 *   sky visplane extends from the back sector's ceiling instead of
 *   the front's.  This produces the "sky looks continuous across an
 *   outdoor step" effect.  {@link shouldCollapseSkyUpper} exposes
 *   the two-sector test so the two-sided-wall path can ask this
 *   module rather than open-coding the predicate.
 * - Per-column sky draw: `dc_yl = plane.top[x]`, `dc_yh =
 *   plane.bottom[x]`, gated by `dc_yl <= dc_yh` (empty columns are
 *   silently skipped).  The angle column index uses the UNSIGNED
 *   shift `(viewAngle + xToViewAngle[x]) >>> 22`, so wrap-around at
 *   the 4 GB BAM boundary produces the correct 10-bit column.
 *   {@link getWallColumn} masks the column index through the sky
 *   texture's `widthMask` — for a 256-wide sky the 10-bit index
 *   wraps four times across one full rotation.
 *
 * This module is pure arithmetic + framebuffer writes via
 * {@link rDrawColumn} with no Win32 or runtime dependencies.  The
 * caller owns the framebuffer, the sky texture, and the view-angle
 * tables; this function mutates only the framebuffer bytes that the
 * sky column paints.
 *
 * @example
 * ```ts
 * import { ANGLETOSKYSHIFT, SKY_TEXTURE_MID, renderSkyVisplane } from "../src/render/sky.ts";
 * import { prepareWallTexture } from "../src/render/wallColumns.ts";
 *
 * const skyTexture = prepareWallTexture("SKY1", 256, 128, placements);
 * renderSkyVisplane(plane, {
 *   skyTexture,
 *   viewAngle: 0,
 *   xToViewAngle,
 *   baseColormap: paletteColormap,
 *   iscale: 0x10000,
 *   textureMid: SKY_TEXTURE_MID,
 *   centerY: 84,
 *   framebuffer,
 * });
 * ```
 */

import { FRACUNIT } from '../core/fixed.ts';
import { rDrawColumn } from './drawPrimitives.ts';
import { SCREENHEIGHT, SCREENWIDTH } from './projection.ts';
import type { Visplane } from './renderLimits.ts';
import { getWallColumn } from './wallColumns.ts';
import type { PreparedWallTexture } from './wallColumns.ts';

/** r_sky.h `SKYFLATNAME` — the lump name that identifies a sky-capped sector. */
export const SKY_FLAT_NAME = 'F_SKY1';

/**
 * r_sky.h `ANGLETOSKYSHIFT`.  Right shift from a 32-bit BAM angle to
 * the 10-bit (1024-column) virtual sky column index.  The shift is
 * applied unsigned so the full `angle_t` range (`0..0xFFFFFFFF`)
 * wraps into `0..0x3FF` without sign extension.
 */
export const ANGLETOSKYSHIFT = 22;

/**
 * r_sky.c `R_InitSkyMap`: `skytexturemid = SCREENHEIGHT/2 * FRACUNIT`.
 * The `R_InitSkyMap` function writes this value once at startup and
 * is the only place the renderer updates `skytexturemid`, so the sky
 * always draws with row 100 pinned at the viewport center regardless
 * of `setblocks` or `detailshift`.  Value equals `100 * 0x10000 =
 * 0x640000`.
 */
export const SKY_TEXTURE_MID = ((SCREENHEIGHT / 2) * FRACUNIT) | 0;

/**
 * r_plane.c `dc_colormap = colormaps;` — the sky always draws with
 * the first (full-bright, no-diminish) colormap row.  Exported as an
 * index so callers that store the 32-colormap ramp as an array of
 * `Uint8Array` rows can index directly into it.
 */
export const SKY_COLORMAP_INDEX = 0;

/**
 * Compute the vanilla `pspriteiscale` — the inverse of the horizontal
 * view-window scale used by player sprites AND the sky column draw.
 *
 * Mirrors r_main.c `R_ExecuteSetViewSize`:
 *
 * ```c
 * pspriteiscale = FRACUNIT*SCREENWIDTH/viewwidth;
 * ```
 *
 * `viewWidth` is the POST-detailshift width (`scaledViewWidth >>
 * detailShift`), so for setblocks = 11 + high detail the result is
 * `FRACUNIT`; for setblocks = 9 + high detail the result is
 * `FRACUNIT * 320 / 288 = 0x11C71`; for low detail at setblocks = 11
 * (`viewWidth = 160`) the result is `FRACUNIT * 2 = 0x20000`.
 *
 * @throws {RangeError} If `viewWidth <= 0`.
 */
export function computePspriteIscale(viewWidth: number): number {
  if (viewWidth <= 0) {
    throw new RangeError(`viewWidth must be > 0, got ${viewWidth}`);
  }
  return ((FRACUNIT * SCREENWIDTH) / viewWidth) | 0;
}

/**
 * Compute the vanilla sky-column `dc_iscale` from `pspriteiscale` and
 * `detailshift` — `dc_iscale = pspriteiscale >> detailshift`.  The
 * right shift is arithmetic (signed), but `pspriteiscale` is always
 * positive for a valid viewWidth so the signed / unsigned
 * distinction does not matter in practice.
 *
 * At `detailShift = 0` the sky draws with `dc_iscale = pspriteiscale`
 * directly.  At `detailShift = 1` (low detail) the sky iscale is
 * halved — combined with the doubled `pspriteiscale` low detail
 * produces (`viewWidth` halved, so `pspriteiscale` doubled), the net
 * `dc_iscale` is identical to the high-detail value at the same
 * scaled width.
 */
export function computeSkyIscale(pspriteIscale: number, detailShift: number): number {
  return (pspriteIscale | 0) >> (detailShift | 0);
}

/**
 * Compute the sky-texture column index for screen column `x` given
 * the current `viewAngle` and the per-column `xToViewAngle[x]` entry.
 *
 * Mirrors r_plane.c:
 *
 * ```c
 * angle = (viewangle + xtoviewangle[x]) >> ANGLETOSKYSHIFT;
 * dc_source = R_GetColumn(skytexture, angle);
 * ```
 *
 * The addition is 32-bit modular (vanilla's `angle_t` is
 * `unsigned int`) and the shift is unsigned (`>>>`) so the full
 * `angle_t` range wraps into `[0, 1024)` without sign extension.
 * The returned index is NOT masked against the sky texture's
 * `widthMask` — {@link getWallColumn} performs that wrap when the
 * caller fetches the column bytes, matching vanilla's
 * `R_GetColumn`.
 */
export function computeSkyColumnAngle(viewAngle: number, xToViewAngleAtX: number): number {
  return ((viewAngle + xToViewAngleAtX) >>> ANGLETOSKYSHIFT) | 0;
}

/**
 * r_plane.c `R_DrawPlanes` sky-branch gate — true when the visplane's
 * `picnum` matches the caller-supplied `skyFlatNum` (the lump index
 * for `F_SKY1` resolved at map load).  Every sky-tagged plane in the
 * pool has been collapsed by `R_FindPlane` to the same `(height = 0,
 * lightlevel = 0, picnum = skyFlatNum)` triple; this helper is the
 * per-frame dispatch test that routes those planes to
 * {@link renderSkyVisplane} instead of `renderVisplaneSpans`.
 */
export function isSkyVisplane(plane: Visplane, skyFlatNum: number): boolean {
  return plane.picnum === skyFlatNum;
}

/**
 * r_segs.c sky-to-sky upper-wall collapse predicate — returns `true`
 * when both the front and back sector ceilings are flagged as sky.
 * Vanilla uses the result to set `worldtop = worldhigh`, skipping
 * the upper wall so the sky appears continuous across an outdoor
 * height step.
 *
 * The two-sided-wall path calls this before computing `worldtop` so
 * the sky renderer owns the parity-critical predicate.  Both
 * arguments are the `ceilingpic` values the map loader placed on the
 * front and back sectors; `skyFlatNum` is the resolved `F_SKY1`
 * lump index.
 */
export function shouldCollapseSkyUpper(frontCeilingPic: number, backCeilingPic: number, skyFlatNum: number): boolean {
  return frontCeilingPic === skyFlatNum && backCeilingPic === skyFlatNum;
}

/**
 * All state the sky-branch of `R_DrawPlanes` consumes beyond the
 * visplane itself.  The caller resolves `skyTexture` from the
 * map's `skytexture` global, captures `viewAngle` and
 * `xToViewAngle` from the per-frame view setup, and supplies the
 * base colormap row plus the derived `iscale` / `textureMid` /
 * `centerY` the column drawer needs.
 */
export interface SkyRenderContext {
  /**
   * Sky texture prepared via {@link prepareWallTexture}.  The
   * texture's `widthMask` wraps the 10-bit column index produced by
   * {@link computeSkyColumnAngle} down to the underlying lump width
   * (256 for DOOM1.WAD).
   */
  readonly skyTexture: PreparedWallTexture;
  /** 32-bit BAM view angle — `viewangle` global at draw time. */
  readonly viewAngle: number;
  /**
   * Per-column view-angle offset in BAM units, length `viewWidth`.
   * Built by `R_InitTextureMapping`; the sky branch reads index
   * `plane.minx..plane.maxx` only.
   */
  readonly xToViewAngle: Int32Array;
  /**
   * Full-bright colormap row — `colormaps + 0`, the first 256 bytes
   * of the COLORMAP lump.  Vanilla pins this for every sky column
   * regardless of sector lightlevel or invulnerability state.
   */
  readonly baseColormap: Uint8Array;
  /**
   * `dc_iscale` — typically
   * `computeSkyIscale(computePspriteIscale(viewWidth), detailShift)`
   * but accepted as a scalar so callers can override for tests.
   */
  readonly iscale: number;
  /**
   * `dc_texturemid` — typically {@link SKY_TEXTURE_MID}.  Accepted as
   * a scalar so callers can plug in host-side sky-texture layouts
   * without reaching into module constants.
   */
  readonly textureMid: number;
  /** Viewport vertical center (`centery` global). */
  readonly centerY: number;
  /** Palette-indexed framebuffer (`screenWidth * SCREENHEIGHT` bytes). */
  readonly framebuffer: Uint8Array;
  /** Framebuffer row stride (defaults to {@link SCREENWIDTH}). */
  readonly screenWidth?: number;
}

/**
 * r_plane.c `R_DrawPlanes` sky-branch — draw every non-empty column
 * of a sky-tagged visplane through {@link rDrawColumn}.
 *
 * Empty planes (`minx > maxx`) are a no-op.  Empty columns inside a
 * non-empty plane (`top[x] > bottom[x]`) are skipped, matching
 * vanilla's `if (dc_yl <= dc_yh)` gate.  Every non-empty column
 * fetches the sky texture column via
 * {@link computeSkyColumnAngle} + {@link getWallColumn} and hands
 * the pixel slice to {@link rDrawColumn} with the supplied
 * `iscale` / `textureMid` / `centerY` plus the full-bright colormap.
 *
 * The caller is responsible for ensuring `plane.picnum === skyFlatNum`
 * before invocation — routing non-sky planes through this function
 * would ignore the spans / distance / lighting pipeline and produce
 * wrong output, so callers gate the dispatch with
 * {@link isSkyVisplane}.
 */
export function renderSkyVisplane(plane: Visplane, ctx: SkyRenderContext): void {
  if (plane.minx > plane.maxx) {
    return;
  }

  const { skyTexture, viewAngle, xToViewAngle, baseColormap, iscale, textureMid, centerY, framebuffer } = ctx;
  const screenWidth = ctx.screenWidth ?? SCREENWIDTH;
  const top = plane.top;
  const bottom = plane.bottom;

  for (let x = plane.minx; x <= plane.maxx; x += 1) {
    const yl = top[x]!;
    const yh = bottom[x]!;
    if (yl > yh) {
      continue;
    }
    const angle = computeSkyColumnAngle(viewAngle, xToViewAngle[x]!);
    const source = getWallColumn(skyTexture, angle);
    rDrawColumn(
      {
        x,
        yl,
        yh,
        textureMid,
        iscale,
        centerY,
        source,
        colormap: baseColormap,
      },
      framebuffer,
      screenWidth,
    );
  }
}
