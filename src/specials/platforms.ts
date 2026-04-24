/**
 * Lift / platform specials (p_plats.c).
 *
 * Implements the five plat types from vanilla Doom 1.9 via the
 * {@link Platform} thinker, the {@link tPlatRaise} action, the
 * line-action helpers {@link evDoPlat} and {@link evStopPlat}, the
 * stasis-wakeup helper {@link pActivateInStasis}, and the fixed-slot
 * {@link ActivePlats} registry.
 *
 * Parity-critical behavior preserved byte-for-byte from Chocolate Doom
 * 2.2.1:
 *
 * - Plats only move the FLOOR plane: `T_MovePlane` is always called
 *   with `floorOrCeiling = 0`.  Direction `1` is used in the up branch,
 *   `-1` in the down branch — the same ints used as the
 *   {@link PlatStatus} sentinels for `up` and `down`.
 * - The down branch calls `T_MovePlane` with `crush = false`
 *   unconditionally, ignoring `plat.crush` — vanilla `p_plats.c`
 *   passes `false` literally, only the up branch consults `plat.crush`.
 * - The crush-reverse path (`up → down`) ONLY fires when
 *   `plat.crush === false`.  EV_DoPlat sets `crush = false` for every
 *   plat type, so this is the always-true case in practice.  The crush
 *   reverse plays `sfx_pstart`.
 * - On up-branch pastdest, every plat type plays `sfx_pstop` and
 *   transitions to `waiting`.  Then `downWaitUpStay`, `blazeDWUS`,
 *   `raiseAndChange`, and `raiseToNearestAndChange` are removed via
 *   {@link ActivePlats.remove}; `perpetualRaise` is the only type that
 *   keeps cycling.
 * - During an up move, `raiseAndChange` and `raiseToNearestAndChange`
 *   restart `sfx_stnmov` every 8 leveltime tics (`!(leveltime & 7)`).
 *   Other types are silent during travel.
 * - The waiting branch decrements `count`; on zero it picks the next
 *   direction by checking whether the floor sits at `low` (then go up)
 *   or anywhere else (then go down) and plays `sfx_pstart`.
 * - The waiting branch in vanilla falls through to `in_stasis` (no
 *   `break` between cases).  Both cases are no-ops past the count
 *   check, so the missing break is observationally identical to
 *   having one.  We model both cases explicitly.
 * - {@link evDoPlat} for `perpetualRaise` calls
 *   {@link pActivateInStasis} BEFORE iterating sectors, even when
 *   the line-tag iteration creates no new plats.  The return value
 *   only reflects newly-created plats (matches vanilla `rtn`).
 * - {@link evDoPlat} clamps `low` to `floorheight` so a sector whose
 *   neighbors are all higher does not push the floor *up* via the
 *   down branch (`if (plat->low > sec->floorheight) plat->low = sec->floorheight`).
 *   The same clamp applies to `perpetualRaise`'s `high`.
 * - `raiseToNearestAndChange` and `raiseAndChange` clear `wait` to
 *   0 — a destination-reached plat enters `waiting`, decrements to
 *   `-1` immediately, then takes whichever direction matches the
 *   reached height.  Both are removed in the same tic before that
 *   matters.  `raiseToNearestAndChange` ALSO clears
 *   `sec.special` so the sector special (e.g. damage) stops once
 *   the lift completes.
 * - {@link evStopPlat} sets `oldstatus = status`, `status = in_stasis`,
 *   and detaches the action (`action = null`) — the thinker stays in
 *   the ring but is skipped by `T_PlatRaise` until
 *   {@link pActivateInStasis} re-attaches `tPlatRaise` and restores
 *   the saved `oldstatus`.
 * - {@link ActivePlats} mirrors the vanilla 30-slot fixed array; the
 *   first NULL slot wins on add.  Overflow throws to surface the
 *   vanilla `I_Error("P_AddActivePlat: no more plats!")`.  Removal
 *   clears `sector.specialdata` and marks the thinker `REMOVED` so
 *   `ThinkerList.run` unlinks it on the next tic.
 *
 * Plats reuse {@link PlaneMoveResult} from {@link ./doors.ts} since
 * vanilla `T_MovePlane` returns the same enum to both door and plat
 * thinkers.  Floor lookup callbacks
 * (`findLowestFloorSurrounding`, `findHighestFloorSurrounding`,
 * `findNextHighestFloor`) are injected via {@link PlatCallbacks} so
 * later steps can share a single implementation across plats, floor
 * movers, and ceiling movers without cyclic imports.
 *
 * @example
 * ```ts
 * import { evDoPlat, PlatType, ActivePlats } from "../src/specials/platforms.ts";
 * const created = evDoPlat(
 *   line, PlatType.downWaitUpStay, 0, sectors, thinkerList, plats, callbacks,
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

/** 35 Hz tic rate matching {@link PRIMARY_TARGET.ticRate}. */
export const TICRATE = 35;

