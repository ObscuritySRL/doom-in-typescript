/**
 * Vanilla DOOM 1.9 automap start/stop state contract.
 *
 * From Chocolate Doom 2.2.1 am_map.c AM_Start, AM_Stop, AM_Responder:
 *   Automap toggles via KEY_TAB. AM_Start initializes amclock=0, AM_active=true.
 *   AM_Stop sets AM_active=false. Player mobj.angle is captured for view rotation.
 *
 *   Activation state flags:
 *     AM_PANINCREMENT = FRACUNIT (1 fixed; pan key step).
 *     AM_INITSCALEMTOF = 0.2 fixed (initial zoom).
 *     AM_MINZOOM, AM_MAXZOOM (zoom bounds).
 */

import { FRACBITS, type Fixed } from '../core/fixed.ts';

export const VANILLA_AM_PAN_INCREMENT_FIXED: Fixed = (1 << FRACBITS) | 0;
export const VANILLA_AM_INIT_SCALE_MTOF_FIXED: Fixed = 0x33000; // 0.1992 fixed (vanilla initial scale)
export const VANILLA_AM_MIN_SCALE_MTOF_FIXED: Fixed = 0x10000; // 0.0625 fixed (min zoom out)
export const VANILLA_AM_MAX_SCALE_MTOF_FIXED: Fixed = 0x800000; // 32 fixed (max zoom in)

export const AM_STATE_INACTIVE = 0;
export const AM_STATE_ACTIVE = 1;

export type AutomapActiveState = typeof AM_STATE_INACTIVE | typeof AM_STATE_ACTIVE;
