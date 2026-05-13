/**
 * Gate step 06-032: pin vanilla DOOM 1.9 world movement constants for parity.
 *
 * Aggregates the runtime constants exercised by P_XYMovement, P_ZMovement,
 * P_TryMove, and friends. Changes to any of these values mean world movement
 * has drifted from vanilla and the parity oracles must rerun.
 *
 * References (Chocolate Doom 2.2.1):
 *   - p_mobj.c: GRAVITY, FLOATSPEED, MAXMOVE, STOPSPEED, FRICTION
 *   - p_map.c:  MAXSTEPHEIGHT
 *   - p_user.c: VIEWHEIGHT
 */

import { FRICTION, MAXMOVE, STOPSPEED } from './xyMovement.ts';
import { FLOATSPEED, GRAVITY, VIEWHEIGHT } from './zMovement.ts';
import { MAXSTEPHEIGHT } from './tryMove.ts';

export const WORLD_MOVEMENT_GATE = Object.freeze({
  gravityFixed: GRAVITY,
  floatSpeedFixed: FLOATSPEED,
  viewHeightFixed: VIEWHEIGHT,
  maxMoveFixed: MAXMOVE,
  stopSpeedFixed: STOPSPEED,
  frictionFixed: FRICTION,
  maxStepHeightFixed: MAXSTEPHEIGHT,
} as const);

export type WorldMovementGate = typeof WORLD_MOVEMENT_GATE;
