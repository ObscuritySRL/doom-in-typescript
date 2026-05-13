/**
 * Vanilla DOOM 1.9 stairs, donut, and crusher special constants.
 *
 * Stairs (p_floor.c EV_BuildStairs):
 *   build_8:  speed = FLOORSPEED/4 = 0.25 fixed/tic, step height = 8.
 *   build_16: speed = 4 * FLOORSPEED = 4 fixed/tic, step height = 16 (turbo).
 *
 * Donut (p_floor.c EV_DoDonut):
 *   pillar_speed = FLOORSPEED / 2 = 0.5 fixed/tic
 *   donut_speed  = FLOORSPEED / 2 = 0.5 fixed/tic
 *
 * Crusher: lowerAndCrush, crushAndRaise share CEILSPEED; fastCrushAndRaise
 *   uses 2 * CEILSPEED (=2 fixed/tic).
 */

import { FRACBITS, type Fixed } from '../core/fixed.ts';

export const VANILLA_STAIRS_BUILD_8_SPEED_FIXED: Fixed = (1 << FRACBITS) >> 2; // FLOORSPEED/4
export const VANILLA_STAIRS_BUILD_16_SPEED_FIXED: Fixed = (4 << FRACBITS) | 0; // 4 * FLOORSPEED
export const VANILLA_STAIRS_BUILD_8_STEP_HEIGHT_MAPUNITS = 8;
export const VANILLA_STAIRS_BUILD_16_STEP_HEIGHT_MAPUNITS = 16;

export const VANILLA_DONUT_PILLAR_SPEED_FIXED: Fixed = (1 << FRACBITS) >> 1; // FLOORSPEED/2
export const VANILLA_DONUT_FLOOR_SPEED_FIXED: Fixed = (1 << FRACBITS) >> 1;

export const VANILLA_CRUSHER_SPEED_FIXED: Fixed = (1 << FRACBITS) | 0;
export const VANILLA_CRUSHER_FAST_SPEED_FIXED: Fixed = (2 << FRACBITS) | 0;
