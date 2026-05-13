import { describe, expect, test } from 'bun:test';

import {
  VANILLA_APPLIES_ACCELERATION_BEFORE_ACCUMULATION,
  VANILLA_CLAMPS_ACCUMULATION_PER_TIC,
  VANILLA_MOUSE_ACCELERATION,
  VANILLA_MOUSE_THRESHOLD,
  VANILLA_NOVERT_DEFAULT,
  accumulateMotion,
  resetAccumulator,
} from '../../../src/bootstrap/implement-mouse-motion-accumulation.ts';

describe('vanilla mouse motion accumulation contract', () => {
  test('mouse_acceleration default is 2, mouse_threshold default is 10, novert default is 0', () => {
    expect(VANILLA_MOUSE_ACCELERATION).toBe(2);
    expect(VANILLA_MOUSE_THRESHOLD).toBe(10);
    expect(VANILLA_NOVERT_DEFAULT).toBe(0);
  });

  test('vanilla does not apply acceleration at the accumulation stage and does not clamp', () => {
    expect(VANILLA_APPLIES_ACCELERATION_BEFORE_ACCUMULATION).toBe(false);
    expect(VANILLA_CLAMPS_ACCUMULATION_PER_TIC).toBe(false);
  });
});

describe('accumulateMotion', () => {
  test('adds dx and dy to the running state when novert is disabled', () => {
    let state = resetAccumulator();
    state = accumulateMotion(state, { deltaX: 3, deltaY: -1 }, false);
    expect(state).toEqual({ accumulatedDeltaX: 3, accumulatedDeltaY: -1 });
    state = accumulateMotion(state, { deltaX: 5, deltaY: 2 }, false);
    expect(state).toEqual({ accumulatedDeltaX: 8, accumulatedDeltaY: 1 });
  });

  test('zeroes dy contribution when novert is enabled but keeps dx', () => {
    let state = resetAccumulator();
    state = accumulateMotion(state, { deltaX: 7, deltaY: 99 }, true);
    expect(state).toEqual({ accumulatedDeltaX: 7, accumulatedDeltaY: 0 });
    state = accumulateMotion(state, { deltaX: -1, deltaY: -50 }, true);
    expect(state).toEqual({ accumulatedDeltaX: 6, accumulatedDeltaY: 0 });
  });

  test('resetAccumulator returns a fresh zero state', () => {
    expect(resetAccumulator()).toEqual({ accumulatedDeltaX: 0, accumulatedDeltaY: 0 });
  });

  test('state is frozen', () => {
    const state = resetAccumulator();
    expect(Object.isFrozen(state)).toBe(true);
  });
});
