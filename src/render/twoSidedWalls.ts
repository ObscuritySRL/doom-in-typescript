/**
 * Two-sided (pass-through) wall path — r_segs.c `R_RenderSegLoop`
 * `else` branch for segs whose linedef has both a front and back sector
 * (a window, portal, step, or lintel).  Unlike the solid-wall midtexture
 * branch, a two-sided seg does NOT close off `ceilingClip` /
 * `floorClip` across the full opening: sprites, masked midtextures, and
 * the back sector's visplanes must be able to draw through the gap.
 *
 * Per column `[rwX, rwStopX)`, {@link renderTwoSidedWall}:
 *
 * 1. Derives `yl` / `yh` exactly like the solid path (ceiling-divide the
 *    `topfrac`, floor-divide the `bottomfrac`, then clamp to the live
 *    per-column {@link TwoSidedWallRenderContext.ceilingClip} and
 *    {@link TwoSidedWallRenderContext.floorClip}).
 * 2. Optionally marks the ceiling and/or floor visplane — same guard as
 *    {@link renderSolidWall} (`top <= bottom` after intersecting with
 *    the opposite clip).
 * 3. Resolves the integer texture U via
 *    {@link TwoSidedWallSegment.textureColumnFor} and picks the light
 *    colormap from `wallLights[scale >> LIGHTSCALESHIFT]` (clamped to
 *    {@link MAXLIGHTSCALE} - 1).  The same U and colormap feed the
 *    upper, lower, and masked branches — one closure call per column.
 * 4. **Top branch** (upper texture above the opening): when
 *    {@link TwoSidedWallSegment.topTexture} is non-null, reads
 *    `mid = pixHigh >> HEIGHTBITS` (floor divide), advances `pixHigh`
 *    by `pixHighStep`, clamps `mid` down to `floorClip[x] - 1` if it
 *    would extend past the floor, and:
 *    - draws `[yl, mid]` and writes `ceilingClip[x] = mid` when
 *      `mid >= yl`; or
 *    - writes `ceilingClip[x] = yl - 1` when `mid < yl` (no upper
 *      pixels fit, but the ceiling is still closed off down to yl - 1
 *      so the next seg starting at this column knows the opening).
 *    When `topTexture` is null AND `markCeiling` is set, still writes
 *    `ceilingClip[x] = yl - 1` to close the ceiling — matches vanilla's
 *    "no top wall, but visplane marked" branch.  When `topTexture` is
 *    null AND `markCeiling` is false, `ceilingClip[x]` is left
 *    untouched — vanilla leaves `ceilingclip[rw_x]` intact in that
 *    branch so the clip remains live for sprites / opposite-side
 *    visplane pass-through.
 * 5. **Bottom branch** (lower texture below the opening): symmetric.
 *    When {@link TwoSidedWallSegment.bottomTexture} is non-null, reads
 *    `mid = (pixLow + HEIGHTUNIT - 1) >> HEIGHTBITS` (ceiling divide),
 *    advances `pixLow` by `pixLowStep`, clamps `mid` up to
 *    `ceilingClip[x] + 1` if it would intersect the already-written
 *    upper ceiling, and:
 *    - draws `[mid, yh]` and writes `floorClip[x] = mid` when
 *      `mid <= yh`; or
 *    - writes `floorClip[x] = yh + 1` when `mid > yh`.
 *    When `bottomTexture` is null AND `markFloor` is set, writes
 *    `floorClip[x] = yh + 1`.  When both are false, `floorClip[x]` is
 *    left untouched.
 * 6. **Masked midtexture** (deferred draw): when
 *    {@link TwoSidedWallSegment.maskedTextureCol} is non-null, writes
 *    `maskedTextureCol[x] = texturecolumn`.  The masked columns render
 *    in a later pass (step 13-013) that walks the openings pool;
 *    this module only records the per-column texture U.
 * 7. Advances `topFrac`, `bottomFrac`, and `scale` by their per-column
 *    steps before iterating to the next column.
 *
 * Parity invariants beyond those of {@link renderSolidWall}:
 *
 * - The bottom-branch `ceilingClip[x]` read is LIVE — vanilla references
 *   `ceilingclip[rw_x]` AFTER the top branch may have written to it.
 *   Callers that render an upper texture at a given column see the
 *   bottom texture's clamp intersect against that upper wall's bottom
 *   row, exactly like vanilla's intra-iteration state sharing.
 * - `pixHigh` and `pixLow` advance ONLY when their respective texture is
 *   present (`topTexture !== null` / `bottomTexture !== null`).  If
 *   `topTexture` is null, `pixHigh` is never read and never updated —
 *   vanilla's `R_StoreWallRange` skips initializing `pixhigh` when
 *   `toptexture` is absent, so the field must not be consulted.  The
 *   same holds for `pixLow`.
 * - No terminal `ceilingClip[x] = viewHeight` / `floorClip[x] = -1`
 *   update: two-sided walls intentionally leave the opening live.  The
 *   only writes to `ceilingClip` / `floorClip` are the per-branch
 *   `mid` / `yl-1` / `yh+1` updates described above.
 * - `maskedTextureCol[x]` receives the RAW `texturecolumn` value —
 *   vanilla stores `texturecolumn` (unmasked by the texture's width
 *   mask).  The later masked pass applies the width mask when it
 *   re-fetches the column.  Our implementation matches that — we do
 *   NOT mask the value here.
 *
 * This module is pure arithmetic + typed-array writes with no Win32 or
 * runtime dependencies.  Imports from ./solidWalls.ts are limited to
 * the shared constants {@link HEIGHTBITS}, {@link HEIGHTUNIT}, and
 * {@link INVERSE_SCALE_NUMERATOR}; the two renderers share those
 * numeric invariants but their per-column loops are structurally
 * different and do not call into each other.
 */

