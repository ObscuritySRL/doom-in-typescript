/**
 * Automap overlay state machine and primitive renderers (am_map.c).
 *
 * Implements the pure-logic half of the vanilla DOOM automap: the
 * viewport + scaling state machine (`AM_LevelInit` / `AM_Start` /
 * `AM_Stop`), map-window panning (`AM_changeWindowLoc`) and zooming
 * (`AM_changeWindowScale`), follow-player tracking (`AM_doFollowPlayer`)
 * with the `FTOM(MTOF(x))` pixel-snap quirk, mark-point recording
 * (`AM_addMark` / `AM_clearMarks`), the full-tick ticker (`AM_Ticker`),
 * and the core coordinate primitives (`FTOM` / `MTOF` / `CXMTOF` /
 * `CYMTOF`).  Linedef/thing/player iteration is delegated to the
 * caller; this module provides the shape tables (player arrow,
 * triangle guy) plus the two raw draw primitives needed to realize
 * them — Cohen-Sutherland clipping (`AM_clipMline`) and the Bresenham
 * line painter (`AM_drawFline`) — so the caller can compose
 * `AM_drawWalls` / `AM_drawPlayers` / `AM_drawThings` /
 * `AM_drawLineCharacter` on top.
 *
 * Parity invariants preserved byte-for-byte:
 *
 *  - Truncating C-style int casts on floating-point constants:
 *    `INITSCALEMTOF = (int)(0.2 * FRACUNIT) = 13107`,
 *    `M_ZOOMIN = (int)(1.02 * FRACUNIT) = 66846`,
 *    `M_ZOOMOUT = (int)(FRACUNIT / 1.02) = 64251`,
 *    `(int)(0.7 * FRACUNIT) = 45875` (the AM_LevelInit scale divisor).
 *    Decimal-to-float rounding is preserved exactly — flipping any of
 *    these constants to `Math.round` or `Math.floor(x + 0.5)` changes
 *    first-frame scale.
 *  - AM_LevelInit scale clamp: if `FixedDiv(min_scale_mtof, 45875)`
 *    exceeds `max_scale_mtof`, the scale is RESET to `min_scale_mtof`,
 *    NOT clamped to `max_scale_mtof`.  Vanilla's behavior on
 *    degenerate maps is "zoom all the way out", not "zoom all the way
 *    in".
 *  - `AM_findMinMaxBoundaries` uses `INT_MAX / -INT_MAX` as sentinels
 *    and scans vertices with `else if`, so a vertex whose x is the
 *    current `min_x` cannot also be tested against `max_x` in the same
 *    iteration — matches vanilla's two-branch update exactly.
 *  - `AM_changeWindowLoc` clamps `m_x + m_w/2` into `[min_x, max_x]`
 *    (and y likewise), NOT `m_x` itself.  The centering clamp preserves
 *    the player-centered follow behavior when the map is smaller than
 *    the window.  It also sets `followplayer = 0` and forces
 *    `f_oldloc.x = INT_MAX` whenever `m_paninc.x | m_paninc.y` is
 *    non-zero — so a single key press during follow mode drops follow
 *    and the *next* tick's follow reconvergence is skipped.
 *  - `AM_doFollowPlayer` applies the `FTOM(MTOF(x)) - m_w/2` pixel
 *    snap, NOT `x - m_w/2`.  The round-trip through pixel space aligns
 *    the window origin to an integer screen pixel, avoiding sub-pixel
 *    jitter as the player walks.
 *  - `AM_changeWindowScale` applies the min/max clamps AFTER the
 *    multiply, not before.  A scale that briefly overshoots
 *    `max_scale_mtof` snaps back via `AM_maxOutWindowScale`, which
 *    recomputes `m_w / m_h / m_x / m_y` via `AM_activateNewScale`.
 *  - `AM_addMark` uses `(markpointnum + 1) % AM_NUMMARKPOINTS`, so the
 *    11th mark overwrites slot 0 (circular buffer).  `AM_clearMarks`
 *    sets every slot to `x = -1` as the "empty" sentinel — any mark
 *    check must test `markpoints[i].x !== -1`.
 *  - Vanilla's file-static defaults initialize `scale_mtof` to
 *    `INITSCALEMTOF`, but leave `scale_ftom` at C's zero-initialized
 *    default until `AM_LevelInit` computes the reciprocal.  This
 *    module instead seeds `createAutomapState().scale_ftom` to
 *    `FixedDiv(FRACUNIT, INITSCALEMTOF) = 327680` so the exported pure
 *    helpers start from a self-consistent reciprocal pair; that
 *    normalization is unobservable in vanilla runtime behavior because
 *    `FTOM` is not used before `AM_LevelInit`.
 *  - Cohen-Sutherland clipping uses the vanilla outcode rotation
 *    order (TOP → BOTTOM → RIGHT → LEFT) when both endpoints are
 *    partially outside.  The `>= f_w` / `>= f_h` inequalities are
 *    STRICT-equal-exclusive (the pixel at `f_w - 1` is the last valid
 *    column); a line touching the exact right edge must be clipped to
 *    `f_w - 1`, not `f_w`.
 *  - `AM_drawFline` bails out silently if either endpoint is outside
 *    `[0, f_w) × [0, f_h)` — the debug `fuck` counter in vanilla
 *    fires without drawing, so an unclipped caller will silently lose
 *    the line rather than painting off the framebuffer.
 *  - Bresenham major/minor axis split uses `ax > ay` (strict), so a
 *    perfect-diagonal line takes the y-major branch.  Both branches
 *    include the starting endpoint (`PUTDOT` before the increment
 *    check) and short-circuit on `x == fl.b.x` (or `y == fl.b.y`).
 *  - `AM_rotate` uses the `finecosine` / `finesine` tables indexed by
 *    `a >> ANGLETOFINESHIFT`, matching vanilla's 2D rotation matrix
 *    with NEGATIVE sine on the x-component row (so positive angles
 *    rotate counter-clockwise).
 *
 * @example
 * ```ts
 * import {
 *   createAutomapState,
 *   automapStart,
 *   automapTicker,
 *   automapClipMline,
 * } from "../src/ui/automap.ts";
 *
 * const state = createAutomapState();
 * automapStart(state, { vertexes, playerX, playerY, episode: 1, map: 1 });
 * automapTicker(state, { playerX, playerY });
 *
 * const fl = automapClipMline(state, {
 *   a: { x: line.v1.x, y: line.v1.y },
 *   b: { x: line.v2.x, y: line.v2.y },
 * });
 * if (fl !== null) drawFline(fb, state.f_w, fl, WALLCOLORS + state.lightlev);
 * ```
 */

import type { Angle } from '../core/angle.ts';
import type { Fixed } from '../core/fixed.ts';
import { FIXED_MAX, FRACBITS, FRACUNIT, fixedDiv, fixedMul } from '../core/fixed.ts';
import { ANGLETOFINESHIFT, finecosine, finesine } from '../core/trig.ts';
import { SBARHEIGHT, SCREENHEIGHT, SCREENWIDTH } from '../render/projection.ts';

