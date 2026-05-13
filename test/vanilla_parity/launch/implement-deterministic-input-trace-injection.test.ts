import { describe, expect, test } from 'bun:test';

import { injectTraceForTic } from '../../../src/bootstrap/implement-deterministic-input-trace-injection.ts';

describe('deterministic input trace injection', () => {
  test('injects events matching current tic and keeps future events', () => {
    const trace = [
      { tic: 0, kind: 'key-down' as const, payload: { scanCode: 28 } },
      { tic: 0, kind: 'key-up' as const, payload: { scanCode: 28 } },
      { tic: 5, kind: 'key-down' as const, payload: { scanCode: 80 } },
    ];
    const decision = injectTraceForTic(0, trace);
    expect(decision.injectedThisTic).toHaveLength(2);
    expect(decision.remainingTrace).toHaveLength(1);
    expect(decision.violations).toEqual([]);
  });

  test('flags past_tic_event when an event tic is below the current tic', () => {
    const trace = [{ tic: 0, kind: 'key-down' as const, payload: {} }];
    const decision = injectTraceForTic(5, trace);
    expect(decision.violations).toContain('past_tic_event');
    expect(decision.injectedThisTic).toEqual([]);
  });

  test('flags unsorted_trace when events arrive out of order', () => {
    const trace = [
      { tic: 5, kind: 'key-down' as const, payload: {} },
      { tic: 1, kind: 'key-up' as const, payload: {} },
    ];
    const decision = injectTraceForTic(0, trace);
    expect(decision.violations).toContain('unsorted_trace');
  });

  test('flags unknown_event_kind for non-canonical kinds', () => {
    const trace = [{ tic: 0, kind: 'gamepad-press' as never, payload: {} }];
    const decision = injectTraceForTic(0, trace);
    expect(decision.violations).toContain('unknown_event_kind');
  });

  test('empty trace yields nothing injected and nothing remaining', () => {
    const decision = injectTraceForTic(0, []);
    expect(decision.injectedThisTic).toEqual([]);
    expect(decision.remainingTrace).toEqual([]);
    expect(decision.violations).toEqual([]);
  });
});
