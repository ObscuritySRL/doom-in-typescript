/**
 * Vanilla DOOM 1.9 floor special constants from p_floor.c.
 *
 * Floor speed: FLOORSPEED = 1 << FRACBITS = 65536 fixed (1 map unit/tic).
 *
 * Floor types (floor_e from p_spec.h):
 *   lowerFloor=0, lowerFloorToLowest=1, turboLower=2, raiseFloor=3,
 *   raiseFloorToNearest=4, raiseToTexture=5, lowerAndChange=6, raiseFloor24=7,
 *   raiseFloor24AndChange=8, raiseFloorCrush=9, raiseFloorTurbo=10,
 *   donutRaise=11, raiseFloor512=12
 *
 * Floor turbo speed: 4 << FRACBITS (4 map units/tic, raiseFloorTurbo).
 * Floor crush damage: 10 (vanilla CRUSHDAMAGE), every 4 tics.
 */

import { FRACBITS, type Fixed } from '../core/fixed.ts';

export const VANILLA_FLOORSPEED_FIXED: Fixed = (1 << FRACBITS) | 0;
export const VANILLA_FLOORSPEED_TURBO_FIXED: Fixed = (4 << FRACBITS) | 0;
export const VANILLA_FLOOR_CRUSH_DAMAGE = 10;
export const VANILLA_FLOOR_CRUSH_TIC_INTERVAL = 4;

export const FLOOR_LOWER = 0;
export const FLOOR_LOWER_TO_LOWEST = 1;
export const FLOOR_TURBO_LOWER = 2;
export const FLOOR_RAISE = 3;
export const FLOOR_RAISE_TO_NEAREST = 4;
export const FLOOR_RAISE_TO_TEXTURE = 5;
export const FLOOR_LOWER_AND_CHANGE = 6;
export const FLOOR_RAISE_24 = 7;
export const FLOOR_RAISE_24_AND_CHANGE = 8;
export const FLOOR_RAISE_CRUSH = 9;
export const FLOOR_RAISE_TURBO = 10;
export const FLOOR_DONUT_RAISE = 11;
export const FLOOR_RAISE_512 = 12;
