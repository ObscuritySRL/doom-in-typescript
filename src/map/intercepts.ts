/**
 * Intercepts and path traversal.
 *
 * Implements P_InterceptVector, P_PointOnDivlineSide, PIT_AddLineIntercepts,
 * P_TraverseIntercepts, and P_PathTraverse from Chocolate Doom's p_maputl.c,
 * reproducing the exact integer arithmetic including the parity-critical
 * `>> 8` precision shift in P_InterceptVector and P_PointOnDivlineSide.
 *
 * @example
 * ```ts
 * import { pathTraverse, PT_ADDLINES } from "../src/map/intercepts.ts";
 * pathTraverse(x1, y1, x2, y2, PT_ADDLINES, blockmap, linedefs, vertexes,
 *   validCount, (intercept, trace) => { console.log(intercept.frac); return true; });
 * ```
 */

import type { Fixed } from '../core/fixed.ts';
import { FRACBITS, FRACUNIT, FIXED_MAX, fixedDiv, fixedMul } from '../core/fixed.ts';
import type { Blockmap } from './blockmap.ts';
import { MAPBLOCKSHIFT, MAPBTOFRAC } from './blockmap.ts';
import type { ValidCount } from './blockmapIter.ts';
import { blockLinesIterator, incrementValidCount } from './blockmapIter.ts';
import type { MapLinedef, MapVertex } from './lineSectorGeometry.ts';

// ── Constants ────────────────────────────────────────────────────────

/** Flag for pathTraverse: collect line intercepts. */
export const PT_ADDLINES = 1;

/** Flag for pathTraverse: collect thing intercepts. */
export const PT_ADDTHINGS = 2;

/** Flag for pathTraverse: stop early on one-sided blocking lines. */
export const PT_EARLYOUT = 4;

/** Initial intercept buffer capacity matching vanilla Doom. */
export const MAXINTERCEPTS = 128;

/** Maximum blockmap cells walked per path traversal (safety limit). */
export const MAX_TRAVERSE_CELLS = 64;

/**
 * Block boundary mask in 16.16 fixed-point.
 *
 * Each blockmap cell spans `1 << MAPBLOCKSHIFT` fixed-point units.
 * The mask isolates the intra-block position for the boundary nudge.
 */
const BLOCK_BOUNDARY_MASK = (1 << MAPBLOCKSHIFT) - 1;

/**
 * Threshold for the dual-precision check in PIT_AddLineIntercepts.
 * When trace dx or dy exceeds ±16 map units (in fixed-point), the
 * crossing test uses pointOnDivlineSide instead of pointOnLineSide.
 */
const TRACE_BIG_THRESHOLD = FRACUNIT * 16;

// ── Types ────────────────────────────────────────────────────────────

/**
 * A directed line: origin (x, y) plus delta (dx, dy) in 16.16 fixed-point.
 *
 * Matches divline_t from Chocolate Doom's p_local.h.
 */
export interface Divline {
  readonly x: Fixed;
  readonly y: Fixed;
  readonly dx: Fixed;
  readonly dy: Fixed;
}

/**
 * An intercept collected during path traversal.
 *
 * Matches intercept_t from Chocolate Doom's p_local.h. The frac field
 * is mutable: P_TraverseIntercepts sets consumed entries to FIXED_MAX
 * during its O(n²) selection-sort pass.
 */
export interface Intercept {
  /** Fractional distance along the trace (0 = origin, FRACUNIT = endpoint). */
  frac: Fixed;
  /** True for a line intercept, false for a thing intercept. */
  readonly isLine: boolean;
  /** Linedef index when isLine is true; -1 otherwise. */
  readonly lineIndex: number;
}

// ── Core functions ───────────────────────────────────────────────────

/**
 * Compute the fractional intercept along v2's line where v1's line crosses.
 *
 * Reproduces P_InterceptVector from Chocolate Doom's p_maputl.c exactly.
 * The `>> 8` shifts (not `>> FRACBITS`) are parity-critical precision
 * reduction that matches the original integer arithmetic.
 *
 * @param v2 - The divline whose parameter is returned (typically the trace).
 * @param v1 - The crossing divline (typically a linedef).
 * @returns Fractional distance along v2 in 16.16 fixed-point; 0 if parallel.
 *
 * @example
 * ```ts
 * import { interceptVector } from "../src/map/intercepts.ts";
 * const frac = interceptVector(trace, lineDiv);
 * ```
 */
