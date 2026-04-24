/**
 * Fuzz column drawer and invisibility path — r_draw.c
 * `R_DrawFuzzColumn` + the MF_SHADOW-triggered `vis->colormap = NULL`
 * branch in r_things.c `R_ProjectSprite` that routes a sprite through
 * the fuzz primitive.
 *
 * Vanilla Doom's "partial invisibility" (the Spectre monster and the
 * Blur Sphere powerup) dithers sprite pixels by sampling a neighboring
 * row of the already-drawn framebuffer and routing the sampled palette
 * index through colormap row 6 (a mid-brightness ramp).  Because the
 * fuzz drawer READS from the framebuffer, it MUST run after all
 * opaque surfaces behind the sprite have been painted, and the
 * sampling is deterministic — a 50-entry ±1-row offset table walked
 * by a module-level counter that persists across frames matching the
 * vanilla `fuzzpos` global.
 *
 * Parity invariants locked here:
 *
 * - {@link FUZZ_TABLE_SIZE} = `50`.  r_draw.c `#define FUZZTABLE 50`.
 *   The counter wraps back to 0 after emitting the 50th entry.
 * - {@link FUZZ_COLORMAP_INDEX} = `6`.  r_draw.c uses
 *   `colormaps[6*256 + dest[fuzzoffset[fuzzpos]]]` — colormap row 6
 *   of the 32-ramp COLORMAP lump, a mid-brightness light level that
 *   makes the fuzz overlay visible regardless of the underlying
 *   sector lightlevel.
 * - {@link FUZZ_COLORMAP_OFFSET} = `1536`.  `6 * 256` — byte offset
 *   into the `colormaps` lump for the fuzz ramp.
 * - {@link FUZZ_OFFSETS}.  50 entries of `+1` or `-1` mirroring the
 *   vanilla `fuzzoffset[FUZZTABLE]` table.  Vanilla stores
 *   `±SCREENWIDTH` so `dest[fuzzoffset[fuzzpos]]` is a one-row
 *   above/below pointer arithmetic access; this module stores the row
 *   sign and multiplies by `screenWidth` at call time so the primitive
 *   works with any framebuffer stride (tests frequently use a smaller
 *   framebuffer).  The sequence is byte-for-byte vanilla, including
 *   the cluster breaks across rows that break a naive "alternating"
 *   pattern.
 * - Border adjustment: `yl === 0 → yl = 1` and
 *   `yh === viewHeight - 1 → yh = viewHeight - 2`.  Vanilla trims the
 *   top and bottom rows so that the `±1 row` offset never reads
 *   outside the viewport (row `-1` would alias the wrong framebuffer
 *   area; row `viewHeight` would alias the status bar or the next
 *   frame's top).
 * - Early exit on `yh < yl` after border adjustment, matching vanilla
 *   `count = dc_yh - dc_yl; if (count < 0) return;`.
 * - {@link getFuzzPos} / {@link setFuzzPos} / {@link resetFuzzPos}.
 *   The module-level `fuzzPos` counter is semantically equivalent to
 *   vanilla's `int fuzzpos = 0;` global — persistent across calls
 *   WITHIN a process, NOT reset per frame, NOT reset per level.
 *   Vanilla's `P_Random`-style randomness is built on the counter
 *   surviving the full session, so demo-compat depends on resetting
 *   the counter only at process start (matching vanilla's static
 *   initializer) and not touching it elsewhere.  The helpers let
 *   tests drive the counter to a known state without duplicating the
 *   increment logic.
 * - `fuzzPos` advances ONCE per row painted, incremented AFTER the
 *   per-row framebuffer write, and wraps `→ 0` when the next value
 *   would be {@link FUZZ_TABLE_SIZE}.  A 5-row paint consumes offsets
 *   `[0..4]` and leaves `fuzzPos = 5`.
 * - Early-exit columns (`yh < yl`) do NOT advance the counter.
 *   Vanilla's `if (count < 0) return;` runs before the do-while so
 *   `fuzzpos++` is never reached.
 * - The per-row framebuffer write samples the OLD (pre-fuzz) pixel at
 *   `dest + FUZZ_OFFSETS[fuzzPos] * screenWidth` — so the source row
 *   for each pixel is one row above or below the destination row in
 *   the CURRENT framebuffer.  The fuzz effect is self-referential: a
 *   column's top row reads the row above (row `yl - 1`, valid because
 *   `yl >= 1`) and subsequent rows read rows that may or may not have
 *   just been painted by this same fuzz column (when the offset is
 *   `-1` and the pixel directly above was painted in the previous
 *   iteration).  This matches vanilla — the ordering is load-bearing
 *   for demo-compat palette stability.
 * - The MF_SHADOW sprite routing happens in spriteProjection.ts: a
 *   thing with `flags & MF_SHADOW` gets `vis.colormap = null`.  When
 *   a sprite's masked-column draw step encounters `vis.colormap ===
 *   null`, it dispatches to this primitive instead of the regular
 *   column drawer.  This module is unaware of the sprite pipeline
 *   wiring; it receives a {@link FuzzColumnJob} and writes the
 *   framebuffer.
 *
 * This module is pure arithmetic with no Win32 or runtime
 * dependencies.
 *
 * @example
 * ```ts
 * import { rDrawFuzzColumn, resetFuzzPos } from "../src/render/fuzz.ts";
 * resetFuzzPos();
 * const framebuffer = new Uint8Array(320 * 200).fill(0x40);
 * const colormaps = new Uint8Array(32 * 256);
 * // populate colormap row 6 so fuzz output is visible
 * for (let i = 0; i < 256; i += 1) colormaps[6 * 256 + i] = i ^ 0xff;
 * rDrawFuzzColumn(
 *   { x: 160, yl: 50, yh: 149, viewHeight: 200, colormaps },
 *   framebuffer,
 * );
 * ```
 */

