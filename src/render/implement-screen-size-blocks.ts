/**
 * Vanilla DOOM 1.9 screen size blocks contract.
 *
 * From Chocolate Doom 2.2.1 r_main.c `R_SetViewSize` and
 * `R_ExecuteSetViewSize`:
 *
 *   void R_SetViewSize (int blocks, int detail)
 *   {
 *       setsizeneeded = true;
 *       setblocks = blocks;
 *       setdetail = detail;
 *   }
 *
 *   void R_ExecuteSetViewSize (void)
 *   {
 *       setsizeneeded = false;
 *       if (setblocks == 11)
 *       {
 *           scaledviewwidth = SCREENWIDTH;
 *           viewheight = SCREENHEIGHT;
 *       }
 *       else
 *       {
 *           scaledviewwidth = setblocks * 32;
 *           viewheight = (setblocks * 168 / 10) & ~7;
 *       }
 *       ...
 *   }
 *
 * Parity-critical invariants pinned here:
 *
 *   1. Block range is `3..11` (inclusive).  Vanilla's menu code clamps
 *      the screenblocks variable to this range.  Block 3 is the
 *      smallest viewport; block 11 is fullscreen with status bar
 *      hidden.
 *   2. Block 10 is the menu default — status bar visible with the
 *      largest viewport above it.
 *   3. Block 11 is the fullscreen mode: `scaledviewwidth = SCREENWIDTH`
 *      (320), `viewheight = SCREENHEIGHT` (200), status bar
 *      overlay-drawn on top.
 *   4. For blocks 3..10 the width and height derive from `setblocks`:
 *        scaledviewwidth = setblocks * 32
 *        viewheight = (setblocks * 168 / 10) & ~7
 *      The `168` is `SCREENHEIGHT - ST_HEIGHT = 200 - 32 = 168`; the
 *      `& ~7` floors the height to a multiple of 8 (so rows align
 *      with the visplane bucketing).
 *   5. SCREENWIDTH = 320, SCREENHEIGHT = 200, ST_HEIGHT = 32 (the
 *      status bar height).  These are vanilla constants from doomdef.h
 *      / st_stuff.h.
 */

export const VANILLA_SCREEN_BLOCK_MIN = 3;
export const VANILLA_SCREEN_BLOCK_MAX = 11;
export const VANILLA_SCREEN_BLOCK_DEFAULT = 10;
export const VANILLA_SCREEN_BLOCK_FULLSCREEN = 11;

/** Vanilla `SCREENWIDTH` (doomdef.h). */
export const VANILLA_SCREEN_WIDTH = 320;

/** Vanilla `SCREENHEIGHT` (doomdef.h). */
export const VANILLA_SCREEN_HEIGHT = 200;

/** Vanilla `ST_HEIGHT` (st_stuff.h) — status bar height. */
export const VANILLA_STATUS_BAR_HEIGHT = 32;

/** Vanilla viewport height available above the status bar = `SCREENHEIGHT - ST_HEIGHT`. */
export const VANILLA_SCREEN_HEIGHT_ABOVE_STATUS_BAR = 168;

export function isValidScreenBlock(setblocks: number): boolean {
  return setblocks >= VANILLA_SCREEN_BLOCK_MIN && setblocks <= VANILLA_SCREEN_BLOCK_MAX;
}

export function isFullscreenScreenBlock(setblocks: number): boolean {
  return setblocks === VANILLA_SCREEN_BLOCK_FULLSCREEN;
}

/**
 * Compute `scaledviewwidth` for a screenblocks value.  Mirrors
 * `R_ExecuteSetViewSize`:
 *
 *   if (setblocks == 11) scaledviewwidth = SCREENWIDTH
 *   else                 scaledviewwidth = setblocks * 32
 */
export function scaledViewWidthForScreenBlock(setblocks: number): number {
  if (setblocks === VANILLA_SCREEN_BLOCK_FULLSCREEN) return VANILLA_SCREEN_WIDTH;
  return (setblocks * 32) | 0;
}

/**
 * Compute `viewheight` for a screenblocks value.  Mirrors
 * `R_ExecuteSetViewSize`:
 *
 *   if (setblocks == 11) viewheight = SCREENHEIGHT
 *   else                 viewheight = (setblocks * 168 / 10) & ~7
 */
export function viewHeightForScreenBlock(setblocks: number): number {
  if (setblocks === VANILLA_SCREEN_BLOCK_FULLSCREEN) return VANILLA_SCREEN_HEIGHT;
  return (((setblocks * VANILLA_SCREEN_HEIGHT_ABOVE_STATUS_BAR) / 10) | 0) & ~7;
}
