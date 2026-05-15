/**
 * Vanilla DOOM 1.9 view-setup wiring.
 *
 * Plan_final step `06-001` (lane: render) wires the vanilla
 * `R_ExecuteSetViewSize` derivation, the status-bar rectangle, the
 * active-view rectangle, and the field-of-view clip-angle range into a
 * frozen runtime artifact every downstream renderer step (BSP walk,
 * wall column draw, visplane fill, masked draw, sprite draw) consumes.
 * The wrapper imports the read-only {@link computeViewport} helper
 * from `src/render/projection.ts` without modifying it; the helper
 * already reproduces the vanilla 1.9 `R_ExecuteSetViewSize` arithmetic
 * byte-for-byte.
 *
 * Behavioral contract:
 *
 *   - `setBlocks` is clamped to the `[3, 11]` range pinned by the
 *     menu UI; values outside the range are coerced via
 *     {@link computeViewport}'s internal clamp.
 *   - `setBlocks = 11` hides the status bar (the active view fills
 *     the full 320×200 client area); any smaller value exposes the
 *     32-pixel-tall status bar at the bottom of the screen.
 *   - `detailShift = 0` ("high detail") delivers one renderer column
 *     per framebuffer pixel; `detailShift = 1` ("low detail") halves
 *     the horizontal sampling rate and replicates each rendered
 *     column to two framebuffer pixels.
 *   - The clip-angle range is the canonical 90-degree vanilla cone
 *     ({@link FIELDOFVIEW}), so callers can validate `setblocks`
 *     against the cone without re-deriving the constant.
 *
 * The wrapper exposes a pure resolver function that does not touch the
 * filesystem or the FFI surface; the {@link VanillaViewSetup} return
 * value is `Object.freeze`d, and every nested rectangle is also
 * frozen so downstream subsystems cannot mutate the resolved view.
 *
 * @example
 * ```ts
 * import { resolveVanillaViewSetup, VANILLA_DEFAULT_SET_BLOCKS } from './viewSetup.ts';
 * import { DetailMode } from '../render/projection.ts';
 *
 * const setup = resolveVanillaViewSetup(VANILLA_DEFAULT_SET_BLOCKS, DetailMode.high);
 * setup.viewport.viewWidth;        // 288
 * setup.statusBarVisible;          // true
 * setup.statusBarRect.height;      // 32
 * setup.viewWindowRect.width;      // 288
 * setup.fieldOfViewInBamUnits;     // 2048 (vanilla 90-degree cone)
 * ```
 */

import type { Viewport } from '../render/projection.ts';
import { DetailMode, FIELDOFVIEW, MAX_SETBLOCKS, MIN_SETBLOCKS, SBARHEIGHT, SCREENHEIGHT, SCREENWIDTH, computeViewport } from '../render/projection.ts';

/**
 * Inclusive range of valid `setblocks` values in vanilla DOOM 1.9.
 * The menu UI clamps the user's selection to this range; values
 * outside are coerced silently by {@link computeViewport}.
 */
export const VANILLA_VIEW_SIZE_RANGE: { readonly maximum: 11; readonly minimum: 3 } = Object.freeze({ maximum: MAX_SETBLOCKS, minimum: MIN_SETBLOCKS });

/**
 * Vanilla 1.9 default `setblocks` value when no user preference has
 * been recorded.  Matches the Chocolate Doom 2.2.1
 * `default.cfg` seed (`screenblocks = 9`).
 */
export const VANILLA_DEFAULT_SET_BLOCKS = 9;

/**
 * Vanilla 90-degree field of view, expressed in BAM units the
 * `viewangletox` clip-angle lookup uses to map view-relative angles
 * onto column indices.  Pinned here so callers can validate clip
 * angles upstream of the lookup itself.
 */
export const VANILLA_FIELD_OF_VIEW_IN_BAM_UNITS = FIELDOFVIEW;

/**
 * Axis-aligned rectangle describing a sub-region of the framebuffer.
 * The rectangle uses 0-based pixel coordinates with the origin in
 * the top-left corner; `(x + width)` and `(y + height)` are exclusive
 * (one past the last pixel in each axis).
 */
export interface ViewSetupRectangle {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Frozen runtime artifact assembled by {@link resolveVanillaViewSetup}.
 * Carries the derived {@link Viewport} alongside the two
 * downstream-relevant rectangles (status bar and active view) plus the
 * canonical clip-angle range.
 */
export interface VanillaViewSetup {
  readonly fieldOfViewInBamUnits: number;
  readonly statusBarRect: ViewSetupRectangle;
  readonly statusBarVisible: boolean;
  readonly viewWindowRect: ViewSetupRectangle;
  readonly viewport: Viewport;
}

const ZERO_STATUS_BAR_RECT: ViewSetupRectangle = Object.freeze({ height: 0, width: 0, x: 0, y: 0 });

function buildStatusBarRect(statusBarVisible: boolean): ViewSetupRectangle {
  if (!statusBarVisible) {
    return ZERO_STATUS_BAR_RECT;
  }
  return Object.freeze({ height: SBARHEIGHT, width: SCREENWIDTH, x: 0, y: SCREENHEIGHT - SBARHEIGHT });
}

function buildViewWindowRect(viewport: Viewport): ViewSetupRectangle {
  return Object.freeze({ height: viewport.viewHeight, width: viewport.scaledViewWidth, x: viewport.viewWindowX, y: viewport.viewWindowY });
}

/**
 * Resolve the vanilla view-setup artifact for a given `setBlocks` and
 * `detailShift`.  The result is `Object.freeze`d at every level so
 * downstream subsystems cannot mutate the resolved viewport.
 *
 * The status bar is reported visible when `viewport.scaledViewWidth`
 * is less than {@link SCREENWIDTH} (i.e. `setBlocks < 11`).  The
 * status-bar rectangle is anchored at the bottom of the 320×200
 * client area with the canonical 32-pixel height ({@link SBARHEIGHT})
 * and the full 320-pixel width.  The view-window rectangle echoes
 * the viewport's `(x, y, scaledViewWidth, viewHeight)` so callers
 * can address the active region directly.
 */
export function resolveVanillaViewSetup(setBlocks: number, detailShift: DetailMode): VanillaViewSetup {
  const viewport = computeViewport(setBlocks, detailShift);
  const statusBarVisible = viewport.scaledViewWidth !== SCREENWIDTH;
  return Object.freeze({
    fieldOfViewInBamUnits: VANILLA_FIELD_OF_VIEW_IN_BAM_UNITS,
    statusBarRect: buildStatusBarRect(statusBarVisible),
    statusBarVisible,
    viewWindowRect: buildViewWindowRect(viewport),
    viewport,
  });
}
