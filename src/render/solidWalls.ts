/**
 * Solid-wall path — one-sided linedef renderer (r_segs.c `R_StoreWallRange`
 * + `R_RenderSegLoop` for the `midtexture` branch, with the ceiling /
 * floor visplane marking logic that r_bsp.c `R_ClipSolidWallSegment`
 * expects before each seg arrives here).
 *
 * A solid wall fills the vertical gap between floor and ceiling.  For
 * every column `[rwX, rwStopX)` the seg covers, {@link renderSolidWall}:
 *
 * 1. Derives `yl` / `yh` from the fixed-point `topfrac` / `bottomfrac`
 *    accumulators, clamped to the live per-column
 *    {@link SolidWallRenderContext.ceilingClip} and
 *    {@link SolidWallRenderContext.floorClip}.
 * 2. Optionally marks the ceiling and/or floor visplane — the top/bottom
 *    rows mirror vanilla's `R_RenderSegLoop` guard (`top <= bottom` only
 *    after intersecting with the opposite clip).
 * 3. Resolves the texture U via the caller-supplied
 *    {@link SolidWallSegment.textureColumnFor}, picks the light-diminish
 *    colormap from `wallLights[scale >> LIGHTSCALESHIFT]` (clamped to
 *    {@link MAXLIGHTSCALE} - 1), divides `0xffffffff / scale` as unsigned
 *    int32 for `dc_iscale`, fetches the midtexture column via
 *    {@link getWallColumn}, and calls {@link rDrawColumn}.
 * 4. Closes the column off by writing `ceilingClip[x] = viewHeight` and
 *    `floorClip[x] = -1` — the vanilla terminal update that prevents any
 *    later seg, visplane, or sprite from touching this column.
 * 5. Advances `topFrac`, `bottomFrac`, and `scale` by their per-column
 *    steps before iterating to the next column.
 *
 * Parity invariants locked here:
 *
 * - {@link HEIGHTBITS} = `12` and {@link HEIGHTUNIT} = `4096` mirror the
 *   r_segs.c macros.  `yl = (topfrac + HEIGHTUNIT - 1) >> HEIGHTBITS`
 *   ceiling-divides `topfrac` by `HEIGHTUNIT` (rounds up to the next
 *   integer row).  `yh = bottomfrac >> HEIGHTBITS` floor-divides
 *   (rounds down).
 * - Vanilla ceiling-visplane marking uses the POST-clamp `yl`: when `yl`
 *   is clamped to `ceilingclip[x]+1`, `top = ceilingclip[x]+1` equals
 *   `yl` and `bottom = yl-1 = ceilingclip[x]` — so `top > bottom` and
 *   nothing is marked.  Same for the floor.
 * - Vanilla ceiling/floor visplane marking reads the ORIGINAL
 *   `ceilingclip[x]` / `floorclip[x]` values, not the post-draw terminal
 *   values (`viewheight` / `-1`).  This module captures them into
 *   `ceilingHere` / `floorHere` before any marking or drawing.
 * - `dc_iscale = 0xffffffffu / (unsigned)rw_scale`.  Reproduced via
 *   `(INVERSE_SCALE_NUMERATOR / (scale >>> 0)) | 0` — `>>> 0` coerces the
 *   denominator to uint32 and `| 0` coerces the quotient back to the
 *   sign-extended int32 that `fixed_t` expects.  For tiny scales the
 *   quotient exceeds `0x7FFFFFFF`, sign-extends to negative, and walks
 *   the texture column backwards — matching vanilla's unsigned division
 *   into a signed accumulator.
 * - `index = scale >> LIGHTSCALESHIFT` is clamped to
 *   `MAXLIGHTSCALE - 1` via `>=`.  Vanilla never generates a negative
 *   scale, so the lower clamp is omitted.
 * - The terminal `ceilingClip[x] = viewHeight` / `floorClip[x] = -1`
 *   update happens AFTER the {@link rDrawColumn} call.  If a caller
 *   orders two segs such that the second shares a column with the first,
 *   the second seg's yl/yh computation will see the closed-off values
 *   (`yl` clamped to `viewHeight + 1` > `yh = -2`) and skip drawing —
 *   matching vanilla's cover-and-close semantics.
 *
 * This module is pure arithmetic + typed-array writes with no Win32 or
 * runtime dependencies.  The caller owns the framebuffer, clip arrays,
 * and visplane records; this function mutates them in place.
 *
 * @example
 * ```ts
 * import {
 *   HEIGHTUNIT,
 *   renderSolidWall,
 * } from "../src/render/solidWalls.ts";
 * import { prepareWallTexture } from "../src/render/wallColumns.ts";
 *
 * const midTexture = prepareWallTexture("STARTAN1", 64, 128, patches);
 * renderSolidWall(
 *   {
 *     rwX: 0,
 *     rwStopX: 320,
 *     topFrac: 0,
 *     topStep: 0,
 *     bottomFrac: 168 * HEIGHTUNIT - 1,
 *     bottomStep: 0,
 *     midTexture,
 *     midTextureMid: 0,
 *     scale: 0x10000,
 *     scaleStep: 0,
 *     wallLights,
 *     markCeiling: false,
 *     ceilingPlane: null,
 *     markFloor: false,
 *     floorPlane: null,
 *     textureColumnFor: (x) => x,
 *   },
 *   { framebuffer, viewHeight: 168, centerY: 84, ceilingClip, floorClip },
 * );
 * ```
 */