import { SCREENWIDTH } from './projection.ts';

/** Number of entries in the vanilla `fuzzoffset[]` table (r_draw.c `FUZZTABLE`). */
export const FUZZ_TABLE_SIZE = 50;

/** COLORMAP row index used by the fuzz primitive (`6` of `0..31`). */
export const FUZZ_COLORMAP_INDEX = 6;

/** Byte offset of the fuzz colormap row inside the COLORMAP lump (`6 * 256`). */
export const FUZZ_COLORMAP_OFFSET = FUZZ_COLORMAP_INDEX * 256;

/**
 * Row-offset sequence consumed by the fuzz counter.  Each entry is
 * `+1` (sample one row below) or `-1` (sample one row above) — the
 * caller multiplies by `screenWidth` at runtime to match vanilla's
 * `±SCREENWIDTH` byte offsets.  Order matches r_draw.c `fuzzoffset[]`
 * byte-for-byte.
 */
export const FUZZ_OFFSETS: readonly number[] = Object.freeze([
  +1, -1, +1, -1, +1, +1, -1, +1, +1, -1, +1, +1, +1, -1, +1, +1, +1, -1, -1, -1, -1, +1, -1, -1, +1, +1, +1, +1, -1, +1, -1, +1, +1, -1, -1, +1, +1, -1, -1, -1, -1, +1, +1, +1, +1, -1, +1, +1, -1, +1,
]);

/**
 * Fuzz-column job.  Mirrors the subset of vanilla `dc_*` globals the
 * fuzz primitive reads (`dc_x`, `dc_yl`, `dc_yh`) plus the
 * `viewheight` and `colormaps` values the fuzz primitive needs
 * directly.  `dc_texturemid`, `dc_iscale`, and `dc_source` are NOT
 * used by the fuzz path — vanilla's R_DrawFuzzColumn declares them
 * via the shared globals but never reads them because the fuzz
 * effect samples the framebuffer, not the texture.
 */
