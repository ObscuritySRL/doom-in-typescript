/**
 * Player movement, thrust, bob, and viewheight (p_user.c).
 *
 * Implements P_Thrust, P_CalcHeight, and P_MovePlayer from Chocolate Doom 2.2.1.
 * P_Thrust applies momentum along an angle. P_CalcHeight computes the view bob
 * oscillation and adjusts viewheight/viewz. P_MovePlayer processes cmd.forwardmove
 * and cmd.sidemove into thrust, updates mo.angle, and triggers run animation.
 *
 * @example
 * ```ts
 * import { movePlayer, calcHeight } from "../src/player/movement.ts";
 * movePlayer(player, setMobjStateFn);
 * calcHeight(player, leveltime);
 * ```
 */

import type { Fixed } from '../core/fixed.ts';
import type { Angle } from '../core/angle.ts';

import { FRACBITS, FRACUNIT, fixedMul } from '../core/fixed.ts';
import { ANG90 } from '../core/angle.ts';
import { ANGLETOFINESHIFT, FINEANGLES, FINEMASK, finecosine, finesine } from '../core/trig.ts';

import type { Player } from './playerSpawn.ts';
import { PlayerState } from './playerSpawn.ts';

import type { Mobj } from '../world/mobj.ts';
import { STATES, StateNum } from '../world/mobj.ts';
import { VIEWHEIGHT } from '../world/zMovement.ts';

// ── Constants ────────────────────────────────────────────────────────

/** Maximum view bob amplitude: 16 pixels in fixed-point (0x100000). */
export const MAXBOB: Fixed = 0x10_0000;

/**
 * CF_NOMOMENTUM cheat flag from d_player.h.
 *
 * When set in player.cheats, P_CalcHeight skips the bob oscillation
 * and uses raw viewheight for viewz.
 */
export const CF_NOMOMENTUM = 4;

/**
 * Movement scale factor: cmd.forwardmove/sidemove are multiplied by
 * 2048 (0x800) before being passed to P_Thrust, converting the int8
 * movement value into a fixed-point velocity delta.
 */
export const MOVE_SCALE = 2048;

// ── P_Thrust ─────────────────────────────────────────────────────────

/**
 * P_Thrust: apply momentum to a player's mobj along a given angle.
 *
 * Matches p_user.c P_Thrust exactly: shifts the BAM angle down to
 * a fine angle index, then adds FixedMul(move, cos/sin) to momx/momy.
 *
 * @param player - The player whose mobj receives the thrust.
 * @param angle - BAM angle for the thrust direction.
 * @param move - Fixed-point movement magnitude.
 */
export function thrust(player: Player, angle: Angle, move: Fixed): void {
  const mobj = player.mo!;
  const fineAngle = (angle >>> ANGLETOFINESHIFT) & FINEMASK;
  mobj.momx = (mobj.momx + fixedMul(move, finecosine[fineAngle]!)) | 0;
  mobj.momy = (mobj.momy + fixedMul(move, finesine[fineAngle]!)) | 0;
}

// ── P_CalcHeight ─────────────────────────────────────────────────────

/**
 * P_CalcHeight: calculate the walking/running height adjustment.
 *
 * Matches p_user.c P_CalcHeight exactly:
 * 1. Compute bob = (momx² + momy²) >> 2, clamped to MAXBOB.
 * 2. If CF_NOMOMENTUM or !onground: viewz = z + VIEWHEIGHT, clamp
 *    to ceiling - 4*FRACUNIT, then override to z + viewheight (vanilla quirk).
 * 3. Otherwise: compute oscillating bob from finesine LUT, advance
 *    viewheight toward VIEWHEIGHT via deltaviewheight, and set
 *    viewz = z + viewheight + bob.
 *
 * Parity-critical: the CF_NOMOMENTUM/airborne path sets viewz twice —
 * first to z+VIEWHEIGHT (clamped to ceiling), then unconditionally to
 * z+viewheight. This is a vanilla bug preserved for parity.
 *
 * @param player - The player to compute view height for.
 * @param leveltime - Current level tic count (drives bob oscillation).
 * @param onground - Whether the player's mobj is on the ground.
 */
