/**
 * P_UseLines and spechit overflow emulation (p_map.c).
 *
 * P_UseLines casts a ray USERANGE units from the player's position
 * along their facing angle. PTR_UseTraverse processes each intercepted
 * line: non-special walls produce an "oof" sound, non-special openings
 * are skipped, and the first special line triggers P_UseSpecialLine.
 *
 * The spechit overflow emulation reproduces vanilla Doom's memory
 * corruption when PIT_CheckLine exceeds the original 8-slot buffer.
 *
 * @example
 * ```ts
 * import { useLines } from "../src/world/useLines.ts";
 * useLines(playerMobj, mapData, {
 *   useSpecialLine: (idx, side, thing) => activateLine(idx, side, thing),
 *   noWaySound: (thing) => playSound(thing, sfx_noway),
 * });
 * ```
 */

import type { Fixed } from '../core/fixed.ts';
import { FRACBITS, FRACUNIT, fixedMul } from '../core/fixed.ts';
import { ANGLETOFINESHIFT, finecosine, finesine, FINEMASK } from '../core/trig.ts';

import type { MapData } from '../map/mapSetup.ts';
import { pathTraverse, PT_ADDLINES } from '../map/intercepts.ts';
import type { Intercept, Divline } from '../map/intercepts.ts';

import { lineOpening } from './checkPosition.ts';
import type { Mobj } from './mobj.ts';

// ── Constants ────────────────────────────────────────────────────────

/** Use-activation range: 64 map units in 16.16 fixed-point. */
export const USERANGE: Fixed = 64 * FRACUNIT;

/** Chocolate Doom's expanded spechit buffer limit. */
export const MAXSPECIALCROSS = 20;

/** Original Doom spechit buffer size; overflows beyond this corrupt memory. */
export const MAXSPECIALCROSS_ORIGINAL = 8;

/**
 * Default base address for spechit overflow emulation.
 * Matches PrBoom-plus's value for demo compatibility.
 */
export const DEFAULT_SPECHIT_MAGIC = 0x01c09c98;

/** Size of line_t struct in vanilla doom2.exe memory layout (62 bytes). */
const VANILLA_LINE_T_SIZE = 0x3e;

// ── Types ────────────────────────────────────────────────────────────

/** Callback to activate a special line (P_UseSpecialLine). */
export type UseSpecialLineFunction = (linedefIndex: number, side: 0 | 1, thing: Mobj) => void;

/** Callback for the "oof" sound when a use-press hits a wall. */
export type NoWaySoundFunction = (thing: Mobj) => void;

/** Callbacks for useLines. */
export interface UseLineCallbacks {
  readonly useSpecialLine?: UseSpecialLineFunction;
  readonly noWaySound?: NoWaySoundFunction;
}

/**
 * Mutable state exposed to spechit overflow emulation.
 *
 * In vanilla Doom, these globals sit adjacent to the spechit array
 * in memory and get overwritten when PIT_CheckLine exceeds 8 hits:
 * - indices 9–12 overwrite tmbbox[0..3]
 * - index 13 overwrites crushchange
 * - index 14 overwrites nofit
 */
export interface SpechitOverrunState {
  tmbbox: [Fixed, Fixed, Fixed, Fixed];
  crushchange: number;
  nofit: number;
}

// ── Spechit overflow emulation ───────────────────────────────────────

/**
 * Emulate vanilla Doom's spechit buffer overflow.
 *
 * In the original DOS executable, `spechit[8]` was laid out so that
 * writes past index 8 corrupted adjacent globals. The written value
 * is a synthetic pointer: `baseAddress + lineIndex * 0x3E` (line_t
 * size in the original binary).
 *
 * This reproduces the overflow for demo compatibility with WADs
 * that depend on the memory corruption.
 */
export function spechitOverrun(lineIndex: number, numspechit: number, state: SpechitOverrunState, baseAddress: number = DEFAULT_SPECHIT_MAGIC): void {
  const addr = (baseAddress + lineIndex * VANILLA_LINE_T_SIZE) | 0;

  switch (numspechit) {
    case 9:
      state.tmbbox[0] = addr;
      break;
    case 10:
      state.tmbbox[1] = addr;
      break;
    case 11:
      state.tmbbox[2] = addr;
      break;
    case 12:
      state.tmbbox[3] = addr;
      break;
    case 13:
      state.crushchange = addr;
      break;
    case 14:
      state.nofit = addr;
      break;
    // Indices > 14: no further emulation possible.
  }
}

// ── P_PointOnLineSide (p_map.c precision) ────────────────────────────

/**
 * Determine which side of a linedef a point falls on.
 * Uses >> FRACBITS precision (not >> 8 like R_PointOnSide).
 */
function pointOnLineSide(x: Fixed, y: Fixed, linedefIndex: number, mapData: MapData): 0 | 1 {
  const linedef = mapData.linedefs[linedefIndex]!;
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

// ── PTR_UseTraverse + P_UseLines ─────────────────────────────────────

/**
 * P_UseLines: cast a use-activation ray from a mobj.
 *
 * Reproduces P_UseLines from Chocolate Doom's p_map.c:
 * 1. Compute endpoint USERANGE units in the mobj's facing direction.
 * 2. pathTraverse with PT_ADDLINES collects line intercepts.
 * 3. PTR_UseTraverse processes each intercept:
 *    - Non-special line with openrange <= 0 → noWaySound, stop.
 *    - Non-special line with opening → continue.
 *    - Special line → determine side, useSpecialLine, stop.
 */
export function useLines(thing: Mobj, mapData: MapData, callbacks?: UseLineCallbacks): void {
  const angle = (thing.angle >>> ANGLETOFINESHIFT) & FINEMASK;

  const x1 = thing.x;
  const y1 = thing.y;
  const x2 = (x1 + (USERANGE >> FRACBITS) * finecosine[angle]!) | 0;
  const y2 = (y1 + (USERANGE >> FRACBITS) * finesine[angle]!) | 0;

  pathTraverse(x1, y1, x2, y2, PT_ADDLINES, mapData.blockmap, mapData.linedefs, mapData.vertexes, mapData.validCount, (intercept: Intercept, _trace: Divline): boolean => {
    if (!intercept.isLine) {
      return true;
    }

    const linedefIndex = intercept.lineIndex;
    const linedef = mapData.linedefs[linedefIndex]!;

    if (linedef.special === 0) {
      const opening = lineOpening(linedefIndex, mapData);
      if (opening.openrange <= 0) {
        callbacks?.noWaySound?.(thing);
        return false;
      }
      return true;
    }

    let side: 0 | 1 = 0;
    if (pointOnLineSide(thing.x, thing.y, linedefIndex, mapData) === 1) {
      side = 1;
    }

    callbacks?.useSpecialLine?.(linedefIndex, side, thing);
    return false;
  });
}
