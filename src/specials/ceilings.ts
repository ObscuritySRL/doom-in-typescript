/**
 * Ceiling movers and crushers (p_ceilng.c).
 *
 * Implements the six `ceiling_e` types via the {@link Ceiling} thinker,
 * the {@link tMoveCeiling} action, the line-action helper
 * {@link evDoCeiling}, the stasis-wakeup helper
 * {@link pActivateInStasisCeiling}, the crush-stop helper
 * {@link evCeilingCrushStop}, and the fixed-slot
 * {@link ActiveCeilings} registry.
 *
 * Parity-critical behavior preserved byte-for-byte from Chocolate Doom
 * 2.2.1:
 *
 * - Ceilings only move the CEILING plane: `T_MovePlane` is always
 *   called with `floorOrCeiling = 1`.  Direction `1` means UP, `-1`
 *   means DOWN, `0` means in-stasis (action detached so
 *   {@link tMoveCeiling} does not fire).
 * - The UP branch passes `crush = false` LITERALLY to `T_MovePlane` —
 *   vanilla never forwards `ceiling.crush` on the upward leg.  Only
 *   the DOWN branch passes `ceiling.crush` through.
 * - Sound policy during travel: every 8 leveltime tics
 *   (`!(leveltime & 7)`) the thinker plays `sfx_stnmov` at the sector
 *   origin — EXCEPT for `silentCrushAndRaise`, which stays silent
 *   during travel in both directions.  The cadence is independent of
 *   direction and of the move result.
 * - UP pastdest:
 *   - `raiseToHighest` → removed via {@link ActiveCeilings.remove}.
 *   - `silentCrushAndRaise` → plays `sfx_pstop` then reverses
 *     (`direction = -1`).
 *   - `fastCrushAndRaise` and `crushAndRaise` → reverse silently
 *     (`direction = -1`).
 *   - Every other type is a no-op at UP pastdest.
 * - DOWN pastdest:
 *   - `silentCrushAndRaise` plays `sfx_pstop`, resets
 *     `speed = CEILSPEED`, and reverses (`direction = 1`).
 *   - `crushAndRaise` resets `speed = CEILSPEED` and reverses.
 *   - `fastCrushAndRaise` reverses WITHOUT resetting speed — vanilla
 *     keeps `CEILSPEED * 2` because fast-crushers never slow during
 *     crush (see below).
 *   - `lowerAndCrush` and `lowerToFloor` → removed via
 *     {@link ActiveCeilings.remove}.
 *   - Every other type is a no-op at DOWN pastdest.
 * - DOWN `crushed` (descent obstructed by an actor):
 *   - `silentCrushAndRaise`, `crushAndRaise`, `lowerAndCrush` drop to
 *     `speed = CEILSPEED / 8` — the canonical "grinding crush" cadence.
 *   - `fastCrushAndRaise`, `lowerToFloor`, `raiseToHighest` keep their
 *     current speed — fast-crushers are intentionally unthrottled.
 * - {@link evDoCeiling} reactivates in-stasis ceilings BEFORE
 *   iterating sectors, but only for `crushAndRaise`,
 *   `silentCrushAndRaise`, and `fastCrushAndRaise` (the three crusher
 *   types).  The vanilla switch relies on a fall-through into
 *   `default: break` — we encode that explicitly.  The return counter
 *   reflects newly-created ceilings only; stasis wakeups do not bump
 *   `rtn`.
 * - {@link evDoCeiling} sets `ceiling.crush = false` before the
 *   per-type switch; only `crushAndRaise`, `silentCrushAndRaise`, and
 *   `fastCrushAndRaise` override to `true`. `lowerAndCrush` and
 *   `lowerToFloor` ship `crush = false`; `lowerAndCrush` gets its
 *   crusher-specific behavior from the 8-unit stop height and the
 *   DOWN-`crushed` speed drop, not from forwarding `crush=true` to
 *   `T_MovePlane`.
 * - The `silentCrushAndRaise` + `crushAndRaise` case in the EV_DoCeiling
 *   switch falls through to `lowerAndCrush`/`lowerToFloor` to share the
 *   bottomheight / direction / speed setup.  Both the silent and
 *   crushAndRaise branches set `topheight = sec.ceilingheight` BEFORE
 *   falling through.  `fastCrushAndRaise` sets its own topheight and
 *   bottomheight without fall-through.  `lowerAndCrush` uses
 *   `bottomheight = floorheight + 8*FRACUNIT`; `lowerToFloor` uses
 *   `bottomheight = floorheight` (no 8-unit clearance).
 * - {@link ActiveCeilings} mirrors the vanilla 30-slot fixed array.
 *   Unlike {@link ../specials/platforms.ts#ActivePlats}, the vanilla
 *   ceiling registry is SILENT on overflow (`P_AddActiveCeiling`
 *   returns without inserting; no I_Error) and SILENT on missing
 *   (`P_RemoveActiveCeiling` exits the loop without ever finding the
 *   entry).  We preserve both parity quirks.
 * - {@link pActivateInStasisCeiling} restores `direction = olddirection`
 *   and re-attaches {@link tMoveCeiling} on every matching entry whose
 *   current `direction === 0` (in-stasis).  Non-matching tag and
 *   non-stasis entries are left alone.
 * - {@link evCeilingCrushStop} saves `olddirection = direction`,
 *   detaches the action (`action = null`), sets `direction = 0`, and
 *   returns 1 if any match was found — vanilla behavior exactly.
 *
 * Ceilings reuse {@link PlaneMoveResult} from {@link ./doors.ts} since
 * vanilla `T_MovePlane` returns the same enum to door, plat, floor,
 * and ceiling thinkers.  Side effects (plane motion, the single
 * neighbor lookup, sound, leveltime) are injected via
 * {@link CeilingCallbacks} so one shared T_MovePlane implementation
 * can serve every special type without cyclic imports.
 *
 * @example
 * ```ts
 * import { evDoCeiling, CeilingType, ActiveCeilings } from "../src/specials/ceilings.ts";
 * const created = evDoCeiling(
 *   line, CeilingType.crushAndRaise, sectors, thinkerList, ceilings, callbacks,
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

/** Base ceiling speed (FRACUNIT per tic).  `fastCrushAndRaise` uses 2x. */
export const CEILSPEED: Fixed = FRACUNIT;

