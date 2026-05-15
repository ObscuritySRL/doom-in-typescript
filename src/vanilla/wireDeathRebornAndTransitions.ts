/**
 * Vanilla DOOM 1.9 death / reborn / transition wiring facade.
 *
 * Plan_final step `08-009` (lane: map-world) wires the player
 * death-think, the reborn/respawn reset, and the post-death
 * transitions (map reload, intermission entry, finale entry, title
 * return) over the read-only
 * `src/player/implement-death-and-reborn-flow.ts` (the
 * `P_DeathThink` step) and `src/player/playerSpawn.ts`
 * (`G_PlayerReborn` / `P_SpawnPlayer`).
 *
 * Those modules already implement the byte-exact p_user.c
 * `P_DeathThink` and g_game.c `G_PlayerReborn` behavior and are
 * SHA-pinned by the inventory; this module does NOT modify them.
 * It is a pure re-export barrel (value/type split for
 * `verbatimModuleSyntax`; the playerSpawn `PlayerState` /
 * `WeaponType` / `AmmoType` / `PowerType` / `CardType` / `PsprNum`
 * `const enum`s are NOT re-exported, and the death-flow
 * `PlayerState` 0|1|2 type alias is surfaced instead) plus a frozen
 * invariants manifest.
 *
 * Five parity invariants this step pins:
 *
 *   1. The player state is exactly `PLAYER_STATE_LIVE` (0),
 *      `PLAYER_STATE_DEAD` (1), or `PLAYER_STATE_REBORN` (2).
 *   2. `stepVanillaDeathThink` drops the dead view by
 *      `VANILLA_DEAD_VIEWHEIGHT_DROP_FIXED` (1·FRACUNIT) per tic and
 *      clamps it at `VANILLA_DEAD_VIEWHEIGHT_FIXED` (6·FRACUNIT).
 *   3. The death-think transitions to reborn only when the use
 *      button is pressed (single-player respawn-on-use).
 *   4. `playerReborn` resets the inventory/weapons to the vanilla
 *      starting loadout (pistol + fist, 50 bullets).
 *   5. The deathmatch respawn delay is
 *      `VANILLA_DEATHMATCH_RESPAWN_DELAY_TICS` = 10 (the C1 target
 *      is single-player, but the constant is preserved for parity).
 *
 * @example
 * ```ts
 * import { stepVanillaDeathThink, PLAYER_STATE_REBORN, VANILLA_DEATH_REBORN_INVARIANTS } from './wireDeathRebornAndTransitions.ts';
 * stepVanillaDeathThink({ viewHeightFixed: 41 << 16, useButtonPressed: true }).transitionsToReborn; // true
 * PLAYER_STATE_REBORN;                                                                               // 2
 * VANILLA_DEATH_REBORN_INVARIANTS.length;                                                            // 5
 * ```
 */

export {
  PLAYER_STATE_DEAD,
  PLAYER_STATE_LIVE,
  PLAYER_STATE_REBORN,
  VANILLA_DEAD_VIEWHEIGHT_DROP_FIXED,
  VANILLA_DEAD_VIEWHEIGHT_FIXED,
  VANILLA_DEATHMATCH_RESPAWN_DELAY_TICS,
  stepVanillaDeathThink,
} from '../player/implement-death-and-reborn-flow.ts';
export type { DeathThinkInput, DeathThinkResult, PlayerState } from '../player/implement-death-and-reborn-flow.ts';
export { NUMAMMO, NUMCARDS, NUMPOWERS, NUMPSPRITES, NUMWEAPONS, bringUpWeapon, createPlayer, playerReborn, setupPsprites } from '../player/playerSpawn.ts';

/**
 * One pinned death / reborn / transition parity invariant.
 */
export interface VanillaDeathRebornInvariant {
  readonly id: 'DEAD_VIEWHEIGHT_DROPS_AND_CLAMPS_AT_SIX' | 'DEATH_THINK_REBORNS_ONLY_ON_USE' | 'PLAYER_REBORN_RESETS_STARTING_LOADOUT' | 'PLAYER_STATE_IS_LIVE_DEAD_OR_REBORN' | 'VANILLA_DEATHMATCH_RESPAWN_DELAY_IS_TEN';
  readonly rule: string;
}

/**
 * Frozen manifest of the five death / reborn / transition parity
 * invariants this step pins.  A later step that wires the live
 * death/transition flow must preserve all five.
 */
export const VANILLA_DEATH_REBORN_INVARIANTS: readonly VanillaDeathRebornInvariant[] = Object.freeze([
  Object.freeze({
    id: 'DEAD_VIEWHEIGHT_DROPS_AND_CLAMPS_AT_SIX',
    rule: 'stepVanillaDeathThink lowers the view by VANILLA_DEAD_VIEWHEIGHT_DROP_FIXED (1*FRACUNIT) each tic while above, and clamps it at VANILLA_DEAD_VIEWHEIGHT_FIXED (6*FRACUNIT), matching p_user.c P_DeathThink.',
  } satisfies VanillaDeathRebornInvariant),
  Object.freeze({
    id: 'DEATH_THINK_REBORNS_ONLY_ON_USE',
    rule: 'stepVanillaDeathThink.transitionsToReborn is true only when the use button is pressed, matching the single-player P_DeathThink respawn-on-use gate.',
  } satisfies VanillaDeathRebornInvariant),
  Object.freeze({
    id: 'PLAYER_REBORN_RESETS_STARTING_LOADOUT',
    rule: 'playerReborn (G_PlayerReborn) resets the player to the vanilla starting loadout: fist + pistol, 50 bullets, 100 health, no armor/keys/powers.',
  } satisfies VanillaDeathRebornInvariant),
  Object.freeze({
    id: 'PLAYER_STATE_IS_LIVE_DEAD_OR_REBORN',
    rule: 'The player state is exactly PLAYER_STATE_LIVE (0), PLAYER_STATE_DEAD (1), or PLAYER_STATE_REBORN (2) (the PlayerState union), matching d_player.h playerstate_t.',
  } satisfies VanillaDeathRebornInvariant),
  Object.freeze({
    id: 'VANILLA_DEATHMATCH_RESPAWN_DELAY_IS_TEN',
    rule: 'VANILLA_DEATHMATCH_RESPAWN_DELAY_TICS = 10; the C1 target is single-player so this path is not exercised, but the constant is preserved for parity with g_game.c.',
  } satisfies VanillaDeathRebornInvariant),
]);
