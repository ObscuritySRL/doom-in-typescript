import { describe, expect, test } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { createFrozenClock, MILLISECONDS_PER_TIC, NANOSECONDS_PER_TIC, TIC_RATE_HZ, type FrozenClock, type FrozenClockSnapshot } from './determinism.ts';

describe('timing constants', () => {
  test('TIC_RATE_HZ matches PRIMARY_TARGET.ticRateHz', () => {
    expect(TIC_RATE_HZ).toBe(PRIMARY_TARGET.ticRateHz);
  });

  test('TIC_RATE_HZ is exactly 35', () => {
    expect(TIC_RATE_HZ).toBe(35);
  });

  test('MILLISECONDS_PER_TIC equals 1000 / 35', () => {
    expect(MILLISECONDS_PER_TIC).toBe(1_000 / 35);
  });

  test('MILLISECONDS_PER_TIC is not an integer (parity-sensitive)', () => {
    expect(Number.isInteger(MILLISECONDS_PER_TIC)).toBe(false);
  });

  test('NANOSECONDS_PER_TIC equals 1e9 / 35', () => {
    expect(NANOSECONDS_PER_TIC).toBe(1_000_000_000 / 35);
  });

  test('35 tics yields exactly 1000 milliseconds', () => {
    expect(35 * MILLISECONDS_PER_TIC).toBe(1_000);
  });
});

describe('createFrozenClock', () => {
  test('starts at tic 0 by default', () => {
    const clock = createFrozenClock();
    expect(clock.currentTic).toBe(0);
  });

  test('starts at the specified initial tic', () => {
    const clock = createFrozenClock(10);
    expect(clock.currentTic).toBe(10);
  });

  test('elapsed milliseconds are zero at tic 0', () => {
    const clock = createFrozenClock();
    expect(clock.elapsedMilliseconds).toBe(0);
  });

  test('elapsed milliseconds match initial tic', () => {
    const clock = createFrozenClock(35);
    expect(clock.elapsedMilliseconds).toBe(1_000);
  });

  test('rejects negative initial tic', () => {
    expect(() => createFrozenClock(-1)).toThrow(RangeError);
  });

  test('rejects non-integer initial tic', () => {
    expect(() => createFrozenClock(1.5)).toThrow(RangeError);
  });
});

describe('advance', () => {
  test('advances by the given number of tics', () => {
    const clock = createFrozenClock();
    clock.advance(5);
    expect(clock.currentTic).toBe(5);
  });

  test('accumulates across multiple advances', () => {
    const clock = createFrozenClock();
    clock.advance(3);
    clock.advance(7);
    expect(clock.currentTic).toBe(10);
  });

  test('advance(0) is a no-op', () => {
    const clock = createFrozenClock();
    clock.advance(0);
    expect(clock.currentTic).toBe(0);
  });

  test('updates elapsed milliseconds', () => {
    const clock = createFrozenClock();
    clock.advance(70);
    expect(clock.elapsedMilliseconds).toBe(2_000);
  });

  test('rejects negative tics', () => {
    const clock = createFrozenClock();
    expect(() => clock.advance(-1)).toThrow(RangeError);
  });

  test('rejects non-integer tics', () => {
    const clock = createFrozenClock();
    expect(() => clock.advance(0.5)).toThrow(RangeError);
  });
});

describe('advanceToTic', () => {
  test('advances to the target tic', () => {
    const clock = createFrozenClock();
    clock.advanceToTic(42);
    expect(clock.currentTic).toBe(42);
  });

  test('advance to current tic is a no-op', () => {
    const clock = createFrozenClock(10);
    clock.advanceToTic(10);
    expect(clock.currentTic).toBe(10);
  });

  test('rejects target below current tic', () => {
    const clock = createFrozenClock(10);
    expect(() => clock.advanceToTic(5)).toThrow(RangeError);
  });

  test('rejects negative target', () => {
    const clock = createFrozenClock();
    expect(() => clock.advanceToTic(-1)).toThrow(RangeError);
  });

  test('rejects non-integer target', () => {
    const clock = createFrozenClock();
    expect(() => clock.advanceToTic(1.5)).toThrow(RangeError);
  });
});

describe('reset', () => {
  test('returns clock to tic 0', () => {
    const clock = createFrozenClock();
    clock.advance(100);
    clock.reset();
    expect(clock.currentTic).toBe(0);
  });

  test('clears elapsed milliseconds', () => {
    const clock = createFrozenClock();
    clock.advance(100);
    clock.reset();
    expect(clock.elapsedMilliseconds).toBe(0);
  });
});

