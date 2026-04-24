/**
 * P_CheckPosition collision detection (p_map.c).
 *
 * Checks whether a mobj at a test position would fit without overlapping
 * blocking things or lines. Reports the adjusted floor/ceiling heights
 * from all contacted sectors and tracks special lines crossed.
 *
 * @example
 * ```ts
 * import { checkPosition, createBlockThingsGrid } from "../src/world/checkPosition.ts";
 * const grid = createBlockThingsGrid(mapData.blockmap.columns, mapData.blockmap.rows);
 * const result = checkPosition(mobj, newX, newY, mapData, grid);
 * if (result.passed) { /* position is valid *\/ }
 * ```
 */

import type { Fixed } from '../core/fixed.ts';
import type { DoomRandom } from '../core/rng.ts';

import { pointOnSegSide } from '../map/nodeTraversal.ts';
import { sectorIndexAt } from '../map/subsectorQuery.ts';
import type { Blockmap } from '../map/blockmap.ts';
import { MAPBLOCKSHIFT } from '../map/blockmap.ts';
import type { MapData } from '../map/mapSetup.ts';
import { MAXRADIUS } from '../map/mapSetup.ts';
import { BOXBOTTOM, BOXLEFT, BOXRIGHT, BOXTOP, ML_BLOCKING, ML_BLOCKMONSTERS, ST_HORIZONTAL, ST_NEGATIVE, ST_POSITIVE, ST_VERTICAL } from '../map/lineSectorGeometry.ts';
import { blockLinesIterator, incrementValidCount } from '../map/blockmapIter.ts';
import type { Mobj } from './mobj.ts';
import { MF_MISSILE, MF_NOCLIP, MF_PICKUP, MF_SHOOTABLE, MF_SKULLFLY, MF_SOLID, MF_SPECIAL, MobjType, setMobjState } from './mobj.ts';
import type { ThinkerList } from './thinkers.ts';
import type { SpechitOverrunState } from './useLines.ts';
import { MAXSPECIALCROSS, MAXSPECIALCROSS_ORIGINAL, spechitOverrun } from './useLines.ts';

// ── Block things grid ────────────────────────────────────────────────

/** Per-cell linked-list heads for mobj blockmap links. */
export type BlockThingsGrid = (Mobj | null)[];

/**
 * Create an empty block-things grid for a given blockmap.
 *
 * @param columns - Blockmap column count.
 * @param rows - Blockmap row count.
 * @returns A mutable grid with all cells set to null.
 *
 * @example
 * ```ts
 * const grid = createBlockThingsGrid(blockmap.columns, blockmap.rows);
 * ```
 */
export function createBlockThingsGrid(columns: number, rows: number): BlockThingsGrid {
  return new Array<Mobj | null>(columns * rows).fill(null);
}

// ── P_BlockThingsIterator ────────────────────────────────────────────

/**
 * Iterate mobjs in a single blockmap cell's linked list.
 *
 * Matches P_BlockThingsIterator from Chocolate Doom's p_maputl.c.
 * Out-of-bounds cell coordinates return true (continue). The next
 * pointer is read after the callback, matching the C for-loop
 * semantics exactly.
 *
 * @param blockX - Column index in blockmap grid.
 * @param blockY - Row index in blockmap grid.
 * @param blockmap - Parsed blockmap structure.
 * @param blocklinks - Per-cell mobj linked-list heads.
 * @param callback - Called with each mobj; return false to stop.
 * @returns true if all mobjs were checked, false if callback stopped.
 */
export function blockThingsIterator(blockX: number, blockY: number, blockmap: Blockmap, blocklinks: BlockThingsGrid, callback: (thing: Mobj) => boolean): boolean {
  if (blockX < 0 || blockY < 0 || blockX >= blockmap.columns || blockY >= blockmap.rows) {
    return true;
  }

  const cellIndex = blockY * blockmap.columns + blockX;
  let mobj = blocklinks[cellIndex] ?? null;
  while (mobj !== null) {
    if (!callback(mobj)) {
      return false;
    }
    mobj = mobj.blockNext;
  }
  return true;
}

