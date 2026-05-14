/**
 * Vanilla DOOM 1.9 status bar key and ammo widgets contract.
 *
 * From Chocolate Doom 2.2.1 st_stuff.c:
 *   Ammo widget positions (small numbers under face):
 *     bullets:  ST_AMMO0_WIDTH ammo bar at x=288, y=171
 *     shells:   x=288, y=179
 *     rockets:  x=288, y=187
 *     cells:    x=288, y=195
 *     maxammo column at x=314.
 *
 *   Key icons (3 columns × keycard + skull pairs):
 *     ST_KEY0X = 239 (blue key column)
 *     ST_KEY1X = 239 (yellow key column - same x, different y)
 *     ST_KEY2X = 239 (red key column - same x, different y)
 *     Y offsets: blue=171, yellow=181, red=191.
 *
 *   Patch names:
 *     STKEYS0..5 (6 key sprites: 3 keycards + 3 skull keys).
 */

export const VANILLA_ST_AMMO_TYPES_Y = Object.freeze([171, 179, 187, 195] as const); // bullets, shells, rockets, cells
export const VANILLA_ST_AMMO_TYPE_X = 288;
export const VANILLA_ST_MAXAMMO_X = 314;

export const VANILLA_ST_KEY_X = 239;
export const VANILLA_ST_KEY_Y = Object.freeze([171, 181, 191] as const); // blue, yellow, red

export const VANILLA_ST_KEYS_PATCH_PREFIX = 'STKEYS';
export const VANILLA_ST_NUM_KEY_SPRITES = 6;