/** Base plat speed (FRACUNIT per tic).  Per-type multipliers below. */
export const PLATSPEED: Fixed = FRACUNIT;

/** Wait seconds at the rest position; total tics = `TICRATE * PLATWAIT`. */
export const PLATWAIT = 3;

/** Tics a `downWaitUpStay` / `perpetualRaise` plat waits at rest. */
export const PLATWAIT_TICS = TICRATE * PLATWAIT;

/** Vanilla cap on simultaneous active plats; overflow is a fatal error. */
export const MAXPLATS = 30;

// ── Sound effects (sounds.h sfxenum_t indices) ─────────────────────

/** sfx_pstart — plat begins moving (down-start, waiting→move, crush-reverse). */
export const SFX_PSTART = 18;

/** sfx_pstop — plat reached destination (up-pastdest, down-pastdest). */
export const SFX_PSTOP = 19;

/** sfx_stnmov — stone-on-stone scrape played by raiseAndChange variants. */
export const SFX_STNMOV = 22;

// ── Enums ──────────────────────────────────────────────────────────

/** plat_e from p_spec.h, in canonical source order. */
export const enum PlatStatus {
  /** Floor moving upward toward `high`. */
  up = 0,
  /** Floor moving downward toward `low`. */
  down = 1,
  /** Resting at end of move; counts down to next move. */
  waiting = 2,
  /** Suspended by EV_StopPlat; resumed by {@link pActivateInStasis}. */
  inStasis = 3,
}

/** plattype_e from p_spec.h, in canonical source order. */
export const enum PlatType {
  /** Bounce between low and high forever. */
  perpetualRaise = 0,
  /** Lower, wait `PLATWAIT_TICS`, raise back, remove. */
  downWaitUpStay = 1,
  /** Raise by `amount` units, change floorpic to the line's front sector, remove. */
  raiseAndChange = 2,
  /** Raise to next-highest neighbor floor, change floorpic, clear `sec.special`, remove. */
  raiseToNearestAndChange = 3,
  /** Blaze-speed `downWaitUpStay`. */
  blazeDWUS = 4,
}

// ── Sector / line / callbacks ──────────────────────────────────────

/**
 * The mutable per-sector state a plat touches.  Mirrors the door
 * contract with the addition of `floorpic` (mutated by
 * `raiseAndChange` / `raiseToNearestAndChange`) and the
 * `floorheight`-only travel surface (plats never touch ceilings).
 */
export interface PlatSector {
  floorheight: Fixed;
  ceilingheight: Fixed;
  floorpic: number;
  special: number;
  specialdata: ThinkerNode | null;
  readonly tag: number;
}

/**
 * Linedef view used by {@link evDoPlat}.  `frontFloorpic` is the
 * floorpic of the front sidedef's sector, which vanilla copies into
 * each new `raiseAndChange` / `raiseToNearestAndChange` plat sector.
 * Plat types that do not change the floorpic ignore the field, so
 * callers may pass any value (typically `0`).
 */
export interface PlatLine {
  readonly tag: number;
  readonly frontFloorpic: number;
}

/**
 * Side-effect bridge for plats.  All side effects (plane motion,
 * sounds, RNG, level time, neighbor lookup) are injected here so
 * future floor/ceiling movers can share one implementation without
 * cyclic imports.
 */
export interface PlatCallbacks {
  /**
   * T_MovePlane(sector, speed, destheight, crush, floorOrCeiling,
   * direction).  Plats always pass `floorOrCeiling = 0`.
   */
  movePlane(sector: PlatSector, speed: Fixed, destheight: Fixed, crush: boolean, floorOrCeiling: 0 | 1, direction: -1 | 1): PlaneMoveResult;

  /** P_FindLowestFloorSurrounding — minimum neighbor floorheight. */
  findLowestFloorSurrounding(sector: PlatSector): Fixed;

