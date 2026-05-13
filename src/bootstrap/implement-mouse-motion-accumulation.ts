/**
 * Vanilla Chocolate Doom 2.2.1 mouse motion accumulation contract.
 *
 * Mouse motion events from the OS arrive at SDL_MOUSEMOTION granularity; the
 * I_StartTic pump accumulates relative dx/dy into ticcmd builders without
 * applying any acceleration curve at this layer (the menu-configured
 * mouse_acceleration value and mouse_threshold are applied later inside the
 * game when building turn/forward responses). novert=0 means vertical motion
 * is allowed; novert=1 forces dy=0 before accumulation.
 */

/** Vanilla mouse_acceleration default from chocolate-doom.cfg. */
export const VANILLA_MOUSE_ACCELERATION = 2;

/** Vanilla mouse_threshold default from chocolate-doom.cfg. */
export const VANILLA_MOUSE_THRESHOLD = 10;

/** Vanilla novert default from chocolate-doom.cfg (0 means vertical motion enabled). */
export const VANILLA_NOVERT_DEFAULT = 0;

/** Whether vanilla applies acceleration before accumulating. Vanilla: no. */
export const VANILLA_APPLIES_ACCELERATION_BEFORE_ACCUMULATION = false;

/** Whether vanilla clamps accumulated dx/dy per tic. Vanilla: no clamp at the accumulation stage. */
export const VANILLA_CLAMPS_ACCUMULATION_PER_TIC = false;

export interface MotionAccumulatorState {
  readonly accumulatedDeltaX: number;
  readonly accumulatedDeltaY: number;
}

export interface MotionEvent {
  readonly deltaX: number;
  readonly deltaY: number;
}

export function accumulateMotion(state: MotionAccumulatorState, event: MotionEvent, novertEnabled: boolean): MotionAccumulatorState {
  return Object.freeze({
    accumulatedDeltaX: state.accumulatedDeltaX + event.deltaX,
    accumulatedDeltaY: novertEnabled ? state.accumulatedDeltaY : state.accumulatedDeltaY + event.deltaY,
  });
}

export function resetAccumulator(): MotionAccumulatorState {
  return Object.freeze({ accumulatedDeltaX: 0, accumulatedDeltaY: 0 });
}