describe('snapshot', () => {
  test('captures current tic', () => {
    const clock = createFrozenClock();
    clock.advance(7);
    const snap = clock.snapshot();
    expect(snap.currentTic).toBe(7);
  });

  test('captures elapsed milliseconds', () => {
    const clock = createFrozenClock();
    clock.advance(35);
    const snap = clock.snapshot();
    expect(snap.elapsedMilliseconds).toBe(1_000);
  });

  test('snapshot is frozen', () => {
    const clock = createFrozenClock();
    const snap = clock.snapshot();
    expect(Object.isFrozen(snap)).toBe(true);
  });

  test('snapshot is not affected by subsequent advances', () => {
    const clock = createFrozenClock();
    clock.advance(5);
    const snap = clock.snapshot();
    clock.advance(10);
    expect(snap.currentTic).toBe(5);
    expect(clock.currentTic).toBe(15);
  });
});

describe('ticProvider', () => {
  test('returns a function', () => {
    const clock = createFrozenClock();
    expect(typeof clock.ticProvider).toBe('function');
  });

  test('reflects current tic', () => {
    const clock = createFrozenClock();
    clock.advance(42);
    expect(clock.ticProvider()).toBe(42);
  });

  test('tracks advances dynamically via captured reference', () => {
    const clock = createFrozenClock();
    const provider = clock.ticProvider;
    expect(provider()).toBe(0);
    clock.advance(1);
    expect(provider()).toBe(1);
  });
});

describe('millisecondProvider', () => {
  test('returns a function', () => {
    const clock = createFrozenClock();
    expect(typeof clock.millisecondProvider).toBe('function');
  });

  test('reflects current elapsed milliseconds', () => {
    const clock = createFrozenClock();
    clock.advance(35);
    expect(clock.millisecondProvider()).toBe(1_000);
  });

  test('tracks advances dynamically via captured reference', () => {
    const clock = createFrozenClock();
    const provider = clock.millisecondProvider;
    expect(provider()).toBe(0);
    clock.advance(70);
    expect(provider()).toBe(2_000);
  });
});

describe('determinism: reproducibility', () => {
  test('identical advance sequences produce identical state', () => {
    const clockA = createFrozenClock();
    const clockB = createFrozenClock();
    clockA.advance(10);
    clockA.advance(25);
    clockB.advance(10);
    clockB.advance(25);
    expect(clockA.currentTic).toBe(clockB.currentTic);
    expect(clockA.elapsedMilliseconds).toBe(clockB.elapsedMilliseconds);
  });

  test('two clocks advance independently', () => {
    const clockA = createFrozenClock();
    const clockB = createFrozenClock();
    clockA.advance(10);
    clockB.advance(5);
    expect(clockA.currentTic).toBe(10);
    expect(clockB.currentTic).toBe(5);
  });

  test('clock does not advance without explicit calls', async () => {
    const clock = createFrozenClock();
    const before = clock.currentTic;
    await Bun.sleep(50);
    expect(clock.currentTic).toBe(before);
  });
});

describe('parity edge case: non-integer millisecond accumulation', () => {
  test('single tic yields non-integer milliseconds', () => {
    const clock = createFrozenClock();
    clock.advance(1);
    expect(Number.isInteger(clock.elapsedMilliseconds)).toBe(false);
  });

  test('total demo tics (10996) produce expected duration per F-021', () => {
    const clock = createFrozenClock();
    clock.advance(10_996);
    const expectedSeconds = 10_996 / 35;
    expect(clock.elapsedMilliseconds / 1_000).toBeCloseTo(expectedSeconds, 10);
  });

  test('full title cycle (11566 tics) produce expected duration per F-025', () => {
    const clock = createFrozenClock();
    clock.advance(11_566);
    const expectedSeconds = 11_566 / 35;
    expect(clock.elapsedMilliseconds / 1_000).toBeCloseTo(expectedSeconds, 10);
  });
});

describe('compile-time type satisfaction', () => {
  test('FrozenClock is assignable from createFrozenClock', () => {
    const clock: FrozenClock = createFrozenClock();
    expect(clock).toBeDefined();
  });

  test('FrozenClockSnapshot is assignable from snapshot', () => {
    const snap: FrozenClockSnapshot = createFrozenClock().snapshot();
    expect(snap).toBeDefined();
  });
});
