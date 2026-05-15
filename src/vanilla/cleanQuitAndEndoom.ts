/**
 * Vanilla DOOM 1.9 clean-quit + ENDOOM launch-host wiring.
 *
 * Plan_final step `03-009` (lane: launch-host-input) maps every
 * host-level quit trigger — explicit `I_Quit`, the window close
 * button (WM_CLOSE / the title-bar X / Alt-F4), a confirmed in-game
 * Quit Game, and a fatal `I_Error` — onto the correct
 * {@link QuitFlow} drain path, the resulting cleanup-step order, the
 * process exit code, and whether the ENDOOM text screen is presented.
 *
 * The quit/ENDOOM surface itself (the read-only `src/ui/endoom.ts`
 * parser and `src/bootstrap/quitFlow.ts` I_AtExit model) is owned by
 * the `07-010` facade {@link ./wireQuitAndEndoomUi.ts}; this module
 * re-exports through that single surface rather than importing the
 * read-only modules a second time, and adds only the launch-host
 * trigger → plan resolution plus a frozen invariants manifest.  No
 * read-only module is modified, and the actual Win32 message-pump /
 * `exit()` call stays in `src/launcher/win32.ts` (FFI cannot be
 * unit-tested without a real window).
 *
 * Parity-anchored quit-trigger semantics (Chocolate Doom 2.2.1
 * `i_system.c` `I_Quit` / `I_Error`, `m_menu.c` `M_QuitResponse`,
 * SDL window-close → `SDL_QUIT` → `I_Quit`):
 *
 *   - `normalQuit`        — explicit `I_Quit`: full LIFO drain
 *                           (`executeQuit`), ENDOOM presented,
 *                           exit code 0.
 *   - `windowClose`       — the WM_CLOSE / X / Alt-F4 path is
 *                           translated to a clean `I_Quit`, so it is
 *                           identical to `normalQuit`.
 *   - `menuQuitConfirmed` — the Quit Game menu action answered
 *                           "yes" routes through `M_QuitResponse`
 *                           into `I_Quit`; identical to `normalQuit`.
 *   - `fatalError`        — `I_Error`: `executeErrorQuit` drain, the
 *                           graphical ENDOOM screen is NOT presented
 *                           (vanilla prints the message and exits),
 *                           process exit code 1.
 *
 * @example
 * ```ts
 * import { resolveQuitPlan, runQuitPlan, QuitFlow, CANONICAL_REGISTRATION_ORDER } from './cleanQuitAndEndoom.ts';
 * resolveQuitPlan('windowClose').showEndoom;   // true
 * resolveQuitPlan('fatalError').exitCode;      // 1
 *
 * const flow = new QuitFlow();
 * for (const r of CANONICAL_REGISTRATION_ORDER) flow.register(r.name, r.runOnError);
 * const { plan, executed } = runQuitPlan(flow, 'normalQuit', () => {});
 * plan.path;        // 'normal'
 * executed.length;  // 8
 * ```
 */

export {
  CANONICAL_QUIT_ORDER,
  CANONICAL_REGISTRATION_ORDER,
  CLEANUP_STEP_COUNT,
  ENDOOM_BYTES_PER_CELL,
  ENDOOM_CELL_COUNT,
  ENDOOM_COLUMNS,
  ENDOOM_ROWS,
  ENDOOM_SIZE,
  QuitFlow,
  VANILLA_QUIT_ENDOOM_INVARIANTS,
  parseEndoom,
} from './wireQuitAndEndoomUi.ts';
export type { CleanupRegistration, CleanupStepName, EndoomCell, EndoomScreen, VanillaQuitEndoomInvariant } from './wireQuitAndEndoomUi.ts';

import { QuitFlow } from './wireQuitAndEndoomUi.ts';
import type { CleanupStepName } from './wireQuitAndEndoomUi.ts';

/**
 * Host-level events that initiate process termination.  Sorted
 * ASCIIbetically per project convention.
 */
export type QuitTrigger = 'fatalError' | 'menuQuitConfirmed' | 'normalQuit' | 'windowClose';

/**
 * The deterministic termination plan for a {@link QuitTrigger}.
 */
export interface QuitPlan {
  /** Process exit code: 0 for a clean quit, 1 for a fatal error. */
  readonly exitCode: number;
  /** Which {@link QuitFlow} drain a host driver must run. */
  readonly path: 'error' | 'normal';
  /** Whether the graphical ENDOOM text screen is presented to the user. */
  readonly showEndoom: boolean;
  /** True when the I_Error (`executeErrorQuit`) drain is used. */
  readonly usesErrorQuit: boolean;
}

