/**
 * Floor movers (p_floor.c).
 *
 * Implements the 12 `floor_e` types plus the `donutRaise` slot via the
 * {@link FloorMove} thinker, the {@link tMoveFloor} action, and the
 * line-action helper {@link evDoFloor}.  The donut-pair helper
 * `EV_DoDonut` and the stair builder `EV_BuildStairs` live in a later
 * step (12-006); `donutRaise` appears in this enum because
 * {@link tMoveFloor}'s pastdest branch runs the texture/special swap
 * for donut-raised sectors.
 *
 * Parity-critical behavior preserved byte-for-byte from Chocolate Doom
 * 2.2.1:
 *
 * - Every floor mover plays `sfx_stnmov` every 8 leveltime tics
 *   (`!(leveltime & 7)`), independent of direction and regardless of
 *   whether the move makes progress this tic.  On the arrival tic the
 *   scrape AND the `sfx_pstop` can both fire if `leveltime` happens to
 *   be a multiple of 8.
 * - On pastdest the thinker clears `sector.specialdata`, applies the
 *   type-specific texture/special swap (up + donutRaise, or down +
 *   lowerAndChange), marks the thinker REMOVED, and plays `sfx_pstop`.
 *   No other type touches `sector.floorpic` or `sector.special` at
 *   arrival — the up/down switches are fall-through to `default: break`
 *   so the swap is observationally a single-case match.
 * - {@link evDoFloor} skips sectors that already have `specialdata`
 *   without bumping the return counter (vanilla `rtn` only reflects
 *   newly-created thinkers).  A sector whose tag does not match is
 *   ignored.
 * - `turboLower` raises its destination by 8 units ONLY when the
 *   highest surrounding floor differs from the starting floorheight.
 *   A sector with no strictly-higher neighbor stays at `floorheight`
 *   (no 8-unit bump, no travel).
 * - `raiseFloor` / `raiseFloorCrush` clamp the destination to the
 *   sector's own ceiling, THEN (for `raiseFloorCrush` only) subtract
 *   `8*FRACUNIT` for crush clearance.  Vanilla writes this as
 *   `dest -= 8*FRACUNIT * (type == raiseFloorCrush)`.
 * - `raiseFloorCrush` is the one type that sets `floor.crush = true`.
 *   Every other type ships `crush = false` through {@link FloorCallbacks.movePlane}.
 * - `raiseFloor24AndChange` mutates the destination sector's floorpic
 *   and special IMMEDIATELY at creation time (copying from the line's
 *   front sector), not at pastdest.  The move then proceeds normally.
 * - `lowerAndChange` seeds `floor.texture = sector.floorpic` BEFORE
 *   scanning neighbors.  The first two-sided neighbor whose floorheight
 *   equals the destination wins: its floorpic becomes `floor.texture`,
 *   its special becomes `floor.newspecial`.  If no neighbor matches,
 *   the defaults remain (self-floorpic, newspecial=0).  The swap runs
 *   only at pastdest.
 * - `raiseToTexture` targets `floorheight + findShortestLowerTexture(sec)`.
 *   Vanilla inlines the texture-table scan; we delegate via
 *   {@link FloorCallbacks.findShortestLowerTexture} so the texture
 *   metadata can live outside the specials layer.
 * - `donutRaise` construction is performed by `EV_DoDonut` (step 12-006).
 *   The type's presence here is solely for {@link tMoveFloor}'s
 *   pastdest texture/special swap — `evDoFloor` does NOT construct a
 *   donutRaise mover (the vanilla switch has no `case donutRaise`).
 *   Callers that pass `FloorType.donutRaise` get the bare thinker with
 *   default direction/speed/destheight and are expected to overwrite
 *   those fields after construction.
 *
 * Floors reuse {@link PlaneMoveResult} from {@link ./doors.ts} because
 * vanilla `T_MovePlane` returns the same enum to every consumer (door,
 * plat, floor, ceiling).  Side effects (plane motion, five neighbor
 * lookups, sound, leveltime) are injected via {@link FloorCallbacks}
 * so ceilings and future movers can share one implementation without
 * cyclic imports.
 *
 * @example
 * ```ts
 * import { evDoFloor, FloorType } from "../src/specials/floors.ts";
 * const created = evDoFloor(
 *   line, FloorType.lowerFloorToLowest, sectors, thinkerList, callbacks,
 * );
 * ```
 */

import type { Fixed } from '../core/fixed.ts';
import { FRACUNIT } from '../core/fixed.ts';
import type { ThinkerList } from '../world/thinkers.ts';
import { REMOVED, ThinkerNode } from '../world/thinkers.ts';
import { PlaneMoveResult } from './doors.ts';

export { PlaneMoveResult } from './doors.ts';

