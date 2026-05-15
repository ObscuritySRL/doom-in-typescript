/**
 * Vanilla DOOM 1.9 use-button → P_UseLines wiring facade.
 *
 * Plan_final step `09-003` (lane: player-weapons-items) wires the
 * `BT_USE` button through the `usedown` debounce into `P_UseLines`,
 * so a single use-press fires exactly one line trace and a held
 * button does not re-fire until released — matching
 * `p_user.c` `P_PlayerThink` and `p_map.c` `P_UseLines`.
 *
 * The read-only `src/player/implement-player-use-action.ts`
 * (`classifyVanillaPlayerUseAction` debounce) and
 * `src/world/useLines.ts` (`P_UseLines` ray cast + spechit-overrun
 * emulation) already implement the per-piece behavior and are
 * SHA-pinned by the inventory; this module does NOT modify them.
 * It re-exports both surfaces and adds {@link applyPlayerUseAction},
 * the thin integration that gates the `useLines` call on the
 * rising edge the debounce reports.
 *
 * Four parity invariants this step pins:
 *
 *   1. **The use button is edge-triggered via `usedown`.**  While
 *      held, `P_UseLines` runs only on the first tic
 *      (`previousUsedown === false`); subsequent held tics latch
 *      `usedown` and fire nothing until the button is released.
 *   2. **`P_UseLines` is invoked exactly when the debounce reports a
 *      rising edge.**  `applyPlayerUseAction` calls `useLines` iff
 *      `classifyVanillaPlayerUseAction(...).fireUseEvent` is true.
 *   3. **Player and world `USERANGE` agree at 64·FRACUNIT.**  The
 *      player-side `VANILLA_USERANGE` equals the world-side
 *      `USERANGE`; the use ray is cast 64 map units along the
 *      mobj's facing angle.
 *   4. **A blocking non-special wall plays the no-way sound.**  When
 *      the first intercepted line has no special and no opening,
 *      `useLines` invokes the `noWaySound` callback (vanilla
 *      `sfx_noway`, id 20) and stops the trace.
 *
 * @example
 * ```ts
 * import { applyPlayerUseAction, useLines } from './wirePlayerUseAction.ts';
 * const outcome = applyPlayerUseAction({ buttonHeld: true, previousUsedown: false }, () => useLines(mo, mapData, callbacks));
 * outcome.fireUseEvent; // true  (rising edge → P_UseLines ran)
 * outcome.nextUsedown;  // true  (latch for the next tic)
 * ```
 */

export { VANILLA_SFX_NOWAY, VANILLA_USERANGE, classifyVanillaPlayerUseAction } from '../player/implement-player-use-action.ts';
export type { PlayerUseInput, PlayerUseOutcome } from '../player/implement-player-use-action.ts';
export { DEFAULT_SPECHIT_MAGIC, MAXSPECIALCROSS, MAXSPECIALCROSS_ORIGINAL, USERANGE, spechitOverrun, useLines } from '../world/useLines.ts';
export type { NoWaySoundFunction, SpechitOverrunState, UseLineCallbacks, UseSpecialLineFunction } from '../world/useLines.ts';

import { classifyVanillaPlayerUseAction } from '../player/implement-player-use-action.ts';
import type { PlayerUseInput, PlayerUseOutcome } from '../player/implement-player-use-action.ts';

/**
 * Wire one tic of use-button input through the `usedown` debounce
 * into `P_UseLines`.
 *
 * Mirrors the `P_PlayerThink` use branch: classify the button
 * state, run the use action only on the rising edge, and return the
 * outcome so the caller can store `player.usedown = nextUsedown`.
 * The caller binds `useLinesAction` to the re-exported
 * {@link useLines} (`() => useLines(player.mo, mapData, callbacks)`);
 * keeping it a thunk lets the rising-edge gating be unit-tested
 * without constructing a full map.
 *
 * @param input          The button-held / previous-usedown state.
 * @param useLinesAction  The P_UseLines invocation to run on a rising edge.
 * @returns The debounce outcome (`fireUseEvent`, `nextUsedown`).
 */
export function applyPlayerUseAction(input: PlayerUseInput, useLinesAction: () => void): PlayerUseOutcome {
  const outcome = classifyVanillaPlayerUseAction(input);
  if (outcome.fireUseEvent) {
    useLinesAction();
  }
  return outcome;
}

/**
 * One pinned use-button / P_UseLines parity invariant.
 */
export interface VanillaPlayerUseInvariant {
  readonly id: 'BLOCKING_NON_SPECIAL_WALL_PLAYS_NOWAY' | 'USE_BUTTON_IS_EDGE_TRIGGERED_VIA_USEDOWN' | 'USE_LINES_FIRES_ONLY_ON_RISING_EDGE' | 'USERANGE_PLAYER_AND_WORLD_AGREE';
  readonly rule: string;
}

/**
 * Frozen manifest of the four use-button / P_UseLines parity
 * invariants this step pins.  A later step that wires the player
 * ticcmd into the live world must preserve all four.
 */
export const VANILLA_PLAYER_USE_INVARIANTS: readonly VanillaPlayerUseInvariant[] = Object.freeze([
  Object.freeze({
    id: 'BLOCKING_NON_SPECIAL_WALL_PLAYS_NOWAY',
    rule: 'When the first intercepted line has no special and no opening (openrange <= 0), useLines invokes the noWaySound callback (vanilla sfx_noway = VANILLA_SFX_NOWAY = 20) and stops the trace.',
  } satisfies VanillaPlayerUseInvariant),
  Object.freeze({
    id: 'USE_BUTTON_IS_EDGE_TRIGGERED_VIA_USEDOWN',
    rule: 'classifyVanillaPlayerUseAction fires the use event only on the rising edge (buttonHeld && !previousUsedown); a held button latches nextUsedown=true and fires nothing until released (buttonHeld=false resets usedown).',
  } satisfies VanillaPlayerUseInvariant),
  Object.freeze({
    id: 'USE_LINES_FIRES_ONLY_ON_RISING_EDGE',
    rule: 'applyPlayerUseAction calls useLines if and only if classifyVanillaPlayerUseAction(input).fireUseEvent is true, so a single press produces exactly one P_UseLines trace.',
  } satisfies VanillaPlayerUseInvariant),
  Object.freeze({
    id: 'USERANGE_PLAYER_AND_WORLD_AGREE',
    rule: 'The player-side VANILLA_USERANGE equals the world-side USERANGE (both 64 * FRACUNIT); the use ray is cast 64 map units along the mobj facing angle.',
  } satisfies VanillaPlayerUseInvariant),
]);