// ── Palette color constants ──────────────────────────────────────────

/** Dark-red base palette index used for WALLCOLORS (`256 - 5*16`). */
export const REDS = 256 - 5 * 16;

/** Wall-color ramp length in palette rows. */
export const REDRANGE = 16;

/** Blue base palette index (unused by vanilla automap but defined for reference). */
export const BLUES = 256 - 4 * 16 + 8;

/** Blue ramp length. */
export const BLUERANGE = 8;

/** Green base palette index used for THINGCOLORS (`7 * 16`). */
export const GREENS = 7 * 16;

/** Green ramp length. */
export const GREENRANGE = 16;

/** Gray base palette index used for TSWALLCOLORS / GRIDCOLORS / XHAIRCOLORS (`6 * 16`). */
export const GRAYS = 6 * 16;

/** Gray ramp length. */
export const GRAYSRANGE = 16;

/** Brown base palette index used for FDWALLCOLORS (`4 * 16`). */
export const BROWNS = 4 * 16;

/** Brown ramp length. */
export const BROWNRANGE = 16;

/** Yellow base palette index used for CDWALLCOLORS (`256 - 32 + 7`). */
export const YELLOWS = 256 - 32 + 7;

/** Yellow ramp length. */
export const YELLOWRANGE = 1;

/** Black palette index (background). */
export const BLACK = 0;

/** White palette index used for YOURCOLORS (`256 - 47`). */
export const WHITE = 256 - 47;

/** Background fill color (BLACK). */
export const BACKGROUND = BLACK;

/** Player arrow color in single-player (WHITE). */
export const YOURCOLORS = WHITE;

/** Solid wall color (REDS). */
export const WALLCOLORS = REDS;

/** Solid wall ramp length. */
export const WALLRANGE = REDRANGE;

/** Two-sided (already-mapped non-door) wall color (GRAYS). */
export const TSWALLCOLORS = GRAYS;

/** Two-sided wall ramp length. */
export const TSWALLRANGE = GRAYSRANGE;

/** Floor-difference wall color (BROWNS). */
export const FDWALLCOLORS = BROWNS;

/** Floor-difference wall ramp length. */
export const FDWALLRANGE = BROWNRANGE;

/** Ceiling-difference wall color (YELLOWS). */
export const CDWALLCOLORS = YELLOWS;

/** Ceiling-difference wall ramp length. */
export const CDWALLRANGE = YELLOWRANGE;

/** Thing (IDDT-revealed monster / pickup) triangle color (GREENS). */
export const THINGCOLORS = GREENS;

/** Thing triangle ramp length. */
export const THINGRANGE = GREENRANGE;

/** Secret-door wall color (same as WALLCOLORS — only visually distinct under IDDT). */
export const SECRETWALLCOLORS = WALLCOLORS;

/** Secret-door wall ramp length. */
export const SECRETWALLRANGE = WALLRANGE;

/** Grid line color (`GRAYS + GRAYSRANGE/2 = 104`). */
export const GRIDCOLORS = GRAYS + Math.floor(GRAYSRANGE / 2);

/** Grid ramp length (always zero — grid is a single color). */
export const GRIDRANGE = 0;

/** Crosshair dot color (GRAYS). */
export const XHAIRCOLORS = GRAYS;

/** Dark shadow color used for players under INVIS powerup (`246`, "close to black"). */
export const INVIS_PLAYER_COLOR = 246;

/** Per-player arrow colors in netgame (GREENS, GRAYS, BROWNS, REDS). */
export const NETGAME_PLAYER_COLORS: readonly number[] = Object.freeze([GREENS, GRAYS, BROWNS, REDS]);

// ── Geometry constants ───────────────────────────────────────────────

/** Max simultaneous marks the player can drop (`AM_NUMMARKPOINTS`). */
export const AM_NUMMARKPOINTS = 10;

/**
 * Initial map-to-frame scale multiplier.  Vanilla C literal
 * `(fixed_t)(0.2*FRACUNIT)` truncates to int → `13107`.
 */
export const INITSCALEMTOF: Fixed = 13107;

/**
 * Frame-buffer pan increment per tic (pixels).  Vanilla constant
 * `F_PANINC = 4`; a full second of held pan moves `4 * TICRATE = 140`
 * pixels — the "140 pixels in 1 second" behavior noted inline in
 * am_map.c.
 */
export const F_PANINC = 4;

/**
 * Zoom-in multiplier per tic.  Vanilla C literal
 * `(int)(1.02*FRACUNIT)` truncates to `66846`; the compounded
 * per-second factor is `1.02^35 ≈ 2.0`, matching the inline
 * "goes to 2x in 1 second" comment.
 */
export const M_ZOOMIN: Fixed = 66846;

/**
 * Zoom-out multiplier per tic.  Vanilla C literal
 * `(int)(FRACUNIT/1.02)` truncates to `64251`; the compounded
 * per-second factor is `(1/1.02)^35 ≈ 0.5`, matching the inline
 * "pulls out to 0.5x in 1 second" comment.
 */
export const M_ZOOMOUT: Fixed = 64251;

/**
 * AM_LevelInit scale divisor.  Vanilla C literal
 * `(int)(0.7*FRACUNIT)` truncates to `45875`.  `scale_mtof` is set to
 * `FixedDiv(min_scale_mtof, 45875)` at level init to give a 70%
 * zoom-out starting view.
 */
export const AM_LEVEL_INIT_SCALE_DIVISOR: Fixed = 45875;

/**
 * PlayerRadius in fixed-point (p_local.h `PLAYERRADIUS = 16*FRACUNIT`).
 * Exposed here so `min_w` / `min_h` can be computed as `2*PLAYERRADIUS`.
 */
export const PLAYERRADIUS: Fixed = 16 * FRACUNIT;

/** Frame-buffer viewport default width (vanilla `finit_width = SCREENWIDTH = 320`). */
export const F_INIT_WIDTH = SCREENWIDTH;

/**
 * Frame-buffer viewport default height (vanilla
 * `finit_height = SCREENHEIGHT - ST_HEIGHT = 168`).
 */
export const F_INIT_HEIGHT = SCREENHEIGHT - SBARHEIGHT;

/**
 * Mark-point patch display width in pixels — hardcoded override in
 * vanilla `AM_drawMarks` because the AMMNUM patches report their own
 * width/height incorrectly.
 */
export const AM_MARK_WIDTH = 5;

/** Mark-point patch display height in pixels — same override as width. */
export const AM_MARK_HEIGHT = 6;

/** Teleport-line special number highlighted with mid-range wall color. */
export const AM_TELEPORT_SPECIAL = 39;

/** The f_oldloc sentinel value that forces follow-player to re-center (vanilla `INT_MAX`). */
export const AM_F_OLDLOC_FORCE_RECENTER: Fixed = FIXED_MAX;