import { rDrawColumn } from './drawPrimitives.ts';
import { LIGHTSCALESHIFT, MAXLIGHTSCALE, SCREENWIDTH } from './projection.ts';
import type { Visplane } from './renderLimits.ts';
import { HEIGHTBITS, HEIGHTUNIT, INVERSE_SCALE_NUMERATOR } from './solidWalls.ts';
import { getWallColumn } from './wallColumns.ts';
import type { PreparedWallTexture } from './wallColumns.ts';

export { HEIGHTBITS, HEIGHTUNIT, INVERSE_SCALE_NUMERATOR } from './solidWalls.ts';

/**
 * All per-seg state a two-sided wall needs.  The caller is responsible
 * for filling these in from the front / back sector heights, sidedef
 * texture selection, and the BSP traversal that produced the seg clip
 * range.  This module owns only the per-column loop; it does not read
 * the map, the wad cache, or the perspective tables.
 */
export interface TwoSidedWallSegment {
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
  /**
   * Upper wall texture (above the opening).  `null` means the seg has
   * no top texture — vanilla's `toptexture == 0` case.  When null, the
   * top branch is skipped and `pixHigh` / `pixHighStep` are never
   * consulted.
   */
  readonly topTexture: PreparedWallTexture | null;
  /** Fixed-point `rw_toptexturemid`.  Ignored when `topTexture` is null. */
  readonly topTextureMid: number;
  /**
   * Initial `pixhigh` at `rwX` — the screen row of the back ceiling in
   * HEIGHTUNIT scale.  Only read when `topTexture` is non-null.
   */
  readonly pixHigh: number;
  /** Per-column `pixhighstep`.  Only applied when `topTexture` is non-null. */
  readonly pixHighStep: number;
  /**
   * Lower wall texture (below the opening).  `null` means the seg has
   * no bottom texture — vanilla's `bottomtexture == 0` case.  When
   * null, the bottom branch is skipped and `pixLow` / `pixLowStep` are
   * never consulted.
   */
  readonly bottomTexture: PreparedWallTexture | null;
  /** Fixed-point `rw_bottomtexturemid`.  Ignored when `bottomTexture` is null. */
  readonly bottomTextureMid: number;
  /**
   * Initial `pixlow` at `rwX` — the screen row of the back floor in
   * HEIGHTUNIT scale.  Only read when `bottomTexture` is non-null.
   */
  readonly pixLow: number;
  /** Per-column `pixlowstep`.  Only applied when `bottomTexture` is non-null. */
  readonly pixLowStep: number;
  /** Initial `rw_scale` at `rwX` (inverse perspective divisor). */
  readonly scale: number;
  /** Per-column `rw_scalestep`. */
  readonly scaleStep: number;
  /**
   * Per-scale-bucket colormap table of length {@link MAXLIGHTSCALE}.
   * The same convention as {@link SolidWallSegment.wallLights} —
   * vanilla's `walllights` array after resolving the per-light-level
   * bucket.
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
   * Floor visplane record.  Mutated only when `markFloor` is `true`
   * AND the intersected row range is non-empty.
   */
  readonly floorPlane: Visplane | null;
  /**
   * Resolve the integer wall-texture U (column index) for a given
   * screen column.  Vanilla derives this from `xtoviewangle`,
   * `finetangent`, and per-seg `rw_offset` / `rw_distance`; callers
   * pre-compute and pass a closure so this module stays focused on
   * the two-sided loop.  The returned integer feeds the upper /
   * lower draws via {@link getWallColumn} and — if enabled — the
   * masked-column record.
   */
  readonly textureColumnFor: (x: number) => number;
  /**
   * Per-column masked-texture U record buffer, indexed by screen
   * column `x`.  When non-null, the loop writes
   * `maskedTextureCol[x] = texturecolumn` for every column it visits,
   * exactly like vanilla's `maskedtexturecol[rw_x] = texturecolumn`.
   * The stored value is the raw unmasked column index (no width-mask
   * applied).  Pass `null` when the seg has no masked midtexture.
   */
  readonly maskedTextureCol: Int16Array | null;
}

