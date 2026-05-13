import { describe, expect, test } from 'bun:test';

import { FRACUNIT } from '../../../src/core/fixed.ts';
import { VANILLA_MELEERANGE_FIXED, VANILLA_MELEE_RANGE_SLACK_FIXED, computeMeleeRangeThreshold, isInVanillaMeleeRange } from '../../../src/ai/implement-monster-melee-range.ts';

describe('vanilla P_CheckMeleeRange constants', () => {
  test('MELEERANGE is 64 map units in fixed-point', () => {
    expect(VANILLA_MELEERANGE_FIXED).toBe(64 * FRACUNIT);
  });

  test('melee range slack is 20 map units in fixed-point', () => {
    expect(VANILLA_MELEE_RANGE_SLACK_FIXED).toBe(20 * FRACUNIT);
  });
});

describe('computeMeleeRangeThreshold', () => {
  test('zero-radius target: threshold = 44*FRACUNIT', () => {
    expect(computeMeleeRangeThreshold(0)).toBe(44 * FRACUNIT);
  });

  test('20-radius target: threshold = 64*FRACUNIT', () => {
    expect(computeMeleeRangeThreshold(20 * FRACUNIT)).toBe(64 * FRACUNIT);
  });
});

describe('isInVanillaMeleeRange', () => {
  test('no target returns false', () => {
    expect(isInVanillaMeleeRange({ distanceFixed: 10 * FRACUNIT, targetRadiusFixed: 20 * FRACUNIT, sightLineClear: true, hasTarget: false })).toBe(false);
  });

  test('distance >= threshold returns false', () => {
    expect(isInVanillaMeleeRange({ distanceFixed: 64 * FRACUNIT, targetRadiusFixed: 20 * FRACUNIT, sightLineClear: true, hasTarget: true })).toBe(false);
  });

  test('within threshold but no line-of-sight returns false', () => {
    expect(isInVanillaMeleeRange({ distanceFixed: 30 * FRACUNIT, targetRadiusFixed: 20 * FRACUNIT, sightLineClear: false, hasTarget: true })).toBe(false);
  });

  test('within threshold with line-of-sight returns true', () => {
    expect(isInVanillaMeleeRange({ distanceFixed: 30 * FRACUNIT, targetRadiusFixed: 20 * FRACUNIT, sightLineClear: true, hasTarget: true })).toBe(true);
  });

  test('threshold boundary exclusive (distance = threshold yields false)', () => {
    expect(isInVanillaMeleeRange({ distanceFixed: 44 * FRACUNIT, targetRadiusFixed: 0, sightLineClear: true, hasTarget: true })).toBe(false);
  });

  test('one unit inside threshold returns true', () => {
    expect(isInVanillaMeleeRange({ distanceFixed: 44 * FRACUNIT - 1, targetRadiusFixed: 0, sightLineClear: true, hasTarget: true })).toBe(true);
  });
});
