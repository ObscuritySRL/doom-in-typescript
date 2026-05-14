/**
 * Vanilla DOOM 1.9 automap line / grid / thing color palette indices.
 *
 * From Chocolate Doom 2.2.1 am_map.c #defines (these are PLAYPAL indices):
 *   BACKGROUND       = 0    (black)
 *   WALLCOLORS       = 23   (gray; solid one-sided walls)
 *   TSWALLCOLORS     = 96   (cyan; two-sided wall with no elev change)
 *   FDWALLCOLORS     = 75   (brown; two-sided wall, floor elev differs)
 *   CDWALLCOLORS     = 76   (yellow; two-sided wall, ceiling elev differs)
 *   THINGCOLORS      = 112  (green; thing arrows)
 *   SECRETWALLCOLORS = 252  (purple; secret sector hint when revealed)
 *   GRIDCOLORS       = 104  (gray; grid overlay)
 *   XHAIRCOLORS      = 4    (red; pan-mode crosshair)
 *
 * Player arrow uses WHITE (PLAYPAL 4 entry actually: WHITE def is 4 in
 * single-player). Net-game arrow colors are per-player constants in am_map.c.
 */

export const VANILLA_AM_BACKGROUND = 0;
export const VANILLA_AM_WALLCOLORS = 23;
export const VANILLA_AM_TSWALLCOLORS = 96;
export const VANILLA_AM_FDWALLCOLORS = 75;
export const VANILLA_AM_CDWALLCOLORS = 76;
export const VANILLA_AM_THINGCOLORS = 112;
export const VANILLA_AM_SECRETWALLCOLORS = 252;
export const VANILLA_AM_GRIDCOLORS = 104;
export const VANILLA_AM_XHAIRCOLORS = 4;

export const VANILLA_AM_PALETTE = Object.freeze({
  background: VANILLA_AM_BACKGROUND,
  wall: VANILLA_AM_WALLCOLORS,
  twoSidedWall: VANILLA_AM_TSWALLCOLORS,
  floorDiffWall: VANILLA_AM_FDWALLCOLORS,
  ceilingDiffWall: VANILLA_AM_CDWALLCOLORS,
  thing: VANILLA_AM_THINGCOLORS,
  secretWall: VANILLA_AM_SECRETWALLCOLORS,
  grid: VANILLA_AM_GRIDCOLORS,
  crosshair: VANILLA_AM_XHAIRCOLORS,
} as const);
