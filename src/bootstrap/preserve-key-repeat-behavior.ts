/**
 * Vanilla Chocolate Doom 2.2.1 key repeat preservation contract.
 *
 * Vanilla DOOM relies on the platform's auto-repeat for menu navigation
 * (holding DOWN to scroll through saved games). The host must NOT consume
 * or coalesce repeated key-down events: every repeat key-down arrives at
 * I_StartTic and is enqueued as a fresh ev_keydown event. Key-up events
 * fire exactly once when the physical key releases.
 */

/** Whether the host must preserve OS-level auto-repeat events. */
export const VANILLA_PRESERVES_AUTO_REPEAT = true;

/** Whether the host coalesces multiple repeats per tic. Vanilla: no. */
export const VANILLA_COALESCES_REPEATS_PER_TIC = false;

/** Whether duplicate ev_keydown events with the same scancode are suppressed. Vanilla: no. */
export const VANILLA_SUPPRESSES_DUPLICATE_KEYDOWN = false;

export interface KeyRepeatEvent {
  readonly kind: 'key-down' | 'key-up';
  readonly scanCode: number;
  readonly isAutoRepeat: boolean;
}

export type RepeatViolation = 'coalesced_repeats' | 'dropped_repeat' | 'suppressed_duplicate_keydown';

export interface RepeatDecision {
  readonly preserved: boolean;
  readonly violations: readonly RepeatViolation[];
}

export function evaluateKeyRepeatPreservation(observedEventStream: readonly KeyRepeatEvent[], expectedEventStream: readonly KeyRepeatEvent[]): RepeatDecision {
  const violations: RepeatViolation[] = [];
  if (observedEventStream.length < expectedEventStream.length) {
    violations.push('dropped_repeat');
  }
  let observedRepeats = 0;
  let expectedRepeats = 0;
  for (const event of observedEventStream) {
    if (event.isAutoRepeat) {
      observedRepeats += 1;
    }
  }
  for (const event of expectedEventStream) {
    if (event.isAutoRepeat) {
      expectedRepeats += 1;
    }
  }
  if (observedRepeats < expectedRepeats) {
    violations.push('coalesced_repeats');
  }
  const observedScanCodes = new Set<number>();
  const observedDuplicateScanCodes = new Set<number>();
  for (const event of observedEventStream) {
    if (event.kind === 'key-down') {
      if (observedScanCodes.has(event.scanCode)) {
        observedDuplicateScanCodes.add(event.scanCode);
      }
      observedScanCodes.add(event.scanCode);
    }
  }
  const expectedDuplicateScanCodes = new Set<number>();
  const expectedScanCodes = new Set<number>();
  for (const event of expectedEventStream) {
    if (event.kind === 'key-down') {
      if (expectedScanCodes.has(event.scanCode)) {
        expectedDuplicateScanCodes.add(event.scanCode);
      }
      expectedScanCodes.add(event.scanCode);
    }
  }
  if (observedDuplicateScanCodes.size < expectedDuplicateScanCodes.size) {
    violations.push('suppressed_duplicate_keydown');
  }
  return Object.freeze({
    preserved: violations.length === 0,
    violations: Object.freeze(violations.sort()),
  });
}
