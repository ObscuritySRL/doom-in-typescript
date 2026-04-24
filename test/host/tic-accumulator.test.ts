import { describe, expect, test } from 'bun:test';

import type { TicClock } from '../../src/host/ticAccumulator.ts';
import { TICS_PER_SECOND, TicAccumulator } from '../../src/host/ticAccumulator.ts';
import { PRIMARY_TARGET } from '../../src/reference/target.ts';

/**
 * Fake clock with controllable counter for deterministic testing.
 * Frequency and counter are set explicitly; {@link tick} advances
 * the counter by a given number of counts.
 */
class FakeClock implements TicClock {
  readonly frequency: bigint;
  #counter: bigint;

  constructor(frequency: bigint, startCounter = 0n) {
    this.frequency = frequency;
    this.#counter = startCounter;
  }

  now(): bigint {
    return this.#counter;
  }

  tick(counts: bigint): void {
    this.#counter += counts;
  }
}

describe('TICS_PER_SECOND', () => {
  test('is 35', () => {
    expect(TICS_PER_SECOND).toBe(35);
  });

  test('matches PRIMARY_TARGET.ticRateHz', () => {
    expect(TICS_PER_SECOND).toBe(PRIMARY_TARGET.ticRateHz);
  });
});

describe('TicAccumulator', () => {
  describe('construction', () => {
    test('starts with zero totalTics', () => {
      const clock = new FakeClock(350n);
      const accumulator = new TicAccumulator(clock);
      expect(accumulator.totalTics).toBe(0);
    });

    test('first advance returns 0 when no time has passed', () => {
      const clock = new FakeClock(350n);
      const accumulator = new TicAccumulator(clock);
      expect(accumulator.advance()).toBe(0);
    });
  });

  describe('advance with evenly-divisible frequency', () => {
    // frequency=350 → countsPerTic = 350/35 = 10 exactly

    test('returns 0 for sub-tic interval', () => {
      const clock = new FakeClock(350n);
      const accumulator = new TicAccumulator(clock);
      clock.tick(9n); // 9 < 10 counts per tic
      expect(accumulator.advance()).toBe(0);
      expect(accumulator.totalTics).toBe(0);
    });

    test('returns 1 after exactly one tic interval', () => {
      const clock = new FakeClock(350n);
      const accumulator = new TicAccumulator(clock);
      clock.tick(10n); // exactly 1 tic
      expect(accumulator.advance()).toBe(1);
      expect(accumulator.totalTics).toBe(1);
    });

    test('returns 0 on second advance with no further time', () => {
      const clock = new FakeClock(350n);
      const accumulator = new TicAccumulator(clock);
      clock.tick(10n);
      accumulator.advance();
      expect(accumulator.advance()).toBe(0);
    });

    test('accumulates across multiple advances', () => {
      const clock = new FakeClock(350n);
      const accumulator = new TicAccumulator(clock);
      clock.tick(10n);
      expect(accumulator.advance()).toBe(1);
      clock.tick(10n);
      expect(accumulator.advance()).toBe(1);
      clock.tick(10n);
      expect(accumulator.advance()).toBe(1);
      expect(accumulator.totalTics).toBe(3);
    });

    test('returns multiple tics for large time jump', () => {
      const clock = new FakeClock(350n);
      const accumulator = new TicAccumulator(clock);
      clock.tick(50n); // 5 tics at once
      expect(accumulator.advance()).toBe(5);
      expect(accumulator.totalTics).toBe(5);
    });

    test('returns exactly 35 tics after one full second', () => {
      const clock = new FakeClock(350n);
      const accumulator = new TicAccumulator(clock);
      clock.tick(350n); // 1 full second
      expect(accumulator.advance()).toBe(35);
      expect(accumulator.totalTics).toBe(35);
    });
  });

  describe('advance with non-divisible frequency', () => {
    // frequency=100 → countsPerTic = 100/35 ≈ 2.857
    // tic boundaries: delta=3→1, delta=6→2, delta=9→3, delta=100→35

    test('sub-tic at delta=2 yields 0', () => {
      const clock = new FakeClock(100n);
      const accumulator = new TicAccumulator(clock);
      clock.tick(2n); // floor(70/100) = 0
      expect(accumulator.advance()).toBe(0);
    });

    test('first tic at delta=3', () => {
      const clock = new FakeClock(100n);
      const accumulator = new TicAccumulator(clock);
      clock.tick(3n); // floor(105/100) = 1
      expect(accumulator.advance()).toBe(1);
    });

    test('second tic at delta=6', () => {
      const clock = new FakeClock(100n);
      const accumulator = new TicAccumulator(clock);
      clock.tick(6n); // floor(210/100) = 2
      expect(accumulator.advance()).toBe(2);
    });

    test('third tic at delta=9', () => {
      const clock = new FakeClock(100n);
      const accumulator = new TicAccumulator(clock);
      clock.tick(9n); // floor(315/100) = 3
      expect(accumulator.advance()).toBe(3);
    });

    test('exactly 35 tics after one full second', () => {
      const clock = new FakeClock(100n);
      const accumulator = new TicAccumulator(clock);
      clock.tick(100n); // floor(3500/100) = 35
      expect(accumulator.advance()).toBe(35);
      expect(accumulator.totalTics).toBe(35);
    });

    test('incremental advances sum correctly across boundary', () => {
      const clock = new FakeClock(100n);
      const accumulator = new TicAccumulator(clock);
      let totalNewTics = 0;
      // Advance 1 count at a time for 9 counts (should reach 3 tics)
      for (let index = 0; index < 9; index++) {
        clock.tick(1n);
        totalNewTics += accumulator.advance();
      }
      expect(totalNewTics).toBe(3);
      expect(accumulator.totalTics).toBe(3);
    });
  });

  describe('advance with realistic 10 MHz frequency', () => {
    // frequency=10_000_000 → countsPerTic ≈ 285_714.286
    // Minimum delta for 1 tic: ceil(10_000_000/35) = 285_715

    test('285_714 counts yields 0 tics', () => {
      const clock = new FakeClock(10_000_000n);
      const accumulator = new TicAccumulator(clock);
      clock.tick(285_714n); // floor(9_999_990 / 10_000_000) = 0
      expect(accumulator.advance()).toBe(0);
    });

    test('285_715 counts yields 1 tic', () => {
      const clock = new FakeClock(10_000_000n);
      const accumulator = new TicAccumulator(clock);
      clock.tick(285_715n); // floor(10_000_025 / 10_000_000) = 1
      expect(accumulator.advance()).toBe(1);
    });

    test('exactly 10_000_000 counts yields 35 tics', () => {
      const clock = new FakeClock(10_000_000n);
      const accumulator = new TicAccumulator(clock);
      clock.tick(10_000_000n);
      expect(accumulator.advance()).toBe(35);
    });
  });

  describe('reset', () => {
    test('zeros totalTics', () => {
      const clock = new FakeClock(350n);
      const accumulator = new TicAccumulator(clock);
      clock.tick(50n);
      accumulator.advance();
      expect(accumulator.totalTics).toBe(5);
      accumulator.reset();
      expect(accumulator.totalTics).toBe(0);
    });

    test('advance after reset counts from new baseline', () => {
      const clock = new FakeClock(350n);
      const accumulator = new TicAccumulator(clock);
      clock.tick(50n);
      accumulator.advance();
      accumulator.reset();
      // Advance 20 more counts (2 tics from new baseline)
      clock.tick(20n);
      expect(accumulator.advance()).toBe(2);
      expect(accumulator.totalTics).toBe(2);
    });
  });

  describe('parity-sensitive edge cases', () => {
    test('integer arithmetic prevents drift over 10 seconds of 1-count advances', () => {
      const frequency = 10_000_000n;
      const clock = new FakeClock(frequency);
      const accumulator = new TicAccumulator(clock);

      // Advance 1 count at a time for 10 full seconds
      const totalCounts = 10n * frequency;
      let accumulatedNewTics = 0;
      for (let index = 0n; index < totalCounts; index += 1000n) {
        clock.tick(1000n);
        accumulatedNewTics += accumulator.advance();
      }

      // Must equal exactly 350 tics (35 Hz * 10 seconds), no drift
      expect(accumulatedNewTics).toBe(350);
      expect(accumulator.totalTics).toBe(350);
    });

    test('non-zero start counter does not affect tic computation', () => {
      const clock = new FakeClock(350n, 999_999_999n);
      const accumulator = new TicAccumulator(clock);
      clock.tick(10n);
      expect(accumulator.advance()).toBe(1);
      expect(accumulator.totalTics).toBe(1);
    });

    test('tic boundary is exact at each integer multiple', () => {
      // With frequency=700, countsPerTic = 700/35 = 20 exactly
      const clock = new FakeClock(700n);
      const accumulator = new TicAccumulator(clock);

      for (let tic = 1; tic <= 35; tic++) {
        // Advance to exactly the boundary
        clock.tick(20n);
        const newTics = accumulator.advance();
        expect(newTics).toBe(1);
        expect(accumulator.totalTics).toBe(tic);
      }
    });

    test('advance never returns negative', () => {
      const clock = new FakeClock(350n);
      const accumulator = new TicAccumulator(clock);
      // Multiple advances with no time passing
      for (let index = 0; index < 100; index++) {
        expect(accumulator.advance()).toBe(0);
      }
    });
  });
});
