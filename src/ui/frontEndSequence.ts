/**
 * Front-end attract-loop sequencer (d_main.c D_StartTitle / D_PageTicker /
 * D_DoAdvanceDemo + m_menu.c title-screen responder shortcuts).
 *
 * Coordinates the title / credit / help / demo cycle with input and
 * the menu overlay.  Wraps a {@link TitleLoop} state machine and
 * layers:
 *
 *  - Demo-playback tracking (`inDemoPlayback`), so a demo state
 *    doesn't receive page-ticker decrements.
 *  - Menu-active gating (`menuActive`), so key presses while the
 *    menu overlay is open are routed to `menus.ts` instead of
 *    advancing the demo.
 *  - Key event dispatch matching vanilla's M_Responder title-screen
 *    branches: `KEY_ESCAPE` opens the Main menu, `KEY_F1` opens the
 *    Read-This help page (lump varies by game mode), any other key
 *    requests advance to the next attract state.
 *
 * Parity invariants preserved from Chocolate Doom 2.2.1:
 *
 *  - `D_StartTitle` sets `demosequence = -1; advancedemo = true;`.
 *    The first call to {@link tickFrontEnd} consumes the advance,
 *    emitting the state-0 TITLEPIC page.  Constructor mirrors this
 *    initial condition via {@link TitleLoop}'s default.
 *  - `D_PageTicker` ticks pagetic regardless of menu overlay state;
 *    vanilla's menu overlay is a pure drawer and does not pause the
 *    attract loop. Demo-playback states do NOT tick pagetic; the demo
 *    itself terminates via `G_CheckDemoStatus`, which the host
 *    surfaces back through {@link notifyDemoCompleted}.
 *  - `key_menu_activate` (KEY_ESCAPE) opens the Main menu via
 *    M_StartControlPanel.  `key_menu_help` (KEY_F1) opens the
 *    Read-This menu; the resulting page graphic is HELP2 for
 *    shareware / registered (ReadDef1), HELP1 for retail / Ultimate
 *    DOOM (ReadDef2), and HELP for commercial (ReadDef1 with
 *    M_DrawReadThisCommercial).  Vanilla's
 *    `if (gameversion >= exe_ultimate) currentMenu = &ReadDef2;`
 *    gate is mapped to `gameMode === 'retail'` here.
 *  - Any non-menu / non-help key during GS_DEMOSCREEN advances the
 *    demo.  Vanilla routes this through G_Responder's title-screen
 *    clause which calls `D_AdvanceDemo`.  The sequencer models this
 *    as `requestAdvance()` on the underlying {@link TitleLoop}.
 *  - Menu-active state short-circuits the front-end key handler.
 *    Vanilla's M_Responder returns `true` when menuactive so
 *    G_Responder (the would-be skip path) never runs.  The
 *    sequencer mirrors this by returning a `none` action when
 *    `state.menuActive === true`.
 *  - Demo-completion paths match vanilla: `G_CheckDemoStatus` calls
 *    `D_AdvanceDemo` on demo finish, so demo playback always ends
 *    by transitioning to the next attract state.
 *
 * @example
 * ```ts
 * import { createFrontEndSequence, tickFrontEnd, handleFrontEndKey } from "../src/ui/frontEndSequence.ts";
 *
 * const seq = createFrontEndSequence("shareware");
 * const first = tickFrontEnd(seq);       // { kind: "showPage", lumpName: "TITLEPIC", pagetic: 170, musicLump: "D_INTRO" }
 * const press = handleFrontEndKey(seq, 27); // KEY_ESCAPE -> { kind: "openMenu" }
 * ```
 */

import type { GameMode } from '../bootstrap/gameMode.ts';
import { CYCLE_LENGTH, COMMERCIAL_TITLEPIC_PAGETIC, INTERLUDE_PAGETIC, TITLEPIC_PAGETIC, TitleLoop } from '../bootstrap/titleLoop.ts';
import { KEY_ESCAPE, KEY_F1 } from '../input/keyboard.ts';

// Re-export the underlying-loop constants so tests and consumers can use a
// single import surface for sequencing logic.
export { COMMERCIAL_TITLEPIC_PAGETIC, CYCLE_LENGTH, INTERLUDE_PAGETIC, TITLEPIC_PAGETIC, TitleLoop };

// Key binding constants (m_menu.c default key_menu_*)

/** Key that opens the Main menu from GS_DEMOSCREEN (m_menu.c `key_menu_activate` default = KEY_ESCAPE). */
export const FRONTEND_KEY_MENU = KEY_ESCAPE;