export function interceptVector(v2: Divline, v1: Divline): Fixed {
  const den = (fixedMul(v1.dy >> 8, v2.dx) - fixedMul(v1.dx >> 8, v2.dy)) | 0;

  if (den === 0) {
    return 0;
  }

  const num = (fixedMul(((v1.x - v2.x) | 0) >> 8, v1.dy) + fixedMul(((v2.y - v1.y) | 0) >> 8, v1.dx)) | 0;

  return fixedDiv(num, den);
}

/**
 * Determine which side of a divline a point falls on.
 *
 * Reproduces P_PointOnDivlineSide from Chocolate Doom's p_maputl.c.
 * Distinct from R_PointOnSide (nodeTraversal.ts) and P_PointOnLineSide:
 * the FixedMul fallback uses `>> 8` shifts instead of `>> FRACBITS`,
 * giving coarser but overflow-safer truncation.
 *
 * @param x - Point X in 16.16 fixed-point.
 * @param y - Point Y in 16.16 fixed-point.
 * @param line - Divline to test against.
 * @returns 0 for front side, 1 for back side.
 *
 * @example
 * ```ts
 * import { pointOnDivlineSide } from "../src/map/intercepts.ts";
 * const side = pointOnDivlineSide(px, py, traceLine);
 * ```
 */
export function pointOnDivlineSide(x: Fixed, y: Fixed, line: Divline): 0 | 1 {
  if (line.dx === 0) {
    if (x <= line.x) {
      return line.dy > 0 ? 1 : 0;
    }
    return line.dy < 0 ? 1 : 0;
  }

  if (line.dy === 0) {
    if (y <= line.y) {
      return line.dx < 0 ? 1 : 0;
    }
    return line.dx > 0 ? 1 : 0;
  }

  const dx = (x - line.x) | 0;
  const dy = (y - line.y) | 0;

  if (((line.dy ^ line.dx ^ dx ^ dy) & 0x80000000) !== 0) {
    if (((line.dy ^ dx) & 0x80000000) !== 0) {
      return 1;
    }
    return 0;
  }

  const left = fixedMul(line.dy >> 8, dx >> 8);
  const right = fixedMul(dy >> 8, line.dx >> 8);

  if (right < left) {
    return 0;
  }
  return 1;
}

/**
 * Walk a line through the blockmap, collect intercepts with linedefs
 * (and optionally things), then deliver them in ascending frac order.
 *
 * Reproduces P_PathTraverse from Chocolate Doom's p_maputl.c, including:
 *
 * - Block-boundary nudge: if the start point falls exactly on a grid
 *   edge, it is pushed by FRACUNIT to avoid degenerate side tests.
 * - DDA stepping: cells are visited along the trace using a
 *   fixed-point Bresenham walk, capped at MAX_TRAVERSE_CELLS.
 * - PIT_AddLineIntercepts: dual-precision side test
 *   (pointOnDivlineSide for long traces, P_PointOnLineSide for short),
 *   earlyout on one-sided lines, negative-frac rejection.
 * - O(n²) selection-sort traversal matching P_TraverseIntercepts.
 *
 * PT_ADDTHINGS is accepted but thing intercepts are not collected
 * until the mobj subsystem exists (Phase 09).
 *
 * @param x1 - Trace start X in 16.16 fixed-point.
 * @param y1 - Trace start Y in 16.16 fixed-point.
 * @param x2 - Trace end X in 16.16 fixed-point.
 * @param y2 - Trace end Y in 16.16 fixed-point.
 * @param flags - Combination of PT_ADDLINES, PT_ADDTHINGS, PT_EARLYOUT.
 * @param blockmap - Parsed blockmap for the map.
 * @param linedefs - Parsed linedef array.
 * @param vertexes - Parsed vertex array.
 * @param validCount - Deduplication tracker for blockmap iteration.
 * @param callback - Called for each intercept in ascending frac order;
 *   return false to stop traversal.
 * @returns true if all intercepts were processed, false if stopped early.
 *
 * @example
 * ```ts
 * import { pathTraverse, PT_ADDLINES } from "../src/map/intercepts.ts";
 * const result = pathTraverse(x1, y1, x2, y2, PT_ADDLINES,
 *   blockmap, linedefs, vertexes, validCount,
 *   (intercept, trace) => { console.log(intercept.lineIndex); return true; });
 * ```
 */
