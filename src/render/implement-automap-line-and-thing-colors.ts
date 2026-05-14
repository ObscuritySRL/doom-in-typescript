/**
 * Vanilla DOOM 1.9 automap line and thing color contract.
 *
 * From Chocolate Doom 2.2.1 am_map.c color palette indices:
 *   BACKGROUND       = 0     (black)
 *   WALLCOLORS       = 23    (gray)
 *   TSWALLCOLORS     = 96    (cyan - two-sided wall, change in elev)
 *   FDWALLCOLORS     = 75    (brown - floor different)
 *   CDWALLCOLORS     = 76    (yellow - ceiling different)
 *   THINGCOLORS      = 112   (green - active things)
 *   SECRETWALLCOLORS = 252   (purple - secret hint)
 *   GRIDCOLORS       = 104   (gray)
 *   XHAIRCOLORS      = 4     (red)
 *
 * Player triangle: WHITE in single-player, varies in netgame.
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