/**
 * Vanilla crush-wait counter in tics.  Defined in p_spec.h for
 * completeness; `p_ceilng.c` itself never reads this value — every
 * ceiling-wait cadence is derived from `leveltime & 7`.  Kept here
 * for future steps that parse savegames or expose ceiling timing.
 */
export const CEILWAIT = 150;

/**
 * Vanilla fixed-slot cap on active ceilings (`MAXCEILINGS` in
 * p_spec.h).  Overflow is silent — see {@link ActiveCeilings.add}.
 */
export const MAXCEILINGS = 30;

/** 8-unit crush clearance baked into every crusher's bottomheight. */
export const CEILING_8_UNIT_OFFSET: Fixed = (8 * FRACUNIT) | 0;

// ── Sound effects (sounds.h sfxenum_t indices) ─────────────────────

/** sfx_stnmov — stone-on-stone scrape played every 8 leveltime tics. */
export const SFX_STNMOV = 22;

/** sfx_pstop — arrival chime played ONLY by `silentCrushAndRaise`. */
export const SFX_PSTOP = 19;

// ── Enums ──────────────────────────────────────────────────────────

/** ceiling_e from p_spec.h, in canonical source order. */
export const enum CeilingType {
  /** Lower ceiling to the sector's floor (no 8-unit clearance). */
  lowerToFloor = 0,
  /** Raise ceiling to the highest surrounding ceiling. */
  raiseToHighest = 1,
  /** Lower ceiling to floor + 8 units; no crush flag. */
  lowerAndCrush = 2,
  /** Full crusher: crush=true, lowers to floor+8, reverses, loops. */
  crushAndRaise = 3,
  /** Fast crusher: crush=true at 2x speed, reverses at full speed always. */
  fastCrushAndRaise = 4,
  /** Silent crusher: crush=true, no scrape during travel, plays sfx_pstop at every pastdest reversal. */
  silentCrushAndRaise = 5,
}

