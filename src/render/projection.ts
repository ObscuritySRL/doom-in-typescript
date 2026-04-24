/**
 * Projection and detail constants for the world renderer (r_main.c,
 * r_main.h, r_bsp.c, r_plane.c).
 *
 * Holds the compile-time constants the later renderer steps consume and
 * the {@link computeViewport} derivation that matches
 * `R_ExecuteSetViewSize` byte-for-byte: viewport dimensions flow from
 * the user's `setblocks` (3..11) and `detailshift` (0..1) through the
 * same arithmetic vanilla ran, and the `centerx` / `centery` /
 * `centerxfrac` / `centeryfrac` / `projection` / `viewwindowx` /
 * `viewwindowy` outputs feed every wall, span, and sprite projection
 * site in phase 13.
 *
 * The lighting constants {@link LIGHTLEVELS}..{@link NUMCOLORMAPS} drive
 * `R_InitLightTables`, the per-segment `zlight` / `scalelight` arrays
 * consumed by {@link solidWallPath} / {@link spanDrawers}, and the 32-
 * colormap light-diminishing ramp applied to every column and span.
 *
 * `FIELDOFVIEW = 2048` is the vanilla 90-degree cone the
 * `R_InitTextureMapping` `viewangletox` table covers; phase 13 steps
 * that build the angle-to-column lookup consume it directly.
 *
 * `MAXSEGS`, `MAXVISPLANES`, and `MAXOPENINGS` are the hard engine
 * limits r_bsp.c / r_plane.c enforce via `I_Error` on overflow; the
 * renderer steps that allocate these tables import the constants from
 * here so the limits live in one place.
 *
 * This module is pure arithmetic with no Win32 or runtime dependencies.
 *
 * @example
 * ```ts
 * import { computeViewport, DetailMode } from "../src/render/projection.ts";
 * const view = computeViewport(11, DetailMode.high);
 * // view.viewWidth === 320, view.viewHeight === 200, view.centerX === 160
 * ```
 */

import { FRACBITS } from '../core/fixed.ts';
import { SCREENHEIGHT, SCREENWIDTH } from '../host/windowPolicy.ts';

export { SCREENHEIGHT, SCREENWIDTH };

/** Vanilla 90-degree field of view (BAM units that span one quadrant of the 4096-entry finetangent table). */
export const FIELDOFVIEW = 2048;

/** Status-bar height in pixels (st_stuff.h `ST_HEIGHT` = `SBARHEIGHT`). */
export const SBARHEIGHT = 32;

/** Light-level bucket count applied across diminish ranges (r_main.h `LIGHTLEVELS`). */
export const LIGHTLEVELS = 16;

/** Right shift from sector lightlevel (0..255) to light-level bucket (0..15). */
export const LIGHTSEGSHIFT = 4;

/** Right shift from wall scale to bucket index for `scalelight`. */
export const LIGHTSCALESHIFT = 12;

/** Upper bound on scale-bucket index consumed by the column light table (r_main.h `MAXLIGHTSCALE`). */
export const MAXLIGHTSCALE = 48;

/** Right shift from view-space z (fixed-point) to `zlight` bucket index. */
export const LIGHTZSHIFT = 20;

/** Upper bound on z-bucket index consumed by the span light table (r_main.h `MAXLIGHTZ`). */
export const MAXLIGHTZ = 128;

/** Number of colormap ramps in COLORMAP for light diminishing (r_main.h `NUMCOLORMAPS`). */
export const NUMCOLORMAPS = 32;

/** Upper bound on simultaneous solid segments tracked per frame (`MAXSEGS = SCREENWIDTH / 2 + 1`). */
export const MAXSEGS = SCREENWIDTH / 2 + 1;

/** Upper bound on simultaneous visplanes per frame (r_plane.c `MAXVISPLANES`). */
export const MAXVISPLANES = 128;

/** Upper bound on entries in the shared openings pool (`MAXOPENINGS = SCREENWIDTH * 64`). */
export const MAXOPENINGS = SCREENWIDTH * 64;

/** Minimum `setblocks` value the viewport size menu clamps to. */
export const MIN_SETBLOCKS = 3;

/** Maximum `setblocks` value (`11` = full screen, no status bar). */
export const MAX_SETBLOCKS = 11;

/**
 * Detail-mode toggle.  Vanilla `detailshift` is 0 for the default
 * "high" detail (one pixel per column) and 1 for the "low" detail
 * mode (two pixels per column, halving the horizontal sampling rate).
 */
export const enum DetailMode {
  high = 0,
  low = 1,
}

/**
 * Everything `R_ExecuteSetViewSize` assigns to the renderer's global
 * view-size state.  All lengths are pixels; the `*Frac` fields are
 * their counterparts in 16.16 fixed-point.  `projection` is set to
 * `centerXFrac` to match vanilla's `projection = centerxfrac`.
 */
