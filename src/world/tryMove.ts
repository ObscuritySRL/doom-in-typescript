/**
 * P_TryMove: attempt to move a mobj to a new position (p_map.c).
 *
 * Calls P_CheckPosition and, if the position is valid, applies
 * height/step/dropoff constraints before committing the move.
 * Special lines crossed during the move are processed in reverse
 * order, matching vanilla Doom's numspechit-- iteration.
 *
 * @example
 * ```ts
 * import { tryMove } from "../src/world/tryMove.ts";
 * const result = tryMove(mobj, newX, newY, mapData, blocklinks);
 * if (result.moved) { /* mobj was repositioned *\/ }
 * ```
 */

import type { Fixed } from '../core/fixed.ts';
import { FRACBITS, FRACUNIT, fixedMul } from '../core/fixed.ts';

import type { MapLinedef, MapVertex } from '../map/lineSectorGeometry.ts';
import type { MapData } from '../map/mapSetup.ts';
import type { Mobj } from './mobj.ts';
import { MF_DROPOFF, MF_FLOAT, MF_NOCLIP, MF_TELEPORT } from './mobj.ts';
import type { BlockThingsGrid, CheckPositionCallbacks, CheckPositionResult } from './checkPosition.ts';
import { checkPosition } from './checkPosition.ts';

// ── Constants ────────────────────────────────────────────────────────

/** Maximum step-up height: 24 map units in fixed-point. */
export const MAXSTEPHEIGHT: Fixed = (24 * FRACUNIT) | 0;

// ── Result type ──────────────────────────────────────────────────────

/** Result of P_TryMove. */
export interface TryMoveResult {
  /** Whether the move succeeded and the thing was repositioned. */
  moved: boolean;
  /**
   * True if the gap between floor and ceiling is large enough for the
   * thing, even when the move ultimately fails due to step-up or
   * dropoff. Used by floating monster AI (P_Move in p_enemy.c).
   */
  floatok: boolean;
  /** The CheckPositionResult from P_CheckPosition, or null if not called. */
  checkResult: CheckPositionResult | null;
}

// ── Callback types ───────────────────────────────────────────────────

/** Callback matching P_UnsetThingPosition. */
export type UnsetThingPositionFunction = (thing: Mobj) => void;

/** Callback matching P_SetThingPosition. */
export type SetThingPositionFunction = (thing: Mobj) => void;

/** Callback matching P_CrossSpecialLine. */
export type CrossSpecialLineFunction = (linedefIndex: number, oldside: number, thing: Mobj) => void;

/**
 * Optional callbacks for position management and special line effects.
 *
 * Extends CheckPositionCallbacks so the same object can flow through
 * to P_CheckPosition. Position and special-line callbacks are wired
 * by later steps; when absent, P_TryMove still makes the correct
 * move decision but skips the side effects.
 */
export interface TryMoveCallbacks extends CheckPositionCallbacks {
  unsetThingPosition?: UnsetThingPositionFunction;
  setThingPosition?: SetThingPositionFunction;
  crossSpecialLine?: CrossSpecialLineFunction;
}

// ── P_PointOnLineSide (inline) ───────────────────────────────────────

/**
 * P_PointOnLineSide from p_maputl.c.
 *
 * Determines which side of a linedef a point falls on. Uses
 * axis-aligned fast paths and FixedMul with >> FRACBITS shifts
 * (not >> 8 like R_PointOnSide). This precision difference is
 * parity-significant.
 */
function pointOnLineSide(x: Fixed, y: Fixed, linedef: MapLinedef, v1: MapVertex): 0 | 1 {
  const ldx = linedef.dx;
  const ldy = linedef.dy;

  if (ldx === 0) {
    if (x <= v1.x) {
      return ldy > 0 ? 1 : 0;
    }
    return ldy < 0 ? 1 : 0;
  }

  if (ldy === 0) {
    if (y <= v1.y) {
      return ldx < 0 ? 1 : 0;
    }
    return ldx > 0 ? 1 : 0;
  }

  const dx = (x - v1.x) | 0;
  const dy = (y - v1.y) | 0;

  const left = fixedMul(ldy >> FRACBITS, dx);
  const right = fixedMul(dy, ldx >> FRACBITS);

  if (right < left) {
    return 0;
  }
  return 1;
}

