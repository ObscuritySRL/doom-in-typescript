/**
 * Vanilla Chocolate Doom 2.2.1 key-down/key-up event ordering preservation.
 *
 * Every physical keystroke produces exactly one ev_keydown followed by exactly
 * one ev_keyup, in that order. Events for different scancodes may interleave
 * freely. The host must not emit an ev_keyup without a prior matching
 * ev_keydown for the same scancode, and must emit ev_keyup exactly once per
 * physical release.
 */

export interface KeyOrderingEvent {
  readonly kind: 'key-down' | 'key-up';
  readonly scanCode: number;
}

export type KeyOrderingViolation = 'keyup_without_keydown' | 'multiple_keyup_per_keydown' | 'multiple_keydown_without_keyup';

export interface KeyOrderingDecision {
  readonly ordered: boolean;
  readonly violations: readonly KeyOrderingViolation[];
}

/**
 * Validate that the stream's per-scancode events follow the
 * down-then-up-once-each contract. Auto-repeat key-downs (multiple
 * key-down without a key-up) are explicitly tolerated by vanilla
 * (preserved by `preserve-key-repeat-behavior.ts`).
 */
export function evaluateKeyOrdering(stream: readonly KeyOrderingEvent[], allowAutoRepeat: boolean): KeyOrderingDecision {
  const violations = new Set<KeyOrderingViolation>();
  const downsByScanCode = new Map<number, number>();
  for (const event of stream) {
    if (event.kind === 'key-down') {
      const currentDownCount = downsByScanCode.get(event.scanCode) ?? 0;
      if (currentDownCount >= 1 && !allowAutoRepeat) {
        violations.add('multiple_keydown_without_keyup');
      }
      downsByScanCode.set(event.scanCode, currentDownCount + 1);
    } else {
      const currentDownCount = downsByScanCode.get(event.scanCode) ?? 0;
      if (currentDownCount === 0) {
        violations.add('keyup_without_keydown');
      } else if (currentDownCount > 1 && !allowAutoRepeat) {
        violations.add('multiple_keyup_per_keydown');
      }
      downsByScanCode.set(event.scanCode, 0);
    }
  }
  const sortedViolations = [...violations].sort();
  return Object.freeze({
    ordered: sortedViolations.length === 0,
    violations: Object.freeze(sortedViolations),
  });
}
