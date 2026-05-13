/**
 * Vanilla DOOM 1.9 platform special constants from p_plats.c.
 *
 * Platform speeds and wait from PLATSPEED constants:
 *   PLATSPEED  = 1 << FRACBITS (1 map unit/tic)
 *   PLATWAIT   = 3 seconds = 3 * TICRATE = 105 tics
 *
 * Platform types (plattype_e from p_spec.h):
 *   perpetualRaise=0, downWaitUpStay=1, raiseAndChange=2, raiseToNearestAndChange=3,
 *   blazeDWUS=4
 *
 * Platform states (plat_e):
 *   up=0, down=1, waiting=2, in_stasis=3
 *
 * MAXPLATS = 30 (vanilla limit).
 */

import { FRACBITS, type Fixed } from '../core/fixed.ts';

export const VANILLA_PLATSPEED_FIXED: Fixed = (1 << FRACBITS) | 0;
export const VANILLA_PLATSPEED_BLAZE_FIXED: Fixed = (8 << FRACBITS) | 0;
export const VANILLA_PLATWAIT_TICS = 3 * 35;
export const VANILLA_MAXPLATS = 30;

export const PLAT_PERPETUAL_RAISE = 0;
export const PLAT_DOWN_WAIT_UP_STAY = 1;
export const PLAT_RAISE_AND_CHANGE = 2;
export const PLAT_RAISE_TO_NEAREST_AND_CHANGE = 3;
export const PLAT_BLAZE_DWUS = 4;

export const PLAT_STATE_UP = 0;
export const PLAT_STATE_DOWN = 1;
export const PLAT_STATE_WAITING = 2;
export const PLAT_STATE_IN_STASIS = 3;
