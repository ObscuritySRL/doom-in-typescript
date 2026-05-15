/**
 * Vanilla DOOM 1.9 quit-confirmation + ENDOOM display facade.
 *
 * Plan_final step `07-010` (lane: ui) wires the Quit Game
 * confirmation, the randomized quit-prompt text, and the ENDOOM
 * text-screen display into the clean-quit cleanup path so the exit
 * sequence matches vanilla `m_menu.c` `M_QuitDOOM` + `i_system.c`
 * `I_Quit` / `I_AtExit` exactly.
 *
 * The read-only `src/ui/endoom.ts` already parses the 80x25 VGA
 * text-mode ENDOOM lump and `src/bootstrap/quitFlow.ts` already
 * models the I_AtExit LIFO cleanup stack; both are SHA-pinned by the
 * inventory and are NOT modified here.  The `quitGame` MenuAction
 * that opens the confirmation overlay was pinned upstream by
 * `07-003` (`VANILLA_MENU_ACTION_KINDS`).  This module is a pure
 * re-export barrel plus a frozen invariants manifest binding those
 * pieces into the quit path.
 *
 * Four parity invariants this step pins:
 *
 *   1. **Quit is gated by a randomized yes/no confirmation.**  The
 *      `quitGame` menu action opens a message overlay; vanilla
 *      `M_QuitDOOM` selects the prompt string from the `endmsg[]`
 *      array by `gametic % NUM_QUITMESSAGES`, so the wording varies
 *      per quit but is deterministic for a given `gametic`.  No
 *      cleanup or ENDOOM runs until the player answers "yes".
 *   2. **Confirmed quit drains the I_AtExit stack in LIFO order.**
 *      `QuitFlow.executeQuit` walks `CANONICAL_REGISTRATION_ORDER`
 *      in reverse, yielding `CANONICAL_QUIT_ORDER`.
 *   3. **ENDOOM is shown immediately after graphics shutdown.**  In
 *      `CANONICAL_QUIT_ORDER` `I_ShutdownGraphics` runs first and
 *      `D_Endoom` second, so the ENDOOM text screen is presented
 *      once the video mode is torn down and before the remaining
 *      shutdown steps.
 *   4. **ENDOOM is the canonical 80x25 / 4000-byte VGA text screen.**
 *      `parseEndoom` requires exactly `ENDOOM_SIZE` (4000) bytes and
 *      yields `ENDOOM_CELL_COUNT` (2000) frozen cells; it is the only
 *      ENDOOM decode on the clean-quit path.
 *
 * @example
 * ```ts
 * import { CANONICAL_QUIT_ORDER, VANILLA_QUIT_ENDOOM_INVARIANTS } from './wireQuitAndEndoomUi.ts';
 * CANONICAL_QUIT_ORDER[0];                 // 'I_ShutdownGraphics'
 * CANONICAL_QUIT_ORDER[1];                 // 'D_Endoom'
 * VANILLA_QUIT_ENDOOM_INVARIANTS.length;   // 4
 * ```
 */

export { ENDOOM_BYTES_PER_CELL, ENDOOM_CELL_COUNT, ENDOOM_COLUMNS, ENDOOM_ROWS, ENDOOM_SIZE, parseEndoom } from '../ui/endoom.ts';
export type { EndoomCell, EndoomScreen } from '../ui/endoom.ts';
export { CANONICAL_QUIT_ORDER, CANONICAL_REGISTRATION_ORDER, CLEANUP_STEP_COUNT, QuitFlow } from '../bootstrap/quitFlow.ts';
export type { CleanupRegistration, CleanupStepName } from '../bootstrap/quitFlow.ts';

/**
 * One pinned quit/ENDOOM parity invariant.
 */
export interface VanillaQuitEndoomInvariant {
  readonly id: 'CLEAN_QUIT_DRAINS_ATEXIT_STACK_LIFO' | 'ENDOOM_IS_80X25_VGA_TEXT_SCREEN' | 'ENDOOM_SHOWN_AFTER_GRAPHICS_SHUTDOWN' | 'QUIT_REQUIRES_RANDOMIZED_CONFIRMATION';
  readonly rule: string;
}

/**
 * Frozen manifest of the four quit-confirmation / ENDOOM-display
 * parity invariants this step pins.  A later step that wires the
 * quit path into the live host must preserve all four.
 */
export const VANILLA_QUIT_ENDOOM_INVARIANTS: readonly VanillaQuitEndoomInvariant[] = Object.freeze([
  Object.freeze({
    id: 'CLEAN_QUIT_DRAINS_ATEXIT_STACK_LIFO',
    rule: 'A confirmed quit calls QuitFlow.executeQuit, which walks CANONICAL_REGISTRATION_ORDER in reverse (LIFO) and yields CANONICAL_QUIT_ORDER, matching i_system.c I_Quit draining the I_AtExit linked list.',
  } satisfies VanillaQuitEndoomInvariant),
  Object.freeze({
    id: 'ENDOOM_IS_80X25_VGA_TEXT_SCREEN',
    rule: 'parseEndoom requires exactly ENDOOM_SIZE (4000) bytes and produces ENDOOM_CELL_COUNT (2000) frozen cells in an ENDOOM_COLUMNS x ENDOOM_ROWS (80 x 25) VGA text grid; it is the only ENDOOM decode on the clean-quit path.',
  } satisfies VanillaQuitEndoomInvariant),
  Object.freeze({
    id: 'ENDOOM_SHOWN_AFTER_GRAPHICS_SHUTDOWN',
    rule: 'CANONICAL_QUIT_ORDER runs I_ShutdownGraphics first and D_Endoom second, so the ENDOOM text screen is displayed only after the video mode is torn down and before the remaining shutdown steps.',
  } satisfies VanillaQuitEndoomInvariant),
  Object.freeze({
    id: 'QUIT_REQUIRES_RANDOMIZED_CONFIRMATION',
    rule: 'The quitGame menu action (pinned by 07-003) opens a yes/no message overlay whose prompt vanilla M_QuitDOOM selects from endmsg[] by gametic % NUM_QUITMESSAGES; no cleanup or ENDOOM runs until the player confirms "yes".',
  } satisfies VanillaQuitEndoomInvariant),
]);
