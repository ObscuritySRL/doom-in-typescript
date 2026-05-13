/**
 * Vanilla DOOM 1.9 P_NightmareRespawn gate contract.
 *
 * From Chocolate Doom 2.2.1 p_mobj.c P_NightmareRespawn, three gates must pass
 * before a dead nightmare monster respawns at its original spawn point:
 *   if (mobj->movecount < 12*TICRATE) return;
 *   if (leveltime & 31)               return;
 *   if (P_Random () > 4)              return;
 *
 * - movecount counts post-death tics. With TICRATE=35, the delay is 420 tics
 *   (12 seconds).
 * - The leveltime gate gates on bits 0..4 (mask 31), so the random roll fires
 *   only once every 32 tics.
 * - The P_Random gate respawns when the random byte is <= 4 (5/256 odds).
 */

export const VANILLA_NIGHTMARE_RESPAWN_DELAY_TICS = 35 * 12;
export const VANILLA_NIGHTMARE_RESPAWN_LEVELTIME_MASK = 31;
export const VANILLA_NIGHTMARE_RESPAWN_RANDOM_THRESHOLD = 4;

export interface NightmareRespawnInput {
  readonly tics_dead: number;
  readonly leveltime: number;
  readonly random_byte: number;
  readonly respawn_monsters_enabled: boolean;
}

export function shouldRespawnNightmareMonster(input: NightmareRespawnInput): boolean {
  if (!input.respawn_monsters_enabled) {
    return false;
  }
  if (input.tics_dead < VANILLA_NIGHTMARE_RESPAWN_DELAY_TICS) {
    return false;
  }
  if ((input.leveltime & VANILLA_NIGHTMARE_RESPAWN_LEVELTIME_MASK) !== 0) {
    return false;
  }
  return input.random_byte <= VANILLA_NIGHTMARE_RESPAWN_RANDOM_THRESHOLD;
}