/**
 * Ceiling direction codes.  The integers are passed directly to
 * `T_MovePlane` (−1 / +1) and also double as the in-stasis sentinel
 * (0).  Unlike doors, ceilings do not use an explicit `waiting`
 * state — the action is detached on stasis so
 * {@link tMoveCeiling} never sees the zero value in practice.
 */
export const enum CeilingDirection {
  down = -1,
  inStasis = 0,
  up = 1,
}

// ── Sector / line / callbacks ──────────────────────────────────────

/**
 * The mutable per-sector state a ceiling mover touches.  Note there
 * is no `ceilingpic` or `special` mutation at pastdest — ceilings
 * never rewrite their sector's visuals (floors do via `donutRaise` /
 * `lowerAndChange`; ceilings do not).
 */
export interface CeilingSector {
  floorheight: Fixed;
  ceilingheight: Fixed;
  special: number;
  specialdata: ThinkerNode | null;
  readonly tag: number;
}

/**
 * Linedef view used by {@link evDoCeiling},
 * {@link pActivateInStasisCeiling}, and {@link evCeilingCrushStop}.
 * Only the `tag` is consumed — ceiling movers do not read front-side
 * floorpic / ceilingpic at creation time.
 */
export interface CeilingLine {
  readonly tag: number;
}

/**
 * Side-effect bridge for ceiling movers.  All side effects (plane
 * motion, the neighbor-ceiling lookup, sound, leveltime) are
 * injected here so doors, plats, floors, and ceilings can share one
 * T_MovePlane implementation without cyclic imports.
 */
export interface CeilingCallbacks {
  /**
   * T_MovePlane(sector, speed, destheight, crush, floorOrCeiling,
   * direction).  Ceilings always pass `floorOrCeiling = 1`.  The UP
   * leg passes `crush = false` literally; the DOWN leg passes
   * `ceiling.crush`.
   */
  movePlane(sector: CeilingSector, speed: Fixed, destheight: Fixed, crush: boolean, floorOrCeiling: 0 | 1, direction: -1 | 1): PlaneMoveResult;

  /** P_FindHighestCeilingSurrounding — used by `raiseToHighest`. */
  findHighestCeilingSurrounding(sector: CeilingSector): Fixed;

  /** S_StartSound at the ceiling sector's soundorg.  Non-fatal if omitted. */
  startSectorSound?(sector: CeilingSector, sfx: number): void;

  /**
   * Current `leveltime` in tics.  Read each tic to gate `sfx_stnmov`
   * via `!(leveltime & 7)`.
   */
  getLevelTime(): number;
}

// ── Thinker ────────────────────────────────────────────────────────

/**
 * ceiling_t from p_spec.h.  Extends {@link ThinkerNode} so it threads
 * through the standard thinker ring; the action is
 * {@link tMoveCeiling}.  `olddirection` preserves the pre-stasis
 * direction so {@link pActivateInStasisCeiling} can restart the
 * ceiling at its last active direction.
 */
export class Ceiling extends ThinkerNode {
  sector: CeilingSector;
  type: CeilingType;
  bottomheight: Fixed = 0;
  topheight: Fixed = 0;
  speed: Fixed = CEILSPEED;
  crush: boolean = false;
  direction: CeilingDirection = CeilingDirection.down;
  tag: number = 0;
  olddirection: CeilingDirection = CeilingDirection.down;
  callbacks: CeilingCallbacks;

  constructor(sector: CeilingSector, type: CeilingType, callbacks: CeilingCallbacks) {
    super();
    this.sector = sector;
    this.type = type;
    this.callbacks = callbacks;
  }
}

// ── ActiveCeilings registry ────────────────────────────────────────

