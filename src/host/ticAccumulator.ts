/**
 * Exact 35 Hz tic accumulator for the Doom game loop.
 *
 * Converts high-resolution clock deltas into discrete tics using
 * integer-only arithmetic: `tics = floor((delta * 35) / frequency)`.
 * This matches Chocolate Doom's `I_GetTime` approach of computing
 * tics from an absolute baseline, preventing drift from rounding
 * error accumulation.
 *
 * @example
 * ```ts
 * import { TicAccumulator } from "../src/host/ticAccumulator.ts";
 * import { PerformanceClock } from "../src/host/win32/clock.ts";
 * const accumulator = new TicAccumulator(new PerformanceClock());
 * const newTics = accumulator.advance(); // 0 on first call
 * ```
 */

/** Fixed game-loop rate in Hz, matching the original Doom engine. */
export const TICS_PER_SECOND = 35;

const TICS_PER_SECOND_BIG = BigInt(TICS_PER_SECOND);

/**
 * Minimal clock interface for the tic accumulator.
 *
 * Any object providing a bigint frequency and monotonic bigint counter
 * satisfies this contract. The production implementation is
 * `PerformanceClock`; tests may supply a fake.
 *
 * @example
 * ```ts
 * const fakeClock: TicClock = { frequency: 350n, now: () => counter };
 * ```
 */
export interface TicClock {
  readonly frequency: bigint;
  now(): bigint;
}

/**
 * Accumulates high-resolution clock ticks into discrete 35 Hz tics.
 *
 * All arithmetic uses bigint to avoid floating-point drift. The total
 * tic count is always recomputed from the absolute delta since the
 * baseline, not accumulated incrementally.
 *
 * @example
 * ```ts
 * import { PerformanceClock } from "../src/host/win32/clock.ts";
 * const accumulator = new TicAccumulator(new PerformanceClock());
 * // In game loop:
 * const newTics = accumulator.advance();
 * for (let i = 0; i < newTics; i++) { runOneTic(); }
 * ```
 */
export class TicAccumulator {
  #clock: TicClock;
  #frequency: bigint;
  #baselineCounter: bigint;
  #lastTotalTics: number;

  constructor(clock: TicClock) {
    this.#clock = clock;
    this.#frequency = clock.frequency;
    this.#baselineCounter = clock.now();
    this.#lastTotalTics = 0;
  }

  /** Total number of elapsed tics since construction or last {@link reset}. */
  get totalTics(): number {
    return this.#lastTotalTics;
  }

  /**
   * Sample the clock and return the count of new tics since the
   * previous call to {@link advance} (or construction / reset).
   *
   * Uses integer-only arithmetic to prevent drift:
   * `totalTics = floor((delta * 35) / frequency)`
   *
   * @returns Number of new whole tics (0 if less than one tic has elapsed).
   */
  advance(): number {
    const current = this.#clock.now();
    const delta = current - this.#baselineCounter;
    const totalTics = Number((delta * TICS_PER_SECOND_BIG) / this.#frequency);
    const newTics = totalTics - this.#lastTotalTics;
    this.#lastTotalTics = totalTics;
    return newTics;
  }

  /** Reset the baseline to the current time, zeroing accumulated tics. */
  reset(): void {
    this.#baselineCounter = this.#clock.now();
    this.#lastTotalTics = 0;
  }
}