export function calcHeight(player: Player, leveltime: number, onground: boolean): void {
  const mobj = player.mo!;

  // Regular movement bobbing (calculated even when airborne, for gun swing).
  player.bob = (fixedMul(mobj.momx, mobj.momx) + fixedMul(mobj.momy, mobj.momy)) | 0;
  player.bob >>= 2;

  if (player.bob > MAXBOB) {
    player.bob = MAXBOB;
  }

  if (player.cheats & CF_NOMOMENTUM || !onground) {
    player.viewz = (mobj.z + VIEWHEIGHT) | 0;

    const ceilingLimit = (mobj.ceilingz - 4 * FRACUNIT) | 0;
    if (player.viewz > ceilingLimit) {
      player.viewz = ceilingLimit;
    }

    // Vanilla quirk: unconditionally overwrite viewz with z + viewheight.
    player.viewz = (mobj.z + player.viewheight) | 0;
    return;
  }

  // Oscillating bob based on leveltime.
  const bobAngle = (((FINEANGLES / 20) * leveltime) | 0) & FINEMASK;
  const bob = fixedMul((player.bob / 2) | 0, finesine[bobAngle]!);

  // Advance viewheight toward VIEWHEIGHT.
  if (player.playerstate === PlayerState.LIVE) {
    player.viewheight = (player.viewheight + player.deltaviewheight) | 0;

    if (player.viewheight > VIEWHEIGHT) {
      player.viewheight = VIEWHEIGHT;
      player.deltaviewheight = 0;
    }

    const halfViewheight = (VIEWHEIGHT / 2) | 0;
    if (player.viewheight < halfViewheight) {
      player.viewheight = halfViewheight;
      if (player.deltaviewheight <= 0) {
        player.deltaviewheight = 1;
      }
    }

    if (player.deltaviewheight) {
      player.deltaviewheight = (player.deltaviewheight + ((FRACUNIT / 4) | 0)) | 0;
      if (!player.deltaviewheight) {
        player.deltaviewheight = 1;
      }
    }
  }

  player.viewz = (mobj.z + player.viewheight + bob) | 0;

  const ceilingClamp = (mobj.ceilingz - 4 * FRACUNIT) | 0;
  if (player.viewz > ceilingClamp) {
    player.viewz = ceilingClamp;
  }
}

// ── P_MovePlayer ─────────────────────────────────────────────────────

/**
 * Callback type for P_SetMobjState, used by movePlayer to trigger
 * the run animation when the player starts moving.
 */
export type SetMobjStateFunction = (mobj: Mobj, state: StateNum) => boolean;

/**
 * P_MovePlayer: process player movement from the ticcmd.
 *
 * Matches p_user.c P_MovePlayer exactly:
 * 1. Apply angleturn to mo.angle (left-shifted by FRACBITS).
 * 2. Determine onground = (mo.z <= mo.floorz).
 * 3. If forwardmove && onground: thrust forward at mo.angle.
 * 4. If sidemove && onground: thrust sideways at mo.angle - ANG90.
 * 5. If moving and in S_PLAY state: set to S_PLAY_RUN1.
 *
 * Returns the onground flag so the caller can pass it to calcHeight.
 *
 * @param player - The player to move.
 * @param setMobjState - Optional callback for run animation state change.
 * @returns Whether the player is on the ground.
 */
export function movePlayer(player: Player, setMobjState?: SetMobjStateFunction): boolean {
  const mobj = player.mo!;
  const cmd = player.cmd;

  // Apply turn angle (angleturn << FRACBITS, unsigned 32-bit wrap).
  mobj.angle = (mobj.angle + (cmd.angleturn << FRACBITS)) >>> 0;

  // Determine ground contact.
  const onground = mobj.z <= mobj.floorz;

  if (cmd.forwardmove && onground) {
    thrust(player, mobj.angle, (cmd.forwardmove * MOVE_SCALE) | 0);
  }

  if (cmd.sidemove && onground) {
    thrust(player, (mobj.angle - ANG90) >>> 0, (cmd.sidemove * MOVE_SCALE) | 0);
  }

  // Trigger run animation if moving and in standing state.
  if ((cmd.forwardmove || cmd.sidemove) && mobj.state === STATES[StateNum.PLAY]) {
    if (setMobjState !== undefined) {
      setMobjState(mobj, StateNum.PLAY_RUN1);
    }
  }

  return onground;
}
