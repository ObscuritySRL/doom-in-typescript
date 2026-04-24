/**
 * Visplane span renderer — r_plane.c `R_DrawPlanes` non-sky branch plus
 * the `R_MakeSpans` column-diff walker and the `R_MapPlane` per-span
 * parameter computation.
 *
 * Once the BSP traversal and wall renderer have populated a
 * {@link Visplane}'s per-column `top` / `bottom` arrays, this module
 * converts those column-major top/bottom intervals into horizontal
 * spans and routes every span through {@link rDrawSpan}.  Three
 * primitives live here:
 *
 * - {@link makeSpans} — the four-while-loop column-over-column walker
 *   (`R_MakeSpans`).  Given the previous column's `(t1, b1)` and the
 *   current column's `(t2, b2)`, closes any spans the previous column
 *   extended beyond the current column's range via the supplied
 *   {@link CloseSpanCallback}, and starts new spans for rows the
 *   current column introduces by updating `spanstart[y] = x`.
 * - {@link mapPlaneSpan} — `R_MapPlane`.  Computes
 *   `distance = FixedMul(planeheight, yslope[y])`,
 *   `xstep = FixedMul(distance, basexscale)`,
 *   `ystep = FixedMul(distance, baseyscale)`,
 *   `length = FixedMul(distance, distscale[x1])`,
 *   `angle = (viewangle + xtoviewangle[x1]) >> ANGLETOFINESHIFT`,
 *   `xfrac = viewx + FixedMul(cos(angle), length)`,
 *   `yfrac = -viewy - FixedMul(sin(angle), length)`, selects the
 *   colormap from `planezlight[distance >> LIGHTZSHIFT]` (clamped to
 *   `MAXLIGHTZ - 1`) unless `fixedColormap` is non-null, then hands
 *   the result to {@link rDrawSpan}.
 * - {@link renderVisplaneSpans} — the non-sky branch of `R_DrawPlanes`.
 *   Walks columns `minx..maxx+1`, synthesises the vanilla
 *   `top[minx-1] = top[maxx+1] = 0xff` sentinels at the boundaries
 *   (without writing out-of-bounds into the visplane's `top` array),
 *   calls {@link makeSpans} with a closure that routes every closed
 *   span to {@link mapPlaneSpan}, and never revisits a finished column.
 *
 * Parity invariants locked here:
 *
 * - Boundary sentinel: vanilla writes `0xff` into `top[minx-1]` and
 *   `top[maxx+1]` before the loop.  Because JS typed arrays cannot
 *   tolerate the negative-index or past-end writes vanilla's `pad1..pad4`
 *   struct padding makes safe in C, we synthesise the sentinel values
 *   in local `t1` / `b1` / `t2` / `b2` variables for the boundary
 *   iterations (`t1 = 0xff, b1 = 0` before the first column;
 *   `t2 = 0xff, b2 = 0` at `x = maxx + 1`).  The zero-valued `b1` /
 *   `b2` are safe because every boundary comparison that touches `b`
 *   also requires `b >= 0xff`, which `0` never satisfies — so the
 *   observable output is identical to vanilla's pad-byte reads.
 * - Four-while structure: the loops run in the order (close-top →
 *   close-bottom → start-top → start-bottom).  The order matters for
 *   `spanstart[y]` writes when a row transitions from "closed on
 *   previous column" to "open on current column" in the same call.
 *   Our implementation mirrors vanilla byte-for-byte.
 * - Close-span emission: `closeSpan(y, spanstart[y], x - 1)` — note the
 *   `x - 1`, not `x`.  Vanilla closes the span at the previous column
 *   because column `x` is the first column that no longer contains the
 *   span.  A caller that receives `(y, spanstart[y], x - 1)` and
 *   hands it to {@link rDrawSpan} draws exactly the columns the span
 *   occupied.
 * - Per-y cache: {@link mapPlaneSpan} stores
 *   `(planeHeight, distance, xStep, yStep)` in `cachedHeight[y]` /
 *   `cachedDistance[y]` / `cachedXStep[y]` / `cachedYStep[y]`.  On the
 *   next call with the same `y`, a `cachedHeight[y] === planeHeight`
 *   hit skips the three `FixedMul` calls and reuses the cached values.
 *   The cache is shared across visplanes for the same frame — this
 *   is the whole point of the cache: multiple planes at the same height
 *   (e.g., all ceilings of an outdoor room) share the per-y math.
 * - Unsigned distance bucket: `distance >> LIGHTZSHIFT` is a signed
 *   right-shift.  Vanilla computes the same with `distance >> 20` on
 *   signed `fixed_t`; negative distances (should not happen for normal
 *   planes, but possible under extreme view positions) would produce
 *   a negative bucket, which the `index >= MAXLIGHTZ` guard does not
 *   clamp.  We preserve vanilla's signed-shift behavior exactly.
 * - `yFrac` sign: vanilla's `ds_yfrac = -viewy - FixedMul(...)`.  The
 *   leading `-viewy` flips the world-space Y because Doom's `viewy`
 *   increases northward but the flat texture's V axis points southward;
 *   the flat's row 0 is the northernmost row of the 64×64 tile.
 * - Empty-plane skip: `minx > maxx` (the empty-plane marker vanilla
 *   leaves on untouched visplanes after `R_ClearPlanes`) returns
 *   immediately without any loop iteration.  Callers can pass every
 *   pool slot through {@link renderVisplaneSpans} and the empty slots
 *   are no-ops.
 *
 * This module is pure arithmetic + typed-array writes with no Win32 or
 * runtime dependencies.  The caller owns the framebuffer, the spanstart
 * scratch array, the per-y plane-math cache, the view-space tables
 * (yslope, distscale, xtoviewangle), the per-frame base scales, and the
 * per-plane state (planeheight, planezlight, fixedColormap, flatSource).
 *
 * @example
 * ```ts
 * import { createPlaneSpanCache, renderVisplaneSpans } from "../src/render/visplaneSpans.ts";
 * import { createVisplanePool, findPlane, checkPlane } from "../src/render/visplanes.ts";
 *
 * const pool = createVisplanePool();
 * const plane = findPlane(pool, 0, 1, 100, 256);
 * checkPlane(pool, plane, 0, 319);
 * // ...populate plane.top/bottom via wall renderers...
 * const cache = createPlaneSpanCache(168);
 * renderVisplaneSpans(plane, {
 *   planeHeight: 64 << 16,
 *   planeZLight: zLightRamp,
 *   fixedColormap: null,
 *   flatSource: flatBytes,
 *   viewX: 0, viewY: 0, viewAngle: 0,
 *   baseXScale: 0, baseYScale: 0,
 *   ySlope, distScale, xToViewAngle,
 *   spanStart: cache.spanStart,
 *   cachedHeight: cache.cachedHeight,
 *   cachedDistance: cache.cachedDistance,
 *   cachedXStep: cache.cachedXStep,
 *   cachedYStep: cache.cachedYStep,
 *   framebuffer,
 * });
 * ```
 */

