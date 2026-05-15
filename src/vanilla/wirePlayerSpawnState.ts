/**
 * Vanilla DOOM 1.9 player spawn-state runtime facade.
 *
 * Plan_final step `09-001` (lane: player-weapons-items) aggregates
 * the player spawn / reborn / psprite functions and the
 * inventory-default constants the runtime spawn path needs into one
 * cohesive re-export barrel.  The read-only `src/player/playerSpawn.ts`
 * module already implements vanilla `g_game.c` `G_PlayerReborn` /
 * `p_pspr.c` psprite-state-machine semantics and is SHA-pinned by
 * the `plan_vanilla_parity` inventory; this module does NOT modify
 * it.
 *
 * Wired functions and their Chocolate Doom 2.2.1 origins:
 *
 *   - `createPlayer`   — fresh `player_t` allocation with the vanilla
 *     C-level field initializers.
 *   - `playerReborn`   — `g_game.c` `G_PlayerReborn` (reset player
 *     state after death while preserving level stats).
 *   - `setupPsprites`  — `p_pspr.c` `P_SetupPsprites`.
 *   - `movePsprites`   — `p_pspr.c` `P_MovePsprites`.
 *   - `bringUpWeapon`  — `p_pspr.c` `P_BringUpWeapon`.
 *   - `setPsprite`     — `p_pspr.c` `P_SetPsprite`.
 *
 * @example
 * ```ts
 * import { createPlayer, INITIAL_HEALTH, VANILLA_PLAYER_SPAWN_ENTRY_POINTS } from './wirePlayerSpawnState.ts';
 * createPlayer().health;                          // 100 (INITIAL_HEALTH)
 * VANILLA_PLAYER_SPAWN_ENTRY_POINTS.length;       // 6
 * ```
 */

export {
  AM_NOAMMO,
  AmmoType,
  CardType,
  INITIAL_BULLETS,
  INITIAL_HEALTH,
  LOWERSPEED,
  MAX_AMMO,
  NUMAMMO,
  NUMCARDS,
  NUMPOWERS,
  NUMPSPRITES,
  NUMWEAPONS,
  PlayerState,
  PowerType,
  PsprNum,
  RAISESPEED,
  WEAPONBOTTOM,
  WEAPONTOP,
  WP_NOCHANGE,
  WeaponType,
  bringUpWeapon,
  createPlayer,
  movePsprites,
  playerReborn,
  setPsprite,
  setupPsprites,
} from '../player/playerSpawn.ts';

/**
 * Frozen manifest of the six canonical player spawn-state entry
 * point names this facade wires, in the order the runtime spawn
 * path invokes them (allocate → reborn → psprite setup → bring up
 * weapon → per-tic psprite move; setPsprite is the shared state
 * primitive the others delegate to).
 */
export const VANILLA_PLAYER_SPAWN_ENTRY_POINTS: readonly string[] = Object.freeze(['bringUpWeapon', 'createPlayer', 'movePsprites', 'playerReborn', 'setPsprite', 'setupPsprites']);
