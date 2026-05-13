/**
 * Vanilla DOOM 1.9 forward/side/turn movement speed tables.
 *
 * From Chocolate Doom 2.2.1 g_game.c G_BuildTiccmd:
 *   - forwardmove[2] = {0x19, 0x32} = {25, 50}    (walk, run)
 *   - sidemove[2]    = {0x18, 0x28} = {24, 40}    (walk, run)
 *   - angleturn[3]   = {640, 1280, 320}           (normal, fast, slow-ramp)
 *   - SLOWTURNTICS   = 6                          (slow-ramp duration)
 *   - MAXPLMOVE      = forwardmove[1] = 50        (clamp magnitude)
 *
 * The slow-start angleturn (index 2) applies for the first SLOWTURNTICS the
 * turn key is held, giving a brief acceleration ramp at the start of a turn.
 *
 * Player thrust applies forwardmove and sidemove through P_Thrust(player,
 * angle, FixedMul(2048, forwardmove)) — the 2048 scaling translates ticcmd
 * units into fixed-point velocity deltas in P_PlayerThink.
 */

import { ANGLE_TURN, FORWARD_MOVE, MAXPLMOVE, SIDE_MOVE, SLOW_TURN_TICS } from '../input/ticcmd.ts';

export const VANILLA_FORWARD_MOVE = FORWARD_MOVE;
export const VANILLA_SIDE_MOVE = SIDE_MOVE;
export const VANILLA_ANGLE_TURN = ANGLE_TURN;
export const VANILLA_SLOW_TURN_TICS = SLOW_TURN_TICS;
export const VANILLA_MAX_PLAYER_MOVE = MAXPLMOVE;

/**
 * P_Thrust scales ticcmd forward/side units by this constant before applying
 * them as fixed-point velocity deltas. Encodes the 2048 multiplier from
 * P_PlayerThink in vanilla p_user.c.
 */
export const VANILLA_PLAYER_THRUST_SCALE = 2048;

export function pickAngleTurnForHoldDurationTics(holdDurationTics: number, isFastTurn: boolean): number {
  if (holdDurationTics < VANILLA_SLOW_TURN_TICS) {
    return VANILLA_ANGLE_TURN[2];
  }
  return isFastTurn ? VANILLA_ANGLE_TURN[1] : VANILLA_ANGLE_TURN[0];
}

export function clampMovementToMaxPlayerMove(value: number): number {
  if (value > VANILLA_MAX_PLAYER_MOVE) {
    return VANILLA_MAX_PLAYER_MOVE;
  }
  if (value < -VANILLA_MAX_PLAYER_MOVE) {
    return -VANILLA_MAX_PLAYER_MOVE;
  }
  return value;
}