import { fixedMul } from '../core/fixed.ts';
import { ANGLETOFINESHIFT, FINEMASK, finecosine, finesine } from '../core/trig.ts';
import { rDrawSpan } from './drawPrimitives.ts';
import { LIGHTZSHIFT, MAXLIGHTZ, SCREENWIDTH } from './projection.ts';
import type { Visplane } from './renderLimits.ts';
import { VISPLANE_TOP_UNFILLED } from './renderLimits.ts';

export { VISPLANE_TOP_UNFILLED } from './renderLimits.ts';

/**
 * Callback invoked by {@link makeSpans} when a horizontal span ends.
 * Called with `(y, spanstart[y], x - 1)` so the caller can hand the
 * tuple directly to {@link rDrawSpan}.
 */
export type CloseSpanCallback = (y: number, x1: number, x2: number) => void;

/**
 * Scratch and cache storage for a frame of {@link renderVisplaneSpans}
 * calls.  `spanStart` records the left edge of every open span per row;
 * the four `cached*` arrays persist `R_MapPlane`'s per-y math so
 * multiple planes at the same height reuse the values.
 */
export interface PlaneSpanCache {
  /** `spanstart[y]` — start column of the currently-open span on row y. */
  readonly spanStart: Int32Array;
  /** `cachedheight[y]` — planeheight that drove this row's cache line. */
  readonly cachedHeight: Int32Array;
  /** `cacheddistance[y]` — `FixedMul(planeheight, yslope[y])`. */
  readonly cachedDistance: Int32Array;
  /** `cachedxstep[y]` — `FixedMul(distance, basexscale)`. */
  readonly cachedXStep: Int32Array;
  /** `cachedystep[y]` — `FixedMul(distance, baseyscale)`. */
  readonly cachedYStep: Int32Array;
}

