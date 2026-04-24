/**
 * P_SlideMove, P_HitSlideLine, and PTR_SlideTraverse from p_map.c.
 *
 * When a player's move is blocked, P_SlideMove traces three leading
 * corners of the bounding box along the momentum vector to find the
 * nearest blocking wall, then decomposes the movement into a flush
 * approach and a wall-parallel slide component.
 *
 * @example
 * ```ts
 * import { slideMove } from "../src/world/slideMove.ts";
 * slideMove(playerMobj, mapData, blocklinks, callbacks);
 * ```
 */

import type { Angle } from '../core/angle.ts';
import { ANG90, ANG180, ANG270, angleWrap } from '../core/angle.ts';
import type { Fixed } from '../core/fixed.ts';
import { FRACBITS, FRACUNIT, fixedMul } from '../core/fixed.ts';
import { ANGLETOFINESHIFT, finecosine, finesine, slopeDiv, tantoangle, FINEMASK } from '../core/trig.ts';

import type { MapData } from '../map/mapSetup.ts';
import type { MapLinedef } from '../map/lineSectorGeometry.ts';
import { ML_TWOSIDED, ST_HORIZONTAL, ST_VERTICAL } from '../map/lineSectorGeometry.ts';
import { pathTraverse, PT_ADDLINES } from '../map/intercepts.ts';
import type { Intercept } from '../map/intercepts.ts';

import type { BlockThingsGrid } from './checkPosition.ts';
import { lineOpening } from './checkPosition.ts';
import type { Mobj } from './mobj.ts';
import type { TryMoveCallbacks } from './tryMove.ts';
import { MAXSTEPHEIGHT, tryMove } from './tryMove.ts';
import { approxDistance } from './zMovement.ts';

// ── R_PointToAngle (local) ──────────────────────────────────────────

/**
 * R_PointToAngle2(0, 0, x, y) — compute BAM angle from origin to (x, y).
 *
 * Reproduces R_PointToAngle from Chocolate Doom's r_main.c using the
 * octant-based SlopeDiv/tantoangle LUT. Used only by P_HitSlideLine.
 */
function pointToAngle(x: Fixed, y: Fixed): Angle {
  if (x === 0 && y === 0) {
    return 0;
  }

  if (x >= 0) {
    if (y >= 0) {
      if (x > y) {
        return tantoangle[slopeDiv(y, x)]!;
      }
      return angleWrap(ANG90 - 1 - tantoangle[slopeDiv(x, y)]!);
    }
    y = -y;
    if (x > y) {
      return angleWrap(-tantoangle[slopeDiv(y, x)]!);
    }
    return angleWrap(ANG270 + tantoangle[slopeDiv(x, y)]!);
  }

  x = -x;
  if (y >= 0) {
    if (x > y) {
      return angleWrap(ANG180 - 1 - tantoangle[slopeDiv(y, x)]!);
    }
    return angleWrap(ANG90 + tantoangle[slopeDiv(x, y)]!);
  }
  y = -y;
  if (x > y) {
    return angleWrap(ANG180 + tantoangle[slopeDiv(y, x)]!);
  }
  return angleWrap(ANG270 - 1 - tantoangle[slopeDiv(x, y)]!);
}

// ── P_PointOnLineSide (local) ───────────────────────────────────────

/**
 * P_PointOnLineSide from p_maputl.c (>> FRACBITS precision).
 *
 * Determines which side of a linedef a point is on. Used by
 * PTR_SlideTraverse to skip backface hits on one-sided lines.
 */
