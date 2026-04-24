/**
 * Low-level column and span drawers for the world renderer
 * (r_draw.c `R_DrawColumn` and `R_DrawSpan`).
 *
 * These are the inner loops every wall, sky, sprite, floor, and ceiling
 * pass eventually calls through: {@link rDrawColumn} writes a single
 * vertical column into the 8-bit framebuffer from a wall-texture column
 * (masked modulo 128), and {@link rDrawSpan} writes a horizontal span
 * of a 64×64 flat. Both paths route every source byte through a
 * 256-entry light-diminish colormap so the renderer's lighting table
 * (r_main.c `R_InitLightTables`) applies uniformly.
 *
 * The primitives operate on framebuffer-absolute coordinates — the
 * caller is responsible for folding {@link Viewport.viewWindowX} and
 * {@link Viewport.viewWindowY} into the supplied `x` / `yl` / `yh` /
 * `x1` / `x2` / `y` values, matching vanilla's precomputed
 * `columnofs[]` / `ylookup[]` tables. The functions do no bounds
 * checking (vanilla's `RANGECHECK` guard is compiled out in release
 * builds); callers must pre-clip to the viewport.
 *
 * Parity invariants locked here:
 * - {@link COLUMN_HEIGHT_MASK} = `127`. R_DrawColumn indexes
 *   `dc_source[(frac >> FRACBITS) & 127]` — vanilla's wall-texture
 *   composite buffer is 128 tall and a column that paints outside the
 *   128-row window wraps modulo 128. This is parity-critical for tall
 *   two-sided walls whose midtexture exceeds 128 pixels.
 * - {@link FLAT_Y_SHIFT} = `FRACBITS - 6` = `10` and
 *   {@link FLAT_Y_MASK} = `63 * 64` = `4032`. R_DrawSpan composes the
 *   64×64 flat offset as
 *   `((yfrac >> 10) & 4032) + ((xfrac >> 16) & 63)` — the `+` and a
 *   bitwise `|` produce identical results because the two fields never
 *   overlap, but vanilla uses `+` and we follow suit.
 * - R_DrawColumn early-exits on `count = yh - yl < 0`. R_DrawSpan has
 *   NO such guard; callers must guarantee `x2 >= x1` or the `do-while
 *   (count--)` loop behaves as vanilla does (degenerate — potentially
 *   infinite for `x2 < x1`).
 * - The per-row destination advance is `SCREENWIDTH` bytes for
 *   R_DrawColumn and 1 byte (`dest++`) for R_DrawSpan, matching the
 *   column-major vs row-major access pattern vanilla inherits from the
 *   linear 320-byte-stride framebuffer.
 * - The accumulator updates (`frac += iscale`, `xFrac += xStep`,
 *   `yFrac += yStep`) are wrapped through `| 0` so JS float precision
 *   never diverges from C int32 two's-complement addition.
 *
 * This module is pure arithmetic with no Win32 or runtime dependencies.
 *
 * @example
 * ```ts
 * import { rDrawColumn } from "../src/render/drawPrimitives.ts";
 * const framebuffer = new Uint8Array(320 * 200);
 * const source = new Uint8Array(128); // wall-texture column
 * const colormap = new Uint8Array(256); // light-diminish LUT
 * rDrawColumn(
 *   {
 *     x: 160,
 *     yl: 50,
 *     yh: 149,
 *     textureMid: 0,
 *     iscale: 0x10000,
 *     centerY: 100,
 *     source,
 *     colormap,
 *   },
 *   framebuffer,
 * );
 * ```
 */

import { FRACBITS } from '../core/fixed.ts';
import { SCREENWIDTH } from './projection.ts';

/**
 * Vanilla `R_DrawColumn` masks the fixed-point texture V index with
 * `127` — wall-texture composite buffers are 128 rows tall and a
 * column that paints past row 127 wraps back to row 0. Kept as a
 * named constant so later renderer steps can reference the invariant
 * without re-deriving the literal.
 */
export const COLUMN_HEIGHT_MASK = 127;