  /** P_FindHighestFloorSurrounding — maximum neighbor floorheight (default `-500*FRACUNIT`). */
  findHighestFloorSurrounding(sector: PlatSector): Fixed;

  /** P_FindNextHighestFloor — minimum neighbor floor strictly greater than `currentHeight`. */
  findNextHighestFloor(sector: PlatSector, currentHeight: Fixed): Fixed;

  /** S_StartSound at the plat sector's soundorg.  Non-fatal if omitted. */
  startSectorSound?(sector: PlatSector, sfx: number): void;

  /**
   * P_Random — gameplay-deterministic 0–255 stream.  Used only by
   * `perpetualRaise` to randomize the initial direction
   * (`P_Random()&1`).
   */
  pRandom(): number;

  /**
   * Current `leveltime` in tics.  Read each tic by
   * `raiseAndChange` and `raiseToNearestAndChange` to gate
   * `sfx_stnmov` (`!(leveltime & 7)`).
   */
  getLevelTime(): number;
}

// ── Thinker ────────────────────────────────────────────────────────

/**
 * plat_t from p_spec.h.  Extends {@link ThinkerNode} so it threads
 * through the standard thinker ring; the action is {@link tPlatRaise}.
 */
export class Platform extends ThinkerNode {
  sector: PlatSector;
  type: PlatType;
  speed: Fixed = PLATSPEED;
  low: Fixed = 0;
  high: Fixed = 0;
  wait: number = 0;
  count: number = 0;
  status: PlatStatus = PlatStatus.up;
  oldstatus: PlatStatus = PlatStatus.up;
  crush: boolean = false;
  tag: number = 0;
  callbacks: PlatCallbacks;

  constructor(sector: PlatSector, type: PlatType, callbacks: PlatCallbacks) {
    super();
    this.sector = sector;
    this.type = type;
    this.callbacks = callbacks;
  }
}

// ── ActivePlats registry ──────────────────────────────────────────

/**
 * Fixed-slot registry mirroring `activeplats[MAXPLATS]` from
 * `p_plats.c`.  The first NULL slot wins on {@link add}; overflow
 * throws to surface vanilla `I_Error("P_AddActivePlat: no more
 * plats!")`.  {@link remove} clears `sector.specialdata` and marks
 * the thinker `REMOVED` so {@link ThinkerList.run} unlinks it on the
 * next tic.
 *
 * The registry is iteration-friendly for {@link evStopPlat} and
 * {@link pActivateInStasis}, which scan every slot.
 */
export class ActivePlats {
  readonly slots: (Platform | null)[] = new Array(MAXPLATS).fill(null);

  /** P_AddActivePlat: insert into the first empty slot. */
  add(plat: Platform): void {
    for (let i = 0; i < MAXPLATS; i++) {
      if (this.slots[i] === null) {
        this.slots[i] = plat;
        return;
      }
    }
    throw new Error('P_AddActivePlat: no more plats!');
  }

  /**
   * P_RemoveActivePlat: free the slot, clear the sector's
   * specialdata pointer, and mark the thinker for deferred removal.
   * Throws if the plat is not in the registry — vanilla behavior.
   */
  remove(plat: Platform): void {
    for (let i = 0; i < MAXPLATS; i++) {
      if (this.slots[i] === plat) {
        plat.sector.specialdata = null;
        plat.action = REMOVED;
        this.slots[i] = null;
        return;
      }
    }
    throw new Error("P_RemoveActivePlat: can't find plat!");
  }
}

// ── T_PlatRaise (per-tic thinker action) ──────────────────────────

/**
 * T_PlatRaise: per-tic think function for every active, non-stasis
 * plat.  Mirrors the canonical p_plats.c switch on {@link Platform.status}.
 *
 * - {@link PlatStatus.up}: T_MovePlane up; on pastdest enter waiting
 *   (and remove for non-perpetual types); on crushed (with crush=false)
 *   reverse to down and play `sfx_pstart`.  Re-plays `sfx_stnmov`
 *   every 8 leveltime tics for `raiseAndChange` /
 *   `raiseToNearestAndChange`.
 * - {@link PlatStatus.down}: T_MovePlane down (crush forced false);
 *   on pastdest enter waiting and play `sfx_pstop`.
 * - {@link PlatStatus.waiting}: count down, on zero pick direction
 *   (up if at `low`, down otherwise) and play `sfx_pstart`.
 * - {@link PlatStatus.inStasis}: no-op.  In vanilla a stasised plat
 *   has its action detached; this case only fires if T_PlatRaise is
 *   somehow invoked on an in-stasis plat (defensive parity).
 *
 * The plat is removed via {@link ActivePlats.remove}, which both
 * clears `sector.specialdata` and sets `action = REMOVED`.  The
 * registry must be passed via a closure-capturing wrapper or via
 * direct mutation after creation; T_PlatRaise itself does not own
 * the registry reference.  In practice, {@link evDoPlat} sets up
 * the action with a reference to the registry through closure, so
 * call this directly only in tests with a known plat instance.
 */
