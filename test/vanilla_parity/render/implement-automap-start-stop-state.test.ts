import { describe, expect, test } from 'bun:test';

import { FRACBITS } from '../../../src/core/fixed.ts';
import {
  AM_STATE_ACTIVE,
  AM_STATE_INACTIVE,
  VANILLA_AM_INIT_SCALE_MTOF_FIXED,
  VANILLA_AM_MAX_SCALE_MTOF_FIXED,
  VANILLA_AM_MIN_SCALE_MTOF_FIXED,
  VANILLA_AM_PAN_INCREMENT_FIXED,
} from '../../../src/render/implement-automap-start-stop-state.ts';

describe('vanilla automap state constants', () => {
  test('pan increment = 1 fixed', () => {
    expect(VANILLA_AM_PAN_INCREMENT_FIXED).toBe(1 << FRACBITS);
  });

  test('initial scale ≈ 0.1992 fixed (0x33000)', () => {
    expect(VANILLA_AM_INIT_SCALE_MTOF_FIXED).toBe(0x33000);
  });

  test('min/max scale bounds', () => {
    expect(VANILLA_AM_MIN_SCALE_MTOF_FIXED).toBe(0x10000);
    expect(VANILLA_AM_MAX_SCALE_MTOF_FIXED).toBe(0x800000);
  });

  test('state enum: inactive=0, active=1', () => {
    expect(AM_STATE_INACTIVE).toBe(0);
    expect(AM_STATE_ACTIVE).toBe(1);
  });
});