/**
 * Per-frame framebuffer + clip state.  Identical shape to
 * {@link SolidWallRenderContext} — the two renderers mutate the same
 * per-frame arrays so running a two-sided seg after a solid seg sees
 * the solid seg's closed columns, and vice versa.
 */
export interface TwoSidedWallRenderContext {
  /** Palette-indexed framebuffer. */
  readonly framebuffer: Uint8Array;
  /**
   * Framebuffer row stride in bytes.  Defaults to {@link SCREENWIDTH}
   * so callers rendering to the vanilla 320-wide framebuffer can omit
   * the field.
   */
  readonly screenWidth?: number;
  /** Active viewport `viewheight` (pixel rows drawn). */
  readonly viewHeight: number;
  /** Active viewport `centery`. */
  readonly centerY: number;
  /** Per-column ceiling clip array (`short ceilingclip[SCREENWIDTH]`). */
  readonly ceilingClip: Int16Array;
  /** Per-column floor clip array (`short floorclip[SCREENWIDTH]`). */
  readonly floorClip: Int16Array;
}

/**
 * Render a two-sided (pass-through) wall seg covering `[rwX, rwStopX)`.
 *
 * Mirrors r_segs.c `R_RenderSegLoop` for the `else` (non-midtexture)
 * branch byte-for-byte, with all three sub-branches (toptexture,
 * bottomtexture, maskedtexture) dispatched per column.  The caller is
 * responsible for `R_StoreWallRange`'s earlier setup (seg framing,
 * texture resolution, `pixhigh` / `pixlow` derivation, visplane prep)
 * and for the BSP-level `R_ClipPassWallSegment` decision to invoke
 * this path at all.
 *
 * Side effects: (1) per-column writes into `framebuffer` for every
 * upper / lower texture that actually intersects the live clip, (2)
 * per-column top/bottom writes into the visplane records when
 * `markCeiling` / `markFloor` are set, (3) per-column updates to
 * `ceilingClip` / `floorClip` that close off each side of the
 * opening to the live upper-texture bottom / lower-texture top, and
 * (4) per-column writes into `maskedTextureCol` when it is non-null.
 *
 * Columns outside `[rwX, rwStopX)` are left entirely untouched.  A seg
 * with `rwStopX <= rwX` draws nothing and updates nothing.
 */
export function renderTwoSidedWall(seg: TwoSidedWallSegment, ctx: TwoSidedWallRenderContext): void {
  const screenWidth = ctx.screenWidth ?? SCREENWIDTH;
  const { framebuffer, centerY, ceilingClip, floorClip } = ctx;
  const { topTexture, topTextureMid, bottomTexture, bottomTextureMid, wallLights, markCeiling, markFloor, ceilingPlane, floorPlane, textureColumnFor, maskedTextureCol } = seg;

  const topStep = seg.topStep | 0;
  const bottomStep = seg.bottomStep | 0;
  const scaleStep = seg.scaleStep | 0;
  const pixHighStep = seg.pixHighStep | 0;
  const pixLowStep = seg.pixLowStep | 0;

  let topFrac = seg.topFrac | 0;
  let bottomFrac = seg.bottomFrac | 0;
  let scale = seg.scale | 0;
  let pixHigh = seg.pixHigh | 0;
  let pixLow = seg.pixLow | 0;

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

    if (topTexture !== null) {
      let mid = pixHigh >> HEIGHTBITS;
      pixHigh = (pixHigh + pixHighStep) | 0;

      if (mid >= floorHere) {
        mid = floorHere - 1;
      }

      if (mid >= yl) {
        const source = getWallColumn(topTexture, texturecolumn);
        rDrawColumn(
          {
            x,
            yl,
            yh: mid,
            textureMid: topTextureMid,
            iscale,
            centerY,
            source,
            colormap,
          },
          framebuffer,
          screenWidth,
        );
        ceilingClip[x] = mid;
      } else {
        ceilingClip[x] = yl - 1;
      }
    } else if (markCeiling) {
      ceilingClip[x] = yl - 1;
    }

    if (bottomTexture !== null) {
      let mid = (pixLow + HEIGHTUNIT - 1) >> HEIGHTBITS;
      pixLow = (pixLow + pixLowStep) | 0;

      const ceilingNow = ceilingClip[x]!;
      if (mid <= ceilingNow) {
        mid = ceilingNow + 1;
      }

      if (mid <= yh) {
        const source = getWallColumn(bottomTexture, texturecolumn);
        rDrawColumn(
          {
            x,
            yl: mid,
            yh,
            textureMid: bottomTextureMid,
            iscale,
            centerY,
            source,
            colormap,
          },
          framebuffer,
          screenWidth,
        );
        floorClip[x] = mid;
      } else {
        floorClip[x] = yh + 1;
      }
    } else if (markFloor) {
      floorClip[x] = yh + 1;
    }

    if (maskedTextureCol !== null) {
      maskedTextureCol[x] = texturecolumn;
    }

    topFrac = (topFrac + topStep) | 0;
    bottomFrac = (bottomFrac + bottomStep) | 0;
    scale = (scale + scaleStep) | 0;
  }
}