const NORMAL_QUIT_PLAN: QuitPlan = Object.freeze({ exitCode: 0, path: 'normal', showEndoom: true, usesErrorQuit: false } satisfies QuitPlan);
const FATAL_ERROR_PLAN: QuitPlan = Object.freeze({ exitCode: 1, path: 'error', showEndoom: false, usesErrorQuit: true } satisfies QuitPlan);

/**
 * Resolve the deterministic {@link QuitPlan} for a host quit trigger.
 *
 * The three clean-quit triggers (`normalQuit`, `windowClose`,
 * `menuQuitConfirmed`) all collapse onto the vanilla `I_Quit` path;
 * only `fatalError` (`I_Error`) diverges.
 *
 * @param trigger The host event that initiated termination.
 * @returns A frozen {@link QuitPlan}.
 */
export function resolveQuitPlan(trigger: QuitTrigger): QuitPlan {
  return trigger === 'fatalError' ? FATAL_ERROR_PLAN : NORMAL_QUIT_PLAN;
}

/**
 * Drain a {@link QuitFlow} along the path the trigger resolves to and
 * return both the plan and the executed cleanup-step order.
 *
 * `normalQuit` / `windowClose` / `menuQuitConfirmed` run
 * {@link QuitFlow.executeQuit}; `fatalError` runs
 * {@link QuitFlow.executeErrorQuit}.
 *
 * @param flow     A populated {@link QuitFlow} (registrations pushed).
 * @param trigger  The host quit trigger.
 * @param dispatch Called once per executed cleanup step, in order.
 * @returns The resolved plan and the frozen executed step-name list.
 */
export function runQuitPlan(flow: QuitFlow, trigger: QuitTrigger, dispatch: (name: CleanupStepName) => void): { readonly executed: readonly CleanupStepName[]; readonly plan: QuitPlan } {
  const plan = resolveQuitPlan(trigger);
  const executed = plan.usesErrorQuit ? flow.executeErrorQuit(dispatch) : flow.executeQuit(dispatch);
  return { executed, plan };
}

/**
 * One pinned clean-quit / ENDOOM launch-host parity invariant.
 */
export interface VanillaCleanQuitInvariant {
  readonly id: 'CLOSE_BUTTON_MAPS_TO_CLEAN_I_QUIT' | 'ENDOOM_PRESENTED_ONLY_ON_CLEAN_QUIT' | 'FATAL_ERROR_USES_ERROR_QUIT_AND_NONZERO_EXIT' | 'MENU_QUIT_CONFIRMATION_ROUTES_TO_I_QUIT';
  readonly rule: string;
}

/**
 * Frozen manifest of the four launch-host quit/ENDOOM parity
 * invariants this step pins.  A later step that wires the Win32
 * message pump into the host driver must preserve all four.
 */
export const VANILLA_CLEAN_QUIT_INVARIANTS: readonly VanillaCleanQuitInvariant[] = Object.freeze([
  Object.freeze({
    id: 'CLOSE_BUTTON_MAPS_TO_CLEAN_I_QUIT',
    rule: 'The window close button (WM_CLOSE / title-bar X / Alt-F4) is translated to a clean I_Quit: full LIFO QuitFlow.executeQuit drain, ENDOOM presented, process exit code 0 — identical to an explicit normalQuit.',
  } satisfies VanillaCleanQuitInvariant),
  Object.freeze({
    id: 'ENDOOM_PRESENTED_ONLY_ON_CLEAN_QUIT',
    rule: 'The graphical ENDOOM text screen is presented on the clean-quit triggers (normalQuit, windowClose, menuQuitConfirmed) and never on the fatalError (I_Error) path, where vanilla prints the error message and exits without presenting ENDOOM.',
  } satisfies VanillaCleanQuitInvariant),
  Object.freeze({
    id: 'FATAL_ERROR_USES_ERROR_QUIT_AND_NONZERO_EXIT',
    rule: 'A fatalError trigger runs QuitFlow.executeErrorQuit (the I_Error drain) and terminates with a non-zero process exit code (1), distinct from the exit-code-0 clean-quit path.',
  } satisfies VanillaCleanQuitInvariant),
  Object.freeze({
    id: 'MENU_QUIT_CONFIRMATION_ROUTES_TO_I_QUIT',
    rule: 'A confirmed in-game Quit Game (the 07-010 quitGame menu action answered "yes" via M_QuitResponse) routes into the same clean I_Quit path as normalQuit: full drain, ENDOOM presented, exit code 0.',
  } satisfies VanillaCleanQuitInvariant),
]);
