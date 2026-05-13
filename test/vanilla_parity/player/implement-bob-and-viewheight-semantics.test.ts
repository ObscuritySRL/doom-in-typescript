import { describe, expect, test } from 'bun:test';

import { FRACUNIT } from '../../../src/core/fixed.ts';
import { VANILLA_BOB_RIGHT_SHIFT, VANILLA_MAXBOB, computeVanillaBobAmplitude } from '../../../src/player/implement-bob-and-viewheight-semantics.ts';

describe('vanilla P_CalcHeight bob clamp', () => {
  test('MAXBOB is 0x100000 (16 pixels in fixed-point)', () => {
    expect(VANILLA_MAXBOB).toBe(0x10_0000);
    expect(VANILLA_MAXBOB).toBe(16 * FRACUNIT);
  });

  test('bob right shift is 2 (divide by 4)', () => {
    expect(VANILLA_BOB_RIGHT_SHIFT).toBe(2);
  });

  test('zero momentum produces zero bob', () => {
    expect(computeVanillaBobAmplitude(0, 0)).toBe(0);
  });

  test('small momentum produces bob = (momx^2 + momy^2) >> 2 (fixed-point)', () => {
    // momx = FRACUNIT, momy = 0: fixedMul(1<<16, 1<<16) = 1<<16, squared = 1<<16, >>2 = 1<<14
    const result = computeVanillaBobAmplitude(FRACUNIT, 0);
    expect(result).toBe(FRACUNIT >> 2);
  });

  test('large momentum clamps to MAXBOB', () => {
    const result = computeVanillaBobAmplitude(10 * FRACUNIT, 10 * FRACUNIT);
    expect(result).toBe(VANILLA_MAXBOB);
  });

  test('exact MAXBOB threshold is not exceeded', () => {
    const result = computeVanillaBobAmplitude(100 * FRACUNIT, 0);
    expect(result).toBe(VANILLA_MAXBOB);
  });
});
