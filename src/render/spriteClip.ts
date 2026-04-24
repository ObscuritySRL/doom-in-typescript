/**
 * Sprite sort and clip — r_things.c `R_SortVisSprites` + `R_DrawSprite`
 * clip phase + `R_DrawMasked` orchestrator + r_main.c
 * `R_PointOnSegSide`.
 *
 * The pipeline in vanilla is: `R_DrawMasked` sorts the frame's
 * vissprite pool back-to-front by scale, then for each sprite calls
 * `R_DrawSprite` which scans every {@link SpriteClipDrawSeg} in
 * reverse-allocation order and either (a) renders the drawseg's
 * masked midtexture range overlapping the sprite if the seg is behind
 * the sprite, or (b) overlays the seg's `sprtopclip[]`/`sprbottomclip[]`
 * silhouette onto the per-column `mfloorclip[]`/`mceilingclip[]`
 * scratch arrays so the final `R_DrawVisSprite` call only paints
 * pixels the seg does not cover.  After all sprites are drawn,
 * remaining masked midtextures are rendered (any drawseg whose
 * masked columns were not consumed by a sprite clip gets rendered at
 * its full `[x1, x2]` range).  Finally the view-aligned player
 * weapon sprites overlay everything.
 *
 * Parity invariants locked here:
 *
 * - {@link SIL_NONE} / {@link SIL_BOTTOM} / {@link SIL_TOP} /
 *   {@link SIL_BOTH} mirror r_defs.h `SIL_*` = `0` / `1` / `2` / `3`.
 *   The values are bit flags so `top | bottom === both` and the
 *   silhouette adjustments below are bit clears.
 * - {@link CLIP_UNSET} = `-2`.  The r_things.c `R_DrawSprite` sentinel
 *   written into `clipbot[x]` / `cliptop[x]` at the start of every
 *   sprite's clip pass; the final unclipped-column pass replaces any
 *   remaining `-2` with `viewheight` (floor default) or `-1` (ceiling
 *   default).  The "first-write-wins" guard uses this value to ensure
 *   a nearer drawseg's silhouette overrides a farther drawseg's
 *   silhouette (since drawsegs are scanned in reverse allocation
 *   order, the FIRST write in loop order is from the most-recently
 *   allocated seg, which is typically the nearer seg).
 * - {@link sortVisSprites} returns a {@link VisSprite}[] ordered
 *   ascending by `scale` (smallest scale first).  Smallest scale =
 *   farthest away, so iterating the array in index order draws
 *   back-to-front — the painter's algorithm the masked pass relies
 *   on.  Equal-scale sprites preserve their pool order via stable
 *   sort, matching vanilla's selection-sort first-match pickup.
 * - {@link clipVisSprite} scans drawsegs from index `drawsegs.length
 *   - 1` down to `0`, matching vanilla's `for (ds=ds_p-1; ds >=
 *   drawsegs; ds--)` walk.  The reverse order is load-bearing: the
 *   last-allocated drawseg is the most-recently written into the BSP
 *   clip pass and typically the nearest to the camera, so visiting
 *   nearer segs first means their silhouettes claim the `clipbot[x]
 *   === -2` / `cliptop[x] === -2` columns first and later (farther)
 *   segs' writes are ignored.
 * - Pre-loop filter: a drawseg is skipped if it is horizontally
 *   disjoint from the sprite (`ds.x1 > spr.x2 || ds.x2 < spr.x1`) OR
 *   if it has neither a silhouette nor a masked-texture column
 *   (`ds.silhouette === 0 && ds.maskedtexturecol === null`).  The
 *   silhouette/masked check is `!ds->silhouette && !ds->maskedtexturecol`
 *   in vanilla — a seg with no contribution to sprite clipping or
 *   masked-midtexture rendering is pure noise.
 * - Overlap range: `r1 = max(ds.x1, spr.x1)` and `r2 = min(ds.x2,
 *   spr.x2)`.  All silhouette-clip writes and the masked-texture
 *   render call use this range, NOT the full sprite or drawseg range.
 * - Scale comparison: `scale = max(ds.scale1, ds.scale2)` and
 *   `lowscale = min(ds.scale1, ds.scale2)`.  Drawsegs have varying
 *   scale across `[x1, x2]` because depth changes along a seg; the
 *   max end is the closest column.
 * - Behind-sprite branch: if `scale < spr.scale` (the seg's closest
 *   column is still farther than the sprite) OR (`lowscale < spr.scale
 *   && sprite is on the FRONT side of the seg`) the seg is behind
 *   the sprite.  `R_PointOnSegSide(spr.gx, spr.gy, ds.curline)`
 *   returns `0` for front, `1` for back; the `!R_PointOnSegSide` in
 *   vanilla is "sprite is on front side".  When this branch fires,
 *   the drawseg's masked-texture columns overlapping the sprite
 *   (`ds.maskedtexturecol !== null`) are rendered IMMEDIATELY via
 *   {@link RenderMaskedSegRange} callback for the `[r1, r2]`
 *   sub-range, and the `continue` skips silhouette clipping — the
 *   sprite will paint OVER this seg's masked texture in the final
 *   `drawVisSprite` call.
 * - Silhouette adjustment: `silhouette = ds.silhouette` then
 *   `if (spr.gz >= ds.bsilheight) silhouette &= ~SIL_BOTTOM` and
 *   `if (spr.gzt <= ds.tsilheight) silhouette &= ~SIL_TOP`.  The
 *   `gz` check drops the bottom-clip if the sprite's feet are at or
 *   above the seg's bottom silhouette height (sprite doesn't dip
 *   into the below-the-seg region).  The `gzt` check drops the
 *   top-clip if the sprite's top is at or below the seg's top
 *   silhouette height (sprite doesn't poke above the seg).  The
 *   adjusted silhouette may be `0` (no clip), `1` (SIL_BOTTOM), `2`
 *   (SIL_TOP), or `3` (SIL_BOTH).
 * - Per-column clip writes: for each column x in `[r1, r2]`, the
 *   adjusted silhouette drives which clip array is written.  The
 *   writes are GATED on `clipbot[x] === CLIP_UNSET` /
 *   `cliptop[x] === CLIP_UNSET`, so the NEAREST drawseg's silhouette
 *   wins for each column (reverse-iteration means we see nearer
 *   segs first, and the `-2` check preserves those first writes).
 *   SIL_BOTTOM writes `clipbot[x] = ds.sprbottomclip[x]`.
 *   SIL_TOP writes `cliptop[x] = ds.sprtopclip[x]`.
 *   SIL_BOTH writes both.  A silhouette of `0` after adjustment is a
 *   no-op (the branch chain falls through).
 * - `ds.sprtopclip` / `ds.sprbottomclip` are indexed by ABSOLUTE
 *   column `x` (not `x - ds.x1`).  Vanilla stores these as pointers
 *   pre-adjusted by `-x1` so `ds->sprtopclip[x]` for x in `[x1, x2]`
 *   reads the first allocated element; this module requires callers
 *   to size their `Int16Array`s so the same absolute-column indexing
 *   works.
 * - Unclipped column fill: after the seg walk, any column still at
 *   `CLIP_UNSET` gets `clipbot[x] = viewHeight` (floor-default) and
 *   `cliptop[x] = -1` (ceiling-default).  These are the "no seg
 *   intervenes" defaults that let the sprite paint the full column.
 * - {@link drawMasked} runs the full pipeline: sort, clip+draw each
 *   sprite, render remaining masked segs at full width, then draw
 *   player sprites if `viewAngleOffset === 0` (view-aligned; vanilla
 *   side-view replays skip `R_DrawPlayerSprites`).  The "remaining"
 *   masked segs are rendered at `[ds.x1, ds.x2]` — the full seg
 *   range — because the `R_RenderMaskedSegRange` implementation is
 *   responsible for skipping already-drawn columns via the
 *   `maskedtexturecol[x] = MAXSHORT` done-flag vanilla writes after
 *   drawing each column.  This module only calls the callback; the
 *   done-flag bookkeeping is the callback's responsibility (step
 *   13-013).
 * - {@link pointOnSegSide} mirrors r_main.c `R_PointOnSegSide` byte-
 *   for-byte: the `!ldx` and `!ldy` axis-aligned shortcuts, the
 *   sign-bit XOR `(ldy ^ ldx ^ dx ^ dy) & 0x80000000` quick decision,
 *   and the fallback `FixedMul(ldy>>FRACBITS, dx) ? FixedMul(dy,
 *   ldx>>FRACBITS)` comparison.  The `>>FRACBITS` on ONE operand of
 *   each `FixedMul` is the vanilla half-precision trick that keeps
 *   the product inside int32.
 *
 * This module is pure arithmetic with no Win32, renderer-draw, or
 * runtime dependencies.  The caller owns the drawseg list, the
 * vissprite pool, the clip buffers, and the callbacks for
 * `renderMaskedSegRange` (implemented in step 13-013) and
 * `drawVisSprite` (implemented in step 13-013 or later).
 *
 * @example
 * ```ts
 * import { createSpriteClipBuffers, drawMasked } from "../src/render/spriteClip.ts";
 *
 * const buffers = createSpriteClipBuffers(viewport.viewWidth);
 * drawMasked(pool, {
 *   viewHeight: viewport.viewHeight,
 *   drawsegs,
 *   viewAngleOffset: 0,
 *   renderMaskedSegRange: (seg, x1, x2) => { ... },
 *   drawVisSprite: (spr, { clipBot, clipTop }) => { ... },
 *   drawPlayerSprites: () => { ... },
 * }, buffers);
 * ```
 */