/**
 * Allocate a {@link PlaneSpanCache} sized to `viewHeight` rows.  Every
 * field is a fresh zero-initialized `Int32Array`; the zero sentinel in
 * `cachedHeight` is vanilla's initial state (a plane with
 * `planeHeight === 0` will hit the cache on first access and read
 * `cachedDistance[y] === 0`, which matches the `FixedMul(0, yslope[y])`
 * = 0 result exactly).
 */
export function createPlaneSpanCache(viewHeight: number): PlaneSpanCache {
  if (!Number.isInteger(viewHeight) || viewHeight < 0) {
    throw new RangeError(`viewHeight must be a non-negative integer, got ${viewHeight}`);
  }

  return {
    spanStart: new Int32Array(viewHeight),
    cachedHeight: new Int32Array(viewHeight),
    cachedDistance: new Int32Array(viewHeight),
    cachedXStep: new Int32Array(viewHeight),
    cachedYStep: new Int32Array(viewHeight),
  };
}

/**
 * Per-frame + per-plane state consumed by {@link mapPlaneSpan} and
 * {@link renderVisplaneSpans}.  The caller rebuilds the per-plane
 * fields (`planeHeight`, `planeZLight`, `fixedColormap`, `flatSource`)
 * before each call; the per-frame fields (view state, yslope,
 * distscale, xtoviewangle, cache arrays, spanstart, framebuffer) are
 * set once per frame.
 */
export interface VisplaneSpanContext {
  /** `planeheight = abs(pl->height - viewz)` in fixed-point. */
  readonly planeHeight: number;
  /**
   * `planezlight[MAXLIGHTZ]` — per-distance-bucket colormaps resolved
   * for this plane's lightlevel.  Length must be at least
   * {@link MAXLIGHTZ}.
   */
  readonly planeZLight: readonly Uint8Array[];
  /**
   * `fixedcolormap` override (null for distance-based lighting).  When
   * non-null, every span ignores the distance bucket and uses this
   * colormap — vanilla's invulnerability-powerup and demo-record
   * fixed-light path.
   */
  readonly fixedColormap: Uint8Array | null;
  /** Flat source bytes — 4096 bytes, 64×64 row-major. */
  readonly flatSource: Uint8Array;
  /** View-space X (`viewx` global) in fixed-point. */
  readonly viewX: number;
  /** View-space Y (`viewy` global) in fixed-point. */
  readonly viewY: number;
  /** View angle (`viewangle` global) in BAM units. */
  readonly viewAngle: number;
  /**
   * `basexscale` — per-frame `FixedMul(viewsin, iprojection)`.
   * Supplied pre-computed by the frame setup (`R_SetupFrame`).
   */
  readonly baseXScale: number;
  /**
   * `baseyscale` — per-frame `-FixedMul(viewcos, iprojection)`.
   * Supplied pre-computed by the frame setup.
   */
  readonly baseYScale: number;
  /** `yslope[y]` — perspective slope per row, length viewHeight. */
  readonly ySlope: Int32Array;
  /** `distscale[x]` — per-column distance scale, length viewWidth. */
  readonly distScale: Int32Array;
  /**
   * `xtoviewangle[x]` — per-column view-angle offset in BAM units,
   * length viewWidth + 1.  `R_MapPlane` only reads indices in
   * `[x1, x1]` so a vanilla-sized table covers the whole frame.
   */
  readonly xToViewAngle: Int32Array;
  /** Per-y planeheight that drove the current cache line. */
  readonly cachedHeight: Int32Array;
  /** Per-y cached distance. */
  readonly cachedDistance: Int32Array;
  /** Per-y cached xstep. */
  readonly cachedXStep: Int32Array;
  /** Per-y cached ystep. */
  readonly cachedYStep: Int32Array;
  /** Per-y `spanstart[y]` — start column of the currently-open span. */
  readonly spanStart: Int32Array;
  /** Palette-indexed framebuffer (`screenWidth * SCREENHEIGHT` bytes). */
  readonly framebuffer: Uint8Array;
  /** Framebuffer row stride (defaults to {@link SCREENWIDTH}). */
  readonly screenWidth?: number;
}

