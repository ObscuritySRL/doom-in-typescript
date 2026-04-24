/**
 * Masked midtextures — r_segs.c `R_RenderMaskedSegRange` plus r_things.c
 * `R_DrawMaskedColumn`.
 *
 * Two-sided walls with a "midtexture" (a non-null `sidedef->midtexture`)
 * draw a translucent-by-absence texture BETWEEN the upper and lower
 * walls — window bars, fence slats, cage grids, hanging chains.  The
 * geometry is registered by {@link TwoSidedWallSegment} (step 13-007)
 * which writes the per-column raw texturecolumn value into
 * `maskedTextureCol[x]`; the actual draw is deferred until all solid
 * walls, floors, ceilings, and skies have been rendered, because the
 * masked column's "transparent" pixels (gaps between posts) must show
 * the background already painted there.
 *
 * The masked pass runs AFTER sprite sort-and-clip (step 13-012): when a
 * {@link drawMasked} iteration encounters a sprite that sits in front of
 * a drawseg carrying a masked midtexture, the drawseg's masked columns
 * that overlap the sprite are rendered FIRST (so the sprite paints over
 * them), and the callback must record per-column "done" flags so the
 * remaining-seg post-pass does not re-draw them.  The done-flag is
 * `maskedtexturecol[x] = MAXSHORT` matching vanilla's `= MAXSHORT` write
 * after each column's draw.
 *
 * Per column `x` in `[x1, x2]`, {@link renderMaskedSegRange}:
 *
 * 1. Skips columns where `seg.maskedtexturecol[x] === {@link MAXSHORT}`
 *    (already drawn by a prior clipVisSprite pass).
 * 2. Resolves the colormap: `fixedColormap !== null` forces the supplied
 *    override (INVUL inverse palette); otherwise indexes the per-seg
 *    `wallLights[scale >> LIGHTSCALESHIFT]` bucket clamped to
 *    `[0, MAXLIGHTSCALE - 1]`.  Vanilla clamps only the upper end
 *    (`index >= MAXLIGHTSCALE → MAXLIGHTSCALE - 1`) with no lower-bound
 *    clamp — a negative bucket reads `walllights[-1]` which is
 *    undefined in C (UB) and would crash in JS; we preserve vanilla's
 *    upper clamp and add a lower clamp to `0` so a stray negative
 *    scale does not read past the start of the table.  Vanilla scenes
 *    never produce a negative scale here, so the added clamp does not
 *    change observable behavior.
 * 3. Computes `iscale = 0xffffffff / (uint32)spryscale` exactly as
 *    vanilla — an unsigned 32-bit divide.  JS coerces via
 *    `spryscale >>> 0` to uint32 then divides the positive double and
 *    `| 0`-truncates to int32, preserving vanilla's bit pattern for
 *    iscale values that overflow signed int32 (e.g. `0xffffffff / 1
 *    === -1` after `| 0`, matching vanilla's `dc_iscale = -1` when
 *    spryscale === 1).
 * 4. Computes `sprtopscreen = centeryfrac - FixedMul(textureMid,
 *    spryscale)` — the fixed-point screen row of the midtexture's row
 *    0 before post offsets.
 * 5. Applies the texture `widthMask` to the raw texturecolumn value
 *    (`texCol & widthMask`) and calls {@link MaskedDrawSeg.maskedColumnFor}
 *    to fetch the PatchColumn for that masked column.  The widthMask
 *    matches r_data.c `texturewidthmask[]` — the largest power-of-2
 *    less than or equal to the texture width, minus one.  Negative
 *    texturecolumn values (possible when `rw_offset` makes a seg's
 *    U-coordinate negative) wrap correctly because JS bitwise AND
 *    interprets operands as int32 two's complement, so `-1 & 127 ===
 *    127` just like C.
 * 6. Iterates each {@link PatchPost} in the column:
 *    - `topscreen = sprtopscreen + spryscale * post.topDelta`
 *    - `bottomscreen = topscreen + spryscale * post.length`
 *    - `yl = (topscreen + FRACUNIT - 1) >> FRACBITS`  (ceiling-divide)
 *    - `yh = (bottomscreen - 1) >> FRACBITS`  (floor-divide minus one)
 *    - Clips `yh` against `seg.sprbottomclip[x]` (floor silhouette):
 *      `if (yh >= sprbottomclip[x]) yh = sprbottomclip[x] - 1`.
 *    - Clips `yl` against `seg.sprtopclip[x]` (ceiling silhouette):
 *      `if (yl <= sprtopclip[x]) yl = sprtopclip[x] + 1`.
 *    - If `yl <= yh`, paints `[yl, yh]` into the framebuffer with
 *      `dc_texturemid = textureMid - (post.topDelta << FRACBITS)` so
 *      the per-row `frac` accumulator indexes `post.pixels[0..length-1]`
 *      regardless of where the post sits within the texture.
 * 7. Writes `maskedtexturecol[x] = MAXSHORT` AFTER the post loop to flag
 *    the column as drawn.  Subsequent calls from the remaining-masked
 *    pass (drawMasked's post-sprite sweep) skip this column because of
 *    the `texCol !== MAXSHORT` gate at the top of the loop.
 *
 * Advances `spryscale` by `scaleStep` at the end of each column —
 * matches vanilla's `spryscale += rw_scalestep` unconditional advance
 * which runs even for columns already at MAXSHORT so the per-column
 * scale stays in lockstep with the seg's geometry.
 *
 * Parity invariants locked here:
 *
 * - {@link MAXSHORT} = `32767` = `0x7fff` = the signed int16 max.
 *   Vanilla uses `MAXSHORT` from m_fixed.h / doomtype.h as the done
 *   flag.  Int16Array holds signed int16, so `32767` stores directly.
 * - The per-column done-flag gate is `texCol !== MAXSHORT`, NOT
 *   `texCol >= 0` or any other check.  If a caller writes a different
 *   sentinel (e.g. `-1` or `MAXINT`), the second pass re-draws the
 *   column.  Matching vanilla exactly is the parity contract.
 * - `spryscale` is advanced by `scaleStep` per column REGARDLESS of
 *   whether the column was drawn or skipped (MAXSHORT).  Vanilla does
 *   `spryscale += rw_scalestep` after the `if (maskedtexturecol[dc_x]
 *   != MAXSHORT)` block, outside the `if`.  A refactor that moves the
 *   advance inside the `if` would desync scale across MAXSHORT runs.
 * - The post clip order is: `yh` (floor) FIRST, then `yl` (ceiling).
 *   Vanilla's R_DrawMaskedColumn performs both checks unconditionally
 *   in this order.  Reversing the order would not change output for
 *   non-overlapping clips but could matter for degenerate clips where
 *   `sprtopclip[x] >= sprbottomclip[x]` (a fully-closed column — the
 *   draw is suppressed either way because `yl > yh` after both
 *   clamps).
 * - Each post is drawn with its own `dc_texturemid` adjusted by
 *   `-post.topDelta << FRACBITS`.  Vanilla's R_DrawMaskedColumn
 *   saves `basetexturemid = dc_texturemid` at entry, modifies
 *   `dc_texturemid` per post, and restores at exit; we recompute per
 *   post and never mutate the seg's textureMid so the module is
 *   re-entrant without save/restore.
 * - The post's pixel source is `post.pixels` — a `Uint8Array` of
 *   exactly `post.length` bytes.  Vanilla's `dc_source = (byte *)column
 *   + 3` points at the first pixel after the 3-byte post header
 *   (topDelta, length, leadingPad).  The decoded patch already
 *   stripped the header bytes, so `post.pixels` is byte-equivalent
 *   to `column + 3`.
 * - {@link drawPostColumn} is the inner loop mirroring r_draw.c
 *   `R_DrawColumn` byte-for-byte WITHOUT the `& 127` composite mask.
 *   The mask is safe to omit because `yl` and `yh` are pre-clipped
 *   such that `frac >> FRACBITS` stays in `[0, post.length - 1]`
 *   throughout the loop; vanilla's R_DrawColumn keeps the mask
 *   because wall-texture composite columns are 128 rows tall, but
 *   for masked posts the mask value happens to equal the source
 *   index only when `post.length <= 128`, which is true for every
 *   DOOM1.WAD midtexture but not a load-bearing parity invariant.
 *   Dropping the mask matches the more semantically correct
 *   "read-from-post" contract.
 * - `centeryfrac` is `centerY * FRACUNIT` in vanilla.  Callers pass
 *   the pre-computed fixed-point value directly so this module does
 *   not hard-code the SCREENHEIGHT / 2 midpoint — a future window-
 *   resize step can vary centerY without edits here.
 *
 * This module is pure arithmetic + typed-array writes with no Win32 or
 * runtime dependencies.  Callers own the drawseg list, per-seg post
 * resolver, per-frame view state, and the integration with
 * {@link drawMasked} from `./spriteClip.ts` that dispatches the
 * callback.
 *
 * @example
 * ```ts
 * import { renderMaskedSegRange, MAXSHORT } from "../src/render/maskedTextures.ts";
 *
 * const seg: MaskedDrawSeg = {
 *   x1: 0, x2: 2, scale1: 0x10000, scale2: 0x10000,
 *   silhouette: 0, bsilheight: 0, tsilheight: 0,
 *   sprtopclip: topClip, sprbottomclip: botClip,
 *   maskedtexturecol: masked,
 *   v1x: 0, v1y: 0, v2x: 0, v2y: 0,
 *   scaleStep: 0, textureMid: 0, midTextureWidthMask: 127,
 *   wallLights, fixedColormap: null,
 *   maskedColumnFor: (col) => postsByColumn[col],
 * };
 * renderMaskedSegRange(seg, 0, 2, {
 *   framebuffer, screenWidth: 16, centerY: 8, centerYFrac: 8 * FRACUNIT,
 * });
 * ```
 */

