/**
 * Deterministic time-freeze harness for doom_codex test suite.
 *
 * Provides a controllable frozen clock that replaces real-time sources
 * for deterministic testing of tic-based game logic. The Doom engine
 * runs at exactly 35 tics per second (F-010); this harness enforces
 * that rate and allows precise, repeatable time advancement.
 *
 * @example
 * ```ts
 * import { createFrozenClock } from "./determinism.ts";
 * const clock = createFrozenClock();
 * clock.advance(35); // advance exactly one second
 * ```
 */

import { PRIMARY_TARGET } from '../../src/reference/target.ts';

/** Tic rate in Hz for the Doom game loop. Sourced from PRIMARY_TARGET. */
export const TIC_RATE_HZ = PRIMARY_TARGET.ticRateHz;

/** Exact milliseconds per tic (non-integer: 1000 / 35 ≈ 28.5714). */
export const MILLISECONDS_PER_TIC = 1_000 / TIC_RATE_HZ;

/** Exact nanoseconds per tic (non-integer: 1e9 / 35 ≈ 28_571_428.5714). */
export const NANOSECONDS_PER_TIC = 1_000_000_000 / TIC_RATE_HZ;

/** Immutable snapshot of frozen clock state at a point in time. */
export interface FrozenClockSnapshot {
  /** Tic number at the time of capture. */
  readonly currentTic: number;
  /** Elapsed milliseconds at the time of capture. */
  readonly elapsedMilliseconds: number;
}

/** Deterministic clock for tic-based testing. */
export interface FrozenClock {
  /** Current tic number (integer, zero-based). */
  readonly currentTic: number;
  /** Elapsed milliseconds since tic 0. */
  readonly elapsedMilliseconds: number;
  /** Advances the clock forward by the given number of tics. */
  advance(tics: number): void;
  /** Advances the clock to the given absolute tic number. */
  advanceToTic(targetTic: number): void;
  /** Resets the clock to tic 0. */
  reset(): void;
  /** Returns a frozen snapshot of the current state. */
  snapshot(): FrozenClockSnapshot;
  /** Tic provider function suitable for injection into tic-consuming code. */
  readonly ticProvider: () => number;
  /** Millisecond provider function suitable for injection into time-consuming code. */
  readonly millisecondProvider: () => number;
}

/**
 * Creates a new frozen clock starting at the given tic (default 0).
 *
 * The clock never advances on its own — only explicit calls to
 * {@link FrozenClock.advance}, {@link FrozenClock.advanceToTic}, or
 * {@link FrozenClock.reset} change its state. This guarantees fully
 * deterministic, wall-clock-independent behavior for test assertions.
 *
 * @param initialTic - Starting tic number (default 0, must be non-negative integer).
 * @returns A controllable {@link FrozenClock} instance.
 *
 * @example
 * ```ts
 * const clock = createFrozenClock();
 * clock.advance(1);
 * console.log(clock.currentTic); // 1
 * console.log(clock.elapsedMilliseconds); // ≈28.571
 * ```
 */
export function createFrozenClock(initialTic: number = 0): FrozenClock {
  if (!Number.isInteger(initialTic) || initialTic < 0) {
    throw new RangeError(`initialTic must be a non-negative integer, got ${initialTic}`);
  }

  let currentTic = initialTic;

  const ticProviderFunction = (): number => currentTic;
  const millisecondProviderFunction = (): number => currentTic * MILLISECONDS_PER_TIC;

  return {
    get currentTic() {
      return currentTic;
    },

    get elapsedMilliseconds() {
      return currentTic * MILLISECONDS_PER_TIC;
    },

    advance(tics: number) {
      if (!Number.isInteger(tics) || tics < 0) {
        throw new RangeError(`tics must be a non-negative integer, got ${tics}`);
      }
      currentTic += tics;
    },

    advanceToTic(targetTic: number) {
      if (!Number.isInteger(targetTic) || targetTic < 0) {
        throw new RangeError(`targetTic must be a non-negative integer, got ${targetTic}`);
      }
      if (targetTic < currentTic) {
        throw new RangeError(`targetTic (${targetTic}) must be >= currentTic (${currentTic})`);
      }
      currentTic = targetTic;
    },

    reset() {
      currentTic = 0;
    },

    snapshot(): FrozenClockSnapshot {
      return Object.freeze({
        currentTic,
        elapsedMilliseconds: currentTic * MILLISECONDS_PER_TIC,
      });
    },

    ticProvider: ticProviderFunction,
    millisecondProvider: millisecondProviderFunction,
  };
}
