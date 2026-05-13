import { describe, expect, test } from 'bun:test';

import { FRACBITS } from '../../../src/core/fixed.ts';
import {
  VANILLA_CRUSHER_FAST_SPEED_FIXED,
  VANILLA_CRUSHER_SPEED_FIXED,
  VANILLA_DONUT_FLOOR_SPEED_FIXED,
  VANILLA_DONUT_PILLAR_SPEED_FIXED,
  VANILLA_STAIRS_BUILD_16_SPEED_FIXED,
  VANILLA_STAIRS_BUILD_16_STEP_HEIGHT_MAPUNITS,
  VANILLA_STAIRS_BUILD_8_SPEED_FIXED,
  VANILLA_STAIRS_BUILD_8_STEP_HEIGHT_MAPUNITS,
} from '../../../src/ai/implement-stairs-donut-and-crusher-specials.ts';

describe('vanilla stairs constants', () => {
  test('build_8 speed = FLOORSPEED/4, step = 8 map units', () => {
    expect(VANILLA_STAIRS_BUILD_8_SPEED_FIXED).toBe((1 << FRACBITS) >> 2);
    expect(VANILLA_STAIRS_BUILD_8_STEP_HEIGHT_MAPUNITS).toBe(8);
  });

  test('build_16 turbo speed = 4*FLOORSPEED, step = 16 map units', () => {
    expect(VANILLA_STAIRS_BUILD_16_SPEED_FIXED).toBe(4 << FRACBITS);
    expect(VANILLA_STAIRS_BUILD_16_STEP_HEIGHT_MAPUNITS).toBe(16);
  });
});

describe('vanilla donut constants', () => {
  test('pillar and donut floor both move at FLOORSPEED/2', () => {
    expect(VANILLA_DONUT_PILLAR_SPEED_FIXED).toBe((1 << FRACBITS) >> 1);
    expect(VANILLA_DONUT_FLOOR_SPEED_FIXED).toBe((1 << FRACBITS) >> 1);
  });
});

describe('vanilla crusher constants', () => {
  test('crusher speed = CEILSPEED = 1 fixed', () => {
    expect(VANILLA_CRUSHER_SPEED_FIXED).toBe(1 << FRACBITS);
  });

  test('fast crusher = 2 * CEILSPEED = 2 fixed', () => {
    expect(VANILLA_CRUSHER_FAST_SPEED_FIXED).toBe(2 << FRACBITS);
  });
});