// ── Vector shape types ───────────────────────────────────────────────

/** A 2D point in either map (fixed-point) or frame-buffer (pixel int32) space. */
export interface Point2D {
  x: number;
  y: number;
}

/** A line segment, both endpoints in the same coordinate space. */
export interface Line2D {
  readonly a: Point2D;
  readonly b: Point2D;
}

// ── Vector shape tables ──────────────────────────────────────────────

/**
 * Build the player-arrow line list in map coordinates.  `R` is the
 * canonical radius `8*PLAYERRADIUS/7` from am_map.c's local `#define R`
 * block; exposing it as a helper avoids magic numbers in callers that
 * need to compose custom shapes at the same scale.
 */
function playerArrowR(): Fixed {
  return Math.trunc((8 * PLAYERRADIUS) / 7);
}

/**
 * Single-player arrow shape (7 line segments).  Vanilla `player_arrow[]`.
 * Each coordinate is in 16.16 fixed-point map units.  Rotation and
 * translation are applied per-frame via `automapDrawLineCharacter`.
 */
export const PLAYER_ARROW_LINES: readonly Line2D[] = Object.freeze(
  (() => {
    const R = playerArrowR();
    return [
      { a: { x: -R + Math.trunc(R / 8), y: 0 }, b: { x: R, y: 0 } },
      { a: { x: R, y: 0 }, b: { x: R - Math.trunc(R / 2), y: Math.trunc(R / 4) } },
      { a: { x: R, y: 0 }, b: { x: R - Math.trunc(R / 2), y: -Math.trunc(R / 4) } },
      { a: { x: -R + Math.trunc(R / 8), y: 0 }, b: { x: -R - Math.trunc(R / 8), y: Math.trunc(R / 4) } },
      { a: { x: -R + Math.trunc(R / 8), y: 0 }, b: { x: -R - Math.trunc(R / 8), y: -Math.trunc(R / 4) } },
      { a: { x: -R + Math.trunc((3 * R) / 8), y: 0 }, b: { x: -R + Math.trunc(R / 8), y: Math.trunc(R / 4) } },
      { a: { x: -R + Math.trunc((3 * R) / 8), y: 0 }, b: { x: -R + Math.trunc(R / 8), y: -Math.trunc(R / 4) } },
    ].map((line) => Object.freeze({ a: Object.freeze(line.a), b: Object.freeze(line.b) }));
  })(),
);

/**
 * Cheat (IDDT-revealed) player arrow shape (16 line segments).  Vanilla
 * `cheat_player_arrow[]`.  Adds a "DD" annotation to the base arrow.
 */
export const CHEAT_PLAYER_ARROW_LINES: readonly Line2D[] = Object.freeze(
  (() => {
    const R = playerArrowR();
    return [
      { a: { x: -R + Math.trunc(R / 8), y: 0 }, b: { x: R, y: 0 } },
      { a: { x: R, y: 0 }, b: { x: R - Math.trunc(R / 2), y: Math.trunc(R / 6) } },
      { a: { x: R, y: 0 }, b: { x: R - Math.trunc(R / 2), y: -Math.trunc(R / 6) } },
      { a: { x: -R + Math.trunc(R / 8), y: 0 }, b: { x: -R - Math.trunc(R / 8), y: Math.trunc(R / 6) } },
      { a: { x: -R + Math.trunc(R / 8), y: 0 }, b: { x: -R - Math.trunc(R / 8), y: -Math.trunc(R / 6) } },
      { a: { x: -R + Math.trunc((3 * R) / 8), y: 0 }, b: { x: -R + Math.trunc(R / 8), y: Math.trunc(R / 6) } },
      { a: { x: -R + Math.trunc((3 * R) / 8), y: 0 }, b: { x: -R + Math.trunc(R / 8), y: -Math.trunc(R / 6) } },
      { a: { x: -Math.trunc(R / 2), y: 0 }, b: { x: -Math.trunc(R / 2), y: -Math.trunc(R / 6) } },
      {
        a: { x: -Math.trunc(R / 2), y: -Math.trunc(R / 6) },
        b: { x: -Math.trunc(R / 2) + Math.trunc(R / 6), y: -Math.trunc(R / 6) },
      },
      {
        a: { x: -Math.trunc(R / 2) + Math.trunc(R / 6), y: -Math.trunc(R / 6) },
        b: { x: -Math.trunc(R / 2) + Math.trunc(R / 6), y: Math.trunc(R / 4) },
      },
      { a: { x: -Math.trunc(R / 6), y: 0 }, b: { x: -Math.trunc(R / 6), y: -Math.trunc(R / 6) } },
      { a: { x: -Math.trunc(R / 6), y: -Math.trunc(R / 6) }, b: { x: 0, y: -Math.trunc(R / 6) } },
      { a: { x: 0, y: -Math.trunc(R / 6) }, b: { x: 0, y: Math.trunc(R / 4) } },
      { a: { x: Math.trunc(R / 6), y: Math.trunc(R / 4) }, b: { x: Math.trunc(R / 6), y: -Math.trunc(R / 7) } },
      {
        a: { x: Math.trunc(R / 6), y: -Math.trunc(R / 7) },
        b: { x: Math.trunc(R / 6) + Math.trunc(R / 32), y: -Math.trunc(R / 7) - Math.trunc(R / 32) },
      },
      {
        a: { x: Math.trunc(R / 6) + Math.trunc(R / 32), y: -Math.trunc(R / 7) - Math.trunc(R / 32) },
        b: { x: Math.trunc(R / 6) + Math.trunc(R / 10), y: -Math.trunc(R / 7) },
      },
    ].map((line) => Object.freeze({ a: Object.freeze(line.a), b: Object.freeze(line.b) }));
  })(),
);

/**
 * IDDT thing triangle shape (3 segments) used for monsters in cheat
 * mode.  Vanilla `triangle_guy[]` with `R = FRACUNIT`; callers scale
 * this by `16*FRACUNIT` at draw time to match the vanilla `AM_drawThings`
 * invocation.
 */
export const TRIANGLE_GUY_LINES: readonly Line2D[] = Object.freeze(
  [
    {
      a: { x: Math.trunc(-0.867 * FRACUNIT), y: Math.trunc(-0.5 * FRACUNIT) },
      b: { x: Math.trunc(0.867 * FRACUNIT), y: Math.trunc(-0.5 * FRACUNIT) },
    },
    {
      a: { x: Math.trunc(0.867 * FRACUNIT), y: Math.trunc(-0.5 * FRACUNIT) },
      b: { x: 0, y: FRACUNIT },
    },
    {
      a: { x: 0, y: FRACUNIT },
      b: { x: Math.trunc(-0.867 * FRACUNIT), y: Math.trunc(-0.5 * FRACUNIT) },
    },
  ].map((line) => Object.freeze({ a: Object.freeze(line.a), b: Object.freeze(line.b) })),
);