import { fixedMul, FRACBITS } from '../core/fixed.ts';

import type { VisSprite, VisSpritePool } from './spriteProjection.ts';

/** r_defs.h `SIL_NONE`. */
export const SIL_NONE = 0;

/** r_defs.h `SIL_BOTTOM`. */
export const SIL_BOTTOM = 1;

/** r_defs.h `SIL_TOP`. */
export const SIL_TOP = 2;

/** r_defs.h `SIL_BOTH`. */
export const SIL_BOTH = 3;

/**
 * r_things.c `R_DrawSprite` per-column sentinel written into
 * `clipbot[x]` / `cliptop[x]` before the drawseg walk.  Any column
 * still at this value after the walk is filled with the `viewHeight`
 * (floor) or `-1` (ceiling) default.
 */
export const CLIP_UNSET = -2;

/**
 * Ceiling clip default for columns no drawseg silhouette covers —
 * vanilla's `cliptop[x] = -1` fill.  One row above the top scanline,
 * so the sprite's first painted row is row 0.
 */
export const CLIP_TOP_DEFAULT = -1;

/**
 * Subset of `drawseg_t` that {@link clipVisSprite} reads.  Vanilla
 * `drawseg_t` carries scale increments and masked-texture metadata
 * this stage does not consume (those fields feed
 * `R_RenderMaskedSegRange` internally).  Callers adapting a fuller
 * drawseg representation to this module provide the fields below and
 * keep their richer record structure.
 */
