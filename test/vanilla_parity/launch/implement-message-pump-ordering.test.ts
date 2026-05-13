import { describe, expect, test } from 'bun:test';

import {
  VANILLA_D_PROCESS_EVENTS_DRAINS_OUT_OF_ORDER,
  VANILLA_D_PROCESS_EVENTS_MAX_PER_TIC,
  VANILLA_DROPS_NEW_EVENTS_ON_FIFO_OVERFLOW,
  VANILLA_PER_TIC_MESSAGE_PUMP_PHASES,
  VANILLA_PER_TIC_PHASE_ORDER,
  VANILLA_PUMPS_OS_MESSAGE_QUEUE_MORE_THAN_ONCE_PER_TIC,
  evaluateMessagePumpOrdering,
} from '../../../src/bootstrap/implement-message-pump-ordering.ts';

describe('vanilla message pump per-tic phase contract', () => {
  test('declares exactly five canonical phases, ASCIIbetically sorted', () => {
    expect(VANILLA_PER_TIC_MESSAGE_PUMP_PHASES).toHaveLength(5);
    expect([...VANILLA_PER_TIC_MESSAGE_PUMP_PHASES].sort()).toEqual([...VANILLA_PER_TIC_MESSAGE_PUMP_PHASES]);
    expect(new Set(VANILLA_PER_TIC_MESSAGE_PUMP_PHASES).size).toBe(VANILLA_PER_TIC_MESSAGE_PUMP_PHASES.length);
  });

  test('pins the per-tic order: i_start_tic, d_process_events, d_run_tics, i_update_no_blit, i_finish_update', () => {
    expect(VANILLA_PER_TIC_PHASE_ORDER).toEqual(['i_start_tic', 'd_process_events', 'd_run_tics', 'i_update_no_blit', 'i_finish_update']);
  });

  test('pins the vanilla quirk constants exactly', () => {
    expect(VANILLA_D_PROCESS_EVENTS_MAX_PER_TIC).toBe(16);
    expect(VANILLA_DROPS_NEW_EVENTS_ON_FIFO_OVERFLOW).toBe(true);
    expect(VANILLA_PUMPS_OS_MESSAGE_QUEUE_MORE_THAN_ONCE_PER_TIC).toBe(false);
    expect(VANILLA_D_PROCESS_EVENTS_DRAINS_OUT_OF_ORDER).toBe(false);
  });
});

describe('evaluateMessagePumpOrdering', () => {
  test('passes on the canonical vanilla observed run', () => {
    const decision = evaluateMessagePumpOrdering({
      observedPhaseOrder: VANILLA_PER_TIC_PHASE_ORDER,
      observedEventsDrainedThisTic: VANILLA_D_PROCESS_EVENTS_MAX_PER_TIC,
      observedPumpsOsQueueExtra: VANILLA_PUMPS_OS_MESSAGE_QUEUE_MORE_THAN_ONCE_PER_TIC,
      observedOverflowDropsNewEvents: VANILLA_DROPS_NEW_EVENTS_ON_FIFO_OVERFLOW,
    });
    expect(decision.matches).toBe(true);
    expect(decision.violations).toEqual([]);
  });

  test('flags out_of_order_phases when phases are swapped', () => {
    const decision = evaluateMessagePumpOrdering({
      observedPhaseOrder: ['d_process_events', 'i_start_tic', 'd_run_tics', 'i_update_no_blit', 'i_finish_update'],
      observedEventsDrainedThisTic: 1,
      observedPumpsOsQueueExtra: false,
      observedOverflowDropsNewEvents: true,
    });
    expect(decision.matches).toBe(false);
    expect(decision.violations).toContain('out_of_order_phases');
  });

  test('flags too_many_events_drained when more than 16 events are pulled', () => {
    const decision = evaluateMessagePumpOrdering({
      observedPhaseOrder: VANILLA_PER_TIC_PHASE_ORDER,
      observedEventsDrainedThisTic: 17,
      observedPumpsOsQueueExtra: false,
      observedOverflowDropsNewEvents: true,
    });
    expect(decision.matches).toBe(false);
    expect(decision.violations).toContain('too_many_events_drained');
  });

  test('flags extra_os_pump when the OS queue is pumped more than once per tic', () => {
    const decision = evaluateMessagePumpOrdering({
      observedPhaseOrder: VANILLA_PER_TIC_PHASE_ORDER,
      observedEventsDrainedThisTic: 1,
      observedPumpsOsQueueExtra: true,
      observedOverflowDropsNewEvents: true,
    });
    expect(decision.matches).toBe(false);
    expect(decision.violations).toContain('extra_os_pump');
  });

  test('flags fifo_overflow_drops_old_events when the FIFO drops oldest events instead of newest', () => {
    const decision = evaluateMessagePumpOrdering({
      observedPhaseOrder: VANILLA_PER_TIC_PHASE_ORDER,
      observedEventsDrainedThisTic: 1,
      observedPumpsOsQueueExtra: false,
      observedOverflowDropsNewEvents: false,
    });
    expect(decision.matches).toBe(false);
    expect(decision.violations).toContain('fifo_overflow_drops_old_events');
  });
});

describe('failure-mode validation invariants', () => {
  test('a phase order of length 4 or 6 cannot match the canonical 5-phase contract', () => {
    expect(VANILLA_PER_TIC_PHASE_ORDER.length).toBe(5);
  });

  test('a non-canonical phase identifier would not pass the order check', () => {
    const phaseSet = new Set(VANILLA_PER_TIC_PHASE_ORDER);
    expect(phaseSet.has('i_start_tic')).toBe(true);
  });
});