/**
 * Thin triangle shape used when `AM_drawThings` is called.  Vanilla
 * `thintriangle_guy[]`; this is the shape that actually appears under
 * IDDT mode (the fat `triangle_guy` is defined but never rendered).
 */
export const THIN_TRIANGLE_GUY_LINES: readonly Line2D[] = Object.freeze(
  [
    {
      a: { x: Math.trunc(-0.5 * FRACUNIT), y: Math.trunc(-0.7 * FRACUNIT) },
      b: { x: FRACUNIT, y: 0 },
    },
    {
      a: { x: FRACUNIT, y: 0 },
      b: { x: Math.trunc(-0.5 * FRACUNIT), y: Math.trunc(0.7 * FRACUNIT) },
    },
    {
      a: { x: Math.trunc(-0.5 * FRACUNIT), y: Math.trunc(0.7 * FRACUNIT) },
      b: { x: Math.trunc(-0.5 * FRACUNIT), y: Math.trunc(-0.7 * FRACUNIT) },
    },
  ].map((line) => Object.freeze({ a: Object.freeze(line.a), b: Object.freeze(line.b) })),
);

// ── State type ───────────────────────────────────────────────────────

/**
 * Mutable automap state.  Field names mirror the file-static globals
 * in am_map.c: `m_*` fields are map coordinates (fixed-point), `f_*`
 * fields are frame-buffer coordinates (pixels), `scale_*` are
 * map↔frame conversion factors.
 */
export interface AutomapState {
  /** `automapactive`: true when the automap overlay is the active view. */
  active: boolean;
  /** `stopped`: true after `AM_Stop`.  Drives the AM_Start fast-path that skips AM_LevelInit on repeat activations. */
  stopped: boolean;
  /** `cheating` mode: 0=normal, 1=iddt walls, 2=iddt walls+things. */
  cheating: number;
  /** `grid`: true when the flat-aligned grid overlay is drawn. */
  grid: boolean;
  /** `followplayer`: 1 when the window tracks the player, 0 when free-panning. */
  followplayer: number;
  /** `bigstate`: true when maxzoom has been toggled.  Saves `old_*` and snaps scale to minOut. */
  bigstate: boolean;
  /** `amclock`: per-tic counter driving light-level modulation. */
  amclock: number;
  /** `lightlev`: index into the light-level table added to WALL/FD/CD/THING colors. */
  lightlev: number;

  /** `f_x, f_y`: top-left of the automap viewport in frame-buffer pixels. */
  f_x: number;
  f_y: number;
  /** `f_w, f_h`: viewport size in frame-buffer pixels. */
  f_w: number;
  f_h: number;

  /** `m_paninc`: per-tic pan delta in map coordinates. */
  m_paninc: Point2D;
  /** `mtof_zoommul`: per-tic multiplier applied to `scale_mtof`. */
  mtof_zoommul: Fixed;
  /** `ftom_zoommul`: per-tic multiplier applied to `scale_ftom`. */
  ftom_zoommul: Fixed;

  /** `m_x, m_y`: lower-left corner of the window in map coordinates. */
  m_x: Fixed;
  m_y: Fixed;
  /** `m_x2, m_y2`: upper-right corner, maintained as `m_x + m_w` / `m_y + m_h`. */
  m_x2: Fixed;
  m_y2: Fixed;
  /** `m_w, m_h`: window dimensions in map coordinates. */
  m_w: Fixed;
  m_h: Fixed;

  /** `min_x, min_y, max_x, max_y`: tight bounding box of all map vertices. */
  min_x: Fixed;
  min_y: Fixed;
  max_x: Fixed;
  max_y: Fixed;
  /** `max_w, max_h`: extent of bounding box. */
  max_w: Fixed;
  max_h: Fixed;
  /** `min_w, min_h`: always `2*PLAYERRADIUS` — the zoom-in limit. */
  min_w: Fixed;
  min_h: Fixed;

  /** `scale_mtof`: map→frame factor.  `MTOF(x) = FixedMul(x, scale_mtof) >> FRACBITS`. */
  scale_mtof: Fixed;
  /** `scale_ftom`: frame→map factor.  Always `FixedDiv(FRACUNIT, scale_mtof)`. */
  scale_ftom: Fixed;
  /** `min_scale_mtof`: the lowest `scale_mtof` that still fits the whole map. */
  min_scale_mtof: Fixed;
  /** `max_scale_mtof`: the highest `scale_mtof` (zoom-in limit — two player radii fill the viewport). */
  max_scale_mtof: Fixed;

  /** `old_m_x, old_m_y, old_m_w, old_m_h`: savebuf for `bigstate` / mode flip. */
  old_m_x: Fixed;
  old_m_y: Fixed;
  old_m_w: Fixed;
  old_m_h: Fixed;

  /** `f_oldloc`: last player position committed by `AM_doFollowPlayer`.  Sentinel `x = INT_MAX` forces re-center. */
  f_oldloc: Point2D;

  /** `markpoints`: circular buffer of dropped marks.  `x === -1` means empty. */
  markpoints: Point2D[];
  /** `markpointnum`: index of the next slot to overwrite. */
  markpointnum: number;
}

// ── State construction ───────────────────────────────────────────────

/**
 * Create a fresh automap state seeded from the vanilla file-static
 * defaults.
 *
 * `scale_mtof` matches the `am_map.c` initializer exactly.  The only
 * deliberate normalization is `scale_ftom`, which this module seeds to
 * the reciprocal of `scale_mtof` so standalone helper calls preserve
 * the invariant that later runtime code establishes in `AM_LevelInit`.
 * The first `automapStart` call still runs `AM_LevelInit` +
 * `AM_initVariables` to populate the map-bound and scale fields.
 */
export function createAutomapState(): AutomapState {
  const markpoints: Point2D[] = new Array<Point2D>(AM_NUMMARKPOINTS);
  for (let i = 0; i < AM_NUMMARKPOINTS; i++) {
    markpoints[i] = { x: -1, y: 0 };
  }
  return {
    active: false,
    stopped: true,
    cheating: 0,
    grid: false,
    followplayer: 1,
    bigstate: false,
    amclock: 0,
    lightlev: 0,
    f_x: 0,
    f_y: 0,
    f_w: F_INIT_WIDTH,
    f_h: F_INIT_HEIGHT,
    m_paninc: { x: 0, y: 0 },
    mtof_zoommul: FRACUNIT,
    ftom_zoommul: FRACUNIT,
    m_x: 0,
    m_y: 0,
    m_x2: 0,
    m_y2: 0,
    m_w: 0,
    m_h: 0,
    min_x: 0,
    min_y: 0,
    max_x: 0,
    max_y: 0,
    max_w: 0,
    max_h: 0,
    min_w: 2 * PLAYERRADIUS,
    min_h: 2 * PLAYERRADIUS,
    scale_mtof: INITSCALEMTOF,
    scale_ftom: fixedDiv(FRACUNIT, INITSCALEMTOF),
    min_scale_mtof: 0,
    max_scale_mtof: 0,
    old_m_x: 0,
    old_m_y: 0,
    old_m_w: 0,
    old_m_h: 0,
    f_oldloc: { x: AM_F_OLDLOC_FORCE_RECENTER, y: 0 },
    markpoints,
    markpointnum: 0,
  };
}

