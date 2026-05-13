/**
 * Vanilla deterministic input trace injection contract.
 *
 * For oracle-capture runs, the host replays a pre-recorded input trace
 * (matching the 02-009 deterministic input stream format) instead of
 * polling the OS. Each tic, all events whose tic field equals the current
 * gametic are dispatched to the local FIFO in insertion order before
 * D_ProcessEvents runs. Events for future tics remain queued; events for
 * past tics indicate a trace error.
 */

import type { InputEventKind } from '../oracles/inputScript.ts';

export interface TraceEvent {
  readonly tic: number;
  readonly kind: InputEventKind;
  readonly payload: Readonly<Record<string, number>>;
}

export type TraceInjectionViolation = 'past_tic_event' | 'unsorted_trace' | 'unknown_event_kind';

export interface TraceInjectionDecision {
  readonly injectedThisTic: readonly TraceEvent[];
  readonly remainingTrace: readonly TraceEvent[];
  readonly violations: readonly TraceInjectionViolation[];
}

const VALID_KINDS: ReadonlySet<InputEventKind> = new Set(['key-down', 'key-up', 'mouse-button-down', 'mouse-button-up', 'mouse-move', 'quit']);

export function injectTraceForTic(currentTic: number, trace: readonly TraceEvent[]): TraceInjectionDecision {
  const injected: TraceEvent[] = [];
  const remaining: TraceEvent[] = [];
  const violations = new Set<TraceInjectionViolation>();
  let previousTic = -1;
  for (const event of trace) {
    if (event.tic < previousTic) {
      violations.add('unsorted_trace');
    }
    previousTic = event.tic;
    if (!VALID_KINDS.has(event.kind)) {
      violations.add('unknown_event_kind');
    }
    if (event.tic < currentTic) {
      violations.add('past_tic_event');
      continue;
    }
    if (event.tic === currentTic) {
      injected.push(event);
    } else {
      remaining.push(event);
    }
  }
  return Object.freeze({
    injectedThisTic: Object.freeze(injected),
    remainingTrace: Object.freeze(remaining),
    violations: Object.freeze([...violations].sort()),
  });
}