/** Key that opens the Read-This help page from GS_DEMOSCREEN (m_menu.c `key_menu_help` default = KEY_F1). */
export const FRONTEND_KEY_HELP = KEY_F1;

// Help-page lump resolution

/** Help lump displayed first on F1: HELP1 (retail), HELP2 (shareware/registered), HELP (commercial). */
export type HelpLump = 'HELP' | 'HELP1' | 'HELP2';

/**
 * Return the lump that appears immediately when F1 is pressed on the
 * title screen.  Mirrors m_menu.c's F1 handler combined with the
 * ReadDef1 / ReadDef2 drawer selection:
 *
 *  - `retail` (vanilla `gameversion >= exe_ultimate`): ReadDef2, which
 *    draws `HELP1`.
 *  - `commercial`: ReadDef1 with M_DrawReadThisCommercial, which
 *    draws `HELP`.
 *  - `shareware`, `registered`, `indetermined`: ReadDef1, which draws
 *    `HELP2`.
 */
export function getInitialHelpLump(gameMode: GameMode): HelpLump {
  if (gameMode === 'retail') return 'HELP1';
  if (gameMode === 'commercial') return 'HELP';
  return 'HELP2';
}

// Action types

/** Host should render the named page graphic and optionally start music. */
export interface ShowPageTickAction {
  readonly kind: 'showPage';
  readonly lumpName: string;
  readonly musicLump: string | null;
  readonly pagetic: number;
}

/** Host should begin deferred demo playback of the named lump. */
export interface PlayDemoTickAction {
  readonly kind: 'playDemo';
  readonly demoLump: string;
}

/** No state transition this tick; caller continues rendering the current page / demo. */
export interface IdleTickAction {
  readonly kind: 'idle';
}

/** Union of all {@link tickFrontEnd} outcomes. */
export type FrontEndTickAction = IdleTickAction | PlayDemoTickAction | ShowPageTickAction;

/** Host should open the Main menu overlay (vanilla M_StartControlPanel). */
export interface OpenMenuKeyAction {
  readonly kind: 'openMenu';
}

/** Host should open the Read-This help overlay showing `lump`. */
export interface OpenHelpKeyAction {
  readonly kind: 'openHelp';
  readonly lump: HelpLump;
}

/** Key consumed by the sequencer to request the next attract state. */
export interface AdvanceDemoKeyAction {
  readonly kind: 'advanceDemo';
}

/** Key ignored when the menu overlay is active or the key has no front-end binding. */
export interface NoneKeyAction {
  readonly kind: 'none';
}

/** Union of all {@link handleFrontEndKey} outcomes. */
export type FrontEndKeyAction = AdvanceDemoKeyAction | NoneKeyAction | OpenHelpKeyAction | OpenMenuKeyAction;

/** Frozen singleton for the idle tick result. */
export const FRONTEND_TICK_IDLE: FrontEndTickAction = Object.freeze({ kind: 'idle' });

/** Frozen singleton for the no-op key result. */
export const FRONTEND_KEY_NONE: FrontEndKeyAction = Object.freeze({ kind: 'none' });

/** Frozen singleton for the open-menu key result. */
export const FRONTEND_KEY_OPEN_MENU: FrontEndKeyAction = Object.freeze({ kind: 'openMenu' });

/** Frozen singleton for the advance-demo key result. */
export const FRONTEND_KEY_ADVANCE_DEMO: FrontEndKeyAction = Object.freeze({ kind: 'advanceDemo' });

// State

/**
 * Mutable front-end sequencer state.  `titleLoop` owns the underlying
 * D_DoAdvanceDemo cycle; `inDemoPlayback` and `menuActive` are the
 * two coordinator bits the sequencer adds.
 */
export interface FrontEndSequenceState {
  /** Underlying TitleLoop instance (owns demosequence / pagetic / advancedemo). */
  readonly titleLoop: TitleLoop;
  /** `true` between a `playDemo` emission and a {@link notifyDemoCompleted} call. */
  inDemoPlayback: boolean;
  /** Mirrors `menus.ts`'s `menuActive`; gates the front-end key dispatcher. */
  menuActive: boolean;
}

// Factories / entrypoints

/**
 * Create a fresh sequencer seeded with `demosequence = -1` and
 * `advancedemo = true`.  Mirrors vanilla `D_StartTitle`: the first
 * {@link tickFrontEnd} call consumes the pending advance and emits
 * the state-0 TITLEPIC page.
 */
