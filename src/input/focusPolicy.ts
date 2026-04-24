/**
 * Focus, pause, and mouse grab policy matching Chocolate Doom's
 * UpdateFocus and MouseShouldBeGrabbed behavior.
 *
 * Tracks three independent state axes:
 * - Window focus (via WM_ACTIVATEAPP)
 * - Screen visibility (minimized vs. visible)
 * - Grab configuration (grabmouse config variable)
 *
 * The combined state determines whether mouse grab should be active
 * and whether input should be accepted.  On each state change, the
 * policy evaluates the grab equation and returns a transition
 * action ('grab', 'release', or 'none') for the caller to execute
 * against the actual Win32 cursor/capture APIs.
 *
 * Chocolate Doom's I_GetEvent discards all input events when the
 * window is not focused.  This module exposes that rule via the
 * {@link FocusPolicy.inputSuppressed} property.
 *
 * @example
 * ```ts
 * import { FocusPolicy, WM_ACTIVATEAPP } from "../src/input/focusPolicy.ts";
 * const policy = new FocusPolicy();
 * const action = policy.evaluate();          // initial grab
 * const lost = policy.handleActivateApp(0);  // focus lost → 'release'
 * if (policy.inputSuppressed) { /* discard input *​/ }
 * ```
 */

/** WM_ACTIVATEAPP message identifier. */
export const WM_ACTIVATEAPP = 0x001c;

/**
 * Action the caller should take on the physical mouse grab.
 *
 * - `'grab'`    — acquire mouse capture and hide the cursor.
 * - `'release'` — release mouse capture and show the cursor.
 * - `'none'`    — no change needed; physical state already matches policy.
 */
export type GrabTransition = 'grab' | 'release' | 'none';

/** All valid {@link GrabTransition} values in ASCIIbetical order. */
export const GRAB_TRANSITIONS: readonly GrabTransition[] = Object.freeze(['grab', 'none', 'release'] as const);

/**
 * Tracks window focus, screen visibility, and grab configuration to
 * produce deterministic mouse-grab and input-suppression decisions.
 *
 * Initial state: focused, visible, grab enabled, not yet grabbed.
 * Call {@link evaluate} after window creation to trigger the first grab.
 *
 * Each state-change method re-evaluates the grab equation and returns
 * a {@link GrabTransition} indicating what the caller should do with
 * the physical mouse capture.
 *
 * Grab equation (matches Chocolate Doom's MouseShouldBeGrabbed):
 *   shouldGrab = grabEnabled AND windowFocused AND screenVisible
 *
 * @example
 * ```ts
 * const policy = new FocusPolicy();
 * policy.evaluate();                // → 'grab'
 * policy.handleActivateApp(0);      // → 'release'
 * policy.handleActivateApp(1);      // → 'grab'
 * ```
 */
export class FocusPolicy {
  #windowFocused: boolean;
  #screenVisible: boolean;
  #grabEnabled: boolean;
  #mouseGrabbed: boolean;

  constructor() {
    this.#windowFocused = true;
    this.#screenVisible = true;
    this.#grabEnabled = true;
    this.#mouseGrabbed = false;
  }

  /** Whether the window currently has application-level focus. */
  get windowFocused(): boolean {
    return this.#windowFocused;
  }

  /** Whether the window is visible (not minimized / iconified). */
  get screenVisible(): boolean {
    return this.#screenVisible;
  }

  /** Whether mouse grab is enabled by configuration (grabmouse). */
  get grabEnabled(): boolean {
    return this.#grabEnabled;
  }

  /** Whether the mouse is currently physically grabbed. */
  get mouseGrabbed(): boolean {
    return this.#mouseGrabbed;
  }

  /**
   * Whether input events should be discarded.
   *
   * Matches Chocolate Doom's I_GetEvent early-return when the window
   * is not focused.  All keyboard, mouse, and joystick events should
   * be ignored while this is true.  Only quit and focus events pass.
   */
  get inputSuppressed(): boolean {
    return !this.#windowFocused;
  }

  /**
   * Whether the mouse should be grabbed according to the current
   * combined state.
   *
   * True when all three conditions are met:
   * 1. grabEnabled (config allows it)
   * 2. windowFocused (app has focus)
   * 3. screenVisible (not minimized)
   *
   * This is the pure policy evaluation with no side effects.
   */
  get shouldGrab(): boolean {
    return this.#grabEnabled && this.#windowFocused && this.#screenVisible;
  }

  /**
   * Handle a WM_ACTIVATEAPP message.
   *
   * @param wParam - Nonzero if the window is being activated,
   *                 zero if it is being deactivated.
   * @returns Grab transition to execute.
   */
  handleActivateApp(wParam: number): GrabTransition {
    this.#windowFocused = wParam !== 0;
    return this.#evaluateGrab();
  }

  /**
   * Update screen visibility state.
   *
   * Call with `false` when the window is minimized (SIZE_MINIMIZED)
   * and `true` when it is restored (SIZE_RESTORED, SIZE_MAXIMIZED).
   *
   * @param visible - Whether the window is visible.
   * @returns Grab transition to execute.
   */
  setScreenVisible(visible: boolean): GrabTransition {
    this.#screenVisible = visible;
    return this.#evaluateGrab();
  }

  /**
   * Update the grab-enabled configuration.
   *
   * Maps to the `grabmouse` config variable (default: enabled).
   *
   * @param enabled - Whether mouse grab is allowed.
   * @returns Grab transition to execute.
   */
  setGrabEnabled(enabled: boolean): GrabTransition {
    this.#grabEnabled = enabled;
    return this.#evaluateGrab();
  }

  /**
   * Re-evaluate the grab equation without changing any tracked state.
   *
   * Call once after window creation to trigger the initial grab.
   * Subsequent calls are harmless and return 'none' if the physical
   * state already matches the desired state.
   *
   * @returns Grab transition to execute.
   */
  evaluate(): GrabTransition {
    return this.#evaluateGrab();
  }

  /**
   * Reset to initial state: focused, visible, grab enabled, not grabbed.
   */
  reset(): void {
    this.#windowFocused = true;
    this.#screenVisible = true;
    this.#grabEnabled = true;
    this.#mouseGrabbed = false;
  }

  /**
   * Core grab transition logic matching Chocolate Doom's UpdateGrab:
   * compare desired state to physical state, return the needed action,
   * and update the tracked physical state.
   */
  #evaluateGrab(): GrabTransition {
    const desired = this.shouldGrab;
    if (desired && !this.#mouseGrabbed) {
      this.#mouseGrabbed = true;
      return 'grab';
    }
    if (!desired && this.#mouseGrabbed) {
      this.#mouseGrabbed = false;
      return 'release';
    }
    return 'none';
  }
}
