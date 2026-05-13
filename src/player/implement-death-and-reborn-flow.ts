/**
 * Vanilla DOOM 1.9 P_DeathThink view-fall and reborn-trigger contract.
 *
 * From Chocolate Doom 2.2.1 p_user.c P_DeathThink:
 *   if (player->viewheight > 6*FRACUNIT)
 *       player->viewheight -= FRACUNIT;
 *   if (player->viewheight < 6*FRACUNIT)
 *       player->viewheight = 6*FRACUNIT;
 *   player->deltaviewheight = 0;
 *   ...
 *   if (player->cmd.buttons & BT_USE)
 *       player->playerstate = PST_REBORN;
 *
 * Vanilla does NOT gate reborn on attackdown — the use button alone moves the
 * player into PST_REBORN. The deathmatch RESPAWN_TIME=10 tic delay is enforced
 * by P_DeathThink's caller, not P_DeathThink itself.
 */

import { FRACBITS, type Fixed } from '../core/fixed.ts';

export const VANILLA_DEAD_VIEWHEIGHT_FIXED: Fixed = (6 << FRACBITS) | 0;
export const VANILLA_DEAD_VIEWHEIGHT_DROP_FIXED: Fixed = 1 << FRACBITS;
export const VANILLA_DEATHMATCH_RESPAWN_DELAY_TICS = 10;

export const PLAYER_STATE_LIVE = 0;
export const PLAYER_STATE_DEAD = 1;
export const PLAYER_STATE_REBORN = 2;

export type PlayerState = typeof PLAYER_STATE_LIVE | typeof PLAYER_STATE_DEAD | typeof PLAYER_STATE_REBORN;

export interface DeathThinkInput {
  readonly viewHeightFixed: Fixed;
  readonly useButtonPressed: boolean;
}

export interface DeathThinkResult {
  readonly viewHeightFixed: Fixed;
  readonly deltaViewHeightFixed: Fixed;
  readonly transitionsToReborn: boolean;
}

export function stepVanillaDeathThink(input: DeathThinkInput): DeathThinkResult {
  let viewHeight = input.viewHeightFixed;
  if (viewHeight > VANILLA_DEAD_VIEWHEIGHT_FIXED) {
    viewHeight = (viewHeight - VANILLA_DEAD_VIEWHEIGHT_DROP_FIXED) | 0;
  }
  if (viewHeight < VANILLA_DEAD_VIEWHEIGHT_FIXED) {
    viewHeight = VANILLA_DEAD_VIEWHEIGHT_FIXED;
  }
  return Object.freeze({
    viewHeightFixed: viewHeight,
    deltaViewHeightFixed: 0,
    transitionsToReborn: input.useButtonPressed,
  });
}