/**
 * `R_MakeSpans` — walk the column-over-column diff between previous
 * column `(t1, b1)` and current column `(t2, b2)`, closing spans the
 * previous column extended beyond the current column's range and
 * starting new spans for rows the current column introduces.
 *
 * The four loops run in strict vanilla order:
 *
 * 1. Close spans at the top (`t1 < t2 && t1 <= b1`): rows that were
 *    inside the previous column's span but above the current column's
 *    span close with `closeSpan(t1, spanstart[t1], x - 1)`.
 * 2. Close spans at the bottom (`b1 > b2 && b1 >= t1`): rows that were
 *    inside the previous column's span but below the current column's
 *    span close symmetrically.
 * 3. Start spans at the top (`t2 < t1 && t2 <= b2`): rows that the
 *    current column introduces above the previous span record
 *    `spanstart[t2] = x`.
 * 4. Start spans at the bottom (`b2 > b1 && b2 >= t2`): rows that the
 *    current column introduces below the previous span record
 *    `spanstart[b2] = x`.
 *
 * All four loops operate on local copies of `t1` / `b1` / `t2` / `b2`
 * so the caller's values are left intact.  The `VISPLANE_TOP_UNFILLED`
 * (`0xff`) sentinel is safe to pass as any of the four arguments:
 * every comparison that involves `255` requires `255 <= b` or
 * `b >= 255`, which a valid row value (`< viewHeight <= 200`) never
 * satisfies.  This is how `renderVisplaneSpans` closes all open spans
 * at the right boundary (`t2 = 0xff`) and skips the close loop at the
 * left boundary (`t1 = 0xff`).
 */
export function makeSpans(x: number, t1: number, b1: number, t2: number, b2: number, spanstart: Int32Array, closeSpan: CloseSpanCallback): void {
  let localT1 = t1 | 0;
  let localB1 = b1 | 0;
  let localT2 = t2 | 0;
  let localB2 = b2 | 0;

  while (localT1 < localT2 && localT1 <= localB1) {
    closeSpan(localT1, spanstart[localT1]!, x - 1);
    localT1 += 1;
  }
  while (localB1 > localB2 && localB1 >= localT1) {
    closeSpan(localB1, spanstart[localB1]!, x - 1);
    localB1 -= 1;
  }
  while (localT2 < localT1 && localT2 <= localB2) {
    spanstart[localT2] = x;
    localT2 += 1;
  }
  while (localB2 > localB1 && localB2 >= localT2) {
    spanstart[localB2] = x;
    localB2 -= 1;
  }
}

/**
 * `R_MapPlane` — compute per-span texture coordinates for row `y`,
 * framebuffer columns `[x1, x2]`, select the lighting colormap, and
 * emit the span to {@link rDrawSpan}.
 *
 * Uses the per-y cache to skip recomputing
 * `distance = FixedMul(planeHeight, ySlope[y])`,
 * `xStep = FixedMul(distance, baseXScale)`, and
 * `yStep = FixedMul(distance, baseYScale)` when multiple planes at
 * the same `planeHeight` hit the same row within one frame.  The
 * cache invalidates on `planeHeight` mismatch and writes the new
 * triple back.
 *
 * `length = FixedMul(distance, distScale[x1])` and
 * `angle = (viewAngle + xToViewAngle[x1]) >> ANGLETOFINESHIFT` drive
 * the per-span origin:
 * `xFrac = viewX + FixedMul(cos(angle), length)`,
 * `yFrac = -viewY - FixedMul(sin(angle), length)`.  The leading
 * `-viewY` reproduces the world-space vs flat-space V-axis flip.
 *
 * The colormap resolves via
 * `planeZLight[clamp(distance >> LIGHTZSHIFT, 0, MAXLIGHTZ - 1)]`
 * unless `fixedColormap` is non-null (invulnerability-powerup path).
 */