// ── P_LineOpening ────────────────────────────────────────────────────

/** Result of P_LineOpening: the vertical gap at a two-sided linedef. */
export interface LineOpening {
  opentop: Fixed;
  openbottom: Fixed;
  openrange: Fixed;
  lowfloor: Fixed;
}

/**
 * Compute the vertical opening at a two-sided linedef.
 *
 * Matches P_LineOpening from Chocolate Doom's p_maputl.c exactly.
 * For one-sided lines, returns openrange === 0.
 *
 * @param linedefIndex - Index into mapData.linedefs.
 * @param mapData - Parsed map data.
 * @returns The opening dimensions.
 *
 * @example
 * ```ts
 * const opening = lineOpening(lineIndex, mapData);
 * if (opening.openrange > thingHeight) { /* fits *\/ }
 * ```
 */
export function lineOpening(linedefIndex: number, mapData: MapData): LineOpening {
  const ls = mapData.lineSectors[linedefIndex]!;

  if (ls.backsector === -1) {
    return { opentop: 0, openbottom: 0, openrange: 0, lowfloor: 0 };
  }

  const front = mapData.sectors[ls.frontsector]!;
  const back = mapData.sectors[ls.backsector]!;

  const opentop: Fixed = front.ceilingheight < back.ceilingheight ? front.ceilingheight : back.ceilingheight;

  let openbottom: Fixed;
  let lowfloor: Fixed;
  if (front.floorheight > back.floorheight) {
    openbottom = front.floorheight;
    lowfloor = back.floorheight;
  } else {
    openbottom = back.floorheight;
    lowfloor = front.floorheight;
  }

  const openrange: Fixed = (opentop - openbottom) | 0;

  return { opentop, openbottom, openrange, lowfloor };
}

// ── P_BoxOnLineSide ──────────────────────────────────────────────────

/**
 * Determine which side of a linedef a bounding box falls on.
 *
 * Matches P_BoxOnLineSide from Chocolate Doom's p_maputl.c exactly,
 * including the slopetype-based fast paths and the pointOnSegSide
 * fallback for diagonal lines.
 *
 * @param bbox - Bounding box [top, bottom, left, right] in fixed-point.
 * @param linedefIndex - Index into mapData.linedefs.
 * @param mapData - Parsed map data.
 * @returns 0 (front), 1 (back), or -1 (straddling).
 *
 * @example
 * ```ts
 * const side = boxOnLineSide(bbox, lineIndex, mapData);
 * if (side === -1) { /* box straddles the line *\/ }
 * ```
 */
export function boxOnLineSide(bbox: readonly [Fixed, Fixed, Fixed, Fixed], linedefIndex: number, mapData: MapData): number {
  const linedef = mapData.linedefs[linedefIndex]!;
  const v1 = mapData.vertexes[linedef.v1]!;

  let p1: number;
  let p2: number;

  switch (linedef.slopetype) {
    case ST_HORIZONTAL:
      p1 = bbox[BOXTOP] > v1.y ? 1 : 0;
      p2 = bbox[BOXBOTTOM] > v1.y ? 1 : 0;
      if (linedef.dx < 0) {
        p1 ^= 1;
        p2 ^= 1;
      }
      break;

    case ST_VERTICAL:
      p1 = bbox[BOXRIGHT] < v1.x ? 1 : 0;
      p2 = bbox[BOXLEFT] < v1.x ? 1 : 0;
      if (linedef.dy < 0) {
        p1 ^= 1;
        p2 ^= 1;
      }
      break;

    case ST_POSITIVE:
      p1 = pointOnSegSide(bbox[BOXLEFT], bbox[BOXTOP], v1.x, v1.y, linedef.dx, linedef.dy);
      p2 = pointOnSegSide(bbox[BOXRIGHT], bbox[BOXBOTTOM], v1.x, v1.y, linedef.dx, linedef.dy);
      break;

    case ST_NEGATIVE:
      p1 = pointOnSegSide(bbox[BOXRIGHT], bbox[BOXTOP], v1.x, v1.y, linedef.dx, linedef.dy);
      p2 = pointOnSegSide(bbox[BOXLEFT], bbox[BOXBOTTOM], v1.x, v1.y, linedef.dx, linedef.dy);
      break;

    default:
      p1 = 0;
      p2 = 0;
      break;
  }

  if (p1 === p2) {
    return p1;
  }
  return -1;
}