/**
 * A flat tile is `FLAT_DIMENSION * FLAT_DIMENSION` bytes (64×64 =
 * 4096). Vanilla `R_DrawSpan` indexes a row-major 64×64 block.
 */
export const FLAT_DIMENSION = 64;

/**
 * Total byte size of one flat (4096). Callers allocating a flat
 * source buffer should size it to this value so the `spot` index
 * `((yFrac >> FLAT_Y_SHIFT) & FLAT_Y_MASK) + ((xFrac >> FRACBITS) &
 * FLAT_X_MASK)` always lands inside the buffer.
 */
export const FLAT_SIZE = FLAT_DIMENSION * FLAT_DIMENSION;

/**
 * Right shift `R_DrawSpan` applies to the fixed-point V coordinate
 * before masking: `FRACBITS - 6 = 10`. The `-6` picks up the bottom
 * six bits of the integer V (the row index within the 64-row flat).
 */
export const FLAT_Y_SHIFT = FRACBITS - 6;

/**
 * Mask for the y-part of the flat `spot` index: `(FLAT_DIMENSION - 1) *
 * FLAT_DIMENSION = 63 * 64 = 4032`. After shifting yFrac by
 * {@link FLAT_Y_SHIFT}, this mask isolates bits 6..11, i.e. the row
 * index already multiplied by the 64-byte row stride.
 */
export const FLAT_Y_MASK = (FLAT_DIMENSION - 1) * FLAT_DIMENSION;

/**
 * Mask for the x-part of the flat `spot` index: `FLAT_DIMENSION - 1 =
 * 63`. Shifting xFrac by `FRACBITS` produces the integer U coordinate;
 * this mask wraps it into the 64-column flat.
 */
export const FLAT_X_MASK = FLAT_DIMENSION - 1;

/**
 * Column-drawer job mirroring the vanilla `dc_*` global state block in
 * r_draw.c. Every field is framebuffer-absolute — the caller has
 * already folded `viewWindowX` / `viewWindowY` into the coordinates.
 */
export interface ColumnDrawJob {
  /** Framebuffer column (`dc_x` after `columnofs[]` resolution). */
  readonly x: number;
  /** Top framebuffer row, inclusive (`dc_yl`). */
  readonly yl: number;
  /** Bottom framebuffer row, inclusive (`dc_yh`). */
  readonly yh: number;
  /** Fixed-point texture V at the viewport `centerY` (`dc_texturemid`). */
  readonly textureMid: number;
  /** Fixed-point texture V step per screen row (`dc_iscale`). */
  readonly iscale: number;
  /** Viewport vertical center (`centery` global). */
  readonly centerY: number;
  /** Wall-texture composite column (indexed modulo {@link COLUMN_HEIGHT_MASK}+1). */
  readonly source: Uint8Array;
  /** 256-entry light-diminish colormap (`dc_colormap`). */
  readonly colormap: Uint8Array;
}

/**
 * Span-drawer job mirroring the vanilla `ds_*` global state block in
 * r_draw.c. Every field is framebuffer-absolute.
 */
export interface SpanDrawJob {
  /** Framebuffer left column, inclusive (`ds_x1`). */
  readonly x1: number;
  /** Framebuffer right column, inclusive (`ds_x2`). */
  readonly x2: number;
  /** Framebuffer row (`ds_y`). */
  readonly y: number;
  /** Fixed-point texture U at {@link SpanDrawJob.x1} (`ds_xfrac`). */
  readonly xFrac: number;
  /** Fixed-point texture V at {@link SpanDrawJob.x1} (`ds_yfrac`). */
  readonly yFrac: number;
  /** Fixed-point U step per column (`ds_xstep`). */
  readonly xStep: number;
  /** Fixed-point V step per column (`ds_ystep`). */
  readonly yStep: number;
  /** 64×64 flat source, row-major (`ds_source`, {@link FLAT_SIZE} bytes). */
  readonly source: Uint8Array;
  /** 256-entry light-diminish colormap (`ds_colormap`). */
  readonly colormap: Uint8Array;
}

