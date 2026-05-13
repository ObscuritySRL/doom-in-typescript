/**
 * Vanilla DOOM 1.9 Keen and Icon of Sin contract (DOOM 2 only).
 *
 * MT_KEEN (mobj type 72) and MT_BOSSBRAIN/MT_BOSSSPIT/MT_BOSSTARGET (types
 * 78/77/76) appear only in DOOM 2 IWAD. DOOM 1 IWADs do not include these
 * sprites or mobj types, and the related actions are gated by gamemode.
 *
 * A_KeenDie (Keen death):
 *   - When all keens are dead, opens tag-666 doors via EV_DoDoor(line, opendoor).
 *
 * A_BrainSpit (Icon of Sin cube spawner):
 *   - Spawns MT_SPAWNSHOT cubes at MT_BOSSTARGET spawners at intervals.
 *
 * A_SpawnFly:
 *   - Cube transforms into random monster type from a 9-entry table on hit.
 *
 * All of these are guarded behind gamemode === 'commercial'.
 */

export const VANILLA_MT_KEEN = 72;
export const VANILLA_MT_BOSSBRAIN = 78;
export const VANILLA_MT_BOSSSPIT = 77;
export const VANILLA_MT_BOSSTARGET = 76;
export const VANILLA_MT_SPAWNSHOT = 74;

export const VANILLA_BRAIN_SPAWN_TABLE: readonly number[] = Object.freeze([
  // From p_enemy.c A_SpawnFly mt_table[]
  // troopser, demon, lostsoul, baron, hellknight, cacodemon, painelemental, fatso, arachnotron
  9, 8, 19, 15, 14, 26, 21, 67, 66,
]);

export type DoomGameMode = 'shareware' | 'registered' | 'retail' | 'commercial';

export function isKeenAllowedInGameMode(mode: DoomGameMode): boolean {
  return mode === 'commercial';
}

export function isIconOfSinAllowedInGameMode(mode: DoomGameMode): boolean {
  return mode === 'commercial';
}