export function createFrontEndSequence(gameMode: GameMode): FrontEndSequenceState {
  return {
    titleLoop: new TitleLoop(gameMode),
    inDemoPlayback: false,
    menuActive: false,
  };
}

/**
 * Advance the sequencer one tic.
 *
 * Dispatch order mirrors vanilla's TryRunTics -> D_Display ordering,
 * folded into a single call:
 *
 *  1. If an advance is pending (`titleLoop.advancedemo`), consume it
 *     via `doAdvanceDemo()`.  Emit `showPage` for page states or
 *     `playDemo` for demo states.  For demo states, also set
 *     `inDemoPlayback = true`; for page states, clear it.
 *  2. Otherwise, if the current state is a page state (not a demo
 *     playback), tick `pageTicker()`.  The ticker may set
 *     `advancedemo = true` for the next tick; the current tick still
 *     returns `idle`.
 *  3. During demo playback, return `idle` without ticking; demos
 *     drive their own termination via {@link notifyDemoCompleted}.
 *
 * The menu overlay does NOT suppress page-ticker decrement: vanilla's
 * D_PageTicker runs regardless of `menuactive`, so the attract
 * timer keeps counting even while the player has the menu open.
 */
export function tickFrontEnd(state: FrontEndSequenceState): FrontEndTickAction {
  if (state.titleLoop.advancedemo) {
    const action = state.titleLoop.doAdvanceDemo();
    if (action === null) return FRONTEND_TICK_IDLE;
    if (action.kind === 'demo') {
      state.inDemoPlayback = true;
      return Object.freeze({ kind: 'playDemo', demoLump: action.demoLump });
    }
    state.inDemoPlayback = false;
    return Object.freeze({
      kind: 'showPage',
      lumpName: action.lumpName,
      musicLump: action.musicLump,
      pagetic: action.pagetic,
    });
  }

  if (!state.inDemoPlayback) {
    state.titleLoop.pageTicker();
  }

  return FRONTEND_TICK_IDLE;
}

/**
 * Dispatch a key event during the front-end attract loop.
 *
 * Dispatch order mirrors vanilla M_Responder's non-menu-active branch:
 *
 *  1. If `state.menuActive === true`: return `none`.  Vanilla's
 *     menuactive-branch M_Responder handles the key and returns
 *     `true`, so G_Responder's title-screen skip never runs.
 *  2. If `key === FRONTEND_KEY_MENU` (KEY_ESCAPE): return
 *     `openMenu`.  Caller activates the menu overlay and sets
 *     {@link setMenuActive} to true.
 *  3. If `key === FRONTEND_KEY_HELP` (KEY_F1): return `openHelp`
 *     with the appropriate {@link HelpLump} for the game mode.
 *  4. Otherwise: call `requestAdvance()` on the title loop and
 *     return `advanceDemo`.  Vanilla routes this through
 *     G_Responder's `if (gamestate == GS_DEMOSCREEN) D_AdvanceDemo()`.
 */
export function handleFrontEndKey(state: FrontEndSequenceState, key: number): FrontEndKeyAction {
  if (state.menuActive) return FRONTEND_KEY_NONE;

  if (key === FRONTEND_KEY_MENU) return FRONTEND_KEY_OPEN_MENU;

  if (key === FRONTEND_KEY_HELP) {
    return Object.freeze({ kind: 'openHelp', lump: getInitialHelpLump(state.titleLoop.gameMode) });
  }

  state.titleLoop.requestAdvance();
  return FRONTEND_KEY_ADVANCE_DEMO;
}

/**
 * Signal that the currently-playing demo has finished.  Clears
 * `inDemoPlayback` and sets `advancedemo = true` on the underlying
 * title loop so the next {@link tickFrontEnd} transitions to the
 * next attract state.  Mirrors vanilla G_CheckDemoStatus's call to
 * D_AdvanceDemo at demo end.
 */
export function notifyDemoCompleted(state: FrontEndSequenceState): void {
  state.inDemoPlayback = false;
  state.titleLoop.requestAdvance();
}

/**
 * Sync the menu overlay active flag.  Call with `true` when the
 * menu opens (e.g. the host acted on an `openMenu` key action) and
 * with `false` when the menu closes.  The flag gates
 * {@link handleFrontEndKey} so keystrokes don't double-skip while
 * the overlay is consuming them.
 */
export function setMenuActive(state: FrontEndSequenceState, active: boolean): void {
  state.menuActive = active;
}