// ── Constants ──────────────────────────────────────────────────────

/** Base floor speed (FRACUNIT per tic).  `turboLower` and `raiseFloorTurbo` use 4x. */
export const FLOORSPEED: Fixed = FRACUNIT;

/** 8-unit clearance applied by `turboLower` (dest bump) and `raiseFloorCrush` (dest trim). */
export const FLOOR_8_UNIT_OFFSET: Fixed = (8 * FRACUNIT) | 0;

/** 24-unit raise used by `raiseFloor24` and `raiseFloor24AndChange`. */
export const FLOOR_24_UNIT_OFFSET: Fixed = (24 * FRACUNIT) | 0;

/** 512-unit raise used by `raiseFloor512`. */
export const FLOOR_512_UNIT_OFFSET: Fixed = (512 * FRACUNIT) | 0;

// ── Sound effects (sounds.h sfxenum_t indices) ─────────────────────

/** sfx_stnmov — stone-on-stone scrape played every 8 leveltime tics. */
export const SFX_STNMOV = 22;

/** sfx_pstop — floor arrived at its destination. */
export const SFX_PSTOP = 19;

// ── Enums ──────────────────────────────────────────────────────────

/** floor_e from p_spec.h, in canonical source order. */
export const enum FloorType {
  /** Lower floor to highest surrounding floor. */
  lowerFloor = 0,
  /** Lower floor to lowest surrounding floor. */
  lowerFloorToLowest = 1,
  /** Lower floor to highest surrounding floor at 4x speed; dest bumps +8 units when it differs. */
  turboLower = 2,
  /** Raise floor to lowest surrounding ceiling (clamped to own ceiling). */
  raiseFloor = 3,
  /** Raise floor to next-highest surrounding floor. */
  raiseFloorToNearest = 4,
  /** Raise floor by the shortest neighboring lower-texture height. */
  raiseToTexture = 5,
  /** Lower floor to lowest surrounding floor and copy the neighbor's floorpic/special at pastdest. */
  lowerAndChange = 6,
  /** Raise floor by 24 units. */
  raiseFloor24 = 7,
  /** Raise floor by 24 units and copy the line's front sector floorpic/special at creation. */
  raiseFloor24AndChange = 8,
  /** Raise floor to lowest surrounding ceiling minus 8 units; floor.crush = true. */
  raiseFloorCrush = 9,
  /** Raise floor to next-highest surrounding floor at 4x speed. */
  raiseFloorTurbo = 10,
  /** Donut-pair outer-rim raise thinker; constructed by EV_DoDonut in step 12-006. */
  donutRaise = 11,
  /** Raise floor by 512 units. */
  raiseFloor512 = 12,
}

/** Floor direction codes.  Same integers passed to `T_MovePlane`. */
export const enum FloorDirection {
  down = -1,
  up = 1,
}

// ── Sector / line / callbacks ──────────────────────────────────────

/**
 * The mutable per-sector state a floor mover touches.  `floorpic` and
 * `special` are mutated at creation by `raiseFloor24AndChange` and at
 * pastdest by `donutRaise` / `lowerAndChange`.
 */
export interface FloorSector {
  floorheight: Fixed;
  ceilingheight: Fixed;
  floorpic: number;
  special: number;
  specialdata: ThinkerNode | null;
  readonly tag: number;
}

/**
 * Linedef view used by {@link evDoFloor}.  `frontFloorpic` and
 * `frontSpecial` carry the pre-resolved front sidedef sector's
 * floorpic and special, copied into the destination sector by
 * `raiseFloor24AndChange`.  Types that do not consume either field
 * ignore them — callers may pass `0`.
 */
export interface FloorLine {
  readonly tag: number;
  readonly frontFloorpic: number;
  readonly frontSpecial: number;
}

/**
 * Neighbor-sector snapshot returned by
 * {@link FloorCallbacks.findAdjacentSectorAtFloorHeight}.  The caller
 * stages the fields; only `lowerAndChange` consumes them.
 */
export interface AdjacentSectorFloorMatch {
  readonly floorpic: number;
  readonly special: number;
}

/**
 * Side-effect bridge for floor movers.  All side effects (plane
 * motion, five neighbor lookups, sound, leveltime) are injected here
 * so doors, plats, floors, and ceilings can share one T_MovePlane
 * implementation without cyclic imports.
 */
export interface FloorCallbacks {
  /**
   * T_MovePlane(sector, speed, destheight, crush, floorOrCeiling,
   * direction).  Floors always pass `floorOrCeiling = 0`.
   */
  movePlane(sector: FloorSector, speed: Fixed, destheight: Fixed, crush: boolean, floorOrCeiling: 0 | 1, direction: -1 | 1): PlaneMoveResult;

