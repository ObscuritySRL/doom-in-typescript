/**
 * Vanilla DOOM 1.9 line-crossing / line-use / switch dispatch facade.
 *
 * Plan_final step `08-004` (lane: map-world) wires the three
 * activation paths a thing can take against a special linedef into
 * one cohesive surface: crossing it (`P_CrossSpecialLine`), pressing
 * Use against it (`P_UseLines` → `P_UseSpecialLine`), and the
 * animated-switch / held-button revert (`P_ChangeSwitchTexture` +
 * `P_UpdateSpecials`).  It also pins the spechit-ordering and
 * trigger/retrigger repeat rules.
 *
 * The read-only `src/world/useLines.ts` (P_UseLines ray + spechit
 * overrun), `src/specials/lineTriggers.ts` (the cross/use/shoot
 * special dispatch tables), and `src/specials/switches.ts` (switch
 * textures + button timers) already implement the per-piece
 * behavior byte-for-byte and are SHA-pinned by the inventory; this
 * module does NOT modify them.  It is a pure re-export barrel plus a
 * frozen invariants manifest so a later host-wiring step cannot
 * silently drop a parity rule.  The cross-module `GameVersion` and
 * `ButtonWhere` const enums are intentionally NOT re-exported (the
 * `pCrossSpecialLine` gameVersion parameter defaults to
 * `doom_1_9`); under `verbatimModuleSyntax` a const-enum re-export
 * is a runtime hazard and no consumer needs it through this surface.
 *
 * Six parity invariants this step pins:
 *
 *   1. A one-shot cross trigger zeroes `line.special` AFTER the EV_*
 *      dispatch, EXCEPT the two exit triggers 52 / 124 which never
 *      clear it (the level transitions before the next tic reads it).
 *   2. A retrigger cross leaves `line.special` intact so the line
 *      can fire again.
 *   3. `P_UseSpecialLine` from the back side (side === 1) is rejected
 *      unless the special is the UNUSED sliding-door code 124.
 *   4. The switch-texture flip fires only when the EV_* helper
 *      returned non-zero, EXCEPT exit cases 11 / 51 and the void
 *      light cases 138 / 139 which flip unconditionally;
 *      `P_ShootSpecialLine` never guards the flip.
 *   5. `P_UseLines` casts a USERANGE ray, stops at the first usable
 *      special line, and plays the no-way sound on a blocking
 *      non-special wall.
 *   6. The spechit pool preserves the vanilla overflow: the original
 *      8-slot boundary (`MAXSPECIALCROSS_ORIGINAL`) corrupts adjacent
 *      globals via `spechitOverrun` within the expanded
 *      `MAXSPECIALCROSS` (20) Chocolate-compatible pool.
 *
 * @example
 * ```ts
 * import { pCrossSpecialLine, pUseSpecialLine, changeSwitchTexture, VANILLA_LINE_CROSSING_USE_INVARIANTS } from './wireLineCrossingAndUse.ts';
 * VANILLA_LINE_CROSSING_USE_INVARIANTS.length; // 6
 * ```
 */

export { MONSTER_CROSS_SPECIALS, MONSTER_SHOOT_SPECIALS, MONSTER_USE_SPECIALS, NON_TRIGGER_PROJECTILE_TYPES, pCrossSpecialLine, pShootSpecialLine, pUseSpecialLine } from '../specials/lineTriggers.ts';
export type { LineTriggerCallbacks, LineTriggerLine, LineTriggerThing } from '../specials/lineTriggers.ts';
export {
  ALPH_SWITCH_LIST,
  BUTTONTIME,
  EXIT_SWITCH_SPECIAL,
  MAXBUTTONS,
  MAXSWITCHES,
  SFX_SWTCHN,
  SFX_SWTCHX,
  changeSwitchTexture,
  createButtonList,
  initSwitchList,
  resetButton,
  startButton,
  switchEpisodeForGameMode,
  updateButtons,
} from '../specials/switches.ts';
export type { Button, SwitchCallbacks, SwitchLine, SwitchList, SwitchSide, SwitchTexturePair } from '../specials/switches.ts';
export { DEFAULT_SPECHIT_MAGIC, MAXSPECIALCROSS, MAXSPECIALCROSS_ORIGINAL, USERANGE, spechitOverrun, useLines } from '../world/useLines.ts';
export type { NoWaySoundFunction, SpechitOverrunState, UseLineCallbacks, UseSpecialLineFunction } from '../world/useLines.ts';

