/**
 * Vanilla deterministic input trace recording contract.
 *
 * Mirrors `implement-deterministic-input-trace-injection.ts` for the
 * opposite direction: while a reference run is observed, every input
 * event is appended to a trace buffer keyed by current gametic. The
 * resulting trace must validate against the 02-009 deterministic input
 * stream format and round-trip through injection without drift.
 */

import type { InputEventKind } from '../oracles/inputScript.ts';

export interface RecordedEvent {
  readonly tic: number;
  readonly kind: InputEventKind;
  readonly payload: Readonly<Record<string, number>>;
}

export type RecordingViolation = 'past_tic_record' | 'unknown_event_kind' | 'tic_clock_regressed';

export interface RecordingDecision {
  readonly appendedTrace: readonly RecordedEvent[];
  readonly violations: readonly RecordingViolation[];
}

const VALID_KINDS: ReadonlySet<InputEventKind> = new Set(['key-down', 'key-up', 'mouse-button-down', 'mouse-button-up', 'mouse-move', 'quit']);

export function recordEvents(existingTrace: readonly RecordedEvent[], newEvents: readonly RecordedEvent[], currentTic: number): RecordingDecision {
  const appendedTrace: RecordedEvent[] = [...existingTrace];
  const violations = new Set<RecordingViolation>();
  if (existingTrace.length > 0) {
    const lastRecordedTic = existingTrace[existingTrace.length - 1]!.tic;
    if (currentTic < lastRecordedTic) {
      violations.add('tic_clock_regressed');
    }
  }
  for (const event of newEvents) {
    if (!VALID_KINDS.has(event.kind)) {
      violations.add('unknown_event_kind');
    }
    if (event.tic < currentTic) {
      violations.add('past_tic_record');
    }
    appendedTrace.push(event);
  }
  return Object.freeze({
    appendedTrace: Object.freeze(appendedTrace),
    violations: Object.freeze([...violations].sort()),
  });
}