/**
 * Fixed 30-slot registry mirroring vanilla `activeceilings[MAXCEILINGS]`.
 * Unlike {@link ../specials/platforms.ts#ActivePlats}, ceiling
 * overflow and missing-lookup are BOTH silent — vanilla
 * `P_AddActiveCeiling` returns without inserting when every slot is
 * taken, and `P_RemoveActiveCeiling` exits its loop without ever
 * matching when the ceiling is not registered.  We preserve both
 * quirks.
 *
 * The registry is iteration-friendly for
 * {@link pActivateInStasisCeiling} and {@link evCeilingCrushStop},
 * which scan every slot.
 */
export class ActiveCeilings {
  readonly slots: (Ceiling | null)[] = new Array(MAXCEILINGS).fill(null);

  /**
   * P_AddActiveCeiling: insert into the first empty slot.  Silently
   * returns without inserting if every slot is occupied — vanilla
   * behavior.
   */
  add(ceiling: Ceiling): void {
    for (let i = 0; i < MAXCEILINGS; i++) {
      if (this.slots[i] === null) {
        this.slots[i] = ceiling;
        return;
      }
    }
  }

  /**
   * P_RemoveActiveCeiling: free the slot, clear the sector's
   * specialdata pointer, and mark the thinker for deferred removal.
   * Silent no-op if the ceiling is not registered — vanilla behavior.
   */
  remove(ceiling: Ceiling): void {
    for (let i = 0; i < MAXCEILINGS; i++) {
      if (this.slots[i] === ceiling) {
        ceiling.sector.specialdata = null;
        ceiling.action = REMOVED;
        this.slots[i] = null;
        return;
      }
    }
  }
}

// ── T_MoveCeiling (per-tic thinker action) ────────────────────────

/**
 * T_MoveCeiling: per-tic think function for every active ceiling.
 * Mirrors the canonical p_ceilng.c switch on {@link Ceiling.direction}.
 *
 * - {@link CeilingDirection.inStasis} (0): no-op.  In vanilla a
 *   stasised ceiling has its action detached; the 0-case exists for
 *   defensive parity.
 * - {@link CeilingDirection.up} (1): T_MovePlane up with
 *   `crush = false` LITERAL; plays `sfx_stnmov` every 8 leveltime
 *   tics (except silent); on pastdest applies the per-type
 *   reversal/removal rules described at the top of this file.
 * - {@link CeilingDirection.down} (-1): T_MovePlane down with
 *   `ceiling.crush`; plays `sfx_stnmov` every 8 leveltime tics
 *   (except silent); on pastdest applies the per-type
 *   reversal/removal rules; on `crushed` slows the three soft
 *   crushers to `CEILSPEED / 8`.
 *
 * The ceiling is removed via {@link ActiveCeilings.remove}, which
 * both clears `sector.specialdata` and sets `action = REMOVED`.
 * {@link evDoCeiling} wires the action through a closure that
 * captures the registry; do not call this directly from thinker-list
 * tests without the same wrapper.
 */
