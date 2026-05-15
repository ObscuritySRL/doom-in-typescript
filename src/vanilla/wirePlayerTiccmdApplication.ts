/**
 * Vanilla DOOM 1.9 player ticcmd-application runtime facade.
 *
 * Plan_final step `09-002` (lane: player-weapons-items) aggregates
 * the player-movement functions and the ticcmd button-decode
 * helpers `P_PlayerThink` calls every tic into one cohesive
 * re-export barrel.  The read-only `src/player/movement.ts` and
 * `src/player/implement-ticcmd-application.ts` modules already
 * implement vanilla `p_user.c` `P_MovePlayer` / `P_CalcHeight` /
 * `P_Thrust` and the `g_game.c` ticcmd button bit semantics and are
 * SHA-pinned by the `plan_vanilla_parity` player inventory; this
 * module does NOT modify them.
 *
 * Wired entry points and their Chocolate Doom 2.2.1 origins:
 *
 *   - `thrust`                    — `p_user.c` `P_Thrust` (apply
 *     forward/side momentum at an angle).
 *   - `calcHeight`                — `p_user.c` `P_CalcHeight`
 *     (view height + bob).
 *   - `movePlayer`                — `p_user.c` `P_MovePlayer`
 *     (forward/side/turn/strafe ticcmd application).
 *   - `applyUseButtonLatch`       — the BT_USE edge-latch so a held
 *     use button only fires once.
 *   - `decodeWeaponChangeRequest` — the BT_CHANGE + weapon-mask
 *     decode that yields the pending weapon index (or null).
 *
 * @example
 * ```ts
 * import { decodeWeaponChangeRequest, VANILLA_BT_ATTACK, VANILLA_PLAYER_TICCMD_ENTRY_POINTS } from './wirePlayerTiccmdApplication.ts';
 * VANILLA_BT_ATTACK;                          // 1
 * VANILLA_PLAYER_TICCMD_ENTRY_POINTS.length;  // 5
 * ```
 */

export { CF_NOMOMENTUM, MAXBOB, MOVE_SCALE, calcHeight, movePlayer, thrust } from '../player/movement.ts';
export {
  VANILLA_BTS_PAUSE,
  VANILLA_BTS_SAVEGAME,
  VANILLA_BTS_SAVESHIFT,
  VANILLA_BT_ATTACK,
  VANILLA_BT_CHANGE,
  VANILLA_BT_SPECIAL,
  VANILLA_BT_USE,
  VANILLA_BT_WEAPONMASK,
  VANILLA_BT_WEAPONSHIFT,
  applyUseButtonLatch,
  decodeWeaponChangeRequest,
} from '../player/implement-ticcmd-application.ts';

/**
 * Frozen manifest of the five canonical player ticcmd-application
 * entry-point names this facade wires, in the order `P_PlayerThink`
 * invokes them (decode the use-button latch + weapon-change request
 * from the ticcmd buttons, then thrust + move the player and
 * recompute the bobbing view height).
 */
export const VANILLA_PLAYER_TICCMD_ENTRY_POINTS: readonly string[] = Object.freeze(['applyUseButtonLatch', 'calcHeight', 'decodeWeaponChangeRequest', 'movePlayer', 'thrust']);
