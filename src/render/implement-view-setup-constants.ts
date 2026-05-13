/**
 * Vanilla DOOM 1.9 view-setup constants and R_ExecuteSetViewSize derivations.
 *
 * From Chocolate Doom 2.2.1 r_main.c R_ExecuteSetViewSize and doomdef.h:
 *
 *   #define SCREENWIDTH   320
 *   #define SCREENHEIGHT  200
 *   #define ST_HEIGHT     32         // status bar height
 *
 *   // screenblocks ranges 3..11
 *   //   3..10 = status bar visible (view = 200-32 = 168 px tall when sb visible)
 *   //   11    = full screen (view = 200 px tall, status bar hidden)
 *
 *   void R_ExecuteSetViewSize(void)
 *   {
 *       setsizeneeded = false;
 *
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
 *
 *       detailshift = setdetail;
 *       viewwidth = scaledviewwidth >> detailshift;
 *       centery = viewheight / 2;
 *       centerx = viewwidth / 2;
 *       centerxfrac = centerx << FRACBITS;
 *       centeryfrac = centery << FRACBITS;
 *       projection = centerxfrac;
 *       ...
 *   }
 *
 * Notes for parity:
 *   - SCREENWIDTH=320, SCREENHEIGHT=200 are hard-coded.
 *   - ST_HEIGHT=32 is the status bar height; the visible view area is
 *     SCREENHEIGHT - ST_HEIGHT = 168 px when the status bar is visible.
 *   - viewheight = (setblocks * 168 / 10) & ~7 — the &~7 rounds DOWN to a multiple of 8.
 *   - setblocks 11 special-cases full-screen (viewheight=200, status bar hidden).
 *   - scaledviewwidth = setblocks * 32 for screenblocks 3..10 (gives 96..320).
 *   - detailshift: 0=high detail (full width), 1=low detail (half width pixels doubled).
 *   - viewwidth = scaledviewwidth >> detailshift.
 *   - centerx = viewwidth / 2, centery = viewheight / 2.
 */

import { FRACBITS } from '../core/fixed.ts';

export const VANILLA_SCREEN_WIDTH = 320;
export const VANILLA_SCREEN_HEIGHT = 200;
export const VANILLA_STATUS_BAR_HEIGHT = 32;
export const VANILLA_VIEW_AREA_HEIGHT = VANILLA_SCREEN_HEIGHT - VANILLA_STATUS_BAR_HEIGHT;

export interface ViewSetupInput {
  readonly setblocks: number;
  readonly setdetail: number;
}

export interface ViewSetupResult {
  readonly scaledviewwidth: number;
  readonly viewheight: number;
  readonly viewwidth: number;
  readonly detailshift: number;
  readonly centerx: number;
  readonly centery: number;
  readonly centerxfrac: number;
  readonly centeryfrac: number;
  readonly projection: number;
  readonly statusBarHidden: boolean;
}

export function executeVanillaSetViewSize(input: ViewSetupInput): ViewSetupResult {
  const setblocks = input.setblocks;
  const setdetail = input.setdetail;

  let scaledviewwidth: number;
  let viewheight: number;
  let statusBarHidden = false;
  if (setblocks === 11) {
    scaledviewwidth = VANILLA_SCREEN_WIDTH;
    viewheight = VANILLA_SCREEN_HEIGHT;
    statusBarHidden = true;
  } else {
    scaledviewwidth = setblocks * 32;
    viewheight = (setblocks * VANILLA_VIEW_AREA_HEIGHT) / 10;
    viewheight = Math.trunc(viewheight) & ~7;
  }

  const detailshift = setdetail;
  const viewwidth = scaledviewwidth >> detailshift;
  const centerx = viewwidth >> 1;
  const centery = viewheight >> 1;
  const centerxfrac = centerx << FRACBITS;
  const centeryfrac = centery << FRACBITS;
  const projection = centerxfrac;

  return Object.freeze({
    scaledviewwidth,
    viewheight,
    viewwidth,
    detailshift,
    centerx,
    centery,
    centerxfrac,
    centeryfrac,
    projection,
    statusBarHidden,
  });
}
