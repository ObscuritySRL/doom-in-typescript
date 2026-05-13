/**
 * Vanilla DOOM 1.9 ceiling special constants from p_ceilng.c.
 *
 * Ceiling speed: CEILSPEED = 1 << FRACBITS = 65536 fixed (1 map unit/tic).
 * Crusher uses CEILSPEED. Fast crusher uses 2 << FRACBITS.
 * Crush damage = 10 every 4 tics (when crushing).
 *
 * Ceiling types (ceiling_e from p_spec.h):
 *   lowerToFloor=0, raiseToHighest=1, lowerAndCrush=2, crushAndRaise=3,
 *   fastCrushAndRaise=4, silentCrushAndRaise=5
 *
 * MAXCEILINGS = 30 (vanilla limit on active ceilings).
 */

import { FRACBITS, type Fixed } from '../core/fixed.ts';

export const VANILLA_CEILSPEED_FIXED: Fixed = (1 << FRACBITS) | 0;
export const VANILLA_CEILSPEED_FAST_FIXED: Fixed = (2 << FRACBITS) | 0;
export const VANILLA_CEILING_CRUSH_DAMAGE = 10;
export const VANILLA_CEILING_CRUSH_TIC_INTERVAL = 4;
export const VANILLA_MAXCEILINGS = 30;

export const CEILING_LOWER_TO_FLOOR = 0;
export const CEILING_RAISE_TO_HIGHEST = 1;
export const CEILING_LOWER_AND_CRUSH = 2;
export const CEILING_CRUSH_AND_RAISE = 3;
export const CEILING_FAST_CRUSH_AND_RAISE = 4;
export const CEILING_SILENT_CRUSH_AND_RAISE = 5;
