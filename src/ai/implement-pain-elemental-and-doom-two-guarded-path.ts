/**
 * Vanilla DOOM 1.9 Pain Elemental (MT_PAIN) Doom II guarded path contract.
 *
 * The Pain Elemental (MT_PAIN=21) is a DOOM 2 enemy. In DOOM 1 IWADs
 * (shareware/registered/retail), MT_PAIN does not appear and its spawn
 * is guarded by gamemode at P_SpawnMapThing.
 *
 * From Chocolate Doom 2.2.1 p_enemy.c A_PainAttack / A_PainShootSkull:
 *   - Spawns up to 21 lost souls (MAXSOULS) per pain elemental at any time.
 *   - Each shot consumes 1 soul slot; on death, A_PainDie spawns 3 lost souls
 *     at 90-degree intervals.
 *
 * MAXSOULS = 21 (vanilla limit on lost souls per pain elemental from p_enemy.c).
 */

export const VANILLA_MT_PAIN = 21;
export const VANILLA_MAX_SOULS_PER_PAIN_ELEMENTAL = 21;
export const VANILLA_PAIN_DIE_LOST_SOUL_COUNT = 3;
export const VANILLA_PAIN_DIE_ANGLE_INTERVAL_BAM = 0x40000000; // ANG90

export type DoomGameMode = 'shareware' | 'registered' | 'retail' | 'commercial';

export function isPainElementalAllowedInGameMode(mode: DoomGameMode): boolean {
  return mode === 'commercial';
}
