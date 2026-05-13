import { describe, expect, test } from 'bun:test';

import { evaluateKeyOrdering } from '../../../src/bootstrap/preserve-key-down-up-event-ordering.ts';

describe('vanilla key-down/key-up event ordering preservation', () => {
  test('a single down-then-up sequence is ordered', () => {
    const decision = evaluateKeyOrdering(
      [
        { kind: 'key-down', scanCode: 28 },
        { kind: 'key-up', scanCode: 28 },
      ],
      false,
    );
    expect(decision.ordered).toBe(true);
    expect(decision.violations).toEqual([]);
  });

  test('auto-repeat key-downs are permitted when allowAutoRepeat is true', () => {
    const decision = evaluateKeyOrdering(
      [
        { kind: 'key-down', scanCode: 80 },
        { kind: 'key-down', scanCode: 80 },
        { kind: 'key-down', scanCode: 80 },
        { kind: 'key-up', scanCode: 80 },
      ],
      true,
    );
    expect(decision.ordered).toBe(true);
  });

  test('multiple key-downs without a key-up violate ordering when auto-repeat is disallowed', () => {
    const decision = evaluateKeyOrdering(
      [
        { kind: 'key-down', scanCode: 80 },
        { kind: 'key-down', scanCode: 80 },
      ],
      false,
    );
    expect(decision.ordered).toBe(false);
    expect(decision.violations).toContain('multiple_keydown_without_keyup');
  });

  test('a key-up without a prior key-down is flagged', () => {
    const decision = evaluateKeyOrdering([{ kind: 'key-up', scanCode: 28 }], false);
    expect(decision.ordered).toBe(false);
    expect(decision.violations).toContain('keyup_without_keydown');
  });

  test('events for different scancodes may interleave freely', () => {
    const decision = evaluateKeyOrdering(
      [
        { kind: 'key-down', scanCode: 28 },
        { kind: 'key-down', scanCode: 80 },
        { kind: 'key-up', scanCode: 28 },
        { kind: 'key-up', scanCode: 80 },
      ],
      false,
    );
    expect(decision.ordered).toBe(true);
  });
});
