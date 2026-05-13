import { describe, expect, test } from 'bun:test';

import {
  VANILLA_INTERMISSION_SP_STATE_ACCELERATED,
  VANILLA_INTERMISSION_SP_STATE_ITEMS,
  VANILLA_INTERMISSION_SP_STATE_KILLS,
  VANILLA_INTERMISSION_SP_STATE_SECRET,
  VANILLA_INTERMISSION_SP_STATE_TIME,
  VANILLA_INTERMISSION_STAT_PERCENT_STEP,
  VANILLA_INTERMISSION_TIME_STEP_TICS,
  computeVanillaIntermissionPercent,
  computeVanillaIntermissionTimeSeconds,
  stepVanillaIntermissionPercent,
} from '../../../src/ui/implement-intermission-stats-counting.ts';

describe('intermission state constants', () => {
  test('sp_state values: 2 kills, 4 items, 6 secret, 8 time, 10 accelerated', () => {
    expect(VANILLA_INTERMISSION_SP_STATE_KILLS).toBe(2);
    expect(VANILLA_INTERMISSION_SP_STATE_ITEMS).toBe(4);
    expect(VANILLA_INTERMISSION_SP_STATE_SECRET).toBe(6);
    expect(VANILLA_INTERMISSION_SP_STATE_TIME).toBe(8);
    expect(VANILLA_INTERMISSION_SP_STATE_ACCELERATED).toBe(10);
  });

  test('percent counts step by 2 per tick', () => {
    expect(VANILLA_INTERMISSION_STAT_PERCENT_STEP).toBe(2);
  });

  test('time counts step by 1 tic-per-second per tick', () => {
    expect(VANILLA_INTERMISSION_TIME_STEP_TICS).toBe(1);
  });
});

describe('computeVanillaIntermissionPercent', () => {
  test('returns 0 when maxKilled is 0 (no monsters)', () => {
    expect(computeVanillaIntermissionPercent({ killed: 0, maxKilled: 0 })).toBe(0);
  });

  test('returns 100 when all killed', () => {
    expect(computeVanillaIntermissionPercent({ killed: 50, maxKilled: 50 })).toBe(100);
  });

  test('returns 0 when none killed', () => {
    expect(computeVanillaIntermissionPercent({ killed: 0, maxKilled: 50 })).toBe(0);
  });

  test('truncates fractional percentages (integer division)', () => {
    expect(computeVanillaIntermissionPercent({ killed: 7, maxKilled: 13 })).toBe(53);
  });
});

describe('computeVanillaIntermissionTimeSeconds', () => {
  test('35 tics = 1 second', () => {
    expect(computeVanillaIntermissionTimeSeconds({ tics: 35 })).toBe(1);
  });

  test('0 tics = 0 seconds', () => {
    expect(computeVanillaIntermissionTimeSeconds({ tics: 0 })).toBe(0);
  });

  test('truncates (integer division)', () => {
    expect(computeVanillaIntermissionTimeSeconds({ tics: 50 })).toBe(1);
    expect(computeVanillaIntermissionTimeSeconds({ tics: 69 })).toBe(1);
    expect(computeVanillaIntermissionTimeSeconds({ tics: 70 })).toBe(2);
  });
});

describe('stepVanillaIntermissionPercent', () => {
  test('non-accelerated step adds 2 toward target', () => {
    const result = stepVanillaIntermissionPercent({ currentCount: 10, targetCount: 50, accelerated: false });
    expect(result.nextCount).toBe(12);
    expect(result.reachedTarget).toBe(false);
  });

  test('clamps to target when within 1 step', () => {
    const result = stepVanillaIntermissionPercent({ currentCount: 49, targetCount: 50, accelerated: false });
    expect(result.nextCount).toBe(50);
    expect(result.reachedTarget).toBe(true);
  });

  test('accelerated jumps directly to target', () => {
    const result = stepVanillaIntermissionPercent({ currentCount: 10, targetCount: 87, accelerated: true });
    expect(result.nextCount).toBe(87);
    expect(result.reachedTarget).toBe(true);
  });

  test('result is frozen', () => {
    const result = stepVanillaIntermissionPercent({ currentCount: 0, targetCount: 50, accelerated: false });
    expect(Object.isFrozen(result)).toBe(true);
  });
});