// ── P_CheckPosition result ───────────────────────────────────────────

/** Mutable result state from P_CheckPosition. */
export interface CheckPositionResult {
  /** Whether the position check passed (thing fits). */
  passed: boolean;
  /** Adjusted floor z from contacted sectors. */
  floorz: Fixed;
  /** Adjusted ceiling z from contacted sectors. */
  ceilingz: Fixed;
  /** Lowest floor of contacted sectors (for dropoff check). */
  dropoffz: Fixed;
  /** Linedef index that limits the ceiling, or -1. */
  ceilingline: number;
  /** Linedef indices with non-zero special that were crossed, capped to Chocolate Doom's 20-entry spechit buffer. */
  specials: number[];
}

// ── Side effect callbacks ────────────────────────────────────────────

/** Callback matching P_DamageMobj signature. */
export type DamageMobjFunction = (target: Mobj, inflictor: Mobj | null, source: Mobj | null, damage: number) => void;

/** Callback matching P_TouchSpecialThing signature. */
export type TouchSpecialFunction = (special: Mobj, toucher: Mobj) => void;

/**
 * Optional callbacks for combat and pickup side effects.
 *
 * These are wired by later steps; when absent, PIT_CheckThing still
 * makes the correct collision decision but skips the side effect.
 */
export interface CheckPositionCallbacks {
  damageMobj?: DamageMobjFunction;
  touchSpecial?: TouchSpecialFunction;
  rng?: DoomRandom;
  thinkerList?: ThinkerList;
}

// ── P_CheckPosition ──────────────────────────────────────────────────

/**
 * Check whether a mobj at a test position would fit.
 *
 * Reproduces P_CheckPosition from Chocolate Doom's p_map.c exactly:
 *
 * 1. Compute bounding box from thing radius around (x, y).
 * 2. Determine base floor/ceiling from the subsector at (x, y).
 * 3. If MF_NOCLIP, return true immediately.
 * 4. Iterate blockmap cells (expanded by MAXRADIUS) for thing overlap
 *    via PIT_CheckThing.
 * 5. Iterate blockmap cells for line crossing via PIT_CheckLine.
 * 6. Adjust floor/ceiling/dropoff from two-sided lines (P_LineOpening).
 * 7. Track special lines crossed.
 *
 * @param thing - The mobj being position-checked.
 * @param x - Test X position in fixed-point.
 * @param y - Test Y position in fixed-point.
 * @param mapData - Parsed map data.
 * @param blocklinks - Block things grid.
 * @param callbacks - Optional combat/pickup callbacks.
 * @returns Mutable result with floor/ceiling adjustments and special list.
 *
 * @example
 * ```ts
 * const result = checkPosition(mobj, newX, newY, mapData, blocklinks);
 * if (result.passed && result.ceilingz - result.floorz >= mobj.height) {
 *   // thing fits at the new position
 * }
 * ```
 */
