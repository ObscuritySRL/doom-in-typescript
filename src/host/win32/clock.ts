/**
 * High-resolution performance clock backed by Win32 QueryPerformanceCounter
 * and QueryPerformanceFrequency.
 *
 * Chocolate Doom uses SDL_GetTicks (millisecond resolution). This port
 * uses QPC directly for sub-microsecond precision, which feeds the 35 Hz
 * tic accumulator in step 06-002.
 *
 * @example
 * ```ts
 * import { PerformanceClock } from "../src/host/win32/clock.ts";
 * const clock = new PerformanceClock();
 * const frequency = clock.frequency; // ticks per second (bigint)
 * const timestamp = clock.now();     // current counter value (bigint)
 * ```
 */

import Kernel32 from '@bun-win32/kernel32';

/** Size in bytes of a LARGE_INTEGER output parameter. */
export const LARGE_INTEGER_SIZE = 8;

/**
 * Wraps QueryPerformanceCounter / QueryPerformanceFrequency into a
 * reusable clock that queries the frequency once and provides monotonic
 * counter reads via {@link now}.
 *
 * @example
 * ```ts
 * const clock = new PerformanceClock();
 * const start = clock.now();
 * // ... work ...
 * const elapsed = clock.now() - start;
 * const elapsedSeconds = Number(elapsed) / Number(clock.frequency);
 * ```
 */
export class PerformanceClock {
  #counterBuffer = Buffer.alloc(LARGE_INTEGER_SIZE);
  #counterView = new DataView(this.#counterBuffer.buffer, this.#counterBuffer.byteOffset, LARGE_INTEGER_SIZE);
  #frequency: bigint;

  constructor() {
    const frequencyBuffer = Buffer.alloc(LARGE_INTEGER_SIZE);
    const frequencyView = new DataView(frequencyBuffer.buffer, frequencyBuffer.byteOffset, LARGE_INTEGER_SIZE);

    if (Kernel32.QueryPerformanceFrequency(frequencyBuffer.ptr) === 0) {
      throw new Error('QueryPerformanceFrequency failed');
    }

    this.#frequency = frequencyView.getBigInt64(0, true);

    if (this.#frequency <= 0n) {
      throw new Error(`QueryPerformanceFrequency returned non-positive value: ${this.#frequency}`);
    }
  }

  /**
   * Counter frequency in ticks per second.
   *
   * This value is fixed for the lifetime of the system and is queried
   * once during construction. On modern Windows it is typically 10 MHz
   * (10_000_000).
   */
  get frequency(): bigint {
    return this.#frequency;
  }

  /**
   * Read the current performance counter value.
   *
   * Returns a monotonically non-decreasing bigint representing the
   * number of ticks since system boot. The tick rate is given by
   * {@link frequency}.
   *
   * @example
   * ```ts
   * const clock = new PerformanceClock();
   * const a = clock.now();
   * const b = clock.now();
   * console.assert(b >= a);
   * ```
   */
  now(): bigint {
    if (Kernel32.QueryPerformanceCounter(this.#counterBuffer.ptr) === 0) {
      throw new Error('QueryPerformanceCounter failed');
    }
    return this.#counterView.getBigInt64(0, true);
  }
}