import { rDrawColumn } from './drawPrimitives.ts';
import { LIGHTSCALESHIFT, MAXLIGHTSCALE, SCREENWIDTH } from './projection.ts';
import type { Visplane } from './renderLimits.ts';
import { getWallColumn } from './wallColumns.ts';
import type { PreparedWallTexture } from './wallColumns.ts';

/**
 * Right-shift applied to `topfrac` / `bottomfrac` to produce an integer
 * screen row (r_segs.c `HEIGHTBITS`).  A 12-bit shift means `1.0 row` is
 * encoded as `HEIGHTUNIT = 4096` — the per-column `topstep` / `bottomstep`
 * accumulators add this unit once per column at a 1:1 slope.
 */
export const HEIGHTBITS = 12;

/**
 * `1 << HEIGHTBITS` = `4096` — the r_segs.c `HEIGHTUNIT` constant.  Used
 * by the `yl = (topfrac + HEIGHTUNIT - 1) >> HEIGHTBITS` ceiling divide.
 */
export const HEIGHTUNIT = 1 << HEIGHTBITS;

/**
 * Numerator for the `dc_iscale = 0xffffffffu / rw_scale` unsigned
 * division in r_segs.c `R_RenderSegLoop`.  Kept as a named constant so
 * the inverse-scale derivation can be audited without re-deriving the
 * literal.
 */
export const INVERSE_SCALE_NUMERATOR = 0xffff_ffff;

/**
 * All per-seg state a solid wall needs.  The caller is responsible for
 * filling these in from the sector / linedef / sidedef layout plus the
 * bsp traversal that produced the seg clip range.  This module owns
 * only the per-column loop; it does not read the map, the wad cache,
 * or the perspective table.
 */
