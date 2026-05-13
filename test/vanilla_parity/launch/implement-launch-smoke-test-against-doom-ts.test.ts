import { describe, expect, test } from 'bun:test';

import { VANILLA_PER_TIC_PHASE_ORDER } from '../../../src/bootstrap/implement-message-pump-ordering.ts';
import { VANILLA_PRE_LOOP_PHASES, evaluateLaunchSmoke } from '../../../src/bootstrap/implement-launch-smoke-test-against-doom-ts.ts';

describe('vanilla launch smoke contract', () => {
  test('pre-loop phase list begins with parse_cmdline and ends with i_init_stretch_tables', () => {
    expect(VANILLA_PRE_LOOP_PHASES[0]).toBe('parse_cmdline');
    expect(VANILLA_PRE_LOOP_PHASES[VANILLA_PRE_LOOP_PHASES.length - 1]).toBe('i_init_stretch_tables');
  });

  test('pre-loop phase list includes core init phases Z_init through S_init', () => {
    expect(VANILLA_PRE_LOOP_PHASES).toContain('z_init');
    expect(VANILLA_PRE_LOOP_PHASES).toContain('w_init');
    expect(VANILLA_PRE_LOOP_PHASES).toContain('r_init');
    expect(VANILLA_PRE_LOOP_PHASES).toContain('p_init');
    expect(VANILLA_PRE_LOOP_PHASES).toContain('s_init');
  });
});

describe('evaluateLaunchSmoke', () => {
  test('passes on the canonical phase order and per-tic order', () => {
    const decision = evaluateLaunchSmoke({
      observedPreLoopPhases: [...VANILLA_PRE_LOOP_PHASES],
      enteredDoomLoop: true,
      firstPerTicPhaseOrder: [...VANILLA_PER_TIC_PHASE_ORDER],
    });
    expect(decision.passed).toBe(true);
    expect(decision.violations).toEqual([]);
  });

  test('flags missing_pre_loop_phase when a phase is missing', () => {
    const decision = evaluateLaunchSmoke({
      observedPreLoopPhases: VANILLA_PRE_LOOP_PHASES.slice(0, -1),
      enteredDoomLoop: true,
      firstPerTicPhaseOrder: [...VANILLA_PER_TIC_PHASE_ORDER],
    });
    expect(decision.passed).toBe(false);
    expect(decision.violations).toContain('missing_pre_loop_phase');
  });

  test('flags did_not_enter_doom_loop when the loop entry never fires', () => {
    const decision = evaluateLaunchSmoke({
      observedPreLoopPhases: [...VANILLA_PRE_LOOP_PHASES],
      enteredDoomLoop: false,
      firstPerTicPhaseOrder: [...VANILLA_PER_TIC_PHASE_ORDER],
    });
    expect(decision.passed).toBe(false);
    expect(decision.violations).toContain('did_not_enter_doom_loop');
  });

  test('flags per_tic_phase_order_mismatch when the per-tic order is wrong', () => {
    const decision = evaluateLaunchSmoke({
      observedPreLoopPhases: [...VANILLA_PRE_LOOP_PHASES],
      enteredDoomLoop: true,
      firstPerTicPhaseOrder: ['d_process_events', 'i_start_tic', 'd_run_tics', 'i_update_no_blit', 'i_finish_update'],
    });
    expect(decision.passed).toBe(false);
    expect(decision.violations).toContain('per_tic_phase_order_mismatch');
  });
});