export interface Viewport {
  /** Pixel width BEFORE the detail-shift halves the actual sampling rate. */
  readonly scaledViewWidth: number;
  /** Pixel width AFTER the detail-shift (`scaledViewWidth >> detailShift`). */
  readonly viewWidth: number;
  /** Pixel height (`200` at `setblocks === 11`, else `(setblocks * 168 / 10) & ~7`). */
  readonly viewHeight: number;
  /** Horizontal center pixel (`viewWidth >> 1`). */
  readonly centerX: number;
  /** Vertical center pixel (`viewHeight >> 1`). */
  readonly centerY: number;
  /** `centerX` in 16.16 fixed-point. */
  readonly centerXFrac: number;
  /** `centerY` in 16.16 fixed-point. */
  readonly centerYFrac: number;
  /** Perspective divisor (`centerXFrac` in vanilla). */
  readonly projection: number;
  /** Left edge of the view window inside the framebuffer. */
  readonly viewWindowX: number;
  /** Top edge of the view window inside the framebuffer. */
  readonly viewWindowY: number;
  /** Echo of the input `detailShift` (0 for high detail, 1 for low). */
  readonly detailShift: DetailMode;
}

/**
 * Derive a {@link Viewport} matching `R_ExecuteSetViewSize` in
 * r_main.c for the given `setBlocks` (3..11) and `detailShift`
 * (0 = high, 1 = low).
 *
 * The calculation reproduces vanilla byte-for-byte:
 * - `setBlocks === 11`: `scaledViewWidth = SCREENWIDTH` and
 *   `viewHeight = SCREENHEIGHT` (full screen, no status bar).
 * - Otherwise: `scaledViewWidth = setBlocks * 32` and
 *   `viewHeight = (setBlocks * 168 / 10) & ~7` (rounds down to the
 *   next multiple of 8).
 * - `viewWidth = scaledViewWidth >> detailShift`, so low detail halves
 *   the horizontal sampling rate.
 * - `centerX = viewWidth >> 1`, `centerY = viewHeight >> 1`,
 *   `centerXFrac = centerX << FRACBITS`, `centerYFrac = centerY << FRACBITS`,
 *   `projection = centerXFrac`.
 * - `viewWindowX = (SCREENWIDTH - scaledViewWidth) >> 1`.
 * - `viewWindowY = 0` when `scaledViewWidth === SCREENWIDTH`; otherwise
 *   `(SCREENHEIGHT - SBARHEIGHT - viewHeight) >> 1`.  The gate uses
 *   `scaledViewWidth`, not `setBlocks`, so `setBlocks === 10` is also
 *   treated as "full width" and pins `viewWindowY` to 0.
 *
 * `setBlocks` outside `[MIN_SETBLOCKS, MAX_SETBLOCKS]` is clamped
 * silently.  `detailShift` is cast through `| 0` so callers may pass a
 * raw config integer; non-zero values produce low-detail behavior
 * regardless of magnitude, matching vanilla where only the lowest bit
 * of `detailshift` participates in the shift.
 *
 * @example
 * ```ts
 * import { computeViewport, DetailMode } from "../src/render/projection.ts";
 * const view = computeViewport(9, DetailMode.high);
 * // view.scaledViewWidth === 288, view.viewHeight === 144
 * // view.centerX === 144, view.centerY === 72
 * // view.viewWindowX === 16, view.viewWindowY === 12
 * ```
 */
export function computeViewport(setBlocks: number, detailShift: DetailMode): Viewport {
  const clampedBlocks = setBlocks < MIN_SETBLOCKS ? MIN_SETBLOCKS : setBlocks > MAX_SETBLOCKS ? MAX_SETBLOCKS : setBlocks | 0;
  const clampedDetail = (detailShift | 0) === 0 ? DetailMode.high : DetailMode.low;

  let scaledViewWidth: number;
  let viewHeight: number;
  if (clampedBlocks === MAX_SETBLOCKS) {
    scaledViewWidth = SCREENWIDTH;
    viewHeight = SCREENHEIGHT;
  } else {
    scaledViewWidth = clampedBlocks * 32;
    viewHeight = ((clampedBlocks * 168) / 10) & ~7;
  }

  const viewWidth = scaledViewWidth >> clampedDetail;
  const centerX = viewWidth >> 1;
  const centerY = viewHeight >> 1;
  const centerXFrac = centerX << FRACBITS;
  const centerYFrac = centerY << FRACBITS;
  const projection = centerXFrac;
  const viewWindowX = (SCREENWIDTH - scaledViewWidth) >> 1;
  const viewWindowY = scaledViewWidth === SCREENWIDTH ? 0 : (SCREENHEIGHT - SBARHEIGHT - viewHeight) >> 1;

  return {
    scaledViewWidth,
    viewWidth,
    viewHeight,
    centerX,
    centerY,
    centerXFrac,
    centerYFrac,
    projection,
    viewWindowX,
    viewWindowY,
    detailShift: clampedDetail,
  };
}
