/**
 * Vanilla DOOM 1.9 P_Thrust and player friction contract.
 *
 * From Chocolate Doom 2.2.1 p_user.c P_Thrust:
 *   void P_Thrust (player_t* player, angle_t angle, fixed_t move)
 *   {
 *     angle >>= ANGLETOFINESHIFT;
 *     player->mo->momx += FixedMul(move, finecosine[angle]);
 *     player->mo->momy += FixedMul(move, finesine[angle]);
 *   }
 *
 * Player friction is shared with mobj friction in p_mobj.c P_XYMovement:
 *   if (player.mo.flags & MF_NOCLIP) noop;
 *   else apply FRICTION (0xE800) when momx/momy crosses STOPSPEED (0x1000).
 *
 * The thrust call in P_MovePlayer scales the ticcmd forward/side units by
 * the PLAYER_THRUST_SCALE = 2048 factor pinned by step 07-004.
 */

import { FRICTION, STOPSPEED } from '../world/xyMovement.ts';
import type { Fixed } from '../core/fixed.ts';

export const VANILLA_PLAYER_FRICTION: Fixed = FRICTION;
export const VANILLA_PLAYER_STOPSPEED: Fixed = STOPSPEED;
export const VANILLA_ANGLETOFINESHIFT = 19;

export function angleToFineIndex(angle: number): number {
  return (angle >>> VANILLA_ANGLETOFINESHIFT) & 0x1fff;
}

export function applyVanillaPlayerFriction(momentum: Fixed): Fixed {
  if (momentum > -VANILLA_PLAYER_STOPSPEED && momentum < VANILLA_PLAYER_STOPSPEED) {
    return 0;
  }
  return Math.imul(momentum, VANILLA_PLAYER_FRICTION) >> 16;
}