export function checkPosition(thing: Mobj, x: Fixed, y: Fixed, mapData: MapData, blocklinks: BlockThingsGrid, callbacks: CheckPositionCallbacks = {}): CheckPositionResult {
  const tmflags = thing.flags;
  const radius = thing.radius;

  const bboxTop = (y + radius) | 0;
  const bboxBottom = (y - radius) | 0;
  const bboxRight = (x + radius) | 0;
  const bboxLeft = (x - radius) | 0;
  const tmbbox: [Fixed, Fixed, Fixed, Fixed] = [bboxTop, bboxBottom, bboxLeft, bboxRight];

  const sectorIndex = sectorIndexAt(x, y, mapData.nodes, mapData.subsectorSectors);
  const sector = mapData.sectors[sectorIndex]!;

  const result: CheckPositionResult = {
    passed: true,
    floorz: sector.floorheight,
    ceilingz: sector.ceilingheight,
    dropoffz: sector.floorheight,
    ceilingline: -1,
    specials: [],
  };
  const spechitState: SpechitOverrunState = {
    tmbbox,
    crushchange: 0,
    nofit: 0,
  };

  incrementValidCount(mapData.validCount);

  if ((tmflags & MF_NOCLIP) !== 0) {
    return result;
  }

  const blockmap = mapData.blockmap;

  // Thing checks (bounding box expanded by MAXRADIUS for blockmap margin).
  const thingXl = ((bboxLeft - blockmap.originX - MAXRADIUS) | 0) >> MAPBLOCKSHIFT;
  const thingXh = ((bboxRight - blockmap.originX + MAXRADIUS) | 0) >> MAPBLOCKSHIFT;
  const thingYl = ((bboxBottom - blockmap.originY - MAXRADIUS) | 0) >> MAPBLOCKSHIFT;
  const thingYh = ((bboxTop - blockmap.originY + MAXRADIUS) | 0) >> MAPBLOCKSHIFT;

  for (let bx = thingXl; bx <= thingXh; bx++) {
    for (let by = thingYl; by <= thingYh; by++) {
      if (!blockThingsIterator(bx, by, blockmap, blocklinks, (other) => pitCheckThing(other, thing, x, y, tmflags, callbacks))) {
        result.passed = false;
        return result;
      }
    }
  }

  // Line checks (bounding box without MAXRADIUS expansion).
  const lineXl = ((bboxLeft - blockmap.originX) | 0) >> MAPBLOCKSHIFT;
  const lineXh = ((bboxRight - blockmap.originX) | 0) >> MAPBLOCKSHIFT;
  const lineYl = ((bboxBottom - blockmap.originY) | 0) >> MAPBLOCKSHIFT;
  const lineYh = ((bboxTop - blockmap.originY) | 0) >> MAPBLOCKSHIFT;

  for (let bx = lineXl; bx <= lineXh; bx++) {
    for (let by = lineYl; by <= lineYh; by++) {
      if (!blockLinesIterator(bx, by, blockmap, mapData.validCount, (linedefIndex) => pitCheckLine(linedefIndex, tmbbox, thing, mapData, result, spechitState))) {
        result.passed = false;
        return result;
      }
    }
  }

  return result;
}

// ── PIT_CheckThing ───────────────────────────────────────────────────

/**
 * PIT_CheckThing: blockmap thing-overlap callback.
 *
 * Matches PIT_CheckThing from Chocolate Doom's p_map.c. Collision
 * decisions (return true/false) are always correct; combat and pickup
 * side effects are delegated to the callbacks object and are no-ops
 * when the callbacks are not yet wired.
 */