import { fixedMul, FRACBITS, FRACUNIT } from '../core/fixed.ts';

import type { PatchColumn } from './patchDraw.ts';
import { LIGHTSCALESHIFT, MAXLIGHTSCALE, SCREENWIDTH } from './projection.ts';
import type { SpriteClipDrawSeg } from './spriteClip.ts';

/**
 * Signed int16 maximum = `32767` = `0x7fff`.  Mirrors doomtype.h
 * `MAXSHORT` and r_segs.c's `maskedtexturecol[dc_x] = MAXSHORT` done-
 * flag write at the end of each column's draw.
 */
export const MAXSHORT = 0x7fff;

/**
 * Drawseg carrying a masked midtexture.  Extends
 * {@link SpriteClipDrawSeg} (which already carries
 * `maskedtexturecol: Int16Array | null` plus the sprite silhouettes)
 * with the per-seg texture-draw parameters {@link renderMaskedSegRange}
 * needs: the scale step, the base `textureMid`, the widthMask, the
 * light table, and the per-column post resolver.
 *
 * Callers that keep a fuller drawseg record in their BSP traversal
 * adapt to this interface via either (a) structural inheritance where
 * the fuller record includes all fields listed here, or (b) a wrapper
 * record that adds the masked-specific fields alongside a reference to
 * the base drawseg.
 */