export interface SpriteClipDrawSeg {
  /** Leftmost screen column (inclusive). */
  readonly x1: number;
  /** Rightmost screen column (inclusive). */
  readonly x2: number;
  /** Inverse-z scale at column {@link SpriteClipDrawSeg.x1}. */
  readonly scale1: number;
  /** Inverse-z scale at column {@link SpriteClipDrawSeg.x2}. */
  readonly scale2: number;
  /** Silhouette flags ({@link SIL_NONE}..{@link SIL_BOTH}). */
  readonly silhouette: number;
  /** Bottom silhouette height — sprites at or above this z skip bottom clip. */
  readonly bsilheight: number;
  /** Top silhouette height — sprites at or below this z skip top clip. */
  readonly tsilheight: number;
  /**
   * Per-column sprite-top clip values, indexed by ABSOLUTE column `x`
   * for `x` in `[x1, x2]`.  `null` when the drawseg has no top
   * silhouette.  Vanilla stores this as `lastopening - x1` pointer
   * arithmetic so `ds->sprtopclip[x]` returns the allocated element;
   * JS typed arrays cannot do negative-base indexing, so callers
   * allocate arrays indexed directly by absolute column.
   */
  readonly sprtopclip: Int16Array | null;
  /** Per-column sprite-bottom clip values, indexed by absolute column. */
  readonly sprbottomclip: Int16Array | null;
  /**
   * Per-column masked-texture column index, indexed by absolute
   * column.  `null` when the drawseg has no masked midtexture.  The
   * actual column values ({@link RenderMaskedSegRange}'s
   * responsibility) are the patch column indices post-widthMask.
   */
  readonly maskedtexturecol: Int16Array | null;
  /** Seg v1 x — first endpoint for {@link pointOnSegSide}. */
  readonly v1x: number;
  /** Seg v1 y. */
  readonly v1y: number;
  /** Seg v2 x — second endpoint. */
  readonly v2x: number;
  /** Seg v2 y. */
  readonly v2y: number;
}

