import { describe, expect, test } from 'bun:test';

import { FRACBITS } from '../../../src/core/fixed.ts';
import {
  FLOOR_DONUT_RAISE,
  FLOOR_LOWER,
  FLOOR_LOWER_AND_CHANGE,
  FLOOR_LOWER_TO_LOWEST,
  FLOOR_RAISE,
  FLOOR_RAISE_24,
  FLOOR_RAISE_24_AND_CHANGE,
  FLOOR_RAISE_512,
  FLOOR_RAISE_CRUSH,
  FLOOR_RAISE_TO_NEAREST,
  FLOOR_RAISE_TO_TEXTURE,
  FLOOR_RAISE_TURBO,
  FLOOR_TURBO_LOWER,
  VANILLA_FLOORSPEED_FIXED,
  VANILLA_FLOORSPEED_TURBO_FIXED,
  VANILLA_FLOOR_CRUSH_DAMAGE,
  VANILLA_FLOOR_CRUSH_TIC_INTERVAL,
} from '../../../src/ai/implement-floor-specials.ts';

describe('vanilla floor special constants', () => {
  test('FLOORSPEED = 1 fixed, turbo = 4 fixed', () => {
    expect(VANILLA_FLOORSPEED_FIXED).toBe(1 << FRACBITS);
    expect(VANILLA_FLOORSPEED_TURBO_FIXED).toBe(4 << FRACBITS);
  });

  test('crush damage = 10 every 4 tics', () => {
    expect(VANILLA_FLOOR_CRUSH_DAMAGE).toBe(10);
    expect(VANILLA_FLOOR_CRUSH_TIC_INTERVAL).toBe(4);
  });

  test('floor_e enum values', () => {
    expect(FLOOR_LOWER).toBe(0);
    expect(FLOOR_LOWER_TO_LOWEST).toBe(1);
    expect(FLOOR_TURBO_LOWER).toBe(2);
    expect(FLOOR_RAISE).toBe(3);
    expect(FLOOR_RAISE_TO_NEAREST).toBe(4);
    expect(FLOOR_RAISE_TO_TEXTURE).toBe(5);
    expect(FLOOR_LOWER_AND_CHANGE).toBe(6);
    expect(FLOOR_RAISE_24).toBe(7);
    expect(FLOOR_RAISE_24_AND_CHANGE).toBe(8);
    expect(FLOOR_RAISE_CRUSH).toBe(9);
    expect(FLOOR_RAISE_TURBO).toBe(10);
    expect(FLOOR_DONUT_RAISE).toBe(11);
    expect(FLOOR_RAISE_512).toBe(12);
  });
});