// ── Coordinate conversion ────────────────────────────────────────────

/**
 * FTOM: frame-buffer pixels → map coordinates.
 *
 * Vanilla macro `FTOM(x) = FixedMul((x)<<FRACBITS, scale_ftom)`.
 */
export function automapFtom(state: AutomapState, pixels: number): Fixed {
  return fixedMul((pixels << FRACBITS) | 0, state.scale_ftom);
}

/**
 * MTOF: map coordinates → frame-buffer pixels.
 *
 * Vanilla macro `MTOF(x) = FixedMul((x), scale_mtof) >> FRACBITS`.
 * The post-multiply shift is arithmetic so sign is preserved.
 */
export function automapMtof(state: AutomapState, mapUnits: Fixed): number {
  return fixedMul(mapUnits, state.scale_mtof) >> FRACBITS;
}

/**
 * CXMTOF: map x → viewport pixel column.
 *
 * Vanilla macro `CXMTOF(x) = f_x + MTOF(x - m_x)`.
 */
export function automapCxMtof(state: AutomapState, mapX: Fixed): number {
  return state.f_x + automapMtof(state, (mapX - state.m_x) | 0);
}

/**
 * CYMTOF: map y → viewport pixel row (flipped — y increases upward on
 * the map, downward on the frame buffer).
 *
 * Vanilla macro `CYMTOF(y) = f_y + (f_h - MTOF(y - m_y))`.
 */
export function automapCyMtof(state: AutomapState, mapY: Fixed): number {
  return state.f_y + (state.f_h - automapMtof(state, (mapY - state.m_y) | 0));
}

// ── Scaling / boundaries ─────────────────────────────────────────────

/**
 * Compute the tight bounding box of the map from its vertex list, and
 * derive `min_scale_mtof` / `max_scale_mtof` from the viewport size.
 *
 * Mirrors `AM_findMinMaxBoundaries`.  The vertex scan uses
 * `else if` branching so a vertex whose x is the running `min_x`
 * cannot simultaneously update `max_x` in the same iteration — a
 * first-vertex edge case where `min_x = max_x = -INT_MAX` until the
 * second vertex resolves the max bound.
 *
 * `min_scale_mtof` is the smaller of the two axis-fit ratios, so the
 * whole map fits in the viewport when zoomed all the way out.
 * `max_scale_mtof` is the scale at which two player radii fill the
 * viewport height — the zoom-in ceiling.
 *
 * @throws {RangeError} If the vertex list is empty.
 */
export function automapFindMinMaxBoundaries(state: AutomapState, vertexes: readonly { readonly x: Fixed; readonly y: Fixed }[]): void {
  if (vertexes.length === 0) {
    throw new RangeError('automapFindMinMaxBoundaries: vertex list is empty');
  }
  let minX: Fixed = FIXED_MAX;
  let minY: Fixed = FIXED_MAX;
  let maxX: Fixed = -FIXED_MAX;
  let maxY: Fixed = -FIXED_MAX;
  for (let i = 0; i < vertexes.length; i++) {
    const v = vertexes[i]!;
    if (v.x < minX) {
      minX = v.x;
    } else if (v.x > maxX) {
      maxX = v.x;
    }
    if (v.y < minY) {
      minY = v.y;
    } else if (v.y > maxY) {
      maxY = v.y;
    }
  }
  state.min_x = minX;
  state.min_y = minY;
  state.max_x = maxX;
  state.max_y = maxY;
  state.max_w = (maxX - minX) | 0;
  state.max_h = (maxY - minY) | 0;
  state.min_w = 2 * PLAYERRADIUS;
  state.min_h = 2 * PLAYERRADIUS;
  const a = fixedDiv((state.f_w << FRACBITS) | 0, state.max_w);
  const b = fixedDiv((state.f_h << FRACBITS) | 0, state.max_h);
  state.min_scale_mtof = a < b ? a : b;
  state.max_scale_mtof = fixedDiv((state.f_h << FRACBITS) | 0, 2 * PLAYERRADIUS);
}

/**
 * Recompute `m_w`, `m_h`, and re-anchor the map window centered on its
 * current midpoint under the new scale.
 *
 * Mirrors `AM_activateNewScale`.  The order — compute new width/height
 * FROM the viewport, THEN shift `m_x` / `m_y` by `m_w/2` — is
 * load-bearing: reversing it drifts the center under successive zoom
 * applications.
 */
export function automapActivateNewScale(state: AutomapState): void {
  state.m_x = (state.m_x + (state.m_w >> 1)) | 0;
  state.m_y = (state.m_y + (state.m_h >> 1)) | 0;
  state.m_w = automapFtom(state, state.f_w);
  state.m_h = automapFtom(state, state.f_h);
  state.m_x = (state.m_x - (state.m_w >> 1)) | 0;
  state.m_y = (state.m_y - (state.m_h >> 1)) | 0;
  state.m_x2 = (state.m_x + state.m_w) | 0;
  state.m_y2 = (state.m_y + state.m_h) | 0;
}

/** Save the current map window into the recovery slots.  Mirrors `AM_saveScaleAndLoc`. */
export function automapSaveScaleAndLoc(state: AutomapState): void {
  state.old_m_x = state.m_x;
  state.old_m_y = state.m_y;
  state.old_m_w = state.m_w;
  state.old_m_h = state.m_h;
}

/**
 * Restore the saved map window.  Mirrors `AM_restoreScaleAndLoc`.
 *
 * When `followplayer` is OFF, the old `m_x` / `m_y` are restored
 * verbatim.  When `followplayer` is ON, the old WIDTH/HEIGHT are kept
 * but the origin is recomputed from the player position so the
 * restored window stays centered on the player.  In either branch,
 * `scale_mtof` is re-derived from the restored `m_w` to keep the
 * viewport-to-map ratio consistent.
 */
export function automapRestoreScaleAndLoc(state: AutomapState, playerX: Fixed, playerY: Fixed): void {
  state.m_w = state.old_m_w;
  state.m_h = state.old_m_h;
  if (state.followplayer === 0) {
    state.m_x = state.old_m_x;
    state.m_y = state.old_m_y;
  } else {
    state.m_x = (playerX - (state.m_w >> 1)) | 0;
    state.m_y = (playerY - (state.m_h >> 1)) | 0;
  }
  state.m_x2 = (state.m_x + state.m_w) | 0;
  state.m_y2 = (state.m_y + state.m_h) | 0;
  state.scale_mtof = fixedDiv((state.f_w << FRACBITS) | 0, state.m_w);
  state.scale_ftom = fixedDiv(FRACUNIT, state.scale_mtof);
}