export interface SolidWallSegment {
  /** Leftmost column (inclusive, `rw_x`). */
  readonly rwX: number;
  /**
   * One past the rightmost column (`rw_stopx`).  Vanilla iterates
   * `while (rw_x < rw_stopx)`, so columns are `[rwX, rwStopX)`.
   */
  readonly rwStopX: number;
  /** Initial `topfrac` at `rwX` (HEIGHTUNIT scale). */
  readonly topFrac: number;
  /** Per-column `topstep` (HEIGHTUNIT scale). */
  readonly topStep: number;
  /** Initial `bottomfrac` at `rwX`. */
  readonly bottomFrac: number;
  /** Per-column `bottomstep`. */
  readonly bottomStep: number;
  /** Midtexture composite produced by {@link prepareWallTexture}. */
  readonly midTexture: PreparedWallTexture;
  /**
   * Fixed-point `rw_midtexturemid` — the texture V the renderer places
   * at the viewport vertical center.  Forwarded verbatim to
   * {@link rDrawColumn}'s `textureMid`.
   */
  readonly midTextureMid: number;
  /** Initial `rw_scale` at `rwX` (inverse perspective divisor). */
  readonly scale: number;
  /** Per-column `rw_scalestep`. */
  readonly scaleStep: number;
  /**
   * Per-scale-bucket colormap table of length {@link MAXLIGHTSCALE}.
   * Vanilla `walllights` points at one of 16 per-light-level arrays
   * (`scalelight[lightlevel]`); the caller has already resolved the
   * correct bucket before handing the table to this module.
   */
  readonly wallLights: readonly Uint8Array[];
  /** `true` when this seg contributes to the ceiling visplane. */
  readonly markCeiling: boolean;
  /**
   * Ceiling visplane record.  Mutated only when `markCeiling` is `true`
   * AND the intersected row range is non-empty (`top <= bottom`).
   */
  readonly ceilingPlane: Visplane | null;
  /** `true` when this seg contributes to the floor visplane. */
  readonly markFloor: boolean;
  /**
   * Floor visplane record.  Mutated only when `markFloor` is `true` AND
   * the intersected row range is non-empty.
   */
  readonly floorPlane: Visplane | null;
  /**
   * Resolve the integer wall-texture U (column index) for a given screen
   * column.  Vanilla derives this from the `xtoviewangle`,
   * `finetangent`, and per-seg `rw_offset` / `rw_distance`:
   *
   * ```c
   * angle = (rw_centerangle + xtoviewangle[rw_x]) >> ANGLETOFINESHIFT;
   * texturecolumn = rw_offset - FixedMul(finetangent[angle], rw_distance);
   * texturecolumn >>= FRACBITS;
   * ```
   *
   * Callers that already maintain those tables pre-compute the U and
   * pass a closure so this module stays focused on the solid-wall
   * loop.  The returned integer is handed to {@link getWallColumn},
   * which masks it through the texture width mask.
   */
  readonly textureColumnFor: (x: number) => number;
}

/**
 * Per-frame framebuffer + clip state.  The caller allocates these once
 * per frame and hands them to every seg path.  This module mutates them
 * in place — after one seg runs, its columns inside `[rwX, rwStopX)` are
 * marked closed (`ceilingClip[x] = viewHeight`, `floorClip[x] = -1`) so
 * subsequent seg paths skip them.
 */
export interface SolidWallRenderContext {
  /**
   * Palette-indexed framebuffer (`screenWidth * SCREENHEIGHT` bytes in
   * the default configuration).  {@link rDrawColumn} writes into this
   * buffer directly, so mutation is visible to subsequent renderer
   * passes.
   */
  readonly framebuffer: Uint8Array;
  /**
   * Framebuffer row stride in bytes.  Defaults to {@link SCREENWIDTH}
   * so callers rendering to the vanilla 320-wide framebuffer can omit
   * the field.
   */
  readonly screenWidth?: number;
  /** Active viewport `viewheight` (pixel rows drawn). */
  readonly viewHeight: number;
  /**
   * Active viewport `centery` (viewport vertical center row).
   * Forwarded verbatim to {@link rDrawColumn}'s `centerY`.
   */
  readonly centerY: number;
  /**
   * Per-column ceiling clip array (`short ceilingclip[SCREENWIDTH]` in
   * vanilla).  Mutated in place: each column the seg covers ends the
   * loop at `ceilingClip[x] = viewHeight`.
   */
  readonly ceilingClip: Int16Array;
  /**
   * Per-column floor clip array (`short floorclip[SCREENWIDTH]`).
   * Mutated in place: each column the seg covers ends the loop at
   * `floorClip[x] = -1`.
   */
  readonly floorClip: Int16Array;
}

