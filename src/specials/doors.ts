/**
 * Vertical door specials (p_doors.c).
 *
 * Implements the eight door types from vanilla Doom 1.9 via the
 * {@link VerticalDoor} thinker and the line-action helpers
 * {@link evDoDoor}, {@link evVerticalDoor}, and {@link evDoLockedDoor}.
 * Timer-seeded doors for sector specials 10 (close-in-30) and 14
 * (raise-in-5-minutes) are spawned by {@link spawnDoorCloseIn30} and
 * {@link spawnDoorRaiseIn5Mins}.
 *
 * Parity-critical behavior preserved byte-for-byte from Chocolate Doom
 * 2.2.1:
 *
 * - Door direction codes are -1 (closing), 0 (waiting at top), 1
 *   (opening), 2 (initial wait for `raiseIn5Mins`).  They are the same
 *   integers used as the `direction` argument to `T_MovePlane`.
 * - `VDOORSPEED = FRACUNIT*2`, `VDOORWAIT = 150` tics.  Blaze doors use
 *   `VDOORSPEED*4` but share the same `VDOORWAIT`.
 * - Door ceilings open to `P_FindLowestCeilingSurrounding(sec) -
 *   4*FRACUNIT` (the 4-unit gap is the vanilla visual "lip").
 * - Open-only (`vld_open`, `vld_blazeOpen`) zero the triggering line's
 *   special so it can only fire once — this is the only place EV_*
 *   mutates the line.
 * - On close-crush, `vld_close` and `vld_blazeClose` DO NOT reverse
 *   direction; every other type crushes → reverses and plays the normal
 *   (non-blaze) open sound `sfx_doropn`.  This asymmetry is vanilla.
 * - The re-activation path in {@link evVerticalDoor} only applies to
 *   lines 1, 26, 27, 28, 117.  On lines 31-34, 118 it falls through and
 *   overwrites `sec.specialdata` — also vanilla.
 * - Monsters may only re-open a closing door, never close one: if
 *   `player === null` and the door is moving up, re-activation is
 *   silently ignored (JDC comment in source).
 *
 * Doors do not implement `T_MovePlane` directly; the plane-move and
 * neighbor-ceiling lookup are injected via {@link DoorCallbacks} so
 * later steps (ceiling-movers, floor-movers) can share one
 * implementation without cyclic imports.
 *
 * @example
 * ```ts
 * import {
 *   VDOORSPEED,
 *   VerticalDoorType,
 *   evDoDoor,
 *   tVerticalDoor,
 * } from "../src/specials/doors.ts";
 *
 * const created = evDoDoor(
 *   tag,
 *   VerticalDoorType.normal,
 *   sectors,
 *   thinkerList,
 *   callbacks,
 * );
 * ```
 */

import type { Fixed } from '../core/fixed.ts';
import { FRACBITS, FRACUNIT } from '../core/fixed.ts';
import { CardType } from '../player/playerSpawn.ts';
import type { Player } from '../player/playerSpawn.ts';
import type { ThinkerList } from '../world/thinkers.ts';
import { REMOVED, ThinkerNode } from '../world/thinkers.ts';

// ── Constants ──────────────────────────────────────────────────────

/** 35 Hz tic rate matching {@link PRIMARY_TARGET.ticRate}. */
export const TICRATE = 35;

/** Normal door speed (FRACUNIT*2 fixed-point units per tic). */
export const VDOORSPEED: Fixed = (FRACUNIT * 2) | 0;

/** Tics a raised door waits at the top before closing (150 = ~4.3s). */
export const VDOORWAIT = 150;

/** Tics a close30ThenOpen door waits in the closed state (30 seconds). */
export const CLOSE30_TICS = 30 * TICRATE;

/** Tics a raiseIn5Mins door waits before its first raise (5 minutes). */
export const RAISE_IN_5MINS_TICS = 5 * 60 * TICRATE;

/** Clearance between the raised door's topheight and the lowest neighbor. */
export const DOOR_CEILING_OFFSET: Fixed = (4 << FRACBITS) | 0;

// ── Sound effects (sounds.h sfxenum_t indices) ─────────────────────

/** sfx_doropn — normal door open. */
export const SFX_DOROPN = 20;

/** sfx_dorcls — normal door close. */
export const SFX_DORCLS = 21;

