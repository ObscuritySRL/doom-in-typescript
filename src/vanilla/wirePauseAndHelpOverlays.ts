/**
 * Vanilla DOOM 1.9 pause + help-overlay runtime facade.
 *
 * Plan_final step `07-009` (lane: ui) wires the pause overlay, the
 * Read-This help routing, and the menu/demo interaction so the
 * GS_DEMOSCREEN page timers are paused EXACTLY when vanilla pauses
 * them and not otherwise.  The read-only `src/ui/frontEndSequence.ts`
 * and `src/ui/menus.ts` modules already implement the per-state
 * behavior and are SHA-pinned by the `plan_vanilla_parity` UI
 * inventory; this module does NOT modify them.
 *
 * Two parity invariants this step pins (from `d_main.c`
 * `D_PageTicker` + `m_menu.c` `M_StartControlPanel` / `g_game.c`
 * pause handling):
 *
 *   1. **Menu/help over the title pauses the page timer.**  Opening
 *      the menu or the Read-This help page during GS_DEMOSCREEN sets
 *      `menuactive`; vanilla's `D_PageTicker` does `if (--pagetic <
 *      0) D_AdvanceDemo()` UNCONDITIONALLY, but the title-loop port
 *      gates the decrement on `!menuActive` so the TITLEPIC does not
 *      silently advance to demo1 while the user is in the menu.
 *      `setMenuActive(state, true)` is the hook that freezes the
 *      page timer; `false` resumes it.
 *   2. **In-level PAUSE does not touch the page timer.**  When
 *      `gamestate === GS_LEVEL` the pause key freezes the game tic
 *      (`paused`), but the front-end page timer is NOT running
 *      during a level, so an in-level pause has no effect on it —
 *      the two timers are independent.
 *
 * Help routing: `getInitialHelpLump(gameMode)` resolves the first
 * Read-This page lump exactly as vanilla's m_menu.c ReadDef1 /
 * ReadDef2 drawer selection does — `HELP1` for `retail`, `HELP` for
 * `commercial`, and `HELP2` for `shareware` / `registered` /
 * `indetermined` — the F1 key opens it and a subsequent key
 * advances/closes it without disturbing the page timer beyond the
 * menu-active gate.
 *
 * @example
 * ```ts
 * import { getInitialHelpLump, setMenuActive, VANILLA_PAUSE_HELP_INVARIANTS } from './wirePauseAndHelpOverlays.ts';
 * getInitialHelpLump('shareware');             // 'HELP2'
 * VANILLA_PAUSE_HELP_INVARIANTS.length;        // 2
 * ```
 */

export { getInitialHelpLump, notifyDemoCompleted, setMenuActive } from '../ui/frontEndSequence.ts';
export type { HelpLump } from '../ui/frontEndSequence.ts';
export { closeMenu, openMenu, openMessage } from '../ui/menus.ts';

/**
 * One pinned pause/help parity invariant.
 */
export interface VanillaPauseHelpInvariant {
  readonly id: 'IN_LEVEL_PAUSE_DOES_NOT_TOUCH_PAGE_TIMER' | 'MENU_OR_HELP_OVER_TITLE_PAUSES_PAGE_TIMER';
  readonly rule: string;
}

/**
 * Frozen manifest of the two pause/help page-timer parity
 * invariants this step pins.  A later step that wires the title
 * loop into the live host must preserve both.
 */
export const VANILLA_PAUSE_HELP_INVARIANTS: readonly VanillaPauseHelpInvariant[] = Object.freeze([
  Object.freeze({
    id: 'MENU_OR_HELP_OVER_TITLE_PAUSES_PAGE_TIMER',
    rule: 'Opening the menu or Read-This help during GS_DEMOSCREEN sets menuActive, which gates the D_PageTicker pagetic decrement so the TITLEPIC/demo page does not advance under the overlay; closing it resumes the timer.',
  } satisfies VanillaPauseHelpInvariant),
  Object.freeze({
    id: 'IN_LEVEL_PAUSE_DOES_NOT_TOUCH_PAGE_TIMER',
    rule: 'An in-level PAUSE (gamestate === GS_LEVEL) freezes the game tic but the front-end page timer is not running during a level, so the two timers stay independent.',
  } satisfies VanillaPauseHelpInvariant),
]);
