/**
 * Mouse motion and button sampling for Doom, matching Chocolate Doom's
 * I_ReadMouse behavior.
 *
 * Doom uses 5 mouse buttons (0-based: left, right, middle, extra1, extra2)
 * represented as a bitmask.  Motion is accumulated as raw pixel deltas
 * between tic samples.  Chocolate Doom applies piecewise-linear
 * acceleration at sample time: deltas at or below the threshold pass
 * through unchanged; the excess above the threshold is multiplied by
 * the acceleration factor.
 *
 * On Win32, mouse button messages (WM_LBUTTONDOWN through WM_XBUTTONUP)
 * are translated to Doom's 0-4 button indices, and cursor-position deltas
 * are accumulated into the sampler.
 *
 * @example
 * ```ts
 * import { MouseSampler, translateMouseButton, WM_LBUTTONDOWN } from "../src/input/mouse.ts";
 * const sampler = new MouseSampler();
 * sampler.handleButtonDown(translateMouseButton(WM_LBUTTONDOWN, 0));
 * sampler.handleMotion(12, -3);
 * const snap = sampler.sample(10, 2.0);
 * ```
 */

// ── Doom mouse button indices (matching SDL/Chocolate Doom) ───────

/** Left mouse button index. */
export const MOUSE_BUTTON_LEFT = 0;
/** Right mouse button index. */
export const MOUSE_BUTTON_RIGHT = 1;
/** Middle mouse button index. */
export const MOUSE_BUTTON_MIDDLE = 2;
/** Extra mouse button 1 (side button / X1). */
export const MOUSE_BUTTON_EXTRA1 = 3;
/** Extra mouse button 2 (side button / X2). */
export const MOUSE_BUTTON_EXTRA2 = 4;

/** Total number of mouse buttons Doom tracks. */
export const MOUSE_BUTTON_COUNT = 5;

/** Maximum valid button index (0-based). */
export const MOUSE_BUTTON_MAX = 4;

// ── Win32 mouse message constants ─────────────────────────────────

export const WM_MOUSEMOVE = 0x0200;
export const WM_LBUTTONDOWN = 0x0201;
export const WM_LBUTTONUP = 0x0202;
export const WM_RBUTTONDOWN = 0x0204;
export const WM_RBUTTONUP = 0x0205;
export const WM_MBUTTONDOWN = 0x0207;
export const WM_MBUTTONUP = 0x0208;
export const WM_XBUTTONDOWN = 0x020b;
export const WM_XBUTTONUP = 0x020c;

/** HIWORD(wParam) value for XBUTTON1. */
export const XBUTTON1 = 0x0001;
/** HIWORD(wParam) value for XBUTTON2. */
export const XBUTTON2 = 0x0002;

// ── Win32 → Doom button translation ──────────────────────────────

/**
 * Translate a Win32 mouse button message to a Doom button index (0-4).
 *
 * For WM_xBUTTON messages, no wParam inspection is needed.
 * For WM_XBUTTON messages, HIWORD(wParam) distinguishes XBUTTON1 (→3)
 * from XBUTTON2 (→4).  Returns -1 for unrecognized messages.
 *
 * @param message - The WM_ message identifier from the MSG structure.
 * @param wParam  - The WPARAM value; only inspected for WM_XBUTTON*.
 */
export function translateMouseButton(message: number, wParam: number): number {
  switch (message) {
    case WM_LBUTTONDOWN:
    case WM_LBUTTONUP:
      return MOUSE_BUTTON_LEFT;
    case WM_RBUTTONDOWN:
    case WM_RBUTTONUP:
      return MOUSE_BUTTON_RIGHT;
    case WM_MBUTTONDOWN:
    case WM_MBUTTONUP:
      return MOUSE_BUTTON_MIDDLE;
    case WM_XBUTTONDOWN:
    case WM_XBUTTONUP: {
      const xButton = (wParam >>> 16) & 0xffff;
      if (xButton === XBUTTON1) return MOUSE_BUTTON_EXTRA1;
      if (xButton === XBUTTON2) return MOUSE_BUTTON_EXTRA2;
      return -1;
    }
    default:
      return -1;
  }
}

/**
 * Test whether a Win32 message is a mouse-button-down message.
 *
 * Covers WM_LBUTTONDOWN, WM_RBUTTONDOWN, WM_MBUTTONDOWN, WM_XBUTTONDOWN.
 */
export function isMouseButtonDown(message: number): boolean {
  return message === WM_LBUTTONDOWN || message === WM_RBUTTONDOWN || message === WM_MBUTTONDOWN || message === WM_XBUTTONDOWN;
}

/**
 * Test whether a Win32 message is a mouse-button-up message.
 *
 * Covers WM_LBUTTONUP, WM_RBUTTONUP, WM_MBUTTONUP, WM_XBUTTONUP.
 */
export function isMouseButtonUp(message: number): boolean {
  return message === WM_LBUTTONUP || message === WM_RBUTTONUP || message === WM_MBUTTONUP || message === WM_XBUTTONUP;
}

// ── Mouse acceleration ────────────────────────────────────────────