/** sfx_oof — locked-door denial bump. */
export const SFX_OOF = 34;

/** sfx_bdopn — blazing (fast) door open. */
export const SFX_BDOPN = 86;

/** sfx_bdcls — blazing (fast) door close. */
export const SFX_BDCLS = 87;

// ── Denial messages ────────────────────────────────────────────────

/** Tagged-door blue key denial ("PD_BLUEO"). */
export const PD_BLUEO = 'You need a blue key to activate this object';

/** Tagged-door red key denial ("PD_REDO"). */
export const PD_REDO = 'You need a red key to activate this object';

/** Tagged-door yellow key denial ("PD_YELLOWO"). */
export const PD_YELLOWO = 'You need a yellow key to activate this object';

/** Manual-door blue key denial ("PD_BLUEK"). */
export const PD_BLUEK = 'You need a blue key to open this door';

/** Manual-door red key denial ("PD_REDK"). */
export const PD_REDK = 'You need a red key to open this door';

/** Manual-door yellow key denial ("PD_YELLOWK"). */
export const PD_YELLOWK = 'You need a yellow key to open this door';

// ── Enums ──────────────────────────────────────────────────────────

/** vldoor_e from p_spec.h, in canonical source order. */
export const enum VerticalDoorType {
  /** Raise, wait `VDOORWAIT`, close. */
  normal = 0,
  /** Close, wait 30 seconds, open. */
  close30ThenOpen = 1,
  /** Close only (no reopen). */
  close = 2,
  /** Open only (one-shot). */
  open = 3,
  /** Wait 5 minutes, then raise as a normal door. */
  raiseIn5Mins = 4,
  /** Blaze-speed raise/wait/close. */
  blazeRaise = 5,
  /** Blaze-speed open only. */
  blazeOpen = 6,
  /** Blaze-speed close only. */
  blazeClose = 7,
}

/** result_e from p_spec.h returned by T_MovePlane. */
export const enum PlaneMoveResult {
  ok = 0,
  crushed = 1,
  pastdest = 2,
}

/** Door direction codes used as both state and T_MovePlane argument. */
export const enum DoorDirection {
  closing = -1,
  waiting = 0,
  opening = 1,
  initialWait = 2,
}

// ── Sector runtime shape ───────────────────────────────────────────

/**
 * The mutable per-sector state a door touches.  This is the minimal
 * contract; later steps introduce a fuller runtime-sector type that
 * will satisfy it.  `specialdata` is the vanilla `specialdata` field
 * (any thinker pointer; doors store themselves here).  `tag` is the
 * static linedef-tag match target; `special` is the sector special
 * that {@link spawnDoorCloseIn30} / {@link spawnDoorRaiseIn5Mins}
 * clear once the timer is armed.
 */
export interface DoorSector {
  ceilingheight: Fixed;
  floorheight: Fixed;
  special: number;
  specialdata: ThinkerNode | null;
  readonly tag: number;
}

// ── Callbacks ──────────────────────────────────────────────────────

/**
 * Side-effect bridge used by every door function.  Keeping these on a
 * callbacks bundle avoids cyclic imports with the ceiling/floor movers
 * and the sound system.
 */
export interface DoorCallbacks {
  /**
   * T_MovePlane(sector, speed, destheight, crush, floorOrCeiling,
   * direction).  Advances `sector.ceilingheight` (floorOrCeiling=1) or
   * `sector.floorheight` (floorOrCeiling=0) one step toward
   * `destheight`.  Returns `pastdest` when clamped to the destination,
   * `crushed` when blocked, `ok` otherwise.  Doors always call with
   * `floorOrCeiling = 1` and `crush = false`.
   */
  movePlane(sector: DoorSector, speed: Fixed, destheight: Fixed, crush: boolean, floorOrCeiling: 0 | 1, direction: -1 | 1): PlaneMoveResult;

  /**
   * P_FindLowestCeilingSurrounding(sec).  Returns the minimum
   * ceilingheight among sectors sharing a two-sided linedef with
   * `sector`, or `sector.ceilingheight` if the sector has no neighbor
   * (doors then have zero travel, matching vanilla).
   */
  findLowestCeilingSurrounding(sector: DoorSector): Fixed;

  /**
   * S_StartSound at the door sector's soundorg.  Non-fatal if omitted.
   */
  startSectorSound?(sector: DoorSector, sfx: number): void;