function pitCheckThing(other: Mobj, tmthing: Mobj, tmx: Fixed, tmy: Fixed, tmflags: number, callbacks: CheckPositionCallbacks): boolean {
  if ((other.flags & (MF_SOLID | MF_SPECIAL | MF_SHOOTABLE)) === 0) {
    return true;
  }

  const blockdist = (other.radius + tmthing.radius) | 0;

  if (Math.abs((other.x - tmx) | 0) >= blockdist || Math.abs((other.y - tmy) | 0) >= blockdist) {
    return true;
  }

  if (other === tmthing) {
    return true;
  }

  // Skull fly slam.
  if ((tmflags & MF_SKULLFLY) !== 0) {
    if (callbacks.rng !== undefined && callbacks.damageMobj !== undefined) {
      const damage = ((callbacks.rng.pRandom() % 8) + 1) * (tmthing.info?.damage ?? 0);
      callbacks.damageMobj(other, tmthing, tmthing, damage);
    }
    tmthing.flags &= ~MF_SKULLFLY;
    tmthing.momx = 0;
    tmthing.momy = 0;
    tmthing.momz = 0;
    if (callbacks.thinkerList !== undefined && tmthing.info !== null) {
      setMobjState(tmthing, tmthing.info.spawnstate, callbacks.thinkerList);
    }
    return false;
  }

  // Missile collision.
  if ((tmflags & MF_MISSILE) !== 0) {
    if (tmthing.z > ((other.z + other.height) | 0)) {
      return true;
    }
    if (((tmthing.z + tmthing.height) | 0) < other.z) {
      return true;
    }

    if (tmthing.target !== null && (tmthing.target.type === other.type || (tmthing.target.type === MobjType.KNIGHT && other.type === MobjType.BRUISER) || (tmthing.target.type === MobjType.BRUISER && other.type === MobjType.KNIGHT))) {
      if (other === tmthing.target) {
        return true;
      }
      if (other.type !== MobjType.PLAYER) {
        return false;
      }
    }

    if ((other.flags & MF_SHOOTABLE) === 0) {
      return (other.flags & MF_SOLID) === 0;
    }

    if (callbacks.rng !== undefined && callbacks.damageMobj !== undefined) {
      const damage = ((callbacks.rng.pRandom() % 8) + 1) * (tmthing.info?.damage ?? 0);
      callbacks.damageMobj(other, tmthing, tmthing.target, damage);
    }
    return false;
  }

  // Special pickup.
  if ((other.flags & MF_SPECIAL) !== 0) {
    const solid = (other.flags & MF_SOLID) !== 0;
    if ((tmflags & MF_PICKUP) !== 0 && callbacks.touchSpecial !== undefined) {
      callbacks.touchSpecial(other, tmthing);
    }
    return !solid;
  }

  return (other.flags & MF_SOLID) === 0;
}

// ── PIT_CheckLine ────────────────────────────────────────────────────

/**
 * PIT_CheckLine: blockmap line-crossing callback.
 *
 * Matches PIT_CheckLine from Chocolate Doom's p_map.c. Adjusts the
 * result's floor/ceiling/dropoff from two-sided line openings and
 * tracks special lines crossed.
 */
function pitCheckLine(linedefIndex: number, tmbbox: [Fixed, Fixed, Fixed, Fixed], tmthing: Mobj, mapData: MapData, result: CheckPositionResult, spechitState: SpechitOverrunState): boolean {
  const linedef = mapData.linedefs[linedefIndex]!;

  // AABB non-overlap test.
  if (tmbbox[BOXRIGHT] <= linedef.bbox[BOXLEFT] || tmbbox[BOXLEFT] >= linedef.bbox[BOXRIGHT] || tmbbox[BOXTOP] <= linedef.bbox[BOXBOTTOM] || tmbbox[BOXBOTTOM] >= linedef.bbox[BOXTOP]) {
    return true;
  }

  // Box-on-line-side test: if entirely on one side, not crossing.
  if (boxOnLineSide(tmbbox, linedefIndex, mapData) !== -1) {
    return true;
  }

  // One-sided line: always blocks.
  const ls = mapData.lineSectors[linedefIndex]!;
  if (ls.backsector === -1) {
    return false;
  }

  // Blocking flags (missiles skip these checks).
  if ((tmthing.flags & MF_MISSILE) === 0) {
    if ((linedef.flags & ML_BLOCKING) !== 0) {
      return false;
    }
    if (tmthing.player == null && (linedef.flags & ML_BLOCKMONSTERS) !== 0) {
      return false;
    }
  }

  // Compute line opening and adjust floor/ceiling.
  const opening = lineOpening(linedefIndex, mapData);

  if (opening.opentop < result.ceilingz) {
    result.ceilingz = opening.opentop;
    result.ceilingline = linedefIndex;
  }

  if (opening.openbottom > result.floorz) {
    result.floorz = opening.openbottom;
  }

  if (opening.lowfloor < result.dropoffz) {
    result.dropoffz = opening.lowfloor;
  }

  // Track special lines.
  if (linedef.special !== 0) {
    const numspechit = result.specials.length + 1;

    if (result.specials.length < MAXSPECIALCROSS) {
      result.specials.push(linedefIndex);
    }

    if (numspechit > MAXSPECIALCROSS_ORIGINAL) {
      spechitOverrun(linedefIndex, numspechit, spechitState);
    }
  }

  return true;
}