// ── P_TryMove ────────────────────────────────────────────────────────

/**
 * Attempt to move a mobj to (x, y).
 *
 * Reproduces P_TryMove from Chocolate Doom's p_map.c exactly:
 *
 * 1. Set floatok = false.
 * 2. Call P_CheckPosition. If it fails, return false.
 * 3. Unless MF_NOCLIP:
 *    - Reject if ceiling - floor < thing height.
 *    - Set floatok = true.
 *    - Unless MF_TELEPORT: reject if ceiling - thing.z < height.
 *    - Unless MF_TELEPORT: reject if floor - thing.z > 24*FRACUNIT.
 *    - Unless MF_DROPOFF|MF_FLOAT: reject if floor - dropoff > 24*FRACUNIT.
 * 4. Unset thing position, update x/y/floorz/ceilingz, set thing position.
 * 5. Unless MF_TELEPORT|MF_NOCLIP: process crossed special lines in
 *    reverse order (numspechit-- loop), calling P_CrossSpecialLine
 *    when oldside !== newside.
 *
 * @param thing - The mobj to move.
 * @param x - Target X position in fixed-point.
 * @param y - Target Y position in fixed-point.
 * @param mapData - Parsed map data.
 * @param blocklinks - Block things grid.
 * @param callbacks - Optional position/special/combat callbacks.
 * @returns Result with moved, floatok, and the underlying checkResult.
 *
 * @example
 * ```ts
 * const result = tryMove(mobj, mobj.x + mobj.momx, mobj.y + mobj.momy, mapData, grid);
 * if (!result.moved && result.floatok) { /* floating monster can adjust z *\/ }
 * ```
 */
export function tryMove(thing: Mobj, x: Fixed, y: Fixed, mapData: MapData, blocklinks: BlockThingsGrid, callbacks: TryMoveCallbacks = {}): TryMoveResult {
  const result: TryMoveResult = {
    moved: false,
    floatok: false,
    checkResult: null,
  };

  const checkResult = checkPosition(thing, x, y, mapData, blocklinks, callbacks);
  result.checkResult = checkResult;

  if (!checkResult.passed) {
    return result;
  }

  const flags = thing.flags;
  const height = thing.height;
  const thingZ = thing.z;
  const ceilingz = checkResult.ceilingz;
  const floorz = checkResult.floorz;

  if ((flags & MF_NOCLIP) === 0) {
    if (((ceilingz - floorz) | 0) < height) {
      return result;
    }

    result.floatok = true;

    const notTeleport = (flags & MF_TELEPORT) === 0;
    if (notTeleport && ((ceilingz - thingZ) | 0) < height) {
      return result;
    }

    if (notTeleport && ((floorz - thingZ) | 0) > MAXSTEPHEIGHT) {
      return result;
    }

    if ((flags & (MF_DROPOFF | MF_FLOAT)) === 0 && ((floorz - checkResult.dropoffz) | 0) > MAXSTEPHEIGHT) {
      return result;
    }
  }

  // Move is ok — reposition the thing.
  callbacks.unsetThingPosition?.(thing);

  const oldx = thing.x;
  const oldy = thing.y;
  thing.floorz = floorz;
  thing.ceilingz = ceilingz;
  thing.x = x;
  thing.y = y;

  callbacks.setThingPosition?.(thing);

  // Process crossed special lines (reverse order, matching numspechit--).
  if ((flags & (MF_TELEPORT | MF_NOCLIP)) === 0) {
    const specials = checkResult.specials;
    const linedefs = mapData.linedefs;
    const vertexes = mapData.vertexes;
    const newx = x;
    const newy = y;
    for (let i = specials.length - 1; i >= 0; i--) {
      const linedefIndex = specials[i]!;
      const linedef = linedefs[linedefIndex]!;
      const v1 = vertexes[linedef.v1]!;
      const side = pointOnLineSide(newx, newy, linedef, v1);
      const oldside = pointOnLineSide(oldx, oldy, linedef, v1);
      if (side !== oldside && linedef.special !== 0) {
        callbacks.crossSpecialLine?.(linedefIndex, oldside, thing);
      }
    }
  }

  result.moved = true;
  return result;
}