/**
 * Callback invoked by {@link clipVisSprite} (for behind-sprite segs
 * with a masked midtexture) and {@link drawMasked} (for remaining
 * masked segs after all sprites are drawn).  Mirrors r_segs.c
 * `R_RenderMaskedSegRange`; the implementation is responsible for
 * the `maskedtexturecol[x] = MAXSHORT` done-flag bookkeeping so
 * repeated calls do not re-draw the same column.
 */
export type RenderMaskedSegRange = (seg: SpriteClipDrawSeg, x1: number, x2: number) => void;

/**
 * Callback invoked by {@link drawMasked} after a sprite is clipped,
 * to draw the sprite with the per-column clip bounds held in the
 * supplied buffers.  Step 13-013 implements the masked column draw
 * that consumes these buffers.
 */
export type DrawVisSprite = (spr: VisSprite, buffers: SpriteClipBuffers) => void;

/**
 * Per-frame scratch buffers holding the clip bounds for the sprite
 * currently being drawn.  `clipBot[x]` is vanilla's `mfloorclip[x]`
 * (one row below the first row the sprite may NOT paint), and
 * `clipTop[x]` is vanilla's `mceilingclip[x]` (one row above the
 * first row the sprite may paint).  Both arrays are sized to
 * {@link SpriteClipBuffers.viewWidth}; columns outside `[spr.x1,
 * spr.x2]` retain stale data from the previous sprite, which is
 * harmless because the draw step only reads columns in that range.
 */
export interface SpriteClipBuffers {
  /** Per-column floor clip (vanilla `mfloorclip`).  `Int16Array` matches vanilla `short *`. */
  readonly clipBot: Int16Array;
  /** Per-column ceiling clip (vanilla `mceilingclip`). */
  readonly clipTop: Int16Array;
  /** Array size (= viewport `viewWidth`). */
  readonly viewWidth: number;
}

/**
 * Allocate a fresh {@link SpriteClipBuffers} record sized to the
 * caller's viewport width.  Both `Int16Array`s start zero-
 * initialized; {@link clipVisSprite} writes {@link CLIP_UNSET} into
 * `[spr.x1, spr.x2]` before its walk, so the initial contents are
 * irrelevant.
 *
 * @example
 * ```ts
 * import { createSpriteClipBuffers } from "../src/render/spriteClip.ts";
 * const buffers = createSpriteClipBuffers(320);
 * buffers.clipBot.length; // 320
 * buffers.clipTop.length; // 320
 * buffers.viewWidth;      // 320
 * ```
 */
