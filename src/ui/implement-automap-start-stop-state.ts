/**
 * Vanilla DOOM 1.9 automap start/stop state contract.
 *
 * From Chocolate Doom 2.2.1 am_map.c AM_Start, AM_Stop, AM_Responder:
 *   - Automap toggles via KEY_TAB (AM_Responder calls AM_Start / AM_Stop).
 *   - AM_Start initializes amclock=0 and sets automapactive=true; the player
 *     mobj.angle is captured into the rotation pivot when ROTATE mode is on.
 *   - AM_Stop sets automapactive=false but preserves the per-map saved
 *     zoom/pan so a re-open continues where the user left off.
 *
 * Activation state flags:
 *   AM_PANINCREMENT  = FRACUNIT (1 fixed; arrow-key pan step per tic).
 *   AM_INITSCALEMTOF = 0x33000  (≈ 0.1992 fixed; initial map-to-frame scale).
 *   AM_MIN_SCALE_MTOF = 0x10000 (1 fixed; zoom-out floor).
 *   AM_MAX_SCALE_MTOF = 0x800000 (128 fixed; zoom-in ceiling).
 */

import { FRACBITS, type Fixed } from '../core/fixed.ts';

export const VANILLA_AM_PAN_INCREMENT_FIXED: Fixed = (1 << FRACBITS) | 0;
export const VANILLA_AM_INIT_SCALE_MTOF_FIXED: Fixed = 0x33000;
export const VANILLA_AM_MIN_SCALE_MTOF_FIXED: Fixed = 0x10000;
export const VANILLA_AM_MAX_SCALE_MTOF_FIXED: Fixed = 0x800000;

export const AM_STATE_INACTIVE = 0;
export const AM_STATE_ACTIVE = 1;

export type AutomapActiveState = typeof AM_STATE_INACTIVE | typeof AM_STATE_ACTIVE;

/** Toggle the automap state: ACTIVE → INACTIVE and vice versa. */
export function toggleAutomapState(state: AutomapActiveState): AutomapActiveState {
  return state === AM_STATE_ACTIVE ? AM_STATE_INACTIVE : AM_STATE_ACTIVE;
}