/**
 * Snap the window scale to `min_scale_mtof` (zoom all the way out) and
 * re-anchor via `automapActivateNewScale`.  Mirrors
 * `AM_minOutWindowScale`.
 */
export function automapMinOutWindowScale(state: AutomapState): void {
  state.scale_mtof = state.min_scale_mtof;
  state.scale_ftom = fixedDiv(FRACUNIT, state.scale_mtof);
  automapActivateNewScale(state);
}

/**
 * Snap the window scale to `max_scale_mtof` (zoom all the way in) and
 * re-anchor via `automapActivateNewScale`.  Mirrors
 * `AM_maxOutWindowScale`.
 */
export function automapMaxOutWindowScale(state: AutomapState): void {
  state.scale_mtof = state.max_scale_mtof;
  state.scale_ftom = fixedDiv(FRACUNIT, state.scale_mtof);
  automapActivateNewScale(state);
}

// ── Pan / zoom / follow ──────────────────────────────────────────────

/**
 * Apply the current `m_paninc` pan delta to `m_x` / `m_y`, clamp the
 * result so the window CENTER stays inside the map bounding box, and
 * refresh `m_x2` / `m_y2`.
 *
 * Mirrors `AM_changeWindowLoc`.  Any non-zero pan component drops
 * follow-player mode (`followplayer = 0`) and forces the next
 * follow-reconverge to use the new `m_x` / `m_y` by setting
 * `f_oldloc.x = INT_MAX`.  The clamp is applied to `m_x + m_w/2` (the
 * window center) against `[min_x, max_x]`, not to `m_x` itself.
 */
export function automapChangeWindowLoc(state: AutomapState): void {
  if (state.m_paninc.x !== 0 || state.m_paninc.y !== 0) {
    state.followplayer = 0;
    state.f_oldloc.x = AM_F_OLDLOC_FORCE_RECENTER;
  }
  state.m_x = (state.m_x + state.m_paninc.x) | 0;
  state.m_y = (state.m_y + state.m_paninc.y) | 0;
  const halfW = state.m_w >> 1;
  const halfH = state.m_h >> 1;
  if (state.m_x + halfW > state.max_x) {
    state.m_x = (state.max_x - halfW) | 0;
  } else if (state.m_x + halfW < state.min_x) {
    state.m_x = (state.min_x - halfW) | 0;
  }
  if (state.m_y + halfH > state.max_y) {
    state.m_y = (state.max_y - halfH) | 0;
  } else if (state.m_y + halfH < state.min_y) {
    state.m_y = (state.min_y - halfH) | 0;
  }
  state.m_x2 = (state.m_x + state.m_w) | 0;
  state.m_y2 = (state.m_y + state.m_h) | 0;
}

/**
 * Apply `mtof_zoommul` / `ftom_zoommul` to the scale factors and clamp
 * to `[min_scale_mtof, max_scale_mtof]`.  If either clamp triggers,
 * the window is re-anchored via `automap{Min,Max}OutWindowScale`;
 * otherwise it is re-anchored via `automapActivateNewScale`.
 *
 * Mirrors `AM_changeWindowScale`.  The clamp is applied AFTER the
 * multiply, so a single-tic overshoot is possible before the snap-back
 * — order matters when reasoning about zoom-key hold duration.
 */
export function automapChangeWindowScale(state: AutomapState): void {
  state.scale_mtof = fixedMul(state.scale_mtof, state.mtof_zoommul);
  state.scale_ftom = fixedDiv(FRACUNIT, state.scale_mtof);
  if (state.scale_mtof < state.min_scale_mtof) {
    automapMinOutWindowScale(state);
  } else if (state.scale_mtof > state.max_scale_mtof) {
    automapMaxOutWindowScale(state);
  } else {
    automapActivateNewScale(state);
  }
}

/**
 * Re-center the map window on the player IFF the player has moved
 * since the last follow update.
 *
 * Mirrors `AM_doFollowPlayer`.  The `FTOM(MTOF(x)) - m_w/2` snap
 * rounds the window origin to an integer frame-buffer pixel — the
 * round-trip through pixel space is deliberate and visible in demo
 * playback: removing it produces sub-pixel jitter in the player arrow
 * rendering that diverges from vanilla frame captures.  The comparison
 * uses raw map coordinates (not the snapped window origin) to decide
 * whether to re-snap, so the player must have MOVED in map space —
 * standing still does not re-snap even if the snap would produce a
 * different window origin.
 */
export function automapDoFollowPlayer(state: AutomapState, playerX: Fixed, playerY: Fixed): void {
  if (state.f_oldloc.x !== playerX || state.f_oldloc.y !== playerY) {
    state.m_x = (automapFtom(state, automapMtof(state, playerX)) - (state.m_w >> 1)) | 0;
    state.m_y = (automapFtom(state, automapMtof(state, playerY)) - (state.m_h >> 1)) | 0;
    state.m_x2 = (state.m_x + state.m_w) | 0;
    state.m_y2 = (state.m_y + state.m_h) | 0;
    state.f_oldloc.x = playerX;
    state.f_oldloc.y = playerY;
  }
}

// ── Marks ────────────────────────────────────────────────────────────

/**
 * Drop a mark at the current window center.  Mirrors `AM_addMark`.
 *
 * Marks are stored in a circular buffer of `AM_NUMMARKPOINTS = 10`;
 * the 11th mark overwrites the 1st.  The mark position is the window
 * CENTER (`m_x + m_w/2`, `m_y + m_h/2`), not the window origin —
 * re-opening the automap later pans to the saved center.
 */
export function automapAddMark(state: AutomapState): void {
  state.markpoints[state.markpointnum] = {
    x: (state.m_x + (state.m_w >> 1)) | 0,
    y: (state.m_y + (state.m_h >> 1)) | 0,
  };
  state.markpointnum = (state.markpointnum + 1) % AM_NUMMARKPOINTS;
}

/**
 * Clear every mark slot.  Mirrors `AM_clearMarks`.  Each slot is reset
 * to `x = -1`, the vanilla "empty" sentinel — consumers that iterate
 * the mark list must test `markpoints[i].x !== -1` before drawing.
 */
export function automapClearMarks(state: AutomapState): void {
  for (let i = 0; i < AM_NUMMARKPOINTS; i++) {
    state.markpoints[i] = { x: -1, y: 0 };
  }
  state.markpointnum = 0;
}

// ── Level init / start / stop ────────────────────────────────────────

/** Context for `automapLevelInit` / `automapInitVariables`. */
export interface AutomapLevelInitContext {
  /** Map vertex list used to compute the bounding box. */
  readonly vertexes: readonly { readonly x: Fixed; readonly y: Fixed }[];
}