export function createSpriteClipBuffers(viewWidth: number): SpriteClipBuffers {
  if (!Number.isInteger(viewWidth) || viewWidth <= 0) {
    throw new RangeError(`createSpriteClipBuffers: viewWidth must be a positive integer, got ${viewWidth}`);
  }
  return {
    clipBot: new Int16Array(viewWidth),
    clipTop: new Int16Array(viewWidth),
    viewWidth,
  };
}

/**
 * r_main.c `R_PointOnSegSide` — decide which side of a seg line a
 * point is on.  Returns `0` for the front side (the side the seg's
 * `frontsector` reference names) and `1` for the back side.
 *
 * The implementation mirrors vanilla byte-for-byte:
 *
 * - If `ldx === 0` (vertical line), decide by comparing `x` against
 *   `lx` and the sign of `ldy`.
 * - If `ldy === 0` (horizontal line), decide by comparing `y`
 *   against `ly` and the sign of `ldx`.
 * - Otherwise try the "sign bits only" quick decision: if the XOR of
 *   the sign bits of `ldy`, `ldx`, `dx`, `dy` is negative, return
 *   based on just `(ldy ^ dx) & 0x80000000`.
 * - Fallback: compute `left = FixedMul(ldy >> FRACBITS, dx)` and
 *   `right = FixedMul(dy, ldx >> FRACBITS)` — the half-precision
 *   multiplies that keep the products inside int32 — and return
 *   `right < left ? 0 : 1`.
 */
export function pointOnSegSide(x: number, y: number, seg: Pick<SpriteClipDrawSeg, 'v1x' | 'v1y' | 'v2x' | 'v2y'>): 0 | 1 {
  const lx = seg.v1x | 0;
  const ly = seg.v1y | 0;
  const ldx = (seg.v2x - lx) | 0;
  const ldy = (seg.v2y - ly) | 0;

  if (ldx === 0) {
    if (x <= lx) {
      return ldy > 0 ? 1 : 0;
    }
    return ldy < 0 ? 1 : 0;
  }
  if (ldy === 0) {
    if (y <= ly) {
      return ldx < 0 ? 1 : 0;
    }
    return ldx > 0 ? 1 : 0;
  }

  const dx = (x - lx) | 0;
  const dy = (y - ly) | 0;

  if ((ldy ^ ldx ^ dx ^ dy) & 0x80000000) {
    if ((ldy ^ dx) & 0x80000000) {
      return 1;
    }
    return 0;
  }

  const left = fixedMul(ldy >> FRACBITS, dx);
  const right = fixedMul(dy, ldx >> FRACBITS);

  if (right < left) {
    return 0;
  }
  return 1;
}

/**
 * r_things.c `R_SortVisSprites` — sort the frame's vissprite pool
 * back-to-front by ascending `scale`.  Vanilla builds a doubly-
 * linked list (`vsprsortedhead`) via repeated selection-sort of the
 * smallest unsorted scale; we return a plain array in the same
 * order.  The caller iterates the result from index `0` (farthest
 * sprite, smallest scale) to index `length - 1` (closest sprite,
 * largest scale).  Equal-scale sprites preserve their pool order
 * via stable `Array.prototype.sort`, matching vanilla's first-match
 * selection-sort tiebreaker.
 *
 * The sort operates on a shallow copy of the pool's active slots;
 * the pool itself is not mutated.  The returned array is a fresh
 * `VisSprite[]` owned by the caller.
 *
 * @example
 * ```ts
 * import { sortVisSprites } from "../src/render/spriteClip.ts";
 * const backToFront = sortVisSprites(pool);
 * for (const spr of backToFront) drawAndClip(spr);
 * ```
 */
