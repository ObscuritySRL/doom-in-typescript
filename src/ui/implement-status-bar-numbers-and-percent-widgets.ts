/**
 * Vanilla DOOM 1.9 status bar numeric widget positions.
 *
 * From Chocolate Doom 2.2.1 st_lib.c and st_stuff.c:
 *   - STTNUM0..9: tall red digits (14 px wide).
 *   - STYSNUM0..9: short yellow digits (4 px wide).
 *   - STTPRCNT: tall red percent sign.
 *   - STYSPRCNT: short yellow percent sign.
 *
 * Widget X anchors (px from screen left) and Y anchor (px from screen top):
 *   ST_HEALTHX  = 90   (player health, % sign at HEALTHX + 3*TALLNUM)
 *   ST_ARMORX   = 221  (player armor)
 *   ST_AMMOX    = 44   (active ammo count, 3-digit tall)
 *   ST_MAXAMMOX = 314  (max ammo for current ammo type)
 *   ST_FRAGSX   = 138  (deathmatch frag total when arms widget is hidden)
 *   ST_NUMBER_Y = 171  (3 px below status bar origin Y=168 so digits sit on STBAR background)
 *
 * Patch lump prefixes/names are unchanged from id source:
 *   tall digits   → STTNUM<n>
 *   short digits  → STYSNUM<n>
 *   tall percent  → STTPRCNT
 *   short percent → STYSPRCNT
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

/** Return the lump name for the tall (red) digit `digit` (0..9). */
export function tallDigitPatchName(digit: number): string {
  if (digit < 0 || digit > 9 || !Number.isInteger(digit)) {
    throw new Error(`tall digit must be integer in 0..9; got ${digit}`);
  }
  return `${VANILLA_ST_PATCH_TALLNUM_PREFIX}${digit}`;
}

/** Return the lump name for the short (yellow) digit `digit` (0..9). */
export function shortDigitPatchName(digit: number): string {
  if (digit < 0 || digit > 9 || !Number.isInteger(digit)) {
    throw new Error(`short digit must be integer in 0..9; got ${digit}`);
  }
  return `${VANILLA_ST_PATCH_SHORTNUM_PREFIX}${digit}`;
}
