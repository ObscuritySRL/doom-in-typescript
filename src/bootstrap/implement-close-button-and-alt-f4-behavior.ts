/**
 * Vanilla Chocolate Doom 2.2.1 host close-button and Alt+F4 behavior contract.
 *
 * The close button (WM_CLOSE) and Alt+F4 (WM_SYSKEYDOWN with VK_F4 + Alt modifier)
 * both trigger I_Quit, which dispatches the canonical clean-exit sequence: save
 * config via M_SaveDefaults, optionally display ENDOOM, then exit with code 0.
 * Vanilla does not prompt the user before quitting and does not bind close-button
 * dispatch to any in-engine menu key.
 */

/** Frozen list of host events that vanilla treats as immediate-quit triggers. */
export const VANILLA_QUIT_TRIGGERS = Object.freeze(['alt_f4', 'sigterm', 'wm_close'] as const);

export type QuitTrigger = (typeof VANILLA_QUIT_TRIGGERS)[number];

/** Frozen sequence of clean-quit phases executed by I_Quit before the process exits. */
export const VANILLA_QUIT_PHASE_ORDER = Object.freeze(['m_save_defaults', 'i_show_endoom', 'i_exit'] as const);

export type QuitPhase = (typeof VANILLA_QUIT_PHASE_ORDER)[number];

/** Whether vanilla prompts the user before quitting from the close button or Alt+F4. */
export const VANILLA_PROMPTS_BEFORE_QUIT_ON_HOST_TRIGGER = false;

/** Whether the close button suppresses the in-engine "quit y/n" menu. */
export const VANILLA_HOST_TRIGGER_BYPASSES_QUIT_MENU = true;

/** Vanilla process exit code for a clean quit. */
export const VANILLA_CLEAN_QUIT_EXIT_CODE = 0;

export interface QuitDispatchInput {
  readonly trigger: QuitTrigger;
  readonly observedPhaseOrder: readonly QuitPhase[];
  readonly observedPromptedBeforeExit: boolean;
  readonly observedBypassedQuitMenu: boolean;
  readonly observedExitCode: number;
}

export type QuitDispatchViolation = 'mismatched_phase_order' | 'prompted_before_exit' | 'quit_menu_not_bypassed' | 'wrong_exit_code';

export interface QuitDispatchDecision {
  readonly matches: boolean;
  readonly violations: readonly QuitDispatchViolation[];
}

function comparePhaseOrder(observedOrder: readonly QuitPhase[], expectedOrder: readonly QuitPhase[]): boolean {
  if (observedOrder.length !== expectedOrder.length) {
    return false;
  }
  for (let phaseIndex = 0; phaseIndex < expectedOrder.length; phaseIndex += 1) {
    if (observedOrder[phaseIndex] !== expectedOrder[phaseIndex]) {
      return false;
    }
  }
  return true;
}

export function evaluateQuitDispatch(input: QuitDispatchInput): QuitDispatchDecision {
  const violations: QuitDispatchViolation[] = [];
  if (!comparePhaseOrder(input.observedPhaseOrder, VANILLA_QUIT_PHASE_ORDER)) {
    violations.push('mismatched_phase_order');
  }
  if (input.observedPromptedBeforeExit !== VANILLA_PROMPTS_BEFORE_QUIT_ON_HOST_TRIGGER) {
    violations.push('prompted_before_exit');
  }
  if (input.observedBypassedQuitMenu !== VANILLA_HOST_TRIGGER_BYPASSES_QUIT_MENU) {
    violations.push('quit_menu_not_bypassed');
  }
  if (input.observedExitCode !== VANILLA_CLEAN_QUIT_EXIT_CODE) {
    violations.push('wrong_exit_code');
  }
  return Object.freeze({
    matches: violations.length === 0,
    violations: Object.freeze(violations.sort()),
  });
}