export function tPlatRaise(thinker: ThinkerNode, plats: ActivePlats): void {
  const plat = thinker as Platform;
  const callbacks = plat.callbacks;

  switch (plat.status) {
    case PlatStatus.up: {
      const res = callbacks.movePlane(plat.sector, plat.speed, plat.high, plat.crush, 0, 1);

      if (plat.type === PlatType.raiseAndChange || plat.type === PlatType.raiseToNearestAndChange) {
        if ((callbacks.getLevelTime() & 7) === 0) {
          callbacks.startSectorSound?.(plat.sector, SFX_STNMOV);
        }
      }

      if (res === PlaneMoveResult.crushed && !plat.crush) {
        plat.count = plat.wait;
        plat.status = PlatStatus.down;
        callbacks.startSectorSound?.(plat.sector, SFX_PSTART);
      } else if (res === PlaneMoveResult.pastdest) {
        plat.count = plat.wait;
        plat.status = PlatStatus.waiting;
        callbacks.startSectorSound?.(plat.sector, SFX_PSTOP);

        switch (plat.type) {
          case PlatType.blazeDWUS:
          case PlatType.downWaitUpStay:
          case PlatType.raiseAndChange:
          case PlatType.raiseToNearestAndChange:
            plats.remove(plat);
            break;
          default:
            break;
        }
      }
      break;
    }

    case PlatStatus.down: {
      const res = callbacks.movePlane(plat.sector, plat.speed, plat.low, false, 0, -1);
      if (res === PlaneMoveResult.pastdest) {
        plat.count = plat.wait;
        plat.status = PlatStatus.waiting;
        callbacks.startSectorSound?.(plat.sector, SFX_PSTOP);
      }
      break;
    }

    case PlatStatus.waiting: {
      plat.count--;
      if (plat.count === 0) {
        if (plat.sector.floorheight === plat.low) {
          plat.status = PlatStatus.up;
        } else {
          plat.status = PlatStatus.down;
        }
        callbacks.startSectorSound?.(plat.sector, SFX_PSTART);
      }
      break;
    }

    case PlatStatus.inStasis:
    default:
      break;
  }
}

// ── EV_DoPlat (line-tag batch creation) ───────────────────────────

/**
 * EV_DoPlat: create plats in every untagged-active sector whose
 * `tag` matches `line.tag`.  For `perpetualRaise`, first wakes any
 * stasised plats with the same tag (vanilla switch BEFORE the
 * iteration).  Returns 1 if at least one new plat was created, 0
 * otherwise — the in-stasis activation does not count.
 *
 * The `amount` argument is consumed only by `raiseAndChange` (raise
 * the floor by `amount * FRACUNIT`).  Other types ignore it.
 *
 * Sound policy mirrors vanilla:
 * - `downWaitUpStay`, `blazeDWUS`, `perpetualRaise` play
 *   `sfx_pstart` immediately (the plat begins moving).
 * - `raiseAndChange`, `raiseToNearestAndChange` play `sfx_stnmov`
 *   immediately (the stone scrape continues every 8 tics during
 *   travel).
 *
 * Floor-clamp parity:
 * - `low = min(findLowestFloorSurrounding(sec), sec.floorheight)`
 * - For `perpetualRaise`: `high = max(findHighestFloorSurrounding(sec),
 *   sec.floorheight)`
 *
 * Floorpic parity (`raiseAndChange`, `raiseToNearestAndChange`):
 * `sec.floorpic = line.frontFloorpic` is set BEFORE the plat begins
 * moving.  The visual change is immediate; the height move follows.
 */
