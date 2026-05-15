/**
 * Vanilla DOOM 1.9 door-specials facade.
 *
 * Plan_final step `08-005` (lane: map-world) wires the manual,
 * walk, switch, locked, and timed door specials — with their open
 * and close sounds — through one re-export barrel.  The read-only
 * `src/specials/doors.ts` module already implements vanilla
 * `p_doors.c` (`EV_DoDoor`, `EV_DoLockedDoor`, `EV_VerticalDoor`,
 * `T_VerticalDoor`, `P_SpawnDoorCloseIn30`,
 * `P_SpawnDoorRaiseIn5Mins`) and is SHA-pinned by the
 * `plan_vanilla_parity` ai-and-specials inventory; this module does
 * NOT modify it.
 *
 * The `VerticalDoorType`, `PlaneMoveResult`, and `DoorDirection`
 * `const enum`s are intentionally NOT re-exported: under
 * `verbatimModuleSyntax` a barrel cannot re-export a `const enum`
 * without breaking erasable-syntax inlining, so consumers that need
 * those enum members import them directly from the read-only
 * `../specials/doors.ts`.  Every value and structural type the door
 * callers actually pass around is surfaced here.
 *
 * @example
 * ```ts
 * import { evDoDoor, VDOORWAIT, VANILLA_DOOR_SPECIALS_INVARIANTS } from './wireDoorSpecials.ts';
 * VANILLA_DOOR_SPECIALS_INVARIANTS.length; // 5
 * ```
 */

export {
  CLOSE30_TICS,
  DOOR_CEILING_OFFSET,
  PD_BLUEK,
  PD_BLUEO,
  PD_REDK,
  PD_REDO,
  PD_YELLOWK,
  PD_YELLOWO,
  RAISE_IN_5MINS_TICS,
  SFX_BDCLS,
  SFX_BDOPN,
  SFX_DORCLS,
  SFX_DOROPN,
  SFX_OOF,
  TICRATE,
  VDOORSPEED,
  VDOORWAIT,
  VerticalDoor,
  evDoDoor,
  evDoLockedDoor,
  evVerticalDoor,
  spawnDoorCloseIn30,
  spawnDoorRaiseIn5Mins,
  tVerticalDoor,
} from '../specials/doors.ts';
export type { DoorCallbacks, DoorLineSpecial, DoorSector } from '../specials/doors.ts';

/** One pinned vanilla `p_doors.c` door-special invariant. */
export interface VanillaDoorSpecialsInvariant {
  /** Stable ASCII-sortable identifier. */
  readonly id: string;
  /** Human-readable parity rule the door specials preserve. */
  readonly rule: string;
}

/**
 * Frozen manifest of the five parity rules the wired door
 * specials preserve.  Ids are ASCII-sorted.
 */
export const VANILLA_DOOR_SPECIALS_INVARIANTS: readonly VanillaDoorSpecialsInvariant[] = Object.freeze([
  Object.freeze({
    id: 'BLAZE_DOORS_QUADRUPLE_SPEED_SHARE_VDOORWAIT',
    rule: 'Blaze door types (blazeRaise 5 / blazeOpen 6 / blazeClose 7) move at VDOORSPEED * 4 but keep the same VDOORWAIT (150) topwait, and play SFX_BDOPN (86) / SFX_BDCLS (87) where the non-blaze types play SFX_DOROPN (20) / SFX_DORCLS (21).',
  }),
  Object.freeze({
    id: 'CLOSE_CRUSH_DOES_NOT_REVERSE_FOR_PLAIN_AND_BLAZE_CLOSE',
    rule: 'On a close-direction crush, vld_close and vld_blazeClose do NOT reverse; every other type reverses to opening and replays the non-blaze sfx_doropn open sound even for blaze doors. This asymmetry is preserved verbatim from vanilla.',
  }),
  Object.freeze({
    id: 'EV_DO_DOOR_SKIPS_SECTORS_WITH_ACTIVE_SPECIALDATA',
    rule: 'evDoDoor tag-matches sectors, skips any sector whose specialdata is already non-null, spawns a VerticalDoor thinker into the thinkerList, stores it back into sector.specialdata, and returns the count of doors created.',
  }),
  Object.freeze({
    id: 'LOCKED_DOOR_KEY_MAP_AND_DENIAL_MESSAGES',
    rule: 'evDoLockedDoor maps line specials 99/133 to blue, 134/135 to red, 136/137 to yellow; it returns 0 with no player or missing key, using the -O ("activate this object") messages PD_BLUEO/PD_REDO/PD_YELLOWO distinct from the manual-door -K ("open this door") PD_BLUEK/PD_REDK/PD_YELLOWK.',
  }),
  Object.freeze({
    id: 'TIMED_DOOR_SPAWNS_USE_CLOSE30_AND_RAISE_IN_5MINS',
    rule: 'spawnDoorCloseIn30 arms a CLOSE30_TICS (30 * TICRATE) close-then-open door and spawnDoorRaiseIn5Mins arms a RAISE_IN_5MINS_TICS (5 * 60 * TICRATE) wait-then-raise door; both clear the sector special once the timer is armed and store themselves in sector.specialdata.',
  }),
]);
