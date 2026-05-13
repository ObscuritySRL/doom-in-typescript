import { describe, expect, test } from 'bun:test';

import { requestVanillaAdvanceDemo, tickVanillaPagetic } from '../../../src/ui/implement-page-ticker-and-advance-demo.ts';

describe('tickVanillaPagetic', () => {
  test('decrements pagetic by one when pagetic > 0', () => {
    const result = tickVanillaPagetic({ pagetic: 5 });
    expect(result.pageticAfter).toBe(4);
    expect(result.advanceTriggered).toBe(false);
  });

  test('does not trigger advance when pre-decremented value is 0', () => {
    const result = tickVanillaPagetic({ pagetic: 1 });
    expect(result.pageticAfter).toBe(0);
    expect(result.advanceTriggered).toBe(false);
  });

  test('triggers advance when pre-decremented value is < 0', () => {
    const result = tickVanillaPagetic({ pagetic: 0 });
    expect(result.pageticAfter).toBe(-1);
    expect(result.advanceTriggered).toBe(true);
  });

  test('continues to trigger advance for already-negative pagetic', () => {
    const result = tickVanillaPagetic({ pagetic: -5 });
    expect(result.pageticAfter).toBe(-6);
    expect(result.advanceTriggered).toBe(true);
  });

  test('170-tic non-commercial TITLEPIC takes 171 ticks to advance', () => {
    let pagetic = 170;
    let ticks = 0;
    while (true) {
      const result = tickVanillaPagetic({ pagetic });
      pagetic = result.pageticAfter;
      ticks += 1;
      if (result.advanceTriggered) break;
      if (ticks > 200) throw new Error('runaway loop');
    }
    expect(ticks).toBe(171);
  });

  test('200-tic CREDIT interlude takes 201 ticks to advance', () => {
    let pagetic = 200;
    let ticks = 0;
    while (true) {
      const result = tickVanillaPagetic({ pagetic });
      pagetic = result.pageticAfter;
      ticks += 1;
      if (result.advanceTriggered) break;
      if (ticks > 300) throw new Error('runaway loop');
    }
    expect(ticks).toBe(201);
  });

  test('result object is frozen', () => {
    const result = tickVanillaPagetic({ pagetic: 5 });
    expect(Object.isFrozen(result)).toBe(true);
  });
});

describe('requestVanillaAdvanceDemo', () => {
  test('sets advancedemo to true', () => {
    expect(requestVanillaAdvanceDemo().advancedemo).toBe(true);
  });

  test('is idempotent (always returns advancedemo=true)', () => {
    expect(requestVanillaAdvanceDemo().advancedemo).toBe(true);
    expect(requestVanillaAdvanceDemo().advancedemo).toBe(true);
  });

  test('result object is frozen', () => {
    expect(Object.isFrozen(requestVanillaAdvanceDemo())).toBe(true);
  });
});
