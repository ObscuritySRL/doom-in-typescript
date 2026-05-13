import { describe, expect, test } from 'bun:test';

import { FRACBITS } from '../../../src/core/fixed.ts';
import { VANILLA_RAISE_IN_5_MINS_TICS, VANILLA_VDOORSPEED_FIXED, VANILLA_VDOORWAIT_TICS, VLD_CLOSE, VLD_CLOSE30THEN, VLD_NORMAL, VLD_OPEN, VLD_RAISE_IN_5_MINS } from '../../../src/ai/implement-door-specials.ts';

describe('vanilla door special constants', () => {
  test('VDOORSPEED = 2 fixed', () => {
    expect(VANILLA_VDOORSPEED_FIXED).toBe(2 << FRACBITS);
  });

  test('VDOORWAIT = 150 tics (4.28s at 35 Hz)', () => {
    expect(VANILLA_VDOORWAIT_TICS).toBe(150);
  });

  test('raise-in-5-mins = 35 * 5 * 60 = 10500 tics', () => {
    expect(VANILLA_RAISE_IN_5_MINS_TICS).toBe(10500);
  });

  test('door type enum values from p_spec.h vldoor_e', () => {
    expect(VLD_NORMAL).toBe(0);
    expect(VLD_CLOSE30THEN).toBe(1);
    expect(VLD_CLOSE).toBe(2);
    expect(VLD_OPEN).toBe(3);
    expect(VLD_RAISE_IN_5_MINS).toBe(4);
  });
});
