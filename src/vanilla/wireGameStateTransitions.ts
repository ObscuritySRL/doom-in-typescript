/**
 * Vanilla DOOM 1.9 game-state transition runtime facade.
 *
 * Plan_final step `04-005` (lane: runtime-core) models the vanilla
 * `gamestate_t` machine — `GS_LEVEL`, `GS_INTERMISSION`,
 * `GS_FINALE`, `GS_DEMOSCREEN` — and the screen-wipe rule that
 * `D_Display` applies on a state change, plus a re-export barrel of
 * the per-state primitives the runtime drives.  The read-only
 * `src/ui/frontEndSequence.ts` (GS_DEMOSCREEN), `src/ui/intermission.ts`
 * (GS_INTERMISSION), and `src/ui/finale.ts` (GS_FINALE) modules
 * already implement the per-state behavior and are SHA-pinned by the
 * `plan_vanilla_parity` UI inventory; this module does NOT modify
 * them.
 *
 * `VanillaGameState` values match `doomstat.h` `gamestate_t`:
 * `GS_LEVEL = 0`, `GS_INTERMISSION = 1`, `GS_FINALE = 2`,
 * `GS_DEMOSCREEN = 3`.
 *
 * Legal `gameaction`-driven transitions (`g_game.c` /
 * `f_finale.c` / `d_main.c`):
 *
 *   - `GS_LEVEL → GS_INTERMISSION`   — `G_DoCompleted`.
 *   - `GS_INTERMISSION → GS_LEVEL`   — `G_DoWorldDone` (next map).
 *   - `GS_INTERMISSION → GS_FINALE`  — `F_StartFinale` (episode end).
 *   - `GS_FINALE → GS_LEVEL`         — `G_DoWorldDone` (after the
 *     cast call / text screen, on the next game).
 *   - `* → GS_DEMOSCREEN`            — `D_StartTitle` (attract loop).
 *   - `GS_DEMOSCREEN → GS_LEVEL`     — `G_DeferedInitNew` (new game
 *     from the menu).
 *
 * Screen-wipe rule (`D_Display`: `wipe = (gamestate !=
 * wipegamestate)`): every gamestate *change* triggers a melt wipe.
 * The page flips WITHIN GS_DEMOSCREEN (TITLEPIC → demo → CREDIT …)
 * do not change `gamestate`, so they do not wipe — only the
 * transition INTO or OUT OF a different state does.
 *
 * @example
 * ```ts
 * import { VanillaGameState, isWipeTransition, VANILLA_GAME_STATE_TRANSITIONS } from './wireGameStateTransitions.ts';
 * isWipeTransition(VanillaGameState.GS_LEVEL, VanillaGameState.GS_INTERMISSION); // true
 * isWipeTransition(VanillaGameState.GS_LEVEL, VanillaGameState.GS_LEVEL);        // false
 * VANILLA_GAME_STATE_TRANSITIONS.length;                                         // 6
 * ```
 */

export { createFrontEndSequence, tickFrontEnd } from '../ui/frontEndSequence.ts';
export { beginIntermission, createIntermissionState, tickIntermission } from '../ui/intermission.ts';
export { createFinaleState, getFinaleScreen, startFinale, tickFinale } from '../ui/finale.ts';

/**
 * Vanilla `gamestate_t` from `doomstat.h`.  Numeric values are
 * load-bearing — savegames and the `D_Display` wipe comparison key
 * off the integer.
 */
export const VanillaGameState = Object.freeze({
  GS_LEVEL: 0,
  GS_INTERMISSION: 1,
  GS_FINALE: 2,
  GS_DEMOSCREEN: 3,
} as const);

/** A legal vanilla game-state transition with the gameaction that drives it. */
export interface VanillaGameStateTransition {
  readonly from: number;
  readonly to: number;
  readonly gameAction: string;
}

/**
 * Frozen adjacency manifest of every legal vanilla
 * `gameaction`-driven gamestate transition.  Any transition NOT in
 * this list is a parity violation.
 */
export const VANILLA_GAME_STATE_TRANSITIONS: readonly VanillaGameStateTransition[] = Object.freeze([
  Object.freeze({ from: VanillaGameState.GS_LEVEL, gameAction: 'G_DoCompleted', to: VanillaGameState.GS_INTERMISSION }),
  Object.freeze({ from: VanillaGameState.GS_INTERMISSION, gameAction: 'G_DoWorldDone', to: VanillaGameState.GS_LEVEL }),
  Object.freeze({ from: VanillaGameState.GS_INTERMISSION, gameAction: 'F_StartFinale', to: VanillaGameState.GS_FINALE }),
  Object.freeze({ from: VanillaGameState.GS_FINALE, gameAction: 'G_DoWorldDone', to: VanillaGameState.GS_LEVEL }),
  Object.freeze({ from: VanillaGameState.GS_LEVEL, gameAction: 'D_StartTitle', to: VanillaGameState.GS_DEMOSCREEN }),
  Object.freeze({ from: VanillaGameState.GS_DEMOSCREEN, gameAction: 'G_DeferedInitNew', to: VanillaGameState.GS_LEVEL }),
]);

/**
 * Whether changing `gamestate` from `fromState` to `toState`
 * triggers a screen-melt wipe.  Mirrors `D_Display`'s
 * `wipe = (gamestate != wipegamestate)`: any actual state change
 * wipes; a no-op (same state, e.g. a GS_DEMOSCREEN page flip that
 * does not alter `gamestate`) does not.
 */
export function isWipeTransition(fromState: number, toState: number): boolean {
  return fromState !== toState;
}

/**
 * Whether the (from → to) pair is one of the canonical vanilla
 * `gameaction`-driven transitions in {@link VANILLA_GAME_STATE_TRANSITIONS}.
 */
export function isLegalGameStateTransition(fromState: number, toState: number): boolean {
  for (const transition of VANILLA_GAME_STATE_TRANSITIONS) {
    if (transition.from === fromState && transition.to === toState) {
      return true;
    }
  }
  return false;
}
