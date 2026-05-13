/**
 * Vanilla DOOM 1.9 fuzz (partial invisibility) rendering contract.
 *
 * From Chocolate Doom 2.2.1 r_draw.c `R_DrawFuzzColumn` and the
 * `fuzzoffset[FUZZTABLE]` table:
 *
 *   #define FUZZTABLE 50
 *   static const int fuzzoffset[FUZZTABLE] = {
 *       FUZZOFF,-FUZZOFF, FUZZOFF,-FUZZOFF, ...
 *   };
 *   static int fuzzpos = 0;
 *
 *   void R_DrawFuzzColumn (void)
 *   {
 *       if (!dc_yl) dc_yl = 1;
 *       if (dc_yh == viewheight - 1) dc_yh = viewheight - 2;
 *       count = dc_yh - dc_yl;
 *       if (count < 0) return;
 *
 *       dest = ylookup[dc_yl] + columnofs[dc_x];
 *       do {
 *           *dest = colormaps[6*256 + dest[fuzzoffset[fuzzpos]]];
 *           if (++fuzzpos == FUZZTABLE) fuzzpos = 0;
 *           dest += SCREENWIDTH;
 *       } while (count--);
 *   }
 *
 * Parity-critical invariants pinned here:
 *
 *   1. FUZZTABLE = 50 entries.  The `fuzzpos` counter wraps to 0 when
 *      it would otherwise become 50.
 *   2. The colormap row used by the fuzz overlay is row 6 of the
 *      32-row COLORMAP lump.  Byte offset `6 * 256 = 1536`.
 *   3. Border clamps run BEFORE the empty-column reject:
 *        if (dc_yl == 0)              dc_yl = 1
 *        if (dc_yh == viewheight - 1) dc_yh = viewheight - 2
 *        if (dc_yh < dc_yl) return
 *   4. Each entry of `fuzzoffset[]` is `+SCREENWIDTH` or `-SCREENWIDTH`
 *      in vanilla; we encode `±1` rows so callers multiply by the
 *      runtime framebuffer stride.  Sequence is byte-for-byte vanilla.
 *   5. `fuzzpos` is a process-lifetime `static int`, initialized to 0
 *      ONCE.  Never reset per frame or per level.  Demo-compat depends
 *      on this persistence.
 *   6. The per-row write samples `dest[fuzzoffset[fuzzpos]]` from the
 *      CURRENT framebuffer (after previous columns have painted).
 *      The fuzz effect is self-referential — the ordering is
 *      load-bearing.
 */

export const VANILLA_FUZZTABLE = 50;
export const VANILLA_FUZZ_COLORMAP_INDEX = 6;
export const VANILLA_FUZZ_COLORMAP_OFFSET = VANILLA_FUZZ_COLORMAP_INDEX * 256;

/**
 * Vanilla fuzz offsets: 50 entries of `±1` matching r_draw.c
 * `fuzzoffset[]` byte-for-byte.  Mirrors `src/render/fuzz.ts`
 * `FUZZ_OFFSETS` (the canonical authoritative table).  Encoded as
 * `±1` rows; callers multiply by the runtime framebuffer stride.
 */
export const VANILLA_FUZZ_OFFSET_PATTERN: readonly number[] = Object.freeze([
  +1, -1, +1, -1, +1, +1, -1, +1, +1, -1, +1, +1, +1, -1, +1, +1, +1, -1, -1, -1, -1, +1, -1, -1, +1, +1, +1, +1, -1, +1, -1, +1, +1, -1, -1, +1, +1, -1, -1, -1, -1, +1, +1, +1, +1, -1, +1, +1, -1, +1,
]);

/** Apply the top-border clamp: `if (dc_yl == 0) dc_yl = 1`. */
export function vanillaFuzzClampYl(yl: number): number {
  return yl === 0 ? 1 : yl;
}

/** Apply the bottom-border clamp: `if (dc_yh == viewheight - 1) dc_yh = viewheight - 2`. */
export function vanillaFuzzClampYh(yh: number, viewHeight: number): number {
  return yh === viewHeight - 1 ? viewHeight - 2 : yh;
}

/**
 * Advance the fuzz counter: `if (++fuzzpos == FUZZTABLE) fuzzpos = 0`.
 * Returns the new fuzzpos.
 */
export function vanillaFuzzAdvancePos(fuzzPos: number): number {
  const next = fuzzPos + 1;
  return next === VANILLA_FUZZTABLE ? 0 : next;
}
