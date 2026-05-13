/**
 * Vanilla DOOM 1.9 door special constants from p_doors.c.
 *
 * Door speed: VDOORSPEED = 2 << FRACBITS = 131072 fixed (2 map units/tic).
 * Door wait:  VDOORWAIT  = 150 tics (4.28 seconds at 35 Hz) before close.
 * Door behavior is a four-state machine:
 *   - normal: open → wait → close
 *   - close: lower from ceiling to floor
 *   - open: raise from floor to ceiling, then idle
 *   - close30Then: close, wait 30 tics, then re-open (Doom2 close-then-open)
 *   - raiseIn5Mins: wait 5 minutes (10500 tics), then open (slow doors)
 *
 * Door state enum from p_spec.h vldoor_e:
 *   vld_normal=0, vld_close30Then=1, vld_close=2, vld_open=3, vld_raiseIn5Mins=4
 *   blue/yellow/red keys check before activation; see EV_DoLockedDoor.
 */

import { FRACBITS, type Fixed } from '../core/fixed.ts';

export const VANILLA_VDOORSPEED_FIXED: Fixed = (2 << FRACBITS) | 0;
export const VANILLA_VDOORWAIT_TICS = 150;
export const VANILLA_RAISE_IN_5_MINS_TICS = 35 * 5 * 60; // 10500

export const VLD_NORMAL = 0;
export const VLD_CLOSE30THEN = 1;
export const VLD_CLOSE = 2;
export const VLD_OPEN = 3;
export const VLD_RAISE_IN_5_MINS = 4;

export type VanillaDoorType = typeof VLD_NORMAL | typeof VLD_CLOSE30THEN | typeof VLD_CLOSE | typeof VLD_OPEN | typeof VLD_RAISE_IN_5_MINS;
