/**
 * Vanilla DOOM 1.9 Nightmare respawn map state contract.
 *
 * On skill 5 (Nightmare), monsters respawn after a delay. P_NightmareRespawn:
 *   - Each monster mobj records its `spawnpoint` (original mapthing).
 *   - After the monster dies, its corpse decays via `movecount` / `reactiontime`.
 *   - Respawn fires after RESPAWN_TIME (35*12 = 420 tics, i.e., 12 seconds at
 *     35 Hz) of being dead, AND a P_Random gate passes.
 *   - On respawn, P_TeleFog at original spawn point; original mobj removed;
 *     new mobj spawned from spawnpoint with original type and angle.
 */

export const VANILLA_NIGHTMARE_RESPAWN_DELAY_TICS = 35 * 12;
export const VANILLA_NIGHTMARE_RESPAWN_RANDOM_GATE = 4;

export interface NightmareRespawnInput {
  readonly tics_dead: number;
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
  return (input.random_byte & 3) === 0;
}
