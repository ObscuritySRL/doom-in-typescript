import { describe, expect, test } from 'bun:test';

import { LARGE_INTEGER_SIZE, PerformanceClock } from '../../src/host/win32/clock.ts';

describe('LARGE_INTEGER_SIZE', () => {
  test('is 8 bytes', () => {
    expect(LARGE_INTEGER_SIZE).toBe(8);
  });
});

describe('PerformanceClock', () => {
  describe('construction', () => {
    test('succeeds without throwing', () => {
      expect(() => new PerformanceClock()).not.toThrow();
    });
  });

  describe('frequency', () => {
    test('is a positive bigint', () => {
      const clock = new PerformanceClock();
      expect(typeof clock.frequency).toBe('bigint');
      expect(clock.frequency > 0n).toBe(true);
    });

    test('is at least 1 MHz (modern Windows guarantees this)', () => {
      const clock = new PerformanceClock();
      expect(clock.frequency >= 1_000_000n).toBe(true);
    });

    test('is stable across multiple PerformanceClock instances', () => {
      const clockA = new PerformanceClock();
      const clockB = new PerformanceClock();
      expect(clockA.frequency).toBe(clockB.frequency);
    });

    test('is the same value on repeated reads from the same instance', () => {
      const clock = new PerformanceClock();
      const first = clock.frequency;
      const second = clock.frequency;
      expect(first).toBe(second);
    });
  });

  describe('now', () => {
    test('returns a positive bigint', () => {
      const clock = new PerformanceClock();
      const value = clock.now();
      expect(typeof value).toBe('bigint');
      expect(value > 0n).toBe(true);
    });

    test('two consecutive calls are monotonically non-decreasing', () => {
      const clock = new PerformanceClock();
      const first = clock.now();
      const second = clock.now();
      expect(second >= first).toBe(true);
    });

    test('100 rapid calls maintain monotonicity', () => {
      const clock = new PerformanceClock();
      let previous = clock.now();
      for (let index = 0; index < 100; index++) {
        const current = clock.now();
        expect(current >= previous).toBe(true);
        previous = current;
      }
    });

    test('counter advances after a short busy-wait', () => {
      const clock = new PerformanceClock();
      const before = clock.now();
      // Busy-wait to ensure counter visibly advances
      const deadline = performance.now() + 5;
      while (performance.now() < deadline) {
        /* spin */
      }
      const after = clock.now();
      expect(after > before).toBe(true);
    });
  });

  describe('parity-sensitive edge cases', () => {
    test('elapsed ticks can represent at least one 35 Hz tic interval', () => {
      const clock = new PerformanceClock();
      const ticDuration = clock.frequency / 35n;
      // At 1 MHz minimum, one tic ≈ 28_571 ticks — well above zero
      expect(ticDuration > 0n).toBe(true);
    });

    test('frequency integer division by 35 has sub-tic remainder < 35', () => {
      const clock = new PerformanceClock();
      const remainder = clock.frequency % 35n;
      expect(remainder >= 0n).toBe(true);
      expect(remainder < 35n).toBe(true);
    });

    test('counter value is not zero (system has been running)', () => {
      const clock = new PerformanceClock();
      expect(clock.now()).not.toBe(0n);
    });

    test('counter buffer reuse across calls does not corrupt values', () => {
      const clock = new PerformanceClock();
      const values: bigint[] = [];
      for (let index = 0; index < 10; index++) {
        values.push(clock.now());
      }
      // All values should be unique (clock advances between calls on modern hardware)
      // At minimum, they must be non-decreasing
      for (let index = 1; index < values.length; index++) {
        expect(values[index] >= values[index - 1]).toBe(true);
      }
    });
  });
});
