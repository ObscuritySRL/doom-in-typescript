import { describe, expect, test } from 'bun:test';

import { recordEvents } from '../../../src/bootstrap/implement-deterministic-input-trace-recording.ts';

describe('deterministic input trace recording', () => {
  test('appends new events to existing trace at current tic', () => {
    const decision = recordEvents([], [{ tic: 0, kind: 'key-down', payload: { scanCode: 28 } }], 0);
    expect(decision.appendedTrace).toHaveLength(1);
    expect(decision.violations).toEqual([]);
  });

  test('flags past_tic_record when an event tic is before the current tic', () => {
    const decision = recordEvents([], [{ tic: 0, kind: 'key-down', payload: {} }], 5);
    expect(decision.violations).toContain('past_tic_record');
  });

  test('flags tic_clock_regressed when current tic moves backwards', () => {
    const existing = [{ tic: 5, kind: 'key-down' as const, payload: {} }];
    const decision = recordEvents(existing, [], 3);
    expect(decision.violations).toContain('tic_clock_regressed');
  });

  test('flags unknown_event_kind for non-canonical kinds', () => {
    const decision = recordEvents([], [{ tic: 0, kind: 'gamepad-axis' as never, payload: {} }], 0);
    expect(decision.violations).toContain('unknown_event_kind');
  });

  test('empty new events with empty existing yields no violations', () => {
    const decision = recordEvents([], [], 0);
    expect(decision.appendedTrace).toEqual([]);
    expect(decision.violations).toEqual([]);
  });
});
