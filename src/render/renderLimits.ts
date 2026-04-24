/**
 * Renderer pool/limit constants and BSP-clip sentinel values shared by
 * the visplane builder, openings allocator, drawseg recorder, and
 * solidsegs clip walker.
 *
 * Vanilla Doom enforces these limits with `I_Error` on overflow.  The
 * later phase-13 steps that allocate the pools and walk the clip lists
 * import the constants from here so the limits and sentinel values live
 * in one place:
 *
 * - `MAXDRAWSEGS` / {@link drawseg_t} list lives in `r_bsp.c` and is
 *   bounded at compile time (`R_StoreWallRange`/`R_DrawPlanes` overflow
 *   guard).
 * - `MAXSEGS` is the `solidsegs[]` cap inside `r_bsp.c`
 *   (`R_ClipSolidWallSegment`/`R_ClipPassWallSegment`).  The two
 *   sentinel entries `solidsegs[0]` / `solidsegs[1]` flank the visible
 *   range and are reset by `R_ClearClipSegs`.
 * - `MAXVISPLANES` and `MAXOPENINGS` are the floor/ceiling pool caps in
 *   `r_plane.c` (`R_FindPlane`/`R_CheckPlane` overflow guard plus
 *   `R_DrawPlanes` opening overflow guard).
 * - The silhouette enum drives drawseg sprite-clip selection in
 *   `R_StoreWallRange`.
 * - `VISPLANE_TOP_UNFILLED = 0xff` is the byte vanilla writes via
 *   `memset(check->top, 0xff, ...)` to mark a visplane column as
 *   not-yet-touched by `R_MakeSpans`.
 * - `CEILINGCLIP_DEFAULT = -1` and `floorclipDefault(viewHeight)`
 *   reproduce the per-frame initialization `R_ClearPlanes` performs on
 *   the floorclip / ceilingclip arrays.
 *
 * The pool counts re-export from {@link ./projection.ts} so this module
 * stays a thin renderer-facing facade and the byte-level constants
 * still trace back to F-128.
 *
 * This module is pure arithmetic with no Win32 or runtime dependencies.
 *
 * @example
 * ```ts
 * import {
 *   CEILINGCLIP_DEFAULT,
 *   MAXDRAWSEGS,
 *   Silhouette,
 *   floorclipDefault,
 * } from "../src/render/renderLimits.ts";
 *
 * const ceilingClip = new Int16Array(320).fill(CEILINGCLIP_DEFAULT);
 * const floorClip = new Int16Array(320).fill(floorclipDefault(168));
 * const silhouette: Silhouette = Silhouette.both;
 * void MAXDRAWSEGS;
 * ```
 */

import { MAXOPENINGS, MAXSEGS, MAXVISPLANES, SCREENHEIGHT, SCREENWIDTH } from './projection.ts';

export { MAXOPENINGS, MAXSEGS, MAXVISPLANES };

/**
 * Upper bound on the per-frame `drawsegs[]` table inside `r_bsp.c`
 * (vanilla `MAXDRAWSEGS = 256`).  `R_DrawPlanes` calls
 * `I_Error("R_DrawPlanes: drawsegs overflow")` if `ds_p - drawsegs`
 * exceeds this cap.
 */
export const MAXDRAWSEGS = 256;

/**
 * Sentinel byte vanilla writes into `visplane_t.top[]` to mark a column
 * that no `R_MakeSpans` call has touched yet.  `R_FindPlane` and
 * `R_CheckPlane` reset every column to this value via
 * `memset(check->top, 0xff, sizeof(check->top))`, and `R_DrawPlanes`
 * then writes `top[minx-1]` and `top[maxx+1]` as the same sentinel
 * before walking spans.
 */
export const VISPLANE_TOP_UNFILLED = 0xff;

/**
 * Initial value `R_ClearPlanes` writes into every entry of
 * `ceilingclip[SCREENWIDTH]`.  Setting it to `-1` (one row above the
 * top scanline) means the first ceiling span starts at row 0.
 */
export const CEILINGCLIP_DEFAULT = -1;

/**
 * Lower-bound sentinel vanilla writes into `solidsegs[0].first` inside
 * `R_ClearClipSegs` (`-0x7FFFFFFF`).  Combined with
 * {@link CLIPRANGE_SENTINEL_LAST_HIGH}, this flanks the visible
 * column range so that `R_ClipSolidWallSegment` never walks off either
 * end of the clip list.
 */
export const CLIPRANGE_SENTINEL_FIRST_LOW = -0x7fff_ffff;

/**
 * Last-column sentinel `R_ClearClipSegs` pairs with the low-end
 * sentinel: `solidsegs[0].last = -1` (one column before the first
 * visible pixel).
 */
export const CLIPRANGE_SENTINEL_LAST_LOW = -1;

/**
 * High-end sentinel `R_ClearClipSegs` writes into `solidsegs[1].last`
 * (`+0x7FFFFFFF`).  Pairs with `solidsegs[1].first = viewWidth` so the
 * walker treats every column past `viewWidth` as already clipped.
 */
export const CLIPRANGE_SENTINEL_LAST_HIGH = 0x7fff_ffff;

/**
 * Drawseg silhouette flags — vanilla `SIL_NONE`/`SIL_BOTTOM`/`SIL_TOP`/
 * `SIL_BOTH` constants from `r_defs.h`.  The values are bit flags so
 * `top | bottom === both` and the renderer can OR them together.
 */
export const enum Silhouette {
  none = 0,
  bottom = 1,
  top = 2,
  both = 3,
}