export function pathTraverse(
  x1: Fixed,
  y1: Fixed,
  x2: Fixed,
  y2: Fixed,
  flags: number,
  blockmap: Blockmap,
  linedefs: readonly MapLinedef[],
  vertexes: readonly MapVertex[],
  validCount: ValidCount,
  callback: (intercept: Intercept, trace: Divline) => boolean,
): boolean {
  const earlyout = (flags & PT_EARLYOUT) !== 0;
  incrementValidCount(validCount);

  const intercepts: Intercept[] = [];

  // Block-boundary nudge: push start point off exact grid edges
  if (((x1 - blockmap.originX) & BLOCK_BOUNDARY_MASK) === 0) {
    x1 = (x1 + FRACUNIT) | 0;
  }
  if (((y1 - blockmap.originY) & BLOCK_BOUNDARY_MASK) === 0) {
    y1 = (y1 + FRACUNIT) | 0;
  }

  // Trace divline (post-nudge world coordinates)
  const trace: Divline = Object.freeze({
    x: x1,
    y: y1,
    dx: (x2 - x1) | 0,
    dy: (y2 - y1) | 0,
  });

  // Blockmap-relative coordinates for DDA
  const relX1 = (x1 - blockmap.originX) | 0;
  const relY1 = (y1 - blockmap.originY) | 0;
  const relX2 = (x2 - blockmap.originX) | 0;
  const relY2 = (y2 - blockmap.originY) | 0;

  const xt1 = relX1 >> MAPBLOCKSHIFT;
  const yt1 = relY1 >> MAPBLOCKSHIFT;
  const xt2 = relX2 >> MAPBLOCKSHIFT;
  const yt2 = relY2 >> MAPBLOCKSHIFT;

  const relDeltaX = (relX2 - relX1) | 0;
  const relDeltaY = (relY2 - relY1) | 0;
  // `| 0` preserves C abs(INT_MIN) → INT_MIN behavior instead of Number 2^31.
  const absDeltaX = (relDeltaX < 0 ? -relDeltaX : relDeltaX) | 0;
  const absDeltaY = (relDeltaY < 0 ? -relDeltaY : relDeltaY) | 0;

  let mapxstep: number;
  let ystep: Fixed;
  let partial: Fixed;

  if (xt2 > xt1) {
    mapxstep = 1;
    partial = (FRACUNIT - ((relX1 >> MAPBTOFRAC) & (FRACUNIT - 1))) | 0;
    ystep = fixedDiv(relDeltaY, absDeltaX);
  } else if (xt2 < xt1) {
    mapxstep = -1;
    partial = (relX1 >> MAPBTOFRAC) & (FRACUNIT - 1);
    ystep = fixedDiv(relDeltaY, absDeltaX);
  } else {
    mapxstep = 0;
    partial = FRACUNIT;
    ystep = (256 * FRACUNIT) | 0;
  }

  let yintercept: Fixed = ((relY1 >> MAPBTOFRAC) + fixedMul(partial, ystep)) | 0;

  let mapystep: number;
  let xstep: Fixed;

  if (yt2 > yt1) {
    mapystep = 1;
    partial = (FRACUNIT - ((relY1 >> MAPBTOFRAC) & (FRACUNIT - 1))) | 0;
    xstep = fixedDiv(relDeltaX, absDeltaY);
  } else if (yt2 < yt1) {
    mapystep = -1;
    partial = (relY1 >> MAPBTOFRAC) & (FRACUNIT - 1);
    xstep = fixedDiv(relDeltaX, absDeltaY);
  } else {
    mapystep = 0;
    partial = FRACUNIT;
    xstep = (256 * FRACUNIT) | 0;
  }

  let xintercept: Fixed = ((relX1 >> MAPBTOFRAC) + fixedMul(partial, xstep)) | 0;

  let mapx = xt1;
  let mapy = yt1;

  const iteratorCallback = (linedefIndex: number): boolean => addLineIntercept(linedefIndex, trace, earlyout, intercepts, linedefs, vertexes);

  for (let count = 0; count < MAX_TRAVERSE_CELLS; count++) {
    if ((flags & PT_ADDLINES) !== 0) {
      if (!blockLinesIterator(mapx, mapy, blockmap, validCount, iteratorCallback)) {
        return false;
      }
    }

    // PT_ADDTHINGS: no-op until mobj subsystem exists (Phase 09)

    if (mapx === xt2 && mapy === yt2) {
      break;
    }

    if (yintercept >> FRACBITS === mapy) {
      yintercept = (yintercept + ystep) | 0;
      mapx += mapxstep;
    } else if (xintercept >> FRACBITS === mapx) {
      xintercept = (xintercept + xstep) | 0;
      mapy += mapystep;
    }
  }

  return traverseIntercepts(intercepts, FRACUNIT, callback, trace);
}