export interface MaskedDrawSeg extends SpriteClipDrawSeg {
  /**
   * Per-column `spryscale` delta (`rw_scalestep` in vanilla).  Added
   * to `spryscale` AFTER each column is drawn or skipped so the scale
   * walks across the seg in lockstep with the geometry.
   */
  readonly scaleStep: number;
  /**
   * Fixed-point texture V at `centerY` for this seg's midtexture
   * (`dc_texturemid` in vanilla).  Callers pre-compute from the
   * linedef's `ML_DONTPEGBOTTOM` flag, front/back sector floor
   * heights, midtexture height, and `sidedef->rowoffset`.
   */
  readonly textureMid: number;
  /**
   * Midtexture wrap mask (largest power-of-2 less than or equal to
   * the texture width, minus one).  Applied via `texCol & widthMask`
   * before calling {@link MaskedDrawSeg.maskedColumnFor} so non-power-
   * of-2 widths wrap prematurely exactly like
   * {@link computeTextureWidthMask}.
   */
  readonly midTextureWidthMask: number;
  /**
   * Per-scale-bucket colormap table of length {@link MAXLIGHTSCALE}.
   * Same convention as {@link TwoSidedWallSegment.wallLights}: the
   * bucket index is `spryscale >> LIGHTSCALESHIFT` clamped to
   * `[0, MAXLIGHTSCALE - 1]`.
   */
  readonly wallLights: readonly Uint8Array[];
  /**
   * Optional fixed-colormap override (e.g. INVUL inverse palette).
   * `null` means use {@link MaskedDrawSeg.wallLights}.  When non-null,
   * every column uses this colormap regardless of scale.
   */
  readonly fixedColormap: Uint8Array | null;
  /**
   * Resolve the {@link PatchColumn} (post chain) for a masked texture
   * column.  The argument is the post-widthMask column index (already
   * wrapped into `[0, width - 1]` by this module).  Callers typically
   * plumb this from the midtexture's {@link DecodedPatch} columns
   * array or from a composite-column chain rebuilt by
   * `R_GenerateComposite`.
   */
  readonly maskedColumnFor: (col: number) => PatchColumn;
}

/**
 * Per-frame framebuffer + view state.  Same shape conventions as
 * {@link TwoSidedWallRenderContext} / {@link SolidWallRenderContext};
 * the masked pass mutates the framebuffer in place without touching
 * the per-column ceilingClip / floorClip arrays (those are already
 * frozen by the time the masked pass runs).
 */
export interface MaskedSegRenderContext {
  /** Palette-indexed framebuffer. */
  readonly framebuffer: Uint8Array;
  /**
   * Framebuffer row stride in bytes.  Defaults to {@link SCREENWIDTH}
   * so callers rendering to the vanilla 320-wide framebuffer can omit
   * the field.
   */
  readonly screenWidth?: number;
  /** Active viewport `centery` row. */
  readonly centerY: number;
  /**
   * Fixed-point `centeryfrac` = `centerY * FRACUNIT`.  Passed
   * explicitly so callers with a resized viewport supply the matching
   * pre-computed value without re-deriving it per frame.
   */
  readonly centerYFrac: number;
}

