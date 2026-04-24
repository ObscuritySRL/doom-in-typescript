/**
 * Window scaling and aspect-ratio correction policy matching Chocolate
 * Doom 2.2.1 display behavior.
 *
 * Chocolate Doom renders into a 320x200 indexed framebuffer. With
 * aspect_ratio_correct enabled (the reference default), the display
 * stretches 200 scanlines to 240 so that the output maintains a 4:3
 * aspect ratio — matching how CRT monitors originally displayed
 * mode 13h. The reference config uses 640x480 (2x integer scale of
 * 320x240).
 *
 * This module is pure arithmetic — no Win32 or runtime dependencies.
 *
 * @example
 * ```ts
 * import { computePresentationRect, SCREENWIDTH } from "../src/host/windowPolicy.ts";
 * const rect = computePresentationRect(640, 480, true);
 * // rect === { x: 0, y: 0, width: 640, height: 480 }
 * ```
 */

/** Vanilla Doom internal framebuffer width in pixels. */
export const SCREENWIDTH = 320;

/** Vanilla Doom internal framebuffer height in pixels. */
export const SCREENHEIGHT = 200;

/**
 * Display height after 4:3 aspect ratio correction.
 *
 * 200 * 6/5 = 240, making the effective ratio 320:240 = 4:3.
 * This matches Chocolate Doom's `SCREENHEIGHT_4_3` and the
 * original CRT vertical stretch of mode 13h.
 */
export const ASPECT_CORRECTED_HEIGHT = 240;

/** Target display aspect ratio when aspect correction is enabled. */
export const DISPLAY_ASPECT_RATIO = 4 / 3;

/**
 * Vertical stretch factor for aspect correction: 240/200 = 6/5 = 1.2.
 *
 * Each scanline is effectively 1.2 display pixels tall when
 * aspect correction is active.
 */
export const ASPECT_STRETCH_RATIO = 6 / 5;

/** Axis-aligned rectangle describing where the game image is placed within the client area. */
export interface PresentationRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Return the effective display height for the given aspect correction setting.
 *
 * @param aspectRatioCorrect - Whether 4:3 aspect correction is active.
 * @returns 240 when corrected, 200 when uncorrected.
 *
 * @example
 * ```ts
 * computeActualHeight(true);  // 240
 * computeActualHeight(false); // 200
 * ```
 */
export function computeActualHeight(aspectRatioCorrect: boolean): number {
  return aspectRatioCorrect ? ASPECT_CORRECTED_HEIGHT : SCREENHEIGHT;
}

/**
 * Compute the largest integer scale multiplier that fits within
 * the given client dimensions.
 *
 * The multiplier is clamped to a minimum of 1. Both axes must fit
 * at the chosen scale, so the result is `min(floor(w/320), floor(h/actualHeight))`.
 *
 * @param clientWidth  - Client area width in pixels.
 * @param clientHeight - Client area height in pixels.
 * @param aspectRatioCorrect - Whether 4:3 aspect correction is active.
 * @returns Integer scale multiplier (>= 1).
 *
 * @example
 * ```ts
 * computeScaleMultiplier(640, 480, true);  // 2
 * computeScaleMultiplier(960, 720, true);  // 3
 * computeScaleMultiplier(800, 480, true);  // 2 (height-limited)
 * ```
 */
export function computeScaleMultiplier(clientWidth: number, clientHeight: number, aspectRatioCorrect: boolean): number {
  const actualHeight = computeActualHeight(aspectRatioCorrect);
  const scaleX = Math.floor(clientWidth / SCREENWIDTH);
  const scaleY = Math.floor(clientHeight / actualHeight);
  return Math.max(1, Math.min(scaleX, scaleY));
}

/**
 * Compute the client-area dimensions for a given integer scale multiplier.
 *
 * @param scaleMultiplier - Integer scale (>= 1).
 * @param aspectRatioCorrect - Whether 4:3 aspect correction is active.
 * @returns Frozen `{ width, height }` in pixels.
 *
 * @example
 * ```ts
 * computeClientDimensions(2, true);  // { width: 640, height: 480 }
 * computeClientDimensions(1, false); // { width: 320, height: 200 }
 * ```
 */
export function computeClientDimensions(scaleMultiplier: number, aspectRatioCorrect: boolean): Readonly<{ width: number; height: number }> {
  const actualHeight = computeActualHeight(aspectRatioCorrect);
  return Object.freeze({
    width: SCREENWIDTH * scaleMultiplier,
    height: actualHeight * scaleMultiplier,
  });
}

/**
 * Compute the presentation rectangle for rendering the game framebuffer
 * into a client area of arbitrary size, preserving the correct aspect ratio.
 *
 * When aspect_ratio_correct is true, the source aspect is 320:240 (4:3).
 * When false, the source aspect is 320:200 (8:5).
 *
 * If the client area is wider than the source aspect, pillarboxing
 * (vertical black bars on the sides) centers the image horizontally.
 * If taller, letterboxing (horizontal black bars top and bottom) centers
 * vertically. When the aspect matches exactly, the image fills the client.
 *
 * @param clientWidth  - Client area width in pixels.
 * @param clientHeight - Client area height in pixels.
 * @param aspectRatioCorrect - Whether 4:3 aspect correction is active.
 * @returns Frozen presentation rectangle within the client area.
 *
 * @example
 * ```ts
 * computePresentationRect(640, 480, true);
 * // { x: 0, y: 0, width: 640, height: 480 }
 *
 * computePresentationRect(800, 480, true);
 * // pillarbox: { x: 80, y: 0, width: 640, height: 480 }
 * ```
 */
export function computePresentationRect(clientWidth: number, clientHeight: number, aspectRatioCorrect: boolean): PresentationRect {
  if (clientWidth <= 0 || clientHeight <= 0) {
    return Object.freeze({ x: 0, y: 0, width: 0, height: 0 });
  }

  const actualHeight = computeActualHeight(aspectRatioCorrect);
  const sourceAspect = SCREENWIDTH / actualHeight;
  const clientAspect = clientWidth / clientHeight;

  let width: number;
  let height: number;

  if (clientAspect > sourceAspect) {
    // Client is wider than source → pillarbox (black bars on sides)
    height = clientHeight;
    width = Math.round(height * sourceAspect);
  } else {
    // Client is taller or exact match → letterbox or exact fit
    width = clientWidth;
    height = Math.round(width / sourceAspect);
  }

  const x = Math.round((clientWidth - width) / 2);
  const y = Math.round((clientHeight - height) / 2);

  return Object.freeze({ x, y, width, height });
}