/**
 * Reset the automap viewport to defaults and derive the per-level
 * scale.  Mirrors `AM_LevelInit`.
 *
 * If `FixedDiv(min_scale_mtof, 45875)` overshoots `max_scale_mtof`
 * (degenerate tiny maps), the scale is SNAPPED BACK to
 * `min_scale_mtof` — NOT to `max_scale_mtof`.  Vanilla's behavior on a
 * pathological case is "zoom all the way out", not "zoom all the way
 * in".
 */
export function automapLevelInit(state: AutomapState, ctx: AutomapLevelInitContext): void {
  state.f_x = 0;
  state.f_y = 0;
  state.f_w = F_INIT_WIDTH;
  state.f_h = F_INIT_HEIGHT;
  automapClearMarks(state);
  automapFindMinMaxBoundaries(state, ctx.vertexes);
  state.scale_mtof = fixedDiv(state.min_scale_mtof, AM_LEVEL_INIT_SCALE_DIVISOR);
  if (state.scale_mtof > state.max_scale_mtof) {
    state.scale_mtof = state.min_scale_mtof;
  }
  state.scale_ftom = fixedDiv(FRACUNIT, state.scale_mtof);
}

/** Context for `automapInitVariables` / `automapStart` / `automapTicker`. */
export interface AutomapPlayerContext {
  /** Player reference position (normally `plyr.mo.x`). */
  readonly playerX: Fixed;
  /** Player reference position (normally `plyr.mo.y`). */
  readonly playerY: Fixed;
}

/**
 * Populate the transient fields that `AM_LevelInit` does not touch —
 * amclock / lightlev / pan-zoom accumulators / window origin — and run
 * a single `automapChangeWindowLoc` pass to clamp the window into the
 * map.  Mirrors `AM_initVariables` minus the status-bar notification
 * (the caller owns the status-bar responder coupling).
 */
export function automapInitVariables(state: AutomapState, ctx: AutomapPlayerContext): void {
  state.active = true;
  state.f_oldloc.x = AM_F_OLDLOC_FORCE_RECENTER;
  state.amclock = 0;
  state.lightlev = 0;
  state.m_paninc.x = 0;
  state.m_paninc.y = 0;
  state.ftom_zoommul = FRACUNIT;
  state.mtof_zoommul = FRACUNIT;
  state.m_w = automapFtom(state, state.f_w);
  state.m_h = automapFtom(state, state.f_h);
  state.m_x = (ctx.playerX - (state.m_w >> 1)) | 0;
  state.m_y = (ctx.playerY - (state.m_h >> 1)) | 0;
  automapChangeWindowLoc(state);
  state.old_m_x = state.m_x;
  state.old_m_y = state.m_y;
  state.old_m_w = state.m_w;
  state.old_m_h = state.m_h;
}

/** Context for `automapStart`: level bounds plus player-center seed. */
export interface AutomapStartContext extends AutomapLevelInitContext, AutomapPlayerContext {
  /** Current episode (1..4).  Used to detect same-level re-entry. */
  readonly episode: number;
  /** Current map (1..9).  Used to detect same-level re-entry. */
  readonly map: number;
  /** Caller's last-seen `(episode, map)` pair, normally stored alongside the automap state. */
  readonly lastLevelKey: { episode: number; map: number };
}

/**
 * Activate the automap overlay.  Mirrors `AM_Start`.
 *
 * Skips the expensive `AM_LevelInit` pass when re-entering the same
 * level (same `(episode, map)` pair), but always runs
 * `AM_initVariables` so the transient fields are reset.  The caller
 * owns the `lastLevelKey` object; this function mutates it so the
 * next `automapStart` can detect the same-level fast path.
 */
export function automapStart(state: AutomapState, ctx: AutomapStartContext): void {
  if (!state.stopped) {
    automapStop(state);
  }
  state.stopped = false;
  if (ctx.lastLevelKey.episode !== ctx.episode || ctx.lastLevelKey.map !== ctx.map) {
    automapLevelInit(state, ctx);
    ctx.lastLevelKey.episode = ctx.episode;
    ctx.lastLevelKey.map = ctx.map;
  }
  automapInitVariables(state, ctx);
}

/**
 * Deactivate the automap overlay.  Mirrors `AM_Stop`.  Leaves the
 * map-bound / scale fields intact so the next `automapStart` on the
 * same level can skip `AM_LevelInit`.
 */
export function automapStop(state: AutomapState): void {
  state.active = false;
  state.stopped = true;
}

// ── Light-level modulation ───────────────────────────────────────────

/**
 * Light-level progression used by `AM_updateLightLev`.  The values are
 * a 1-D ramp; vanilla code indexes into this table via `litelevelscnt`
 * and resets to 0 when the end is reached.  Note: the updater is
 * currently COMMENTED OUT in vanilla `AM_Ticker`, so this table is
 * dead code under reference playback.  Exposed for completeness
 * because it's referenced by the wall-color `WALLCOLORS + lightlev`
 * expression in `AM_drawWalls`.
 */
export const AM_LITE_LEVELS: readonly number[] = Object.freeze([0, 4, 7, 10, 12, 14, 15, 15]);

/**
 * Advance `amclock` by one tic and, if `followplayer` is on, re-snap
 * the window to the player's position.  Also applies any pending
 * `ftom_zoommul`-driven zoom and `m_paninc`-driven pan.
 *
 * Mirrors `AM_Ticker`.  The early-out `if (!automapactive) return` is
 * preserved exactly — a call while `state.active === false` is a
 * no-op.  `AM_updateLightLev` is not called (commented out in
 * vanilla).
 */
export function automapTicker(state: AutomapState, ctx: AutomapPlayerContext): void {
  if (!state.active) {
    return;
  }
  state.amclock++;
  if (state.followplayer !== 0) {
    automapDoFollowPlayer(state, ctx.playerX, ctx.playerY);
  }
  if (state.ftom_zoommul !== FRACUNIT) {
    automapChangeWindowScale(state);
  }
  if (state.m_paninc.x !== 0 || state.m_paninc.y !== 0) {
    automapChangeWindowLoc(state);
  }
}

// ── Cohen-Sutherland clipping ────────────────────────────────────────

/** Clip outcode flags used by `automapClipMline`. */
const OC_LEFT = 1;
const OC_RIGHT = 2;
const OC_BOTTOM = 4;
const OC_TOP = 8;

function computeOutcode(state: AutomapState, px: number, py: number): number {
  let oc = 0;
  if (py < 0) oc |= OC_TOP;
  else if (py >= state.f_h) oc |= OC_BOTTOM;
  if (px < 0) oc |= OC_LEFT;
  else if (px >= state.f_w) oc |= OC_RIGHT;
  return oc;
}