/**
 * Render a masked midtexture seg over the inclusive column range
 * `[x1, x2]`.  Mirrors r_segs.c `R_RenderMaskedSegRange` +
 * r_things.c `R_DrawMaskedColumn` for the non-fuzz colfunc path.
 *
 * No-ops when {@link SpriteClipDrawSeg.maskedtexturecol} is `null`
 * (the seg carries no masked midtexture) or when either
 * {@link SpriteClipDrawSeg.sprtopclip} / `sprbottomclip` is `null`
 * (vanilla guarantees both are allocated for any seg with a masked
 * midtexture; defensive guard keeps this module safe against bad
 * input).
 *
 * Side effects: (1) per-row framebuffer writes for every column in
 * `[x1, x2]` whose post chain produces at least one `yl <= yh` range
 * after clipping, and (2) `maskedtexturecol[x] = MAXSHORT` written
 * AFTER each column's draw (regardless of whether any pixels were
 * painted; the "column was visited" semantic matches vanilla).
 *
 * Callers that require byte-for-byte parity with vanilla must pass
 * the same `seg.scale1` at `seg.x1` as vanilla's `ds->scale1`; this
 * module computes `spryscale = seg.scale1 + (x1 - seg.x1) * scaleStep`
 * at entry and advances per column.
 */
export function renderMaskedSegRange(seg: MaskedDrawSeg, x1: number, x2: number, ctx: MaskedSegRenderContext): void {
  const maskedCol = seg.maskedtexturecol;
  if (maskedCol === null) {
    return;
  }
  const topClip = seg.sprtopclip;
  const botClip = seg.sprbottomclip;
  if (topClip === null || botClip === null) {
    return;
  }

  const screenWidth = ctx.screenWidth ?? SCREENWIDTH;
  const framebuffer = ctx.framebuffer;
  const centerY = ctx.centerY;
  const centerYFrac = ctx.centerYFrac | 0;
  const textureMid = seg.textureMid | 0;
  const widthMask = seg.midTextureWidthMask | 0;
  const scaleStep = seg.scaleStep | 0;
  const wallLights = seg.wallLights;
  const fixedColormap = seg.fixedColormap;
  const maskedColumnFor = seg.maskedColumnFor;

  let spryscale = (seg.scale1 + (x1 - seg.x1) * scaleStep) | 0;

  for (let x = x1; x <= x2; x += 1) {
    const texCol = maskedCol[x]!;
    if (texCol !== MAXSHORT) {
      let colormap: Uint8Array;
      if (fixedColormap !== null) {
        colormap = fixedColormap;
      } else {
        let bucket = spryscale >> LIGHTSCALESHIFT;
        if (bucket >= MAXLIGHTSCALE) {
          bucket = MAXLIGHTSCALE - 1;
        } else if (bucket < 0) {
          bucket = 0;
        }
        colormap = wallLights[bucket]!;
      }

      const iscale = (0xffffffff / (spryscale >>> 0)) | 0;
      const sprtopscreen = (centerYFrac - fixedMul(textureMid, spryscale)) | 0;
      const column = maskedColumnFor(texCol & widthMask);
      const floorBoundary = botClip[x]!;
      const ceilingBoundary = topClip[x]!;

      for (let p = 0; p < column.length; p += 1) {
        const post = column[p]!;
        const topscreen = (sprtopscreen + spryscale * post.topDelta) | 0;
        const bottomscreen = (topscreen + spryscale * post.length) | 0;
        let yl = (topscreen + FRACUNIT - 1) >> FRACBITS;
        let yh = (bottomscreen - 1) >> FRACBITS;

        if (yh >= floorBoundary) {
          yh = floorBoundary - 1;
        }
        if (yl <= ceilingBoundary) {
          yl = ceilingBoundary + 1;
        }

        if (yl <= yh) {
          drawPostColumn(framebuffer, screenWidth, x, yl, yh, (textureMid - (post.topDelta << FRACBITS)) | 0, iscale, centerY, post.pixels, colormap);
        }
      }

      maskedCol[x] = MAXSHORT;
    }
    spryscale = (spryscale + scaleStep) | 0;
  }
}

function drawPostColumn(framebuffer: Uint8Array, screenWidth: number, x: number, yl: number, yh: number, textureMid: number, iscale: number, centerY: number, source: Uint8Array, colormap: Uint8Array): void {
  let count = yh - yl;
  if (count < 0) {
    return;
  }
  let dest = yl * screenWidth + x;
  let frac = (textureMid + (yl - centerY) * iscale) | 0;
  do {
    const index = frac >> FRACBITS;
    framebuffer[dest] = colormap[source[index]!]!;
    dest += screenWidth;
    frac = (frac + iscale) | 0;
  } while (count--);
}
