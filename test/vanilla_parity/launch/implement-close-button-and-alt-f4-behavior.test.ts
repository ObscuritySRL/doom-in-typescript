import { describe, expect, test } from 'bun:test';

import {
  VANILLA_CLEAN_QUIT_EXIT_CODE,
  VANILLA_HOST_TRIGGER_BYPASSES_QUIT_MENU,
  VANILLA_PROMPTS_BEFORE_QUIT_ON_HOST_TRIGGER,
  VANILLA_QUIT_PHASE_ORDER,
  VANILLA_QUIT_TRIGGERS,
  evaluateQuitDispatch,
} from '../../../src/bootstrap/implement-close-button-and-alt-f4-behavior.ts';

describe('vanilla close-button and Alt+F4 quit contract', () => {
  test('quit triggers are alt_f4, sigterm, wm_close, sorted and unique', () => {
    expect(VANILLA_QUIT_TRIGGERS).toEqual(['alt_f4', 'sigterm', 'wm_close']);
    expect(new Set(VANILLA_QUIT_TRIGGERS).size).toBe(VANILLA_QUIT_TRIGGERS.length);
  });

  test('quit phase order is m_save_defaults, i_show_endoom, i_exit', () => {
    expect(VANILLA_QUIT_PHASE_ORDER).toEqual(['m_save_defaults', 'i_show_endoom', 'i_exit']);
  });

  test('host-trigger quit does not prompt and bypasses the quit menu; exit code is 0', () => {
    expect(VANILLA_PROMPTS_BEFORE_QUIT_ON_HOST_TRIGGER).toBe(false);
    expect(VANILLA_HOST_TRIGGER_BYPASSES_QUIT_MENU).toBe(true);
    expect(VANILLA_CLEAN_QUIT_EXIT_CODE).toBe(0);
  });
});

describe('evaluateQuitDispatch', () => {
  test('passes on a canonical clean quit from wm_close', () => {
    const decision = evaluateQuitDispatch({
      trigger: 'wm_close',
      observedPhaseOrder: VANILLA_QUIT_PHASE_ORDER,
      observedPromptedBeforeExit: false,
      observedBypassedQuitMenu: true,
      observedExitCode: 0,
    });
    expect(decision.matches).toBe(true);
    expect(decision.violations).toEqual([]);
  });

  test('flags mismatched_phase_order when ENDOOM is shown before saving defaults', () => {
    const decision = evaluateQuitDispatch({
      trigger: 'alt_f4',
      observedPhaseOrder: ['i_show_endoom', 'm_save_defaults', 'i_exit'],
      observedPromptedBeforeExit: false,
      observedBypassedQuitMenu: true,
      observedExitCode: 0,
    });
    expect(decision.matches).toBe(false);
    expect(decision.violations).toContain('mismatched_phase_order');
  });

  test('flags prompted_before_exit when the host shows a confirmation prompt', () => {
    const decision = evaluateQuitDispatch({
      trigger: 'wm_close',
      observedPhaseOrder: VANILLA_QUIT_PHASE_ORDER,
      observedPromptedBeforeExit: true,
      observedBypassedQuitMenu: true,
      observedExitCode: 0,
    });
    expect(decision.matches).toBe(false);
    expect(decision.violations).toContain('prompted_before_exit');
  });

  test('flags quit_menu_not_bypassed when the close button opens the in-engine quit menu', () => {
    const decision = evaluateQuitDispatch({
      trigger: 'wm_close',
      observedPhaseOrder: VANILLA_QUIT_PHASE_ORDER,
      observedPromptedBeforeExit: false,
      observedBypassedQuitMenu: false,
      observedExitCode: 0,
    });
    expect(decision.matches).toBe(false);
    expect(decision.violations).toContain('quit_menu_not_bypassed');
  });

  test('flags wrong_exit_code on a non-zero exit', () => {
    const decision = evaluateQuitDispatch({
      trigger: 'sigterm',
      observedPhaseOrder: VANILLA_QUIT_PHASE_ORDER,
      observedPromptedBeforeExit: false,
      observedBypassedQuitMenu: true,
      observedExitCode: 1,
    });
    expect(decision.matches).toBe(false);
    expect(decision.violations).toContain('wrong_exit_code');
  });
});