/**
 * Apply Chocolate Doom's piecewise-linear mouse acceleration to a
 * single axis delta.
 *
 * Below or at the threshold the value passes through unchanged.
 * Above the threshold the excess is multiplied by the acceleration
 * factor.  The result is truncated to integer via `Math.trunc`,
 * matching the C `(int)` cast.
 *
 * When threshold is 0 or acceleration is ≤ 1.0, the value is
 * returned unchanged (no acceleration applied).
 *
 * @param value        - Raw pixel delta (may be negative).
 * @param threshold    - Acceleration threshold (pixels).
 * @param acceleration - Acceleration multiplier (> 1.0 to take effect).
 * @returns Accelerated delta, truncated to integer.
 */
export function accelerateMouse(value: number, threshold: number, acceleration: number): number {
  if (threshold <= 0 || acceleration <= 1.0) {
    return value;
  }
  const absolute = Math.abs(value);
  if (absolute <= threshold) {
    return value;
  }
  const accelerated = threshold + (absolute - threshold) * acceleration;
  return value > 0 ? Math.trunc(accelerated) : -Math.trunc(accelerated);
}

// ── Mouse sample result ───────────────────────────────────────────

/** Per-tic mouse sample returned by {@link MouseSampler.sample}. */
export interface MouseSample {
  /** Button bitmask: bit N set if button N is currently held. */
  readonly buttons: number;
  /** Accumulated horizontal delta (positive = rightward), post-acceleration. */
  readonly deltaX: number;
  /** Accumulated vertical delta (positive = forward/up), post-acceleration. */
  readonly deltaY: number;
}

// ── MouseSampler ──────────────────────────────────────────────────

/**
 * Accumulates raw mouse input between tic boundaries and produces
 * per-tic {@link MouseSample} snapshots.
 *
 * Button state is tracked as a persistent bitmask that survives
 * across samples — buttons stay held until explicitly released.
 * Motion deltas are accumulated additively and reset to zero after
 * each {@link sample} call, matching Chocolate Doom's I_ReadMouse
 * drain-and-clear pattern.
 *
 * Y-axis inversion (screen-down → Doom-forward) is the caller's
 * responsibility when feeding raw OS deltas.  The sampler itself
 * is axis-agnostic.
 *
 * @example
 * ```ts
 * const sampler = new MouseSampler();
 * sampler.handleMotion(5, 3);
 * sampler.handleMotion(7, -1);
 * sampler.handleButtonDown(0);
 * const snap = sampler.sample(10, 2.0);
 * // snap.deltaX === 12, snap.deltaY === 2, snap.buttons === 1
 * ```
 */
export class MouseSampler {
  #buttons = 0;
  #deltaX = 0;
  #deltaY = 0;

  /** Current button bitmask (bit N = button N held). */
  get buttons(): number {
    return this.#buttons;
  }

  /** Accumulated horizontal delta since the last sample. */
  get pendingDeltaX(): number {
    return this.#deltaX;
  }

  /** Accumulated vertical delta since the last sample. */
  get pendingDeltaY(): number {
    return this.#deltaY;
  }

  /**
   * Record a mouse button press.
   *
   * @param button - Doom button index (0-4).  Out-of-range values are ignored.
   */
  handleButtonDown(button: number): void {
    if (button < 0 || button > MOUSE_BUTTON_MAX) return;
    this.#buttons |= 1 << button;
  }

  /**
   * Record a mouse button release.
   *
   * @param button - Doom button index (0-4).  Out-of-range values are ignored.
   */
  handleButtonUp(button: number): void {
    if (button < 0 || button > MOUSE_BUTTON_MAX) return;
    this.#buttons &= ~(1 << button);
  }

  /**
   * Accumulate a raw mouse motion delta.
   *
   * Multiple calls between samples are summed.  The caller is
   * responsible for Y-axis inversion if needed.
   *
   * @param deltaX - Horizontal pixel delta (positive = rightward).
   * @param deltaY - Vertical pixel delta (positive = forward in Doom convention).
   */
  handleMotion(deltaX: number, deltaY: number): void {
    this.#deltaX += deltaX;
    this.#deltaY += deltaY;
  }

  /**
   * Produce a per-tic sample: current button state and accumulated
   * deltas with acceleration applied.  Resets the delta accumulators
   * to zero.
   *
   * @param threshold    - Acceleration threshold in pixels.
   * @param acceleration - Acceleration multiplier (> 1.0 to take effect).
   * @returns Frozen {@link MouseSample} with post-acceleration deltas.
   */
  sample(threshold: number, acceleration: number): MouseSample {
    const acceleratedX = accelerateMouse(this.#deltaX, threshold, acceleration);
    const acceleratedY = accelerateMouse(this.#deltaY, threshold, acceleration);
    this.#deltaX = 0;
    this.#deltaY = 0;
    return Object.freeze({
      buttons: this.#buttons,
      deltaX: acceleratedX,
      deltaY: acceleratedY,
    });
  }

  /**
   * Reset all state: clear button mask and pending deltas.
   */
  reset(): void {
    this.#buttons = 0;
    this.#deltaX = 0;
    this.#deltaY = 0;
  }
}