  /** P_FindLowestFloorSurrounding — minimum neighbor floorheight. */
  findLowestFloorSurrounding(sector: FloorSector): Fixed;

  /** P_FindHighestFloorSurrounding — maximum neighbor floorheight (default `-500*FRACUNIT`). */
  findHighestFloorSurrounding(sector: FloorSector): Fixed;

  /** P_FindNextHighestFloor — minimum neighbor floor strictly greater than `currentHeight`. */
  findNextHighestFloor(sector: FloorSector, currentHeight: Fixed): Fixed;

  /** P_FindLowestCeilingSurrounding — minimum neighbor ceilingheight. */
  findLowestCeilingSurrounding(sector: FloorSector): Fixed;

  /**
   * P_FindShortestLowerTexture — minimum bottom-texture height among
   * two-sided linedefs adjacent to `sector`, in Fixed units.  Vanilla
   * returns `INT_MAX` when no two-sided line has a valid bottom
   * texture; callers should forward that sentinel unchanged.
   */
  findShortestLowerTexture(sector: FloorSector): Fixed;

  /**
   * Walk `sector`'s two-sided linedefs and return the first neighbor
   * sector whose floorheight equals `height`.  Returns `null` when no
   * neighbor matches — `lowerAndChange` then keeps its seeded
   * defaults (sector's own floorpic, `newspecial = 0`).
   */
  findAdjacentSectorAtFloorHeight(sector: FloorSector, height: Fixed): AdjacentSectorFloorMatch | null;

  /** S_StartSound at the floor sector's soundorg.  Non-fatal if omitted. */
  startSectorSound?(sector: FloorSector, sfx: number): void;

  /**
   * Current `leveltime` in tics.  Read each tic to gate `sfx_stnmov`
   * via `!(leveltime & 7)`.
   */
  getLevelTime(): number;
}

// ── Thinker ────────────────────────────────────────────────────────

/**
 * floormove_t from p_spec.h.  Extends {@link ThinkerNode} so it
 * threads through the standard thinker ring; the action is
 * {@link tMoveFloor}.
 */
export class FloorMove extends ThinkerNode {
  sector: FloorSector;
  type: FloorType;
  crush: boolean = false;
  direction: FloorDirection = FloorDirection.up;
  newspecial: number = 0;
  texture: number = 0;
  floordestheight: Fixed = 0;
  speed: Fixed = FLOORSPEED;
  callbacks: FloorCallbacks;

  constructor(sector: FloorSector, type: FloorType, callbacks: FloorCallbacks) {
    super();
    this.sector = sector;
    this.type = type;
    this.callbacks = callbacks;
  }
}

// ── T_MoveFloor (per-tic thinker action) ──────────────────────────

/**
 * T_MoveFloor: per-tic think function for every active floor mover.
 * Mirrors the canonical p_floor.c layout:
 *
 * 1. Call `T_MovePlane` with the stored direction / speed /
 *    destheight / crush.
 * 2. Play `sfx_stnmov` when `(leveltime & 7) === 0`, independent of
 *    the move result.
 * 3. On `pastdest`: clear `sector.specialdata`, apply the
 *    type-specific texture/special swap (up + donutRaise, down +
 *    lowerAndChange), mark the thinker REMOVED, and play `sfx_pstop`.
 *
 * The direction-gated switches are fall-through to `default: break`
 * in vanilla — observationally equivalent to a single-case match.
 * We model them explicitly.
 */
export function tMoveFloor(thinker: ThinkerNode): void {
  const floor = thinker as FloorMove;
  const callbacks = floor.callbacks;

  const res = callbacks.movePlane(floor.sector, floor.speed, floor.floordestheight, floor.crush, 0, floor.direction);

  if ((callbacks.getLevelTime() & 7) === 0) {
    callbacks.startSectorSound?.(floor.sector, SFX_STNMOV);
  }

  if (res === PlaneMoveResult.pastdest) {
    floor.sector.specialdata = null;

    if (floor.direction === FloorDirection.up) {
      if (floor.type === FloorType.donutRaise) {
        floor.sector.special = floor.newspecial;
        floor.sector.floorpic = floor.texture;
      }
    } else if (floor.direction === FloorDirection.down) {
      if (floor.type === FloorType.lowerAndChange) {
        floor.sector.special = floor.newspecial;
        floor.sector.floorpic = floor.texture;
      }
    }

    floor.action = REMOVED;
    callbacks.startSectorSound?.(floor.sector, SFX_PSTOP);
  }
}

// ── EV_DoFloor (line-tag batch creation) ──────────────────────────