export function tMoveCeiling(thinker: ThinkerNode, ceilings: ActiveCeilings): void {
  const ceiling = thinker as Ceiling;
  const callbacks = ceiling.callbacks;

  switch (ceiling.direction) {
    case CeilingDirection.inStasis:
      break;

    case CeilingDirection.up: {
      const res = callbacks.movePlane(ceiling.sector, ceiling.speed, ceiling.topheight, false, 1, 1);

      if ((callbacks.getLevelTime() & 7) === 0) {
        if (ceiling.type !== CeilingType.silentCrushAndRaise) {
          callbacks.startSectorSound?.(ceiling.sector, SFX_STNMOV);
        }
      }

      if (res === PlaneMoveResult.pastdest) {
        switch (ceiling.type) {
          case CeilingType.raiseToHighest:
            ceilings.remove(ceiling);
            break;

          case CeilingType.silentCrushAndRaise:
            callbacks.startSectorSound?.(ceiling.sector, SFX_PSTOP);
            ceiling.direction = CeilingDirection.down;
            break;

          case CeilingType.fastCrushAndRaise:
          case CeilingType.crushAndRaise:
            ceiling.direction = CeilingDirection.down;
            break;

          default:
            break;
        }
      }
      break;
    }

    case CeilingDirection.down: {
      const res = callbacks.movePlane(ceiling.sector, ceiling.speed, ceiling.bottomheight, ceiling.crush, 1, -1);

      if ((callbacks.getLevelTime() & 7) === 0) {
        if (ceiling.type !== CeilingType.silentCrushAndRaise) {
          callbacks.startSectorSound?.(ceiling.sector, SFX_STNMOV);
        }
      }

      if (res === PlaneMoveResult.pastdest) {
        switch (ceiling.type) {
          case CeilingType.silentCrushAndRaise:
            callbacks.startSectorSound?.(ceiling.sector, SFX_PSTOP);
            ceiling.speed = CEILSPEED;
            ceiling.direction = CeilingDirection.up;
            break;

          case CeilingType.crushAndRaise:
            ceiling.speed = CEILSPEED;
            ceiling.direction = CeilingDirection.up;
            break;

          case CeilingType.fastCrushAndRaise:
            ceiling.direction = CeilingDirection.up;
            break;

          case CeilingType.lowerAndCrush:
          case CeilingType.lowerToFloor:
            ceilings.remove(ceiling);
            break;

          default:
            break;
        }
      } else if (res === PlaneMoveResult.crushed) {
        switch (ceiling.type) {
          case CeilingType.silentCrushAndRaise:
          case CeilingType.crushAndRaise:
          case CeilingType.lowerAndCrush:
            ceiling.speed = (CEILSPEED / 8) | 0;
            break;

          default:
            break;
        }
      }
      break;
    }

    default:
      break;
  }
}

// ── EV_DoCeiling (line-tag batch creation) ────────────────────────

/**
 * EV_DoCeiling: create ceiling movers in every untagged-active
 * sector whose `tag` matches `line.tag`.  For the three crusher
 * types (`crushAndRaise`, `silentCrushAndRaise`, `fastCrushAndRaise`)
 * reactivates any in-stasis ceilings with the same tag BEFORE
 * iterating sectors — vanilla fall-through in the top switch.
 * Returns 1 if at least one NEW ceiling was created, 0 otherwise —
 * stasis wakeups do not count toward `rtn`.
 *
 * Sectors that already have `specialdata` set are skipped without
 * bumping `rtn`.  Each new ceiling is added to `thinkerList` and
 * back-fills `sector.specialdata`.  `crush` defaults to `false`;
 * only the three crusher types override to `true`.
 *
 * Per-type initialization (from p_ceilng.c):
 * - `fastCrushAndRaise`: `crush=true, topheight=sec.ceilingheight,
 *   bottomheight=sec.floorheight + 8*FRACUNIT, direction=down,
 *   speed=CEILSPEED*2`.
 * - `silentCrushAndRaise` / `crushAndRaise`: `crush=true,
 *   topheight=sec.ceilingheight` — then fall through into
 *   `lowerAndCrush` / `lowerToFloor` for the shared bottomheight /
 *   direction / speed setup.
 * - `lowerAndCrush` / `lowerToFloor`: `bottomheight=sec.floorheight
 *   (+ 8*FRACUNIT if NOT lowerToFloor)`, `direction=down,
 *   speed=CEILSPEED`.
 * - `raiseToHighest`: `topheight=findHighestCeilingSurrounding(sec),
 *   direction=up, speed=CEILSPEED`.
 */
