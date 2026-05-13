/**
 * Vanilla DOOM 1.9 P_SpawnMapThing exclusion contract for multiplayer modes.
 *
 * P_SpawnMapThing applies two multiplayer-specific exclusions:
 *   1. Things flagged MTF_NETGAME (bit 16) are not spawned in single-player.
 *   2. In deathmatch, type 11 (dm starts) are saved separately; non-DM
 *      pickups remain but coop-only pickups are filtered (vanilla treats
 *      them via deathmatch flag in info table). Player starts type 1..4
 *      are not spawned (saved as playerstarts for deferred respawn).
 */

import { VANILLA_DEATHMATCH_START_TYPE, VANILLA_MTF_NETGAME, VANILLA_PLAYER_START_TYPES } from './implement-map-spawn-thing-ordering.ts';

export type SpawnMode = 'single-player' | 'cooperative' | 'deathmatch';

export interface SpawnExclusionInput {
  readonly thingType: number;
  readonly options: number;
  readonly mode: SpawnMode;
}

export type SpawnExclusionOutcome = 'spawn' | 'save-player-start' | 'save-deathmatch-start' | 'skip-net-only-in-singleplayer';

export function classifySpawnOutcome(input: SpawnExclusionInput): SpawnExclusionOutcome {
  if ((VANILLA_PLAYER_START_TYPES as readonly number[]).includes(input.thingType)) {
    return 'save-player-start';
  }
  if (input.thingType === VANILLA_DEATHMATCH_START_TYPE) {
    return 'save-deathmatch-start';
  }
  if (input.mode === 'single-player' && (input.options & VANILLA_MTF_NETGAME) !== 0) {
    return 'skip-net-only-in-singleplayer';
  }
  return 'spawn';
}
