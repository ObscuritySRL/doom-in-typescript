/**
 * Vanilla DOOM 1.9 automap pan/zoom/follow/grid contract.
 *
 * From Chocolate Doom 2.2.1 am_map.c:
 *   Pan keys: HOME, END, ARROWS. Each press increments map_x/y by F_PANINC.
 *   F_PANINC = 8 (pan increment in screen units per key tic).
 *   M_ZOOMIN = 1.02 fixed (zoom multiplier per tic when '+' held).
 *   M_ZOOMOUT = 1.0 / 1.02 (zoom out per tic).
 *
 *   Follow mode: AM_followPlayer toggled by 'F' key (default true).
 *   Grid mode: AM_drawGrid toggled by 'G' key (default false).
 *   Grid size: MAPBLOCKSIZE=128 fixed (matches blockmap).
 *
 *   Map keys (defaults from m_misc.c):
 *     key_map_east, key_map_west, key_map_north, key_map_south
 *     key_map_zoomin (+), key_map_zoomout (-), key_map_clearmark (c),
 *     key_map_follow (f), key_map_grid (g), key_map_mark (m), key_map_maxzoom (0).
 */

export const VANILLA_AM_F_PANINC = 8;
export const VANILLA_AM_M_ZOOMIN_FIXED = 0x10570; // 1.0214 fixed (vanilla)
export const VANILLA_AM_M_ZOOMOUT_FIXED = 0xfb00; // ~0.9805 fixed
export const VANILLA_AM_GRID_MAPBLOCKSIZE = 128;

export const VANILLA_AM_FOLLOW_DEFAULT = true;
export const VANILLA_AM_GRID_DEFAULT = false;
