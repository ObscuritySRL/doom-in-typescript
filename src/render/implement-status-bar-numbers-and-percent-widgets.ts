/**
 * Vanilla DOOM 1.9 status bar numbers and percent widgets contract.
 *
 * From Chocolate Doom 2.2.1 st_lib.c and st_stuff.c:
 *   STTNUM0..9 — large red numbers (0-9, 18 pixels wide).
 *   STYSNUM0..9 — small yellow numbers (10 pixels wide).
 *   STTPRCNT — large red percent sign.
 *   STYSPRCNT — small yellow percent sign.
 *
 *   Number widget positions:
 *     ST_HEALTHX = 90 (health %)
 *     ST_ARMORX = 221 (armor %)
 *     ST_AMMOX = 44 (current ammo, 3-digit)
 *     ST_MAXAMMOX = 314 (max ammo for current type)
 *     ST_FRAGSX = 138 (deathmatch frag count)
 *
 *   Number Y offset: ST_NUMBERY = 171 (3 pixels below ST_Y=168, large numbers).
 */

export const VANILLA_ST_HEALTHX = 90;
export const VANILLA_ST_ARMORX = 221;
export const VANILLA_ST_AMMOX = 44;
export const VANILLA_ST_MAXAMMOX = 314;
export const VANILLA_ST_FRAGSX = 138;
export const VANILLA_ST_NUMBER_Y = 171;

export const VANILLA_ST_TALLNUM_WIDTH = 14;
export const VANILLA_ST_SHORTNUM_WIDTH = 4;

export const VANILLA_ST_PATCH_TALLNUM_PREFIX = 'STTNUM';
export const VANILLA_ST_PATCH_SHORTNUM_PREFIX = 'STYSNUM';
export const VANILLA_ST_PATCH_TALL_PERCENT = 'STTPRCNT';
export const VANILLA_ST_PATCH_SHORT_PERCENT = 'STYSPRCNT';