function pointOnLineSide(x: Fixed, y: Fixed, linedef: MapLinedef, mapData: MapData): 0 | 1 {
  const v1 = mapData.vertexes[linedef.v1]!;

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

// ── Slide state ─────────────────────────────────────────────────────

/**
 * `FRACUNIT + 1` sentinel used to initialize `bestslidefrac` and detect
 * "no blocking line was found" after the three-corner traces. Any real
 * intercept fraction returned by `pathTraverse` is in `[0, FRACUNIT]`,
 * so an unchanged sentinel value means every trace was clear.
 */
const BESTSLIDE_SENTINEL: Fixed = (FRACUNIT + 1) | 0;

/**
 * Mutable state shared between P_SlideMove, PTR_SlideTraverse, and
 * P_HitSlideLine. In the C code these are module-level globals; here
 * they are captured via closure.
 */
interface SlideState {
  bestslidefrac: Fixed;
  bestslideline: MapLinedef | null;
  slidemo: Mobj;
  tmxmove: Fixed;
  tmymove: Fixed;
}

// ── PTR_SlideTraverse ───────────────────────────────────────────────

/**
 * PTR_SlideTraverse callback for pathTraverse.
 *
 * Finds the closest blocking line along the trace. Non-blocking
 * two-sided lines (gap fits, ceiling fits, step-up fits) are skipped.
 * One-sided lines hit from the back are also skipped.
 */
function slideTraverse(intercept: Intercept, state: SlideState, mapData: MapData): boolean {
  const linedef = mapData.linedefs[intercept.lineIndex]!;

  if ((linedef.flags & ML_TWOSIDED) === 0) {
    if (pointOnLineSide(state.slidemo.x, state.slidemo.y, linedef, mapData) !== 0) {
      return true;
    }
    // One-sided, front-facing — blocks.
  } else {
    const opening = lineOpening(intercept.lineIndex, mapData);

    if (opening.openrange >= state.slidemo.height) {
      if (((opening.opentop - state.slidemo.z) | 0) >= state.slidemo.height && ((opening.openbottom - state.slidemo.z) | 0) <= MAXSTEPHEIGHT) {
        return true;
      }
    }
    // Two-sided but doesn't fit — blocks.
  }

  if (intercept.frac < state.bestslidefrac) {
    state.bestslidefrac = intercept.frac;
    state.bestslideline = linedef;
  }

  return false;
}

// ── P_HitSlideLine ──────────────────────────────────────────────────

/**
 * P_HitSlideLine from p_map.c.
 *
 * Projects the movement vector onto the wall-parallel direction.
 * Fast paths for axis-aligned lines (horizontal zeroes Y, vertical
 * zeroes X). For diagonal lines, computes the dot product via
 * R_PointToAngle2 and fine trig tables.
 *
 * Parity-critical:
 * - `deltaangle > ANG180` wraps via `+= ANG180` (not negation).
 * - The finecosine/finesine lookups use the result of `>>> ANGLETOFINESHIFT`.
 * - All intermediate values are uint32-wrapped BAM angles.
 */
function hitSlideLine(linedef: MapLinedef, state: SlideState, mapData: MapData): void {
  if (linedef.slopetype === ST_HORIZONTAL) {
    state.tmymove = 0;
    return;
  }

  if (linedef.slopetype === ST_VERTICAL) {
    state.tmxmove = 0;
    return;
  }

  const side = pointOnLineSide(state.slidemo.x, state.slidemo.y, linedef, mapData);

  // Compute line angle and adjust for the side we're on.
  let lineangle = pointToAngle(linedef.dx, linedef.dy);
  if (side === 1) {
    lineangle = angleWrap(lineangle + ANG180);
  }

  const moveangle = pointToAngle(state.tmxmove, state.tmymove);
  let deltaangle = angleWrap(moveangle - lineangle);

  if (deltaangle > ANG180) {
    deltaangle = angleWrap(deltaangle + ANG180);
  }

  const fineLineAngle = (lineangle >>> ANGLETOFINESHIFT) & FINEMASK;
  const fineDeltaAngle = (deltaangle >>> ANGLETOFINESHIFT) & FINEMASK;

  const movelen = approxDistance(state.tmxmove, state.tmymove);
  const newlen = fixedMul(movelen, finecosine[fineDeltaAngle]!);

  state.tmxmove = fixedMul(newlen, finecosine[fineLineAngle]!);
  state.tmymove = fixedMul(newlen, finesine[fineLineAngle]!);
}

// ── P_SlideMove ─────────────────────────────────────────────────────

/**
 * Stairstep fallback: try a Y-only move, then fall back to an X-only move.
 *
 * Matches the `stairstep:` label in p_map.c `P_SlideMove`. Momentum is
 * never modified by this path — the caller's `thing.momx` / `thing.momy`
 * are read unchanged into the two tryMove attempts.
 */
function stairstepFallback(thing: Mobj, mapData: MapData, blocklinks: BlockThingsGrid, callbacks: TryMoveCallbacks): void {
  if (!tryMove(thing, thing.x, (thing.y + thing.momy) | 0, mapData, blocklinks, callbacks).moved) {
    tryMove(thing, (thing.x + thing.momx) | 0, thing.y, mapData, blocklinks, callbacks);
  }
}

/**
 * P_SlideMove from p_map.c.
 *
 * Attempts to slide a player along walls when direct movement is
 * blocked. Traces three leading corners to find the nearest blocking
 * line, moves flush to it (minus a fudge factor), then slides along
 * the wall. Retries up to 3 times before falling back to a stairstep
 * move (try Y-only, then X-only).
 *
 * Parity-critical:
 * - Leading/trailing corners are chosen by momentum sign, not direction.
 * - The fudge factor is 0x800 (half a fractional unit).
 * - The remainder fraction is `FRACUNIT - (bestslidefrac + 0x800)`,
 *   clamped to [0, FRACUNIT].
 * - `++hitcount == 3` means at most 3 iterations (not 2).
 * - Momentum is updated to the slide vector on success.
 *
 * @param thing - The player mobj to slide.
 * @param mapData - Parsed map data.
 * @param blocklinks - Block things grid.
 * @param callbacks - Optional tryMove callbacks for position/special effects.
 */
export function slideMove(thing: Mobj, mapData: MapData, blocklinks: BlockThingsGrid, callbacks: TryMoveCallbacks = {}): void {
  const state: SlideState = {
    bestslidefrac: BESTSLIDE_SENTINEL,
    bestslideline: null,
    slidemo: thing,
    tmxmove: 0,
    tmymove: 0,
  };

  const traverseCallback = (intercept: Intercept): boolean => slideTraverse(intercept, state, mapData);
  const { blockmap, linedefs, vertexes, validCount } = mapData;

  let hitcount = 0;

  for (;;) {
    if (++hitcount === 3) {
      stairstepFallback(thing, mapData, blocklinks, callbacks);
      return;
    }

    const momx = thing.momx;
    const momy = thing.momy;
    const radius = thing.radius;

    // Determine leading/trailing corners from momentum direction.
    let leadx: Fixed;
    let trailx: Fixed;
    if (momx > 0) {
      leadx = (thing.x + radius) | 0;
      trailx = (thing.x - radius) | 0;
    } else {
      leadx = (thing.x - radius) | 0;
      trailx = (thing.x + radius) | 0;
    }

    let leady: Fixed;
    let traily: Fixed;
    if (momy > 0) {
      leady = (thing.y + radius) | 0;
      traily = (thing.y - radius) | 0;
    } else {
      leady = (thing.y - radius) | 0;
      traily = (thing.y + radius) | 0;
    }

    state.bestslidefrac = BESTSLIDE_SENTINEL;
    state.bestslideline = null;

    // Trace from three leading corners.
    pathTraverse(leadx, leady, (leadx + momx) | 0, (leady + momy) | 0, PT_ADDLINES, blockmap, linedefs, vertexes, validCount, traverseCallback);
    pathTraverse(trailx, leady, (trailx + momx) | 0, (leady + momy) | 0, PT_ADDLINES, blockmap, linedefs, vertexes, validCount, traverseCallback);
    pathTraverse(leadx, traily, (leadx + momx) | 0, (traily + momy) | 0, PT_ADDLINES, blockmap, linedefs, vertexes, validCount, traverseCallback);

    // If no blocking line was found, stairstep.
    if (state.bestslidefrac === BESTSLIDE_SENTINEL) {
      stairstepFallback(thing, mapData, blocklinks, callbacks);
      return;
    }

    // Fudge: move slightly back from the wall.
    state.bestslidefrac = (state.bestslidefrac - 0x800) | 0;
    if (state.bestslidefrac > 0) {
      const newx = fixedMul(momx, state.bestslidefrac);
      const newy = fixedMul(momy, state.bestslidefrac);

      if (!tryMove(thing, (thing.x + newx) | 0, (thing.y + newy) | 0, mapData, blocklinks, callbacks).moved) {
        stairstepFallback(thing, mapData, blocklinks, callbacks);
        return;
      }
    }

    // Calculate the remaining movement fraction.
    state.bestslidefrac = (FRACUNIT - (state.bestslidefrac + 0x800)) | 0;
    if (state.bestslidefrac > FRACUNIT) {
      state.bestslidefrac = FRACUNIT;
    }

    if (state.bestslidefrac <= 0) {
      return;
    }

    state.tmxmove = fixedMul(momx, state.bestslidefrac);
    state.tmymove = fixedMul(momy, state.bestslidefrac);

    // Clip the remaining movement to the wall direction.
    hitSlideLine(state.bestslideline!, state, mapData);

    thing.momx = state.tmxmove;
    thing.momy = state.tmymove;

    if (!tryMove(thing, (thing.x + state.tmxmove) | 0, (thing.y + state.tmymove) | 0, mapData, blocklinks, callbacks).moved) {
      continue;
    }

    // Slide succeeded.
    return;
  }
}