  /**
   * S_StartSound(NULL, sfx_oof) for player-directed denial.  Non-fatal
   * if omitted.
   */
  startPlayerSound?(sfx: number): void;
}

interface DirectionThinker extends ThinkerNode {
  direction: number;
}

interface WaitThinker extends ThinkerNode {
  wait: number;
}

function hasDirection(thinker: ThinkerNode): thinker is DirectionThinker {
  return 'direction' in thinker && typeof thinker.direction === 'number';
}

function hasWait(thinker: ThinkerNode): thinker is WaitThinker {
  return 'wait' in thinker && typeof thinker.wait === 'number';
}

// ── Thinker ────────────────────────────────────────────────────────

/**
 * vldoor_t from p_spec.h.  Extends {@link ThinkerNode} so it threads
 * through the standard thinker ring; the action is {@link tVerticalDoor}.
 */
export class VerticalDoor extends ThinkerNode {
  sector: DoorSector;
  type: VerticalDoorType;
  topheight: Fixed = 0;
  speed: Fixed = VDOORSPEED;
  direction: DoorDirection = DoorDirection.opening;
  topwait: number = VDOORWAIT;
  topcountdown: number = 0;
  callbacks: DoorCallbacks;

  constructor(sector: DoorSector, type: VerticalDoorType, callbacks: DoorCallbacks) {
    super();
    this.sector = sector;
    this.type = type;
    this.callbacks = callbacks;
  }
}

// ── T_VerticalDoor (per-tic thinker action) ───────────────────────

/**
 * T_VerticalDoor: per-tic think function for every active door.
 *
 * The switch on {@link VerticalDoor.direction} mirrors the canonical
 * p_doors.c layout exactly:
 *
 * - `waiting` (0): countdown, on zero convert to a close (normal,
 *   blazeRaise) or an open (close30ThenOpen).
 * - `initialWait` (2): countdown, on zero open as a `normal` door
 *   (raiseIn5Mins only).
 * - `closing` (-1): T_MovePlane down; on pastdest remove (or wait 30s
 *   for close30ThenOpen); on crushed reverse unless type is
 *   `vld_close`/`vld_blazeClose`.
 * - `opening` (1): T_MovePlane up; on pastdest start wait (normal,
 *   blazeRaise) or remove (open, blazeOpen, close30ThenOpen); crushing
 *   cannot happen because vanilla calls T_MovePlane with crush=false
 *   for doors.
 */