// ── Internal helpers ─────────────────────────────────────────────────

/**
 * P_PointOnLineSide from p_maputl.c.
 *
 * Same axis-aligned fast paths as pointOnDivlineSide but the FixedMul
 * fallback uses `>> FRACBITS` shifts (not `>> 8`) and omits the
 * sign-bit quick-reject. This precision difference is parity-significant.
 */
function pointOnLineSide(x: Fixed, y: Fixed, linedef: MapLinedef, vertexes: readonly MapVertex[]): 0 | 1 {
  const v1 = vertexes[linedef.v1]!;

  if (linedef.dx === 0) {
    if (x <= v1.x) {
      return linedef.dy > 0 ? 1 : 0;
    }
    return linedef.dy < 0 ? 1 : 0;
  }

  if (linedef.dy === 0) {
    if (y <= v1.y) {
      return linedef.dx < 0 ? 1 : 0;
    }
    return linedef.dx > 0 ? 1 : 0;
  }

  const dx = (x - v1.x) | 0;
  const dy = (y - v1.y) | 0;

  const left = fixedMul(linedef.dy >> FRACBITS, dx);
  const right = fixedMul(dy, linedef.dx >> FRACBITS);

  if (right < left) {
    return 0;
  }
  return 1;
}

/** P_MakeDivline: construct a divline from a linedef's v1 and deltas. */
function makeDivline(linedef: MapLinedef, vertexes: readonly MapVertex[]): Divline {
  const v1 = vertexes[linedef.v1]!;
  return { x: v1.x, y: v1.y, dx: linedef.dx, dy: linedef.dy };
}

/**
 * PIT_AddLineIntercepts logic from p_maputl.c.
 *
 * Checks whether the trace crosses the linedef, computes the fractional
 * intercept, applies the earlyout optimization, and pushes valid
 * intercepts into the buffer.
 */
function addLineIntercept(linedefIndex: number, trace: Divline, earlyout: boolean, intercepts: Intercept[], linedefs: readonly MapLinedef[], vertexes: readonly MapVertex[]): boolean {
  const linedef = linedefs[linedefIndex]!;

  let side1: 0 | 1;
  let side2: 0 | 1;

  // Dual precision: long traces test linedef endpoints against the
  // trace divline; short traces test trace endpoints against the linedef.
  if (trace.dx > TRACE_BIG_THRESHOLD || trace.dy > TRACE_BIG_THRESHOLD || trace.dx < -TRACE_BIG_THRESHOLD || trace.dy < -TRACE_BIG_THRESHOLD) {
    const v1 = vertexes[linedef.v1]!;
    const v2 = vertexes[linedef.v2]!;
    side1 = pointOnDivlineSide(v1.x, v1.y, trace);
    side2 = pointOnDivlineSide(v2.x, v2.y, trace);
  } else {
    side1 = pointOnLineSide(trace.x, trace.y, linedef, vertexes);
    side2 = pointOnLineSide((trace.x + trace.dx) | 0, (trace.y + trace.dy) | 0, linedef, vertexes);
  }

  if (side1 === side2) {
    return true;
  }

  const lineDiv = makeDivline(linedef, vertexes);
  const frac = interceptVector(trace, lineDiv);

  if (frac < 0) {
    return true;
  }

  if (earlyout && frac < FRACUNIT) {
    if (linedef.sidenum1 === -1) {
      return false;
    }
  }

  intercepts.push({
    frac,
    isLine: true,
    lineIndex: linedefIndex,
  });

  return true;
}

/**
 * O(n²) selection-sort traversal of collected intercepts.
 *
 * Reproduces P_TraverseIntercepts from p_maputl.c: each pass finds the
 * minimum-frac intercept, invokes the callback, and marks it consumed
 * by setting frac to FIXED_MAX.
 */
function traverseIntercepts(intercepts: Intercept[], maxfrac: Fixed, callback: (intercept: Intercept, trace: Divline) => boolean, trace: Divline): boolean {
  const total = intercepts.length;

  for (let pass = 0; pass < total; pass++) {
    let dist = FIXED_MAX;
    let selected: Intercept | undefined;

    for (let index = 0; index < total; index++) {
      const scan = intercepts[index]!;
      if (scan.frac < dist) {
        dist = scan.frac;
        selected = scan;
      }
    }

    if (dist > maxfrac) {
      return true;
    }

    if (selected === undefined) {
      return true;
    }

    if (!callback(selected, trace)) {
      return false;
    }

    selected.frac = FIXED_MAX;
  }

  return true;
}