/**
 * Clip a map-space line segment against the current viewport and
 * return its frame-buffer coordinates, or `null` if it is fully
 * rejected.
 *
 * Mirrors `AM_clipMline`.  The algorithm is Cohen-Sutherland with a
 * two-stage trivial reject: first by y against `[m_y, m_y2]`, then by
 * x against `[m_x, m_x2]`, before the coordinate conversion.  The
 * clip loop rotates through `TOP` → `BOTTOM` → `RIGHT` → `LEFT` in
 * that exact order; alternative rotations produce pixel-level
 * differences when two outcodes are set simultaneously.  The `>= f_w`
 * and `>= f_h` comparisons are strict-equal-exclusive — a line
 * endpoint at `x = f_w - 1` is inside, at `x = f_w` is outside.
 */
export function automapClipMline(state: AutomapState, ml: Line2D): Line2D | null {
  let outcode1 = 0;
  let outcode2 = 0;

  if (ml.a.y > state.m_y2) outcode1 = OC_TOP;
  else if (ml.a.y < state.m_y) outcode1 = OC_BOTTOM;
  if (ml.b.y > state.m_y2) outcode2 = OC_TOP;
  else if (ml.b.y < state.m_y) outcode2 = OC_BOTTOM;
  if ((outcode1 & outcode2) !== 0) return null;

  if (ml.a.x < state.m_x) outcode1 |= OC_LEFT;
  else if (ml.a.x > state.m_x2) outcode1 |= OC_RIGHT;
  if (ml.b.x < state.m_x) outcode2 |= OC_LEFT;
  else if (ml.b.x > state.m_x2) outcode2 |= OC_RIGHT;
  if ((outcode1 & outcode2) !== 0) return null;

  const ax = automapCxMtof(state, ml.a.x);
  const ay = automapCyMtof(state, ml.a.y);
  const bx = automapCxMtof(state, ml.b.x);
  const by = automapCyMtof(state, ml.b.y);
  const fa: Point2D = { x: ax, y: ay };
  const fb: Point2D = { x: bx, y: by };

  outcode1 = computeOutcode(state, fa.x, fa.y);
  outcode2 = computeOutcode(state, fb.x, fb.y);
  if ((outcode1 & outcode2) !== 0) return null;

  while ((outcode1 | outcode2) !== 0) {
    const outside = outcode1 !== 0 ? outcode1 : outcode2;
    const tmp: Point2D = { x: 0, y: 0 };
    let dx: number;
    let dy: number;
    if ((outside & OC_TOP) !== 0) {
      dy = fa.y - fb.y;
      dx = fb.x - fa.x;
      tmp.x = (fa.x + Math.trunc((dx * fa.y) / dy)) | 0;
      tmp.y = 0;
    } else if ((outside & OC_BOTTOM) !== 0) {
      dy = fa.y - fb.y;
      dx = fb.x - fa.x;
      tmp.x = (fa.x + Math.trunc((dx * (fa.y - state.f_h)) / dy)) | 0;
      tmp.y = state.f_h - 1;
    } else if ((outside & OC_RIGHT) !== 0) {
      dy = fb.y - fa.y;
      dx = fb.x - fa.x;
      tmp.y = (fa.y + Math.trunc((dy * (state.f_w - 1 - fa.x)) / dx)) | 0;
      tmp.x = state.f_w - 1;
    } else if ((outside & OC_LEFT) !== 0) {
      dy = fb.y - fa.y;
      dx = fb.x - fa.x;
      tmp.y = (fa.y + Math.trunc((dy * -fa.x) / dx)) | 0;
      tmp.x = 0;
    }
    if (outside === outcode1) {
      fa.x = tmp.x;
      fa.y = tmp.y;
      outcode1 = computeOutcode(state, fa.x, fa.y);
    } else {
      fb.x = tmp.x;
      fb.y = tmp.y;
      outcode2 = computeOutcode(state, fb.x, fb.y);
    }
    if ((outcode1 & outcode2) !== 0) return null;
  }
  return { a: fa, b: fb };
}

// ── Bresenham line painter ───────────────────────────────────────────

/**
 * Paint a line onto the automap framebuffer using Bresenham's
 * algorithm.
 *
 * Mirrors `AM_drawFline`.  Silently bails out if either endpoint is
 * outside `[0, f_w) × [0, f_h)` — vanilla increments its `fuck` debug
 * counter and returns without drawing.  The major/minor axis split
 * uses `ax > ay` (strict), so a perfect diagonal takes the y-major
 * branch.  Both branches include the starting endpoint via the
 * `PUTDOT` before the increment check.
 *
 * @param framebuffer - The palette-indexed frame buffer (length ≥ f_w × f_h).
 * @param state - Automap state providing `f_w` / `f_h` viewport dimensions.
 * @param line - Line endpoints in frame-buffer pixel coordinates.
 * @param color - Palette index to write at each painted pixel.
 */
export function automapDrawFline(framebuffer: Uint8Array, state: AutomapState, line: Line2D, color: number): void {
  if (line.a.x < 0 || line.a.x >= state.f_w || line.a.y < 0 || line.a.y >= state.f_h) return;
  if (line.b.x < 0 || line.b.x >= state.f_w || line.b.y < 0 || line.b.y >= state.f_h) return;

  const f_w = state.f_w;
  const dx = line.b.x - line.a.x;
  const ax = 2 * (dx < 0 ? -dx : dx);
  const sx = dx < 0 ? -1 : 1;
  const dy = line.b.y - line.a.y;
  const ay = 2 * (dy < 0 ? -dy : dy);
  const sy = dy < 0 ? -1 : 1;
  let x = line.a.x;
  let y = line.a.y;
  let d: number;
  if (ax > ay) {
    d = ay - Math.floor(ax / 2);
    for (;;) {
      framebuffer[y * f_w + x] = color;
      if (x === line.b.x) return;
      if (d >= 0) {
        y += sy;
        d -= ax;
      }
      x += sx;
      d += ay;
    }
  } else {
    d = ax - Math.floor(ay / 2);
    for (;;) {
      framebuffer[y * f_w + x] = color;
      if (y === line.b.y) return;
      if (d >= 0) {
        x += sx;
        d -= ay;
      }
      y += sy;
      d += ax;
    }
  }
}

// ── 2D rotation ──────────────────────────────────────────────────────

/**
 * Rotate a 2D point in place by a BAM angle.  Mirrors `AM_rotate`.
 *
 * The rotation matrix is `[cos -sin; sin cos]` — positive angles
 * rotate counter-clockwise in map space (which is y-up), producing
 * clockwise rotation on the frame buffer (y-down).  The finecos /
 * finesin index is `angle >> ANGLETOFINESHIFT`, matching vanilla's
 * table-of-8192 lookup.
 */
export function automapRotate(point: Point2D, angle: Angle): void {
  const index = (angle >>> ANGLETOFINESHIFT) & 0x1fff;
  const cosA = finecosine[index]!;
  const sinA = finesine[index]!;
  const tmpX = (fixedMul(point.x, cosA) - fixedMul(point.y, sinA)) | 0;
  point.y = (fixedMul(point.x, sinA) + fixedMul(point.y, cosA)) | 0;
  point.x = tmpX;
}