/**
 * Draw a vertical column of framebuffer pixels, reproducing
 * `R_DrawColumn` in r_draw.c byte-for-byte.
 *
 * The loop advances `frac` by `iscale` per row, indexes the source
 * column at `(frac >> FRACBITS) & {@link COLUMN_HEIGHT_MASK}`, and
 * writes `colormap[source[index]]` into the framebuffer. The
 * per-row destination stride is `screenWidth` bytes.
 *
 * Early-exits when `yh < yl`, matching vanilla's `count < 0` guard.
 *
 * @example
 * ```ts
 * import { rDrawColumn } from "../src/render/drawPrimitives.ts";
 * const fb = new Uint8Array(320 * 200);
 * const source = new Uint8Array(128).fill(0x10);
 * const colormap = Uint8Array.from({ length: 256 }, (_, i) => i);
 * rDrawColumn(
 *   { x: 0, yl: 0, yh: 1, textureMid: 0, iscale: 0x10000, centerY: 0, source, colormap },
 *   fb,
 * );
 * // fb[0] === fb[320] === 0x10
 * ```
 */
export function rDrawColumn(job: ColumnDrawJob, framebuffer: Uint8Array, screenWidth: number = SCREENWIDTH): void {
  let count = job.yh - job.yl;
  if (count < 0) {
    return;
  }
  const { source, colormap, iscale } = job;
  let dest = job.yl * screenWidth + job.x;
  let frac = (job.textureMid + (job.yl - job.centerY) * iscale) | 0;
  do {
    framebuffer[dest] = colormap[source[(frac >> FRACBITS) & COLUMN_HEIGHT_MASK]!]!;
    dest += screenWidth;
    frac = (frac + iscale) | 0;
  } while (count--);
}

/**
 * Draw a horizontal span of framebuffer pixels, reproducing
 * `R_DrawSpan` in r_draw.c byte-for-byte.
 *
 * The loop composes the 64×64 flat offset as
 * `((yFrac >> {@link FLAT_Y_SHIFT}) & {@link FLAT_Y_MASK}) +
 * ((xFrac >> FRACBITS) & {@link FLAT_X_MASK})`, writes
 * `colormap[source[spot]]`, and advances `xFrac` / `yFrac` by `xStep`
 * / `yStep`.
 *
 * Has NO `x2 < x1` early-exit — vanilla's R_DrawSpan omits the guard,
 * so callers MUST ensure `x2 >= x1` before calling. The `do-while
 * (count--)` loop writes `x2 - x1 + 1` pixels.
 *
 * @example
 * ```ts
 * import { rDrawSpan } from "../src/render/drawPrimitives.ts";
 * const fb = new Uint8Array(320 * 200);
 * const source = new Uint8Array(64 * 64);
 * for (let i = 0; i < source.length; i += 1) source[i] = i & 0xff;
 * const colormap = Uint8Array.from({ length: 256 }, (_, i) => i);
 * rDrawSpan(
 *   { x1: 0, x2: 3, y: 0, xFrac: 0, yFrac: 0, xStep: 0x10000, yStep: 0, source, colormap },
 *   fb,
 * );
 * // fb[0..3] === [0, 1, 2, 3]
 * ```
 */
export function rDrawSpan(job: SpanDrawJob, framebuffer: Uint8Array, screenWidth: number = SCREENWIDTH): void {
  const { source, colormap, xStep, yStep } = job;
  let xFrac = job.xFrac | 0;
  let yFrac = job.yFrac | 0;
  let dest = job.y * screenWidth + job.x1;
  let count = job.x2 - job.x1;
  do {
    const spot = ((yFrac >> FLAT_Y_SHIFT) & FLAT_Y_MASK) + ((xFrac >> FRACBITS) & FLAT_X_MASK);
    framebuffer[dest++] = colormap[source[spot]!]!;
    xFrac = (xFrac + xStep) | 0;
    yFrac = (yFrac + yStep) | 0;
  } while (count--);
}