export function sortVisSprites(pool: VisSpritePool): VisSprite[] {
  const count = pool.count | 0;
  if (count <= 0) {
    return [];
  }
  const sorted: VisSprite[] = [];
  for (let i = 0; i < count; i += 1) {
    sorted.push(pool.sprites[i]!);
  }
  sorted.sort((a, b) => a.scale - b.scale);
  return sorted;
}

/**
 * Per-sprite inputs {@link clipVisSprite} reads from the caller.
 * `viewHeight` is the current viewport height (floor-clip default),
 * `drawsegs` is the frame's allocated drawseg list (iterated in
 * reverse allocation order), and `renderMaskedSegRange` is the
 * callback invoked for behind-sprite drawsegs that carry a masked
 * midtexture.
 */
export interface ClipVisSpriteContext {
  /** Current viewport height — default floor clip for uncovered columns. */
  readonly viewHeight: number;
  /** Frame-allocated drawseg list walked in reverse order. */
  readonly drawsegs: readonly SpriteClipDrawSeg[];
  /** r_segs.c `R_RenderMaskedSegRange` callback. */
  readonly renderMaskedSegRange: RenderMaskedSegRange;
}

/**
 * r_things.c `R_DrawSprite` clip phase — walk the drawseg list in
 * reverse allocation order, for each overlapping seg either render
 * its masked midtexture (when the seg is behind the sprite) or
 * overlay its silhouette onto the per-column clip buffers.  After
 * this returns, `buffers.clipBot[x]` and `buffers.clipTop[x]` for
 * `x` in `[spr.x1, spr.x2]` hold the final clip bounds for the
 * sprite's downstream draw step.
 */
export function clipVisSprite(spr: VisSprite, ctx: ClipVisSpriteContext, buffers: SpriteClipBuffers): void {
  const clipBot = buffers.clipBot;
  const clipTop = buffers.clipTop;

  for (let x = spr.x1; x <= spr.x2; x += 1) {
    clipBot[x] = CLIP_UNSET;
    clipTop[x] = CLIP_UNSET;
  }

  const drawsegs = ctx.drawsegs;
  const sprScale = spr.scale | 0;
  const sprGx = spr.gx | 0;
  const sprGy = spr.gy | 0;
  const sprGz = spr.gz | 0;
  const sprGzt = spr.gzt | 0;

  for (let i = drawsegs.length - 1; i >= 0; i -= 1) {
    const ds = drawsegs[i]!;

    if (ds.x1 > spr.x2 || ds.x2 < spr.x1 || (ds.silhouette === SIL_NONE && ds.maskedtexturecol === null)) {
      continue;
    }

    const r1 = ds.x1 < spr.x1 ? spr.x1 : ds.x1;
    const r2 = ds.x2 > spr.x2 ? spr.x2 : ds.x2;

    let scale: number;
    let lowscale: number;
    if (ds.scale1 > ds.scale2) {
      lowscale = ds.scale2 | 0;
      scale = ds.scale1 | 0;
    } else {
      lowscale = ds.scale1 | 0;
      scale = ds.scale2 | 0;
    }

    if (scale < sprScale || (lowscale < sprScale && pointOnSegSide(sprGx, sprGy, ds) === 0)) {
      if (ds.maskedtexturecol !== null) {
        ctx.renderMaskedSegRange(ds, r1, r2);
      }
      continue;
    }

    let silhouette = ds.silhouette;
    if (sprGz >= ds.bsilheight) {
      silhouette &= ~SIL_BOTTOM;
    }
    if (sprGzt <= ds.tsilheight) {
      silhouette &= ~SIL_TOP;
    }

    if (silhouette === SIL_BOTTOM) {
      const botSrc = ds.sprbottomclip!;
      for (let x = r1; x <= r2; x += 1) {
        if (clipBot[x] === CLIP_UNSET) {
          clipBot[x] = botSrc[x]!;
        }
      }
    } else if (silhouette === SIL_TOP) {
      const topSrc = ds.sprtopclip!;
      for (let x = r1; x <= r2; x += 1) {
        if (clipTop[x] === CLIP_UNSET) {
          clipTop[x] = topSrc[x]!;
        }
      }
    } else if (silhouette === SIL_BOTH) {
      const botSrc = ds.sprbottomclip!;
      const topSrc = ds.sprtopclip!;
      for (let x = r1; x <= r2; x += 1) {
        if (clipBot[x] === CLIP_UNSET) {
          clipBot[x] = botSrc[x]!;
        }
        if (clipTop[x] === CLIP_UNSET) {
          clipTop[x] = topSrc[x]!;
        }
      }
    }
  }

  const floorDefault = ctx.viewHeight | 0;
  for (let x = spr.x1; x <= spr.x2; x += 1) {
    if (clipBot[x] === CLIP_UNSET) {
      clipBot[x] = floorDefault;
    }
    if (clipTop[x] === CLIP_UNSET) {
      clipTop[x] = CLIP_TOP_DEFAULT;
    }
  }
}

