/**
 * Vanilla DOOM 1.9 title-loop / attract-loop runtime facade.
 *
 * Plan_final step `07-001` (lane: ui) aggregates the front-end
 * attract-loop sequence and the TitleLoop page-timing primitive the
 * clean-launch path drives every tic into one cohesive re-export
 * barrel.  The read-only `src/ui/frontEndSequence.ts` and
 * `src/bootstrap/titleLoop.ts` modules already implement vanilla
 * `d_main.c` `D_DoomLoop` title/demo attract cycle, `D_PageTicker`
 * page timing, and the `D_AdvanceDemo` page → demo → page cycle,
 * and are SHA-pinned by the respective `plan_vanilla_parity`
 * inventories; this module does NOT modify them.
 *
 * Wired entry points and their Chocolate Doom 2.2.1 origins:
 *
 *   - `createFrontEndSequence`  — `d_main.c` `D_StartTitle` initial
 *     attract-loop state for the gamemode (TITLEPIC → demo1 →
 *     CREDIT/CREDIT-equivalent → demo2 …).
 *   - `tickFrontEnd`            — `d_main.c` `D_PageTicker` +
 *     `D_AdvanceDemo` per-tic page/demo advance.
 *   - `handleFrontEndKey`       — the title-screen key responder
 *     (Esc → menu, F1 → help, any other → advance demo).
 *   - `notifyDemoCompleted` / `setMenuActive` — the demo-finished
 *     and menu-open state transitions that pause/resume page timers.
 *   - `getInitialHelpLump`      — the gamemode-keyed first help
 *     page (HELP/HELP1/HELP2).
 *   - `TitleLoop`               — the page-tic countdown primitive
 *     (TITLEPIC_PAGETIC=170, COMMERCIAL_TITLEPIC_PAGETIC=385,
 *     INTERLUDE_PAGETIC=200, CYCLE_LENGTH=6).
 *
 * @example
 * ```ts
 * import { createFrontEndSequence, TITLEPIC_PAGETIC, VANILLA_TITLE_LOOP_ENTRY_POINTS } from './wireTitleLoopRendering.ts';
 * TITLEPIC_PAGETIC;                            // 170
 * VANILLA_TITLE_LOOP_ENTRY_POINTS.length;      // 6
 * ```
 */

export {
  FRONTEND_KEY_ADVANCE_DEMO,
  FRONTEND_KEY_HELP,
  FRONTEND_KEY_MENU,
  FRONTEND_KEY_NONE,
  FRONTEND_KEY_OPEN_MENU,
  FRONTEND_TICK_IDLE,
  createFrontEndSequence,
  getInitialHelpLump,
  handleFrontEndKey,
  notifyDemoCompleted,
  setMenuActive,
  tickFrontEnd,
} from '../ui/frontEndSequence.ts';
export { COMMERCIAL_TITLEPIC_PAGETIC, CYCLE_LENGTH, INTERLUDE_PAGETIC, TITLEPIC_PAGETIC, TitleLoop } from '../bootstrap/titleLoop.ts';

/**
 * Frozen manifest of the six canonical title-loop entry-point names
 * this facade wires, in the order the clean-launch path invokes
 * them (create the attract sequence for the gamemode, resolve the
 * initial help lump, then per-tic advance the front-end + handle a
 * title-screen key, with demo-completed / menu-active transitions
 * pausing the page timers).
 */
export const VANILLA_TITLE_LOOP_ENTRY_POINTS: readonly string[] = Object.freeze(['createFrontEndSequence', 'getInitialHelpLump', 'handleFrontEndKey', 'notifyDemoCompleted', 'setMenuActive', 'tickFrontEnd']);
