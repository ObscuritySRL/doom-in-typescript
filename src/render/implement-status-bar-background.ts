/**
 * Vanilla DOOM 1.9 status bar background contract.
 *
 * From Chocolate Doom 2.2.1 st_stuff.c ST_drawWidgets and st_main.c:
 *   Status bar background patch: STBAR (320 x 32 pixels at bottom of screen).
 *   In DOOM 2 / fullscreen variants, ARMS box overlays STBAR with STARMS
 *   when player owns 2+ weapon types.
 *
 *   ST_HEIGHT = 32 pixels.
 *   ST_WIDTH = 320 pixels.
 *   ST_Y = 200 - 32 = 168 (y offset from screen top).
 */

export const VANILLA_ST_HEIGHT = 32;
export const VANILLA_ST_WIDTH = 320;
export const VANILLA_ST_Y_OFFSET = 168;
export const VANILLA_STATUS_BAR_PATCH_NAME = 'STBAR';
export const VANILLA_STATUS_BAR_ARMS_PATCH_NAME = 'STARMS';