/**
 * Per-frame inputs {@link drawMasked} reads.  Bundles the drawseg
 * list, view state, and the three caller-supplied callbacks for
 * masked-seg rendering, sprite drawing, and player-sprite overlay.
 */
export interface DrawMaskedContext {
  /** Current viewport height — routed to {@link clipVisSprite}. */
  readonly viewHeight: number;
  /** Frame-allocated drawseg list. */
  readonly drawsegs: readonly SpriteClipDrawSeg[];
  /** r_segs.c `R_RenderMaskedSegRange` callback. */
  readonly renderMaskedSegRange: RenderMaskedSegRange;
  /** Sprite draw callback (vanilla `R_DrawVisSprite`). */
  readonly drawVisSprite: DrawVisSprite;
  /**
   * r_main.c `viewangleoffset` global.  Vanilla skips player
   * sprites when non-zero (side-view replays).  Pass `0` for the
   * normal first-person view.
   */
  readonly viewAngleOffset: number;
  /**
   * Vanilla `R_DrawPlayerSprites` callback.  Invoked after all
   * world sprites and remaining masked segs are drawn, ONLY when
   * {@link viewAngleOffset} is `0`.  Omit to skip the player-sprite
   * overlay (unit-test usage).
   */
  readonly drawPlayerSprites?: () => void;
}

/**
 * r_things.c `R_DrawMasked` — the full masked pass.  Sorts the
 * vissprite pool, clips and draws each sprite back-to-front,
 * renders any drawseg masked midtexture that was not already
 * consumed by a sprite clip (the `R_RenderMaskedSegRange`
 * implementation is responsible for skipping already-drawn columns
 * via the `maskedtexturecol[x] = MAXSHORT` done-flag), and finally
 * overlays the player weapon sprites when the view is not offset.
 */
export function drawMasked(pool: VisSpritePool, ctx: DrawMaskedContext, buffers: SpriteClipBuffers): void {
  const sorted = sortVisSprites(pool);
  const clipCtx: ClipVisSpriteContext = {
    viewHeight: ctx.viewHeight,
    drawsegs: ctx.drawsegs,
    renderMaskedSegRange: ctx.renderMaskedSegRange,
  };

  for (let i = 0; i < sorted.length; i += 1) {
    const spr = sorted[i]!;
    clipVisSprite(spr, clipCtx, buffers);
    ctx.drawVisSprite(spr, buffers);
  }

  const drawsegs = ctx.drawsegs;
  for (let i = drawsegs.length - 1; i >= 0; i -= 1) {
    const ds = drawsegs[i]!;
    if (ds.maskedtexturecol !== null) {
      ctx.renderMaskedSegRange(ds, ds.x1, ds.x2);
    }
  }

  if (ctx.viewAngleOffset === 0 && ctx.drawPlayerSprites !== undefined) {
    ctx.drawPlayerSprites();
  }
}
