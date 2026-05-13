import { describe, expect, test } from 'bun:test';

import { FRACBITS } from '../../../src/core/fixed.ts';
import {
  PLAT_BLAZE_DWUS,
  PLAT_DOWN_WAIT_UP_STAY,
  PLAT_PERPETUAL_RAISE,
  PLAT_RAISE_AND_CHANGE,
  PLAT_RAISE_TO_NEAREST_AND_CHANGE,
  PLAT_STATE_DOWN,
  PLAT_STATE_IN_STASIS,
  PLAT_STATE_UP,
  PLAT_STATE_WAITING,
  VANILLA_MAXPLATS,
  VANILLA_PLATSPEED_BLAZE_FIXED,
  VANILLA_PLATSPEED_FIXED,
  VANILLA_PLATWAIT_TICS,
} from '../../../src/ai/implement-platform-specials.ts';

describe('vanilla platform constants', () => {
  test('PLATSPEED = 1 fixed, blaze = 8 fixed', () => {
    expect(VANILLA_PLATSPEED_FIXED).toBe(1 << FRACBITS);
    expect(VANILLA_PLATSPEED_BLAZE_FIXED).toBe(8 << FRACBITS);
  });

  test('PLATWAIT = 3 * 35 = 105 tics', () => {
    expect(VANILLA_PLATWAIT_TICS).toBe(105);
  });

  test('MAXPLATS = 30', () => {
    expect(VANILLA_MAXPLATS).toBe(30);
  });

  test('plattype_e and plat_e enum values', () => {
    expect(PLAT_PERPETUAL_RAISE).toBe(0);
    expect(PLAT_DOWN_WAIT_UP_STAY).toBe(1);
    expect(PLAT_RAISE_AND_CHANGE).toBe(2);
    expect(PLAT_RAISE_TO_NEAREST_AND_CHANGE).toBe(3);
    expect(PLAT_BLAZE_DWUS).toBe(4);
    expect(PLAT_STATE_UP).toBe(0);
    expect(PLAT_STATE_DOWN).toBe(1);
    expect(PLAT_STATE_WAITING).toBe(2);
    expect(PLAT_STATE_IN_STASIS).toBe(3);
  });
});