/**
 * One pinned line-crossing / line-use / switch parity invariant.
 */
export interface VanillaLineCrossingUseInvariant {
  readonly id:
    | 'BACK_SIDE_USE_ONLY_UNUSED_SLIDING_DOOR_124'
    | 'CROSS_ONESHOT_CLEARS_SPECIAL_EXCEPT_EXIT_52_124'
    | 'CROSS_RETRIGGER_NEVER_CLEARS_SPECIAL'
    | 'SPECHIT_VANILLA_OVERFLOW_AT_ORIGINAL_8'
    | 'SWITCH_FLIP_GUARDED_ON_EV_RESULT_EXCEPT_EXIT_AND_LIGHT'
    | 'USE_LINES_STOPS_AT_FIRST_USABLE_OR_PLAYS_NOWAY';
  readonly rule: string;
}

/**
 * Frozen manifest of the six line-crossing / line-use / switch
 * parity invariants this step pins.  A later step that wires these
 * dispatchers into the live world tick must preserve all six.
 */
export const VANILLA_LINE_CROSSING_USE_INVARIANTS: readonly VanillaLineCrossingUseInvariant[] = Object.freeze([
  Object.freeze({
    id: 'BACK_SIDE_USE_ONLY_UNUSED_SLIDING_DOOR_124',
    rule: 'pUseSpecialLine called with side === 1 returns false (no dispatch) unless line.special === 124, the UNUSED vanilla sliding-door code; that case falls through with no matching switch arm and returns true.',
  } satisfies VanillaLineCrossingUseInvariant),
  Object.freeze({
    id: 'CROSS_ONESHOT_CLEARS_SPECIAL_EXCEPT_EXIT_52_124',
    rule: 'A TRIGGERS-block cross special zeroes line.special after the EV_* dispatch call; the exit triggers 52 (normal) and 124 (secret) never clear it because G_ExitLevel/G_SecretExitLevel transitions before the next tic.',
  } satisfies VanillaLineCrossingUseInvariant),
  Object.freeze({
    id: 'CROSS_RETRIGGER_NEVER_CLEARS_SPECIAL',
    rule: 'A RETRIGGERS-block cross special leaves line.special intact so the line fires again on every crossing.',
  } satisfies VanillaLineCrossingUseInvariant),
  Object.freeze({
    id: 'SPECHIT_VANILLA_OVERFLOW_AT_ORIGINAL_8',
    rule: 'The spechit pool preserves vanilla memory corruption: MAXSPECIALCROSS_ORIGINAL (8) is the boundary past which spechitOverrun writes synthetic line_t pointers over tmbbox/crushchange/nofit, inside the expanded MAXSPECIALCROSS (20) Chocolate-compatible pool.',
  } satisfies VanillaLineCrossingUseInvariant),
  Object.freeze({
    id: 'SWITCH_FLIP_GUARDED_ON_EV_RESULT_EXCEPT_EXIT_AND_LIGHT',
    rule: 'pUseSpecialLine flips the switch texture (changeSwitchTexture) only when the EV_* helper returned non-zero, except exit cases 11/51 and void light cases 138/139 which flip unconditionally; pShootSpecialLine never guards the flip.',
  } satisfies VanillaLineCrossingUseInvariant),
  Object.freeze({
    id: 'USE_LINES_STOPS_AT_FIRST_USABLE_OR_PLAYS_NOWAY',
    rule: 'useLines casts a USERANGE (64 * FRACUNIT) ray along the mobj facing angle, dispatches the first special line via the useSpecialLine callback and stops, and plays the noWaySound callback when the first intercepted line is a blocking non-special wall (openrange <= 0).',
  } satisfies VanillaLineCrossingUseInvariant),
]);