/**
 * Cliprange entry stored in `solidsegs[]` (vanilla `cliprange_t` from
 * `r_bsp.c`).  Each entry covers a half-open horizontal range of
 * already-clipped columns; new wall segments insert into the gaps
 * between adjacent entries.
 */
export interface ClipRange {
  /** Leftmost column (inclusive) covered by this clip span. */
  first: number;
  /** Rightmost column (inclusive) covered by this clip span. */
  last: number;
}

/**
 * Visplane pool entry mirroring the vanilla `visplane_t` from
 * `r_defs.h`.  The `top` and `bottom` arrays are `SCREENWIDTH` bytes
 * each; column indices outside `[minx, maxx]` keep
 * {@link VISPLANE_TOP_UNFILLED}.
 */
export interface Visplane {
  /** Floor or ceiling height in 16.16 fixed-point view-space units. */
  height: number;
  /** Flat picnum or `skyflatnum` for the sky special-case. */
  picnum: number;
  /** Sector lightlevel passed through `R_DrawPlanes` (0..255). */
  lightlevel: number;
  /** Leftmost touched column; resets to `SCREENWIDTH` so `minx > maxx` means empty. */
  minx: number;
  /** Rightmost touched column; resets to `-1` so `minx > maxx` means empty. */
  maxx: number;
  /** Per-column top-row index (`VISPLANE_TOP_UNFILLED` for untouched columns). */
  top: Uint8Array;
  /** Per-column bottom-row index (paired with {@link Visplane.top}). */
  bottom: Uint8Array;
}

/**
 * Drawseg entry mirroring the vanilla `drawseg_t` from `r_defs.h`.
 * Phase 13 wall paths populate this; sprite clipping reads
 * {@link Drawseg.silhouette}, {@link Drawseg.bsilheight},
 * {@link Drawseg.tsilheight}, and the shared opening offsets.
 */
export interface Drawseg {
  /** Index of the source `seg_t` (resolved at draw time, not stored as a pointer). */
  curlineIndex: number;
  /** Leftmost screen column (inclusive). */
  x1: number;
  /** Rightmost screen column (inclusive). */
  x2: number;
  /** Inverse-z scale at column {@link Drawseg.x1}. */
  scale1: number;
  /** Inverse-z scale at column {@link Drawseg.x2}. */
  scale2: number;
  /** Per-column scale increment between {@link Drawseg.x1} and {@link Drawseg.x2}. */
  scalestep: number;
  /** Silhouette flags (see {@link Silhouette}). */
  silhouette: Silhouette;
  /** Bottom silhouette height — sprites below this z are not clipped by this seg. */
  bsilheight: number;
  /** Top silhouette height — sprites above this z are not clipped by this seg. */
  tsilheight: number;
  /** Offset into the openings pool for the per-column sprite-top clip (or `-1` for none). */
  sprtopclip: number;
  /** Offset into the openings pool for the per-column sprite-bottom clip (or `-1` for none). */
  sprbottomclip: number;
  /** Offset into the openings pool for the per-column masked-texture column index (or `-1` for none). */
  maskedtexturecol: number;
}

/**
 * Pool capacities packaged as a single record so allocators can read
 * everything from one import.  All fields are vanilla pins; mutating
 * the record at runtime is a parity violation.
 */
export interface RenderPoolLimits {
  readonly maxDrawsegs: number;
  readonly maxOpenings: number;
  readonly maxSegs: number;
  readonly maxVisplanes: number;
  readonly screenHeight: number;
  readonly screenWidth: number;
}

/**
 * Frozen snapshot of the renderer pool capacities for callers that
 * want a single object reference.  The field names follow the
 * surrounding camelCase convention; the underlying constants stay
 * exported individually for direct use.
 */
export const RENDER_POOL_LIMITS: RenderPoolLimits = Object.freeze({
  maxDrawsegs: MAXDRAWSEGS,
  maxOpenings: MAXOPENINGS,
  maxSegs: MAXSEGS,
  maxVisplanes: MAXVISPLANES,
  screenHeight: SCREENHEIGHT,
  screenWidth: SCREENWIDTH,
});

/**
 * Initial value `R_ClearPlanes` writes into every entry of
 * `floorclip[SCREENWIDTH]`.  Vanilla uses the per-frame `viewheight`
 * directly; callers pass the active {@link Viewport.viewHeight} so the
 * clip default tracks the view-size slider.
 *
 * @example
 * ```ts
 * import { floorclipDefault } from "../src/render/renderLimits.ts";
 * const floorClip = new Int16Array(320).fill(floorclipDefault(168));
 * ```
 */
export function floorclipDefault(viewHeight: number): number {
  return viewHeight | 0;
}

/**
 * Compute the byte size of an `openings[]` pool entry in vanilla.  The
 * vanilla pool is `short openings[SCREENWIDTH * 64]`, so each entry is
 * 2 bytes.  Phase-13 allocators that target a typed array import this
 * directly to size the backing `Int16Array`.
 */
export const OPENINGS_BYTES_PER_ENTRY = 2;

/**
 * Total byte footprint of the openings pool (`MAXOPENINGS *
 * OPENINGS_BYTES_PER_ENTRY` = 40 960 bytes).  Mirrors the vanilla
 * `short openings[MAXOPENINGS]` allocation in `r_plane.c`.
 */
export const OPENINGS_POOL_BYTES = MAXOPENINGS * OPENINGS_BYTES_PER_ENTRY;
