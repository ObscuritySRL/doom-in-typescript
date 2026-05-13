/**
 * Vanilla DOOM 1.9 P_SpawnPlayer contract.
 *
 * From Chocolate Doom 2.2.1 p_mobj.c P_SpawnPlayer:
 *   - The spawned mobj for a player has MF_SOLID | MF_SHOOTABLE | MF_DROPOFF |
 *     MF_PICKUP | MF_NOTDMATCH flags (NOTDMATCH only in coop, dropped in DM).
 *   - mobj health is set to the player's current health (handles preserved
 *     state across hubs).
 *   - mobj->player is bound to the player and player.mo references the mobj.
 *   - viewheight = VIEWHEIGHT (41 * FRACUNIT) and view-state is reset:
 *     viewz = mobj.z + viewheight, deltaviewheight = 0, bob = 0.
 *   - readyweapon/pendingweapon are not touched by P_SpawnPlayer itself
 *     (G_PlayerReborn handles initial loadout in deathmatch/respawn).
 *   - playerstate = PST_LIVE.
 */

import type { Fixed } from '../core/fixed.ts';
import { VIEWHEIGHT } from '../world/zMovement.ts';

export const VANILLA_PLAYER_VIEWHEIGHT: Fixed = VIEWHEIGHT;

export interface PlayerSpawnInput {
  readonly mobjZ: Fixed;
  readonly currentHealth: number;
}

export interface PlayerSpawnViewState {
  readonly viewz: Fixed;
  readonly viewheight: Fixed;
  readonly deltaviewheight: Fixed;
  readonly bob: Fixed;
}

export function computeSpawnedPlayerViewState(input: PlayerSpawnInput): PlayerSpawnViewState {
  return Object.freeze({
    viewz: (input.mobjZ + VANILLA_PLAYER_VIEWHEIGHT) | 0,
    viewheight: VANILLA_PLAYER_VIEWHEIGHT,
    deltaviewheight: 0,
    bob: 0,
  });
}
