import { describe, expect, test } from 'bun:test';

import { VANILLA_COALESCES_REPEATS_PER_TIC, VANILLA_PRESERVES_AUTO_REPEAT, VANILLA_SUPPRESSES_DUPLICATE_KEYDOWN, evaluateKeyRepeatPreservation } from '../../../src/bootstrap/preserve-key-repeat-behavior.ts';

describe('vanilla key repeat preservation contract', () => {
  test('auto-repeat preserved; not coalesced; duplicate key-down not suppressed', () => {
    expect(VANILLA_PRESERVES_AUTO_REPEAT).toBe(true);
    expect(VANILLA_COALESCES_REPEATS_PER_TIC).toBe(false);
    expect(VANILLA_SUPPRESSES_DUPLICATE_KEYDOWN).toBe(false);
  });
});

describe('evaluateKeyRepeatPreservation', () => {
  test('preserved when observed and expected streams match exactly', () => {
    const stream = [
      { kind: 'key-down' as const, scanCode: 80, isAutoRepeat: false },
      { kind: 'key-down' as const, scanCode: 80, isAutoRepeat: true },
      { kind: 'key-down' as const, scanCode: 80, isAutoRepeat: true },
      { kind: 'key-up' as const, scanCode: 80, isAutoRepeat: false },
    ];
    const decision = evaluateKeyRepeatPreservation(stream, stream);
    expect(decision.preserved).toBe(true);
    expect(decision.violations).toEqual([]);
  });

  test('flags dropped_repeat when observed stream is shorter than expected', () => {
    const expected = [
      { kind: 'key-down' as const, scanCode: 80, isAutoRepeat: false },
      { kind: 'key-down' as const, scanCode: 80, isAutoRepeat: true },
      { kind: 'key-down' as const, scanCode: 80, isAutoRepeat: true },
    ];
    const observed = expected.slice(0, 2);
    const decision = evaluateKeyRepeatPreservation(observed, expected);
    expect(decision.preserved).toBe(false);
    expect(decision.violations).toContain('dropped_repeat');
  });

  test('flags coalesced_repeats when observed has fewer auto-repeats than expected', () => {
    const expected = [
      { kind: 'key-down' as const, scanCode: 80, isAutoRepeat: false },
      { kind: 'key-down' as const, scanCode: 80, isAutoRepeat: true },
      { kind: 'key-down' as const, scanCode: 80, isAutoRepeat: true },
    ];
    const observed = [
      { kind: 'key-down' as const, scanCode: 80, isAutoRepeat: false },
      { kind: 'key-down' as const, scanCode: 80, isAutoRepeat: false },
      { kind: 'key-down' as const, scanCode: 80, isAutoRepeat: false },
    ];
    const decision = evaluateKeyRepeatPreservation(observed, expected);
    expect(decision.preserved).toBe(false);
    expect(decision.violations).toContain('coalesced_repeats');
  });

  test('flags suppressed_duplicate_keydown when same scancode emits only once', () => {
    const expected = [
      { kind: 'key-down' as const, scanCode: 80, isAutoRepeat: false },
      { kind: 'key-down' as const, scanCode: 80, isAutoRepeat: true },
    ];
    const observed = [
      { kind: 'key-down' as const, scanCode: 80, isAutoRepeat: false },
      { kind: 'key-up' as const, scanCode: 80, isAutoRepeat: false },
    ];
    const decision = evaluateKeyRepeatPreservation(observed, expected);
    expect(decision.preserved).toBe(false);
    expect(decision.violations).toContain('suppressed_duplicate_keydown');
  });
});