export function mapPlaneSpan(y: number, x1: number, x2: number, ctx: VisplaneSpanContext): void {
  const { baseXScale, baseYScale, cachedDistance, cachedHeight, cachedXStep, cachedYStep, distScale, fixedColormap, flatSource, framebuffer, planeHeight, planeZLight, screenWidth, viewAngle, viewX, viewY, xToViewAngle, ySlope } = ctx;
  let distance: number;
  let xStep: number;
  let yStep: number;
  if (cachedHeight[y] !== planeHeight) {
    cachedHeight[y] = planeHeight;
    distance = fixedMul(planeHeight, ySlope[y]!);
    cachedDistance[y] = distance;
    xStep = fixedMul(distance, baseXScale);
    cachedXStep[y] = xStep;
    yStep = fixedMul(distance, baseYScale);
    cachedYStep[y] = yStep;
  } else {
    distance = cachedDistance[y]!;
    xStep = cachedXStep[y]!;
    yStep = cachedYStep[y]!;
  }

  const length = fixedMul(distance, distScale[x1]!);
  const angleIndex = ((viewAngle + xToViewAngle[x1]!) >>> ANGLETOFINESHIFT) & FINEMASK;
  const xFrac = (viewX + fixedMul(finecosine[angleIndex]!, length)) | 0;
  const yFrac = (-viewY - fixedMul(finesine[angleIndex]!, length)) | 0;

  let colormap: Uint8Array;
  if (fixedColormap !== null) {
    colormap = fixedColormap;
  } else {
    let index = distance >> LIGHTZSHIFT;
    if (index >= MAXLIGHTZ) {
      index = MAXLIGHTZ - 1;
    }
    colormap = planeZLight[index]!;
  }

  rDrawSpan({ x1, x2, y, xFrac, yFrac, xStep, yStep, source: flatSource, colormap }, framebuffer, screenWidth ?? SCREENWIDTH);
}

/**
 * Render a single non-sky visplane — the `R_DrawPlanes` body for the
 * `picnum !== skyflatnum` branch.
 *
 * Walks the plane's `[minx, maxx + 1]` column range, synthesizing the
 * `VISPLANE_TOP_UNFILLED` sentinel at the boundary columns (where
 * vanilla writes `top[minx-1] = top[maxx+1] = 0xff`), calls
 * {@link makeSpans} for every column transition, and routes every
 * closed span through {@link mapPlaneSpan}.
 *
 * Empty planes (`minx > maxx`) are a no-op — the caller can safely
 * hand every pool slot to this function and let the empty-plane check
 * short-circuit the untouched ones.
 *
 * Sky planes are NOT handled here — the caller dispatches on
 * `picnum === skyFlatNum` before invoking this function.  A future
 * step will add the sky column-draw path on top.
 */
export function renderVisplaneSpans(plane: Visplane, ctx: VisplaneSpanContext): void {
  if (plane.minx > plane.maxx) {
    return;
  }

  const planeBottom = plane.bottom;
  const planeMaxX = plane.maxx;
  const planeTop = plane.top;
  const spanStart = ctx.spanStart;
  const closeSpan: CloseSpanCallback = (y, x1, x2) => {
    mapPlaneSpan(y, x1, x2, ctx);
  };

  let t1 = VISPLANE_TOP_UNFILLED;
  let b1 = 0;
  const stop = planeMaxX + 1;
  for (let x = plane.minx; x <= stop; x += 1) {
    let t2: number;
    let b2: number;
    if (x > planeMaxX) {
      t2 = VISPLANE_TOP_UNFILLED;
      b2 = 0;
    } else {
      t2 = planeTop[x]!;
      b2 = planeBottom[x]!;
    }
    makeSpans(x, t1, b1, t2, b2, spanStart, closeSpan);
    t1 = t2;
    b1 = b2;
  }
}