/**
 * EV_DoFloor: create floor movers in every untagged-active sector
 * whose `tag` matches `line.tag`.  Returns 1 if at least one mover
 * was created, 0 otherwise — matching vanilla `rtn`.
 *
 * Sectors that already have `specialdata` set are skipped without
 * counting toward `rtn`.  Each new mover is added to `thinkerList`
 * and back-fills `sector.specialdata`.  `crush` is `false` for every
 * type except `raiseFloorCrush`.
 *
 * The canonical vanilla switch has no `case donutRaise` — passing
 * `FloorType.donutRaise` here falls through to `default: break`,
 * leaving direction/speed/destheight at their class defaults.
 * `EV_DoDonut` (step 12-006) constructs donutRaise movers directly
 * and overwrites those fields.
 */
export function evDoFloor(line: FloorLine, type: FloorType, sectors: readonly FloorSector[], thinkerList: ThinkerList, callbacks: FloorCallbacks): number {
  let created = 0;
  for (const sector of sectors) {
    if (sector.tag !== line.tag) continue;
    if (sector.specialdata !== null) continue;

    const floor = new FloorMove(sector, type, callbacks);
    floor.action = tMoveFloor;
    floor.crush = false;
    sector.specialdata = floor;
    thinkerList.add(floor);
    created = 1;

    switch (type) {
      case FloorType.lowerFloor:
        floor.direction = FloorDirection.down;
        floor.speed = FLOORSPEED;
        floor.floordestheight = callbacks.findHighestFloorSurrounding(sector);
        break;

      case FloorType.lowerFloorToLowest:
        floor.direction = FloorDirection.down;
        floor.speed = FLOORSPEED;
        floor.floordestheight = callbacks.findLowestFloorSurrounding(sector);
        break;

      case FloorType.turboLower: {
        floor.direction = FloorDirection.down;
        floor.speed = (FLOORSPEED * 4) | 0;
        let dest = callbacks.findHighestFloorSurrounding(sector);
        if (dest !== sector.floorheight) {
          dest = (dest + FLOOR_8_UNIT_OFFSET) | 0;
        }
        floor.floordestheight = dest;
        break;
      }

      case FloorType.raiseFloor:
      case FloorType.raiseFloorCrush: {
        if (type === FloorType.raiseFloorCrush) floor.crush = true;
        floor.direction = FloorDirection.up;
        floor.speed = FLOORSPEED;
        let dest = callbacks.findLowestCeilingSurrounding(sector);
        if (dest > sector.ceilingheight) dest = sector.ceilingheight;
        if (type === FloorType.raiseFloorCrush) {
          dest = (dest - FLOOR_8_UNIT_OFFSET) | 0;
        }
        floor.floordestheight = dest;
        break;
      }

      case FloorType.raiseFloorTurbo:
        floor.direction = FloorDirection.up;
        floor.speed = (FLOORSPEED * 4) | 0;
        floor.floordestheight = callbacks.findNextHighestFloor(sector, sector.floorheight);
        break;

      case FloorType.raiseFloorToNearest:
        floor.direction = FloorDirection.up;
        floor.speed = FLOORSPEED;
        floor.floordestheight = callbacks.findNextHighestFloor(sector, sector.floorheight);
        break;

      case FloorType.raiseFloor24:
        floor.direction = FloorDirection.up;
        floor.speed = FLOORSPEED;
        floor.floordestheight = (sector.floorheight + FLOOR_24_UNIT_OFFSET) | 0;
        break;

      case FloorType.raiseFloor512:
        floor.direction = FloorDirection.up;
        floor.speed = FLOORSPEED;
        floor.floordestheight = (sector.floorheight + FLOOR_512_UNIT_OFFSET) | 0;
        break;

      case FloorType.raiseFloor24AndChange:
        floor.direction = FloorDirection.up;
        floor.speed = FLOORSPEED;
        floor.floordestheight = (sector.floorheight + FLOOR_24_UNIT_OFFSET) | 0;
        sector.floorpic = line.frontFloorpic;
        sector.special = line.frontSpecial;
        break;

      case FloorType.raiseToTexture: {
        floor.direction = FloorDirection.up;
        floor.speed = FLOORSPEED;
        const minsize = callbacks.findShortestLowerTexture(sector);
        floor.floordestheight = (sector.floorheight + minsize) | 0;
        break;
      }

      case FloorType.lowerAndChange: {
        floor.direction = FloorDirection.down;
        floor.speed = FLOORSPEED;
        const dest = callbacks.findLowestFloorSurrounding(sector);
        floor.floordestheight = dest;
        floor.texture = sector.floorpic;
        const match = callbacks.findAdjacentSectorAtFloorHeight(sector, dest);
        if (match !== null) {
          floor.texture = match.floorpic;
          floor.newspecial = match.special;
        }
        break;
      }

      default:
        break;
    }
  }
  return created;
}