export function evDoCeiling(line: CeilingLine, type: CeilingType, sectors: readonly CeilingSector[], thinkerList: ThinkerList, ceilings: ActiveCeilings, callbacks: CeilingCallbacks): number {
  switch (type) {
    case CeilingType.fastCrushAndRaise:
    case CeilingType.silentCrushAndRaise:
    case CeilingType.crushAndRaise:
      pActivateInStasisCeiling(line, ceilings);
      break;
    default:
      break;
  }

  const ceilingAction = (t: ThinkerNode) => tMoveCeiling(t, ceilings);

  let created = 0;
  for (const sector of sectors) {
    if (sector.tag !== line.tag) continue;
    if (sector.specialdata !== null) continue;

    const ceiling = new Ceiling(sector, type, callbacks);
    ceiling.action = ceilingAction;
    ceiling.crush = false;
    ceiling.tag = sector.tag;
    sector.specialdata = ceiling;
    thinkerList.add(ceiling);

    switch (type) {
      case CeilingType.fastCrushAndRaise:
        ceiling.crush = true;
        ceiling.topheight = sector.ceilingheight;
        ceiling.bottomheight = (sector.floorheight + CEILING_8_UNIT_OFFSET) | 0;
        ceiling.direction = CeilingDirection.down;
        ceiling.speed = (CEILSPEED * 2) | 0;
        break;

      case CeilingType.silentCrushAndRaise:
      case CeilingType.crushAndRaise:
        ceiling.crush = true;
        ceiling.topheight = sector.ceilingheight;
        ceiling.bottomheight = (sector.floorheight + CEILING_8_UNIT_OFFSET) | 0;
        ceiling.direction = CeilingDirection.down;
        ceiling.speed = CEILSPEED;
        break;

      case CeilingType.lowerAndCrush:
        ceiling.bottomheight = (sector.floorheight + CEILING_8_UNIT_OFFSET) | 0;
        ceiling.direction = CeilingDirection.down;
        ceiling.speed = CEILSPEED;
        break;

      case CeilingType.lowerToFloor:
        ceiling.bottomheight = sector.floorheight;
        ceiling.direction = CeilingDirection.down;
        ceiling.speed = CEILSPEED;
        break;

      case CeilingType.raiseToHighest:
        ceiling.topheight = callbacks.findHighestCeilingSurrounding(sector);
        ceiling.direction = CeilingDirection.up;
        ceiling.speed = CEILSPEED;
        break;

      default:
        break;
    }

    ceilings.add(ceiling);
    created = 1;
  }
  return created;
}

// ── Stasis helpers ─────────────────────────────────────────────────

/**
 * P_ActivateInStasisCeiling: resume every in-stasis ceiling whose
 * `tag` matches `line.tag`.  Restores `direction = olddirection` and
 * re-attaches {@link tMoveCeiling} as the action.  Called by
 * {@link evDoCeiling} for the three crusher types before iterating
 * sectors, and exported so line-trigger dispatch (step 12-009) can
 * resume suspended crushers on the 73/77/184/185 repeatable lines.
 */
export function pActivateInStasisCeiling(line: CeilingLine, ceilings: ActiveCeilings): void {
  let ceilingAction: ((t: ThinkerNode) => void) | null = null;
  for (const ceiling of ceilings.slots) {
    if (ceiling === null) continue;
    if (ceiling.tag !== line.tag) continue;
    if (ceiling.direction !== CeilingDirection.inStasis) continue;
    ceiling.direction = ceiling.olddirection;
    ceilingAction ??= (t: ThinkerNode) => tMoveCeiling(t, ceilings);
    ceiling.action = ceilingAction;
  }
}

/**
 * EV_CeilingCrushStop: suspend every active, non-stasis ceiling
 * whose `tag` matches `line.tag`.  Saves the current direction into
 * `olddirection`, detaches the action, sets
 * `direction = CeilingDirection.inStasis`, and returns 1 if any
 * match was found (vanilla `rtn`).
 */
export function evCeilingCrushStop(line: CeilingLine, ceilings: ActiveCeilings): number {
  let rtn = 0;
  for (const ceiling of ceilings.slots) {
    if (ceiling === null) continue;
    if (ceiling.tag !== line.tag) continue;
    if (ceiling.direction === CeilingDirection.inStasis) continue;
    ceiling.olddirection = ceiling.direction;
    ceiling.action = null;
    ceiling.direction = CeilingDirection.inStasis;
    rtn = 1;
  }
  return rtn;
}