export interface FuzzColumnJob {
  /** Framebuffer column (`dc_x` after `columnofs[]` resolution). */
  readonly x: number;
  /** Top framebuffer row, inclusive (`dc_yl`).  Clamped to `≥ 1`. */
  readonly yl: number;
  /** Bottom framebuffer row, inclusive (`dc_yh`).  Clamped to `≤ viewHeight - 2`. */
  readonly yh: number;
  /** Current viewport height — drives the bottom border clamp (`viewheight`). */
  readonly viewHeight: number;
  /**
   * Full COLORMAP lump (32 × 256 = 8192 bytes for vanilla; lengths
   * `≥ 7 * 256 = 1792` are sufficient since the fuzz row lives at
   * offset `6 * 256..6 * 256 + 255`).
   */
  readonly colormaps: Uint8Array;
}

let fuzzPos = 0;

/** Read the current fuzz counter (`fuzzpos` global). */
export function getFuzzPos(): number {
  return fuzzPos;
}

/**
 * Overwrite the fuzz counter.  Accepts any integer in
 * `[0, FUZZ_TABLE_SIZE)`; other values throw to catch test wiring
 * errors.  Vanilla never writes the counter directly outside the
 * increment inside R_DrawFuzzColumn, so production code should not
 * call this — tests use it to pin the counter to a known state.
 */
export function setFuzzPos(pos: number): void {
  if (!Number.isInteger(pos) || pos < 0 || pos >= FUZZ_TABLE_SIZE) {
    throw new RangeError(`setFuzzPos: pos must be an integer in [0, ${FUZZ_TABLE_SIZE}), got ${pos}`);
  }
  fuzzPos = pos;
}

/** Reset the fuzz counter to `0` (matching vanilla's static initializer). */
export function resetFuzzPos(): void {
  fuzzPos = 0;
}

/**
 * Draw a fuzz column into the framebuffer, reproducing
 * `R_DrawFuzzColumn` in r_draw.c byte-for-byte.
 *
 * The loop samples `framebuffer[dest + FUZZ_OFFSETS[fuzzPos] *
 * screenWidth]`, maps that palette index through colormap row 6
 * (`colormaps[FUZZ_COLORMAP_OFFSET + sample]`), and writes the result
 * back at `dest`.  Advances the module-level fuzz counter by one per
 * row painted, wrapping at {@link FUZZ_TABLE_SIZE}.
 *
 * Adjusts `yl` up to `1` and `yh` down to `viewHeight - 2` so the
 * ±1-row offset never reads outside the viewport.  Early-exits when
 * `yh < yl` after the adjustment, matching vanilla's `count < 0`
 * guard; early-exit paths do NOT advance the fuzz counter.
 *
 * @example
 * ```ts
 * import { rDrawFuzzColumn, resetFuzzPos } from "../src/render/fuzz.ts";
 * resetFuzzPos();
 * const fb = new Uint8Array(320 * 200);
 * const colormaps = new Uint8Array(32 * 256);
 * rDrawFuzzColumn({ x: 0, yl: 1, yh: 1, viewHeight: 200, colormaps }, fb);
 * ```
 */
export function rDrawFuzzColumn(job: FuzzColumnJob, framebuffer: Uint8Array, screenWidth: number = SCREENWIDTH): void {
  let yl = job.yl | 0;
  let yh = job.yh | 0;
  if (yl === 0) {
    yl = 1;
  }
  if (yh === job.viewHeight - 1) {
    yh = job.viewHeight - 2;
  }
  let count = yh - yl;
  if (count < 0) {
    return;
  }

  const colormaps = job.colormaps;
  const offsets = FUZZ_OFFSETS;
  let pos = fuzzPos;
  let dest = yl * screenWidth + job.x;
  do {
    const offset = offsets[pos]! * screenWidth;
    framebuffer[dest] = colormaps[FUZZ_COLORMAP_OFFSET + framebuffer[dest + offset]!]!;
    pos += 1;
    if (pos === FUZZ_TABLE_SIZE) {
      pos = 0;
    }
    dest += screenWidth;
  } while (count--);
  fuzzPos = pos;
}
