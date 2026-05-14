/**
 * Vanilla DOOM 1.9 automap mark contract.
 *
 * From Chocolate Doom 2.2.1 am_map.c AM_addMark, AM_clearMarks, AM_drawMarks:
 *   markpoints[AM_NUMMARKPOINTS] = array of marks.
 *   AM_NUMMARKPOINTS = 10 (maximum simultaneous marks).
 *
 *   Marks are numbered 0..9 and use patches AMMNUM0..AMMNUM9.
 *   marknum increments and wraps after the 10th mark.
 *
 *   Patches: AMMNUM0..AMMNUM9 (5px wide each).
 */

export const VANILLA_AM_NUMMARKPOINTS = 10;
export const VANILLA_AM_MARK_PATCH_PREFIX = 'AMMNUM';
export const VANILLA_AM_MARK_WIDTH = 5;