export function evDoPlat(line: PlatLine, type: PlatType, amount: number, sectors: readonly PlatSector[], thinkerList: ThinkerList, plats: ActivePlats, callbacks: PlatCallbacks): number {
  if (type === PlatType.perpetualRaise) {
    pActivateInStasis(line.tag, plats);
  }

  let created = 0;
  for (const sector of sectors) {
    if (sector.tag !== line.tag) continue;
    if (sector.specialdata !== null) continue;

    const plat = new Platform(sector, type, callbacks);
    plat.action = (t) => tPlatRaise(t, plats);
    plat.crush = false;
    plat.tag = line.tag;
    sector.specialdata = plat;
    thinkerList.add(plat);

    switch (type) {
      case PlatType.raiseToNearestAndChange:
        plat.speed = (PLATSPEED / 2) | 0;
        sector.floorpic = line.frontFloorpic;
        plat.high = callbacks.findNextHighestFloor(sector, sector.floorheight);
        plat.wait = 0;
        plat.status = PlatStatus.up;
        sector.special = 0;
        callbacks.startSectorSound?.(sector, SFX_STNMOV);
        break;
      case PlatType.raiseAndChange:
        plat.speed = (PLATSPEED / 2) | 0;
        sector.floorpic = line.frontFloorpic;
        plat.high = (sector.floorheight + amount * FRACUNIT) | 0;
        plat.wait = 0;
        plat.status = PlatStatus.up;
        callbacks.startSectorSound?.(sector, SFX_STNMOV);
        break;
      case PlatType.downWaitUpStay:
        plat.speed = (PLATSPEED * 4) | 0;
        plat.low = callbacks.findLowestFloorSurrounding(sector);
        if (plat.low > sector.floorheight) plat.low = sector.floorheight;
        plat.high = sector.floorheight;
        plat.wait = PLATWAIT_TICS;
        plat.status = PlatStatus.down;
        callbacks.startSectorSound?.(sector, SFX_PSTART);
        break;
      case PlatType.blazeDWUS:
        plat.speed = (PLATSPEED * 8) | 0;
        plat.low = callbacks.findLowestFloorSurrounding(sector);
        if (plat.low > sector.floorheight) plat.low = sector.floorheight;
        plat.high = sector.floorheight;
        plat.wait = PLATWAIT_TICS;
        plat.status = PlatStatus.down;
        callbacks.startSectorSound?.(sector, SFX_PSTART);
        break;
      case PlatType.perpetualRaise:
        plat.speed = PLATSPEED;
        plat.low = callbacks.findLowestFloorSurrounding(sector);
        if (plat.low > sector.floorheight) plat.low = sector.floorheight;
        plat.high = callbacks.findHighestFloorSurrounding(sector);
        if (plat.high < sector.floorheight) plat.high = sector.floorheight;
        plat.wait = PLATWAIT_TICS;
        plat.status = (callbacks.pRandom() & 1) as PlatStatus;
        callbacks.startSectorSound?.(sector, SFX_PSTART);
        break;
      default:
        break;
    }
    plats.add(plat);
    created = 1;
  }
  return created;
}

// ── EV_StopPlat / P_ActivateInStasis ──────────────────────────────

/**
 * EV_StopPlat: suspend every active, non-stasis plat with a tag
 * matching `line.tag`.  Saves the current status into `oldstatus`,
 * sets `status = inStasis`, and detaches the action so
 * {@link ThinkerList.run} skips the plat.  Vanilla returns void; we
 * follow.
 */
export function evStopPlat(line: PlatLine, plats: ActivePlats): void {
  for (const plat of plats.slots) {
    if (plat === null) continue;
    if (plat.status === PlatStatus.inStasis) continue;
    if (plat.tag !== line.tag) continue;
    plat.oldstatus = plat.status;
    plat.status = PlatStatus.inStasis;
    plat.action = null;
  }
}

/**
 * P_ActivateInStasis: resume every plat with a matching tag that is
 * currently in stasis.  Restores `status = oldstatus` and re-attaches
 * {@link tPlatRaise} as the action.  Called by {@link evDoPlat} for
 * the `perpetualRaise` type before iterating sectors.
 */
export function pActivateInStasis(tag: number, plats: ActivePlats): void {
  for (const plat of plats.slots) {
    if (plat === null) continue;
    if (plat.tag !== tag) continue;
    if (plat.status !== PlatStatus.inStasis) continue;
    plat.status = plat.oldstatus;
    plat.action = (t) => tPlatRaise(t, plats);
  }
}