export function tVerticalDoor(thinker: ThinkerNode): void {
  const door = thinker as VerticalDoor;
  const callbacks = door.callbacks;

  switch (door.direction) {
    case DoorDirection.waiting:
      door.topcountdown--;
      if (door.topcountdown === 0) {
        switch (door.type) {
          case VerticalDoorType.blazeRaise:
            door.direction = DoorDirection.closing;
            callbacks.startSectorSound?.(door.sector, SFX_BDCLS);
            break;
          case VerticalDoorType.normal:
            door.direction = DoorDirection.closing;
            callbacks.startSectorSound?.(door.sector, SFX_DORCLS);
            break;
          case VerticalDoorType.close30ThenOpen:
            door.direction = DoorDirection.opening;
            callbacks.startSectorSound?.(door.sector, SFX_DOROPN);
            break;
          default:
            break;
        }
      }
      break;

    case DoorDirection.initialWait:
      door.topcountdown--;
      if (door.topcountdown === 0) {
        if (door.type === VerticalDoorType.raiseIn5Mins) {
          door.direction = DoorDirection.opening;
          door.type = VerticalDoorType.normal;
          callbacks.startSectorSound?.(door.sector, SFX_DOROPN);
        }
      }
      break;

    case DoorDirection.closing: {
      const res = callbacks.movePlane(door.sector, door.speed, door.sector.floorheight, false, 1, -1);
      if (res === PlaneMoveResult.pastdest) {
        switch (door.type) {
          case VerticalDoorType.blazeRaise:
          case VerticalDoorType.blazeClose:
            door.sector.specialdata = null;
            door.action = REMOVED;
            callbacks.startSectorSound?.(door.sector, SFX_BDCLS);
            break;
          case VerticalDoorType.normal:
          case VerticalDoorType.close:
            door.sector.specialdata = null;
            door.action = REMOVED;
            break;
          case VerticalDoorType.close30ThenOpen:
            door.direction = DoorDirection.waiting;
            door.topcountdown = CLOSE30_TICS;
            break;
          default:
            break;
        }
      } else if (res === PlaneMoveResult.crushed) {
        switch (door.type) {
          case VerticalDoorType.blazeClose:
          case VerticalDoorType.close:
            break;
          default:
            door.direction = DoorDirection.opening;
            callbacks.startSectorSound?.(door.sector, SFX_DOROPN);
            break;
        }
      }
      break;
    }

    case DoorDirection.opening: {
      const res = callbacks.movePlane(door.sector, door.speed, door.topheight, false, 1, 1);
      if (res === PlaneMoveResult.pastdest) {
        switch (door.type) {
          case VerticalDoorType.blazeRaise:
          case VerticalDoorType.normal:
            door.direction = DoorDirection.waiting;
            door.topcountdown = door.topwait;
            break;
          case VerticalDoorType.close30ThenOpen:
          case VerticalDoorType.blazeOpen:
          case VerticalDoorType.open:
            door.sector.specialdata = null;
            door.action = REMOVED;
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

// ── EV_DoDoor (tagged-sector batch creation) ──────────────────────

/**
 * EV_DoDoor: create doors in every untagged-active sector whose
 * `tag` matches `tag`.  Returns 1 if at least one door was created,
 * 0 otherwise — matching the vanilla `rtn` semantics.
 *
 * Sectors that already have `specialdata` set are skipped.  Each new
 * door is added to `thinkerList`, its `specialdata` slot is
 * back-filled, and its direction/speed/topheight are configured via
 * the `type` switch below.
 *
 * Sound policy mirrors vanilla exactly:
 * - `close*` types always play their close sound.
 * - `open` / `raise` types play the open sound only when
 *   `topheight !== sec.ceilingheight`.  Doors that would not move
 *   (the ceiling is already at the neighbor-minus-4) stay silent.
 */
export function evDoDoor(tag: number, type: VerticalDoorType, sectors: readonly DoorSector[], thinkerList: ThinkerList, callbacks: DoorCallbacks): number {
  let created = 0;
  for (const sector of sectors) {
    if (sector.tag !== tag) continue;
    if (sector.specialdata !== null) continue;

    const door = new VerticalDoor(sector, type, callbacks);
    door.action = tVerticalDoor;
    door.topwait = VDOORWAIT;
    door.speed = VDOORSPEED;
    sector.specialdata = door;
    thinkerList.add(door);

    switch (type) {
      case VerticalDoorType.blazeClose:
        door.topheight = (callbacks.findLowestCeilingSurrounding(sector) - DOOR_CEILING_OFFSET) | 0;
        door.direction = DoorDirection.closing;
        door.speed = (VDOORSPEED * 4) | 0;
        callbacks.startSectorSound?.(sector, SFX_BDCLS);
        break;
      case VerticalDoorType.close:
        door.topheight = (callbacks.findLowestCeilingSurrounding(sector) - DOOR_CEILING_OFFSET) | 0;
        door.direction = DoorDirection.closing;
        callbacks.startSectorSound?.(sector, SFX_DORCLS);
        break;
      case VerticalDoorType.close30ThenOpen:
        door.topheight = sector.ceilingheight;
        door.direction = DoorDirection.closing;
        callbacks.startSectorSound?.(sector, SFX_DORCLS);
        break;
      case VerticalDoorType.blazeRaise:
      case VerticalDoorType.blazeOpen:
        door.direction = DoorDirection.opening;
        door.topheight = (callbacks.findLowestCeilingSurrounding(sector) - DOOR_CEILING_OFFSET) | 0;
        door.speed = (VDOORSPEED * 4) | 0;
        if (door.topheight !== sector.ceilingheight) {
          callbacks.startSectorSound?.(sector, SFX_BDOPN);
        }
        break;
      case VerticalDoorType.normal:
      case VerticalDoorType.open:
        door.direction = DoorDirection.opening;
        door.topheight = (callbacks.findLowestCeilingSurrounding(sector) - DOOR_CEILING_OFFSET) | 0;
        if (door.topheight !== sector.ceilingheight) {
          callbacks.startSectorSound?.(sector, SFX_DOROPN);
        }
        break;
      default:
        break;
    }
    created = 1;
  }
  return created;
}

// ── EV_DoLockedDoor (keyed-tagged batch creation) ─────────────────

/**
 * Mutable linedef shape used by {@link evVerticalDoor} and
 * {@link evDoLockedDoor}.  The functions may set `special = 0` for
 * the one-shot types (`vld_open`, `vld_blazeOpen`).
 */
export interface DoorLineSpecial {
  special: number;
}

/**
 * EV_DoLockedDoor: check the triggering player's keys for the
 * line's special, then delegate to {@link evDoDoor}.  Returns 0 on
 * denial (no key / no player), otherwise the `evDoDoor` return.
 *
 * Line-special key map (vanilla p_doors.c):
 * - 99, 133 → blue
 * - 134, 135 → red
 * - 136, 137 → yellow
 *
 * Each non-blue-card player message uses the `-O` suffix
 * ("activate this object") distinct from the `-K` ("open this door")
 * messages used by manual doors.
 */
export function evDoLockedDoor(line: DoorLineSpecial, type: VerticalDoorType, tag: number, player: Player | null, sectors: readonly DoorSector[], thinkerList: ThinkerList, callbacks: DoorCallbacks): number {
  if (player === null) return 0;

  let requiredCards: readonly CardType[] | null = null;
  let denialMessage = '';
  switch (line.special) {
    case 99:
    case 133:
      requiredCards = [CardType.BLUECARD, CardType.BLUESKULL];
      denialMessage = PD_BLUEO;
      break;
    case 134:
    case 135:
      requiredCards = [CardType.REDCARD, CardType.REDSKULL];
      denialMessage = PD_REDO;
      break;
    case 136:
    case 137:
      requiredCards = [CardType.YELLOWCARD, CardType.YELLOWSKULL];
      denialMessage = PD_YELLOWO;
      break;
    default:
      break;
  }

  if (requiredCards !== null) {
    const hasKey = requiredCards.some((card) => player.cards[card] === true);
    if (!hasKey) {
      player.message = denialMessage;
      callbacks.startPlayerSound?.(SFX_OOF);
      return 0;
    }
  }

  return evDoDoor(tag, type, sectors, thinkerList, callbacks);
}

// ── EV_VerticalDoor (manual per-line activation) ──────────────────

/**
 * EV_VerticalDoor: activate a manually-triggered door.
 *
 * Covers line specials 1, 26-28, 31-34, 117, 118.  The function
 * validates keys for the locked-door cases, re-activates an existing
 * door when the line is one of the repeatable codes (1, 26-28, 117),
 * and otherwise creates a fresh thinker.
 *
 * Re-activation rules (repeatable codes only):
 * - If the door is closing, flip to opening.
 * - If the door is opening/waiting, flip to closing — BUT only if the
 *   activator is a player; monsters cannot close doors (vanilla JDC
 *   comment).
 *
 * Non-repeatable codes fall through to creation, overwriting
 * `sec.specialdata` — this is a vanilla orphan-thinker quirk.
 *
 * @returns 1 on success, 0 on key-denial or no-player monster attempts.
 */
export function evVerticalDoor(line: DoorLineSpecial, sector: DoorSector, player: Player | null, thinkerList: ThinkerList, callbacks: DoorCallbacks): number {
  switch (line.special) {
    case 26:
    case 32:
      if (player === null) return 0;
      if (!player.cards[CardType.BLUECARD] && !player.cards[CardType.BLUESKULL]) {
        player.message = PD_BLUEK;
        callbacks.startPlayerSound?.(SFX_OOF);
        return 0;
      }
      break;
    case 27:
    case 34:
      if (player === null) return 0;
      if (!player.cards[CardType.YELLOWCARD] && !player.cards[CardType.YELLOWSKULL]) {
        player.message = PD_YELLOWK;
        callbacks.startPlayerSound?.(SFX_OOF);
        return 0;
      }
      break;
    case 28:
    case 33:
      if (player === null) return 0;
      if (!player.cards[CardType.REDCARD] && !player.cards[CardType.REDSKULL]) {
        player.message = PD_REDK;
        callbacks.startPlayerSound?.(SFX_OOF);
        return 0;
      }
      break;
    default:
      break;
  }

  if (sector.specialdata !== null) {
    const existing = sector.specialdata;
    switch (line.special) {
      case 1:
      case 26:
      case 27:
      case 28:
      case 117:
        if (existing instanceof VerticalDoor) {
          if (existing.direction === DoorDirection.closing) {
            existing.direction = DoorDirection.opening;
          } else {
            if (player === null) return 0;
            existing.direction = DoorDirection.closing;
          }
          return 1;
        }
        if (hasDirection(existing) && existing.direction === DoorDirection.closing) {
          existing.direction = DoorDirection.opening;
          return 1;
        }
        if (hasWait(existing) && existing.wait === DoorDirection.closing) {
          existing.wait = DoorDirection.opening;
          return 1;
        }
        if (player === null) return 0;
        if (hasWait(existing)) {
          existing.wait = DoorDirection.closing;
          return 1;
        }
        if (hasDirection(existing)) {
          existing.direction = DoorDirection.closing;
          return 1;
        }
        return 1;
      default:
        break;
    }
  }

  switch (line.special) {
    case 117:
    case 118:
      callbacks.startSectorSound?.(sector, SFX_BDOPN);
      break;
    default:
      callbacks.startSectorSound?.(sector, SFX_DOROPN);
      break;
  }

  const door = new VerticalDoor(sector, VerticalDoorType.normal, callbacks);
  door.action = tVerticalDoor;
  door.direction = DoorDirection.opening;
  door.speed = VDOORSPEED;
  door.topwait = VDOORWAIT;
  sector.specialdata = door;
  thinkerList.add(door);

  switch (line.special) {
    case 1:
    case 26:
    case 27:
    case 28:
      door.type = VerticalDoorType.normal;
      break;
    case 31:
    case 32:
    case 33:
    case 34:
      door.type = VerticalDoorType.open;
      line.special = 0;
      break;
    case 117:
      door.type = VerticalDoorType.blazeRaise;
      door.speed = (VDOORSPEED * 4) | 0;
      break;
    case 118:
      door.type = VerticalDoorType.blazeOpen;
      door.speed = (VDOORSPEED * 4) | 0;
      line.special = 0;
      break;
    default:
      break;
  }

  door.topheight = (callbacks.findLowestCeilingSurrounding(sector) - DOOR_CEILING_OFFSET) | 0;

  return 1;
}

// ── Sector-special spawners ───────────────────────────────────────

/**
 * P_SpawnDoorCloseIn30: sector special 10 — arms a `normal` door in
 * the `waiting` state so it fires `T_VerticalDoor`'s close branch
 * after 30 seconds.  Clears `sector.special`.
 */
export function spawnDoorCloseIn30(sector: DoorSector, thinkerList: ThinkerList, callbacks: DoorCallbacks): VerticalDoor {
  const door = new VerticalDoor(sector, VerticalDoorType.normal, callbacks);
  door.action = tVerticalDoor;
  door.direction = DoorDirection.waiting;
  door.topwait = VDOORWAIT;
  door.speed = VDOORSPEED;
  door.topcountdown = CLOSE30_TICS;
  sector.specialdata = door;
  sector.special = 0;
  thinkerList.add(door);
  return door;
}

/**
 * P_SpawnDoorRaiseIn5Mins: sector special 14 — arms a
 * `raiseIn5Mins` door in the `initialWait` state so it fires
 * `T_VerticalDoor`'s case-2 branch after 5 minutes and converts to a
 * normal door.  Seeds `topheight` and `topwait` up front so the
 * eventual raise has the correct destination.  Clears
 * `sector.special`.
 */
export function spawnDoorRaiseIn5Mins(sector: DoorSector, thinkerList: ThinkerList, callbacks: DoorCallbacks): VerticalDoor {
  const door = new VerticalDoor(sector, VerticalDoorType.raiseIn5Mins, callbacks);
  door.action = tVerticalDoor;
  door.direction = DoorDirection.initialWait;
  door.speed = VDOORSPEED;
  door.topwait = VDOORWAIT;
  door.topcountdown = RAISE_IN_5MINS_TICS;
  door.topheight = (callbacks.findLowestCeilingSurrounding(sector) - DOOR_CEILING_OFFSET) | 0;
  sector.specialdata = door;
  sector.special = 0;
  thinkerList.add(door);
  return door;
}