/**
 * Render a solid (one-sided, fully-solid) wall seg covering
 * `[rwX, rwStopX)`.
 *
 * Mirrors r_segs.c `R_RenderSegLoop` for the `midtexture` branch
 * byte-for-byte; the caller is responsible for `R_StoreWallRange`'s
 * earlier setup (seg framing, midtexture resolution, `rw_scale` /
 * `rw_scalestep` derivation, visplane prep) and for the BSP-level
 * `R_ClipSolidWallSegment` decision to invoke this path at all.
 *
 * No return value: side effects are (1) per-column writes into
 * `framebuffer`, (2) per-column top/bottom writes into the visplane
 * records when `markCeiling` / `markFloor` are set, and (3) the terminal
 * `ceilingClip[x] = viewHeight` / `floorClip[x] = -1` updates that
 * close the column.
 *
 * Columns outside `[rwX, rwStopX)` are left entirely untouched.  A seg
 * with `rwStopX <= rwX` draws nothing.
 */
export function renderSolidWall(seg: SolidWallSegment, ctx: SolidWallRenderContext): void {
  const screenWidth = ctx.screenWidth ?? SCREENWIDTH;
  const { framebuffer, viewHeight, centerY, ceilingClip, floorClip } = ctx;
  const { midTexture, midTextureMid, wallLights, markCeiling, markFloor, ceilingPlane, floorPlane, textureColumnFor } = seg;

  const topStep = seg.topStep | 0;
  const bottomStep = seg.bottomStep | 0;
  const scaleStep = seg.scaleStep | 0;
  const viewHeightInt = viewHeight | 0;

  let topFrac = seg.topFrac | 0;
  let bottomFrac = seg.bottomFrac | 0;
  let scale = seg.scale | 0;

  for (let x = seg.rwX; x < seg.rwStopX; x += 1) {
    const ceilingHere = ceilingClip[x]!;
    const floorHere = floorClip[x]!;

    let yl = (topFrac + HEIGHTUNIT - 1) >> HEIGHTBITS;
    if (yl < ceilingHere + 1) {
      yl = ceilingHere + 1;
    }

    if (markCeiling && ceilingPlane !== null) {
      const top = ceilingHere + 1;
      let bottom = yl - 1;
      if (bottom >= floorHere) {
        bottom = floorHere - 1;
      }
      if (top <= bottom) {
        ceilingPlane.top[x] = top;
        ceilingPlane.bottom[x] = bottom;
      }
    }

    let yh = bottomFrac >> HEIGHTBITS;
    if (yh >= floorHere) {
      yh = floorHere - 1;
    }

    if (markFloor && floorPlane !== null) {
      let top = yh + 1;
      const bottom = floorHere - 1;
      if (top <= ceilingHere) {
        top = ceilingHere + 1;
      }
      if (top <= bottom) {
        floorPlane.top[x] = top;
        floorPlane.bottom[x] = bottom;
      }
    }

    const texturecolumn = textureColumnFor(x);
    let index = scale >> LIGHTSCALESHIFT;
    if (index >= MAXLIGHTSCALE) {
      index = MAXLIGHTSCALE - 1;
    }
    const colormap = wallLights[index]!;
    const iscale = (INVERSE_SCALE_NUMERATOR / (scale >>> 0)) | 0;

    const source = getWallColumn(midTexture, texturecolumn);
    rDrawColumn(
      {
        x,
        yl,
        yh,
        textureMid: midTextureMid,
        iscale,
        centerY,
        source,
        colormap,
      },
      framebuffer,
      screenWidth,
    );

    ceilingClip[x] = viewHeightInt;
    floorClip[x] = -1;

    topFrac = (topFrac + topStep) | 0;
    bottomFrac = (bottomFrac + bottomStep) | 0;
    scale = (scale + scaleStep) | 0;
  }
}
