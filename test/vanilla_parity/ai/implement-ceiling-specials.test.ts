import { describe, expect, test } from 'bun:test';

import { FRACBITS } from '../../../src/core/fixed.ts';
import {
  CEILING_CRUSH_AND_RAISE,
  CEILING_FAST_CRUSH_AND_RAISE,
  CEILING_LOWER_AND_CRUSH,
  CEILING_LOWER_TO_FLOOR,
  CEILING_RAISE_TO_HIGHEST,
  CEILING_SILENT_CRUSH_AND_RAISE,
  VANILLA_CEILING_CRUSH_DAMAGE,
  VANILLA_CEILING_CRUSH_TIC_INTERVAL,
  VANILLA_CEILSPEED_FAST_FIXED,
  VANILLA_CEILSPEED_FIXED,
  VANILLA_MAXCEILINGS,
} from '../../../src/ai/implement-ceiling-specials.ts';

describe('vanilla ceiling special constants', () => {
  test('CEILSPEED = 1 fixed, fast = 2 fixed', () => {
    expect(VANILLA_CEILSPEED_FIXED).toBe(1 << FRACBITS);
    expect(VANILLA_CEILSPEED_FAST_FIXED).toBe(2 << FRACBITS);
  });

  test('crush damage = 10 every 4 tics', () => {
    expect(VANILLA_CEILING_CRUSH_DAMAGE).toBe(10);
    expect(VANILLA_CEILING_CRUSH_TIC_INTERVAL).toBe(4);
  });

  test('MAXCEILINGS = 30', () => {
    expect(VANILLA_MAXCEILINGS).toBe(30);
  });

  test('ceiling_e enum 0..5', () => {
    expect(CEILING_LOWER_TO_FLOOR).toBe(0);
    expect(CEILING_RAISE_TO_HIGHEST).toBe(1);
    expect(CEILING_LOWER_AND_CRUSH).toBe(2);
    expect(CEILING_CRUSH_AND_RAISE).toBe(3);
    expect(CEILING_FAST_CRUSH_AND_RAISE).toBe(4);
    expect(CEILING_SILENT_CRUSH_AND_RAISE).toBe(5);
  });
});
