/**
 * Line-trigger dispatch (p_spec.c `P_CrossSpecialLine` /
 * `P_ShootSpecialLine` and p_switch.c `P_UseSpecialLine`).
 *
 * Routes every activated linedef to the correct EV_* helper based on
 * `line.special`, applies the trigger/retrigger/use/shoot activation
 * rules, zeroes `line.special` for one-shot triggers, and leaves it
 * intact for retriggers.  Side effects travel through
 * {@link LineTriggerCallbacks} so the dispatcher stays free of
 * coupling to the actual door/plat/floor/ceiling/teleport/exit
 * implementations.
 *
 * Parity-critical behavior preserved byte-for-byte from Chocolate Doom
 * 2.2.1:
 *
 * - `P_CrossSpecialLine` gate for non-players: the six projectile
 *   mobj types {@link NON_TRIGGER_PROJECTILE_TYPES} never fire a cross
 *   special under `gameversion > exe_doom_1_2`.  On
 *   `gameversion <= exe_doom_1_2` (see {@link GameVersion.doom_1_2})
 *   the vanilla path is different: special > 98 && special !== 104
 *   returns early, otherwise falls through without the projectile
 *   filter.  We accept {@link GameVersion} as an optional parameter
 *   (default {@link GameVersion.doom_1_9}).
 * - Non-player cross eligibility is the exact set
 *   {@link MONSTER_CROSS_SPECIALS}: `[39, 97, 125, 126, 4, 10, 88]`.
 *   Everything else returns early for monsters.
 * - Non-player shoot eligibility is the single set
 *   {@link MONSTER_SHOOT_SPECIALS}: `[46]`.
 * - Non-player use eligibility is
 *   {@link MONSTER_USE_SPECIALS}: `[1, 32, 33, 34]` AND the line must
 *   lack the `ML_SECRET` flag.  32/33/34 are locked-door specials;
 *   the locked-door helper rejects null-player activators internally,
 *   but the outer gate still lets monsters *attempt* these lines
 *   because vanilla does.
 * - `P_UseSpecialLine` back-side (side === 1) accepts only the
 *   UNUSED sliding-door special 124.  Every other special returns
 *   false without dispatching.
 * - Trigger (`TRIGGERS` block in `P_CrossSpecialLine`) clears
 *   `line.special = 0` AFTER calling the EV_* helper.  The two exit
 *   triggers 52 (normal exit) and 124 (secret exit) are the
 *   exceptions — they DO NOT clear the special because
 *   `G_ExitLevel()` / `G_SecretExitLevel()` transitions to the next
 *   map before the next tic ever reads the line.
 * - Retrigger (`RETRIGGERS` block in `P_CrossSpecialLine`) leaves
 *   `line.special` intact so the line can fire again.
 * - Case 125 (monster-only teleport trigger) and 126 (monster-only
 *   retrigger) gate the EV_Teleport call on `!thing.player`; case 125
 *   additionally only clears `line.special` inside the non-player
 *   branch, so a player crossing a 125 line does nothing and leaves
 *   the line armed for a later monster.
 * - `P_UseSpecialLine` distinguishes SWITCHES (one-shot, pass
 *   `useAgain = 0`) from BUTTONS (repeatable, pass `useAgain = 1`).
 *   `changeSwitchTexture` fires ONLY when the underlying EV_* helper
 *   returns non-zero, matching the vanilla `if (EV_Do...()) P_Change...`
 *   guard pattern.  Two exceptions: case 11 (exit) and case 51
 *   (secret exit) flip the switch texture UNCONDITIONALLY before
 *   triggering the level exit, and cases 138 (light on) / 139 (light
 *   off) flip the switch UNCONDITIONALLY because EV_LightTurnOn
 *   returns void in vanilla.
 * - `P_ShootSpecialLine` NEVER guards `changeSwitchTexture` on the
 *   EV_* return value; cases 24 / 46 / 47 flip the switch unconditionally.
 *
 * @example
 * ```ts
 * import {
 *   pCrossSpecialLine,
 *   pUseSpecialLine,
 *   pShootSpecialLine,
 * } from "../src/specials/lineTriggers.ts";
 *
 * pCrossSpecialLine(line, side, thing, callbacks);
 * const handled = pUseSpecialLine(thing, line, side, callbacks);
 * pShootSpecialLine(thing, line, callbacks);
 * ```
 */

import { ML_SECRET } from '../map/lineSectorGeometry.ts';
import type { CeilingType } from './ceilings.ts';
import type { VerticalDoorType } from './doors.ts';
import type { FloorType } from './floors.ts';
import type { PlatType } from './platforms.ts';
import type { StairType } from './stairsDonut.ts';
import { MobjType } from '../world/mobj.ts';

// ── Game-version gate ──────────────────────────────────────────────

/**
 * Canonical gameversion values consulted by the pre-1.2 cross-special
 * filter in `P_CrossSpecialLine`.  We target {@link doom_1_9} and
 * default to it; {@link doom_1_2} exists so demo-parity tests can
 * reproduce the alternate early-return path.
 */
export const enum GameVersion {
  doom_1_2 = 0,
  doom_1_9 = 1,
}

// ── Non-player eligibility sets ────────────────────────────────────

/**
 * The six projectile `MobjType` values that vanilla blocks from
 * triggering cross specials on `gameversion > exe_doom_1_2`.  Listed
 * in p_spec.c order: `MT_ROCKET`, `MT_PLASMA`, `MT_BFG`,
 * `MT_TROOPSHOT`, `MT_HEADSHOT`, `MT_BRUISERSHOT`.  Projectiles fired
 * by *any* actor — monster or player — cannot trigger crosses,
 * but only the non-player branch consults this list (players never
 * have `type` equal to a projectile).
 */
export const NON_TRIGGER_PROJECTILE_TYPES: readonly MobjType[] = Object.freeze([MobjType.ROCKET, MobjType.PLASMA, MobjType.BFG, MobjType.TROOPSHOT, MobjType.HEADSHOT, MobjType.BRUISERSHOT]);

/**
 * Cross-eligible specials for non-player actors.  Exact set from the
 * p_spec.c `!thing->player` switch: 39 (teleport trigger), 97
 * (teleport retrigger), 125 (monster-only teleport trigger), 126
 * (monster-only teleport retrigger), 4 (raise door), 10 (plat
 * trigger), 88 (plat retrigger).
 */
export const MONSTER_CROSS_SPECIALS: readonly number[] = Object.freeze([39, 97, 125, 126, 4, 10, 88]);

/**
 * Use-eligible specials for non-player actors.  Exact set from the
 * p_switch.c `!thing->player` switch: 1 (manual door), 32/33/34
 * (manual blue/red/yellow — locked-door helper rejects non-players
 * internally, but vanilla still lets monsters attempt the line).
 * The ML_SECRET flag is an additional gate; the caller enforces it.
 */
export const MONSTER_USE_SPECIALS: readonly number[] = Object.freeze([1, 32, 33, 34]);

/**
 * Shoot-eligible specials for non-player actors.  Exact set from the
 * p_spec.c `!thing->player` impact switch: 46 (open door).
 */
export const MONSTER_SHOOT_SPECIALS: readonly number[] = Object.freeze([46]);

// ── Runtime shapes ─────────────────────────────────────────────────

/**
 * The mutable linedef fields read and written by the dispatcher.
 * `special` is mutated on one-shot triggers; `flags` is read for the
 * ML_SECRET guard in `P_UseSpecialLine`; `tag` flows through to every
 * callback.  `frontFloorpic` and `frontSpecial` are re-exported
 * so callers can forward the same object to the floor/plat helpers.
 */
export interface LineTriggerLine {
  special: number;
  readonly flags: number;
  readonly tag: number;
  readonly frontFloorpic: number;
  readonly frontSpecial: number;
}

/**
 * The minimum actor shape required to decide eligibility.  Players are
 * identified by a non-null `player`; `type` is consulted only for the
 * non-player projectile filter.
 */
export interface LineTriggerThing {
  readonly type: MobjType;
  readonly player: unknown | null;
}

// ── Callbacks ──────────────────────────────────────────────────────

/**
 * Side-effect bridge for the dispatcher.  Every EV_* helper and every
 * host action (level exit, switch flip) is injected here so the
 * dispatcher remains free of direct imports and the test suite can
 * assert call ordering against a plain event log.
 *
 * Return values mirror vanilla: helpers that return `int` are
 * declared as `number` (1 for success, 0 for no-op); helpers that
 * return `void` remain `void`.  `evVerticalDoor` is void because the
 * p_doors.c caller in `P_UseSpecialLine` does not consult the return
 * value even though our local implementation does return a number.
 */
export interface LineTriggerCallbacks {
  evDoDoor(line: LineTriggerLine, type: VerticalDoorType): number;
  evDoLockedDoor(line: LineTriggerLine, type: VerticalDoorType, thing: LineTriggerThing): number;
  evVerticalDoor(line: LineTriggerLine, thing: LineTriggerThing): void;
  evDoPlat(line: LineTriggerLine, type: PlatType, amount: number): number;
  evStopPlat(line: LineTriggerLine): void;
  evDoFloor(line: LineTriggerLine, type: FloorType): number;
  evDoCeiling(line: LineTriggerLine, type: CeilingType): number;
  evCeilingCrushStop(line: LineTriggerLine): number;
  evBuildStairs(line: LineTriggerLine, type: StairType): number;
  evDoDonut(line: LineTriggerLine): number;
  evTeleport(line: LineTriggerLine, side: number, thing: LineTriggerThing): number;
  evLightTurnOn(line: LineTriggerLine, bright: number): void;
  evStartLightStrobing(line: LineTriggerLine): void;
  evTurnTagLightsOff(line: LineTriggerLine): void;
  changeSwitchTexture(line: LineTriggerLine, useAgain: 0 | 1): void;
  gExitLevel(): void;
  gSecretExitLevel(): void;
}

// ── VerticalDoorType / PlatType / FloorType / CeilingType / StairType literals ─

// const-enum values inlined here so case dispatch does not need to
// import the enum at the call site.  The numeric values mirror the
// canonical p_spec.h enum orders locked by F-115 / F-120 / F-122 /
// F-123 / F-124.

const VDT_NORMAL = 0;
const VDT_CLOSE_30_THEN_OPEN = 1;
const VDT_CLOSE = 2;
const VDT_OPEN = 3;
const VDT_BLAZE_RAISE = 5;
const VDT_BLAZE_OPEN = 6;
const VDT_BLAZE_CLOSE = 7;

const FT_LOWER_FLOOR = 0;
const FT_LOWER_FLOOR_TO_LOWEST = 1;
const FT_TURBO_LOWER = 2;
const FT_RAISE_FLOOR = 3;
const FT_RAISE_FLOOR_TO_NEAREST = 4;
const FT_RAISE_TO_TEXTURE = 5;
const FT_LOWER_AND_CHANGE = 6;
const FT_RAISE_FLOOR_24 = 7;
const FT_RAISE_FLOOR_24_AND_CHANGE = 8;
const FT_RAISE_FLOOR_CRUSH = 9;
const FT_RAISE_FLOOR_TURBO = 10;
const FT_RAISE_FLOOR_512 = 12;

const PT_PERPETUAL_RAISE = 0;
const PT_DOWN_WAIT_UP_STAY = 1;
const PT_RAISE_AND_CHANGE = 2;
const PT_RAISE_TO_NEAREST_AND_CHANGE = 3;
const PT_BLAZE_DWUS = 4;

const CT_LOWER_TO_FLOOR = 0;
const CT_LOWER_AND_CRUSH = 2;
const CT_CRUSH_AND_RAISE = 3;
const CT_FAST_CRUSH_AND_RAISE = 4;
const CT_SILENT_CRUSH_AND_RAISE = 5;

const STR_BUILD8 = 0;
const STR_TURBO16 = 1;

// ── P_CrossSpecialLine ─────────────────────────────────────────────

/**
 * P_CrossSpecialLine: dispatch for a thing crossing a special line.
 *
 * Eligibility pipeline:
 * 1. `gameVersion <= doom_1_2`: early-return if `special > 98 && special !== 104`.
 * 2. `gameVersion > doom_1_2`: non-players whose `type` is in
 *    {@link NON_TRIGGER_PROJECTILE_TYPES} early-return.
 * 3. Non-players whose `special` is not in {@link MONSTER_CROSS_SPECIALS}
 *    early-return.
 * 4. Dispatch to the appropriate EV_* helper via `callbacks`.
 * 5. If the special is in the TRIGGERS block (one-shot), set
 *    `line.special = 0` AFTER the dispatch call.  The two exit
 *    triggers 52 and 124 skip the reset because the engine
 *    transitions to the next map before the line ever re-reads.
 */
export function pCrossSpecialLine(line: LineTriggerLine, side: number, thing: LineTriggerThing, callbacks: LineTriggerCallbacks, gameVersion: GameVersion = GameVersion.doom_1_9): void {
  if (gameVersion <= GameVersion.doom_1_2) {
    if (line.special > 98 && line.special !== 104) {
      return;
    }
  } else {
    if (thing.player === null) {
      if (NON_TRIGGER_PROJECTILE_TYPES.indexOf(thing.type) !== -1) {
        return;
      }
    }
  }

  if (thing.player === null) {
    if (MONSTER_CROSS_SPECIALS.indexOf(line.special) === -1) {
      return;
    }
  }

  switch (line.special) {
    // ── TRIGGERS (one-shot) ─────────────────────────────────────
    case 2:
      callbacks.evDoDoor(line, VDT_OPEN as VerticalDoorType);
      line.special = 0;
      break;
    case 3:
      callbacks.evDoDoor(line, VDT_CLOSE as VerticalDoorType);
      line.special = 0;
      break;
    case 4:
      callbacks.evDoDoor(line, VDT_NORMAL as VerticalDoorType);
      line.special = 0;
      break;
    case 5:
      callbacks.evDoFloor(line, FT_RAISE_FLOOR as FloorType);
      line.special = 0;
      break;
    case 6:
      callbacks.evDoCeiling(line, CT_FAST_CRUSH_AND_RAISE as CeilingType);
      line.special = 0;
      break;
    case 8:
      callbacks.evBuildStairs(line, STR_BUILD8 as StairType);
      line.special = 0;
      break;
    case 10:
      callbacks.evDoPlat(line, PT_DOWN_WAIT_UP_STAY as PlatType, 0);
      line.special = 0;
      break;
    case 12:
      callbacks.evLightTurnOn(line, 0);
      line.special = 0;
      break;
    case 13:
      callbacks.evLightTurnOn(line, 255);
      line.special = 0;
      break;
    case 16:
      callbacks.evDoDoor(line, VDT_CLOSE_30_THEN_OPEN as VerticalDoorType);
      line.special = 0;
      break;
    case 17:
      callbacks.evStartLightStrobing(line);
      line.special = 0;
      break;
    case 19:
      callbacks.evDoFloor(line, FT_LOWER_FLOOR as FloorType);
      line.special = 0;
      break;
    case 22:
      callbacks.evDoPlat(line, PT_RAISE_TO_NEAREST_AND_CHANGE as PlatType, 0);
      line.special = 0;
      break;
    case 25:
      callbacks.evDoCeiling(line, CT_CRUSH_AND_RAISE as CeilingType);
      line.special = 0;
      break;
    case 30:
      callbacks.evDoFloor(line, FT_RAISE_TO_TEXTURE as FloorType);
      line.special = 0;
      break;
    case 35:
      callbacks.evLightTurnOn(line, 35);
      line.special = 0;
      break;
    case 36:
      callbacks.evDoFloor(line, FT_TURBO_LOWER as FloorType);
      line.special = 0;
      break;
    case 37:
      callbacks.evDoFloor(line, FT_LOWER_AND_CHANGE as FloorType);
      line.special = 0;
      break;
    case 38:
      callbacks.evDoFloor(line, FT_LOWER_FLOOR_TO_LOWEST as FloorType);
      line.special = 0;
      break;
    case 39:
      callbacks.evTeleport(line, side, thing);
      line.special = 0;
      break;
    case 40:
      callbacks.evDoCeiling(line, 1 as number as CeilingType);
      callbacks.evDoFloor(line, FT_LOWER_FLOOR_TO_LOWEST as FloorType);
      line.special = 0;
      break;
    case 44:
      callbacks.evDoCeiling(line, CT_LOWER_AND_CRUSH as CeilingType);
      line.special = 0;
      break;
    case 52:
      callbacks.gExitLevel();
      break;
    case 53:
      callbacks.evDoPlat(line, PT_PERPETUAL_RAISE as PlatType, 0);
      line.special = 0;
      break;
    case 54:
      callbacks.evStopPlat(line);
      line.special = 0;
      break;
    case 56:
      callbacks.evDoFloor(line, FT_RAISE_FLOOR_CRUSH as FloorType);
      line.special = 0;
      break;
    case 57:
      callbacks.evCeilingCrushStop(line);
      line.special = 0;
      break;
    case 58:
      callbacks.evDoFloor(line, FT_RAISE_FLOOR_24 as FloorType);
      line.special = 0;
      break;
    case 59:
      callbacks.evDoFloor(line, FT_RAISE_FLOOR_24_AND_CHANGE as FloorType);
      line.special = 0;
      break;
    case 104:
      callbacks.evTurnTagLightsOff(line);
      line.special = 0;
      break;
    case 108:
      callbacks.evDoDoor(line, VDT_BLAZE_RAISE as VerticalDoorType);
      line.special = 0;
      break;
    case 109:
      callbacks.evDoDoor(line, VDT_BLAZE_OPEN as VerticalDoorType);
      line.special = 0;
      break;
    case 100:
      callbacks.evBuildStairs(line, STR_TURBO16 as StairType);
      line.special = 0;
      break;
    case 110:
      callbacks.evDoDoor(line, VDT_BLAZE_CLOSE as VerticalDoorType);
      line.special = 0;
      break;
    case 119:
      callbacks.evDoFloor(line, FT_RAISE_FLOOR_TO_NEAREST as FloorType);
      line.special = 0;
      break;
    case 121:
      callbacks.evDoPlat(line, PT_BLAZE_DWUS as PlatType, 0);
      line.special = 0;
      break;
    case 124:
      callbacks.gSecretExitLevel();
      break;
    case 125:
      if (thing.player === null) {
        callbacks.evTeleport(line, side, thing);
        line.special = 0;
      }
      break;
    case 130:
      callbacks.evDoFloor(line, FT_RAISE_FLOOR_TURBO as FloorType);
      line.special = 0;
      break;
    case 141:
      callbacks.evDoCeiling(line, CT_SILENT_CRUSH_AND_RAISE as CeilingType);
      line.special = 0;
      break;

    // ── RETRIGGERS (repeatable; never reset line.special) ──────
    case 72:
      callbacks.evDoCeiling(line, CT_LOWER_AND_CRUSH as CeilingType);
      break;
    case 73:
      callbacks.evDoCeiling(line, CT_CRUSH_AND_RAISE as CeilingType);
      break;
    case 74:
      callbacks.evCeilingCrushStop(line);
      break;
    case 75:
      callbacks.evDoDoor(line, VDT_CLOSE as VerticalDoorType);
      break;
    case 76:
      callbacks.evDoDoor(line, VDT_CLOSE_30_THEN_OPEN as VerticalDoorType);
      break;
    case 77:
      callbacks.evDoCeiling(line, CT_FAST_CRUSH_AND_RAISE as CeilingType);
      break;
    case 79:
      callbacks.evLightTurnOn(line, 35);
      break;
    case 80:
      callbacks.evLightTurnOn(line, 0);
      break;
    case 81:
      callbacks.evLightTurnOn(line, 255);
      break;
    case 82:
      callbacks.evDoFloor(line, FT_LOWER_FLOOR_TO_LOWEST as FloorType);
      break;
    case 83:
      callbacks.evDoFloor(line, FT_LOWER_FLOOR as FloorType);
      break;
    case 84:
      callbacks.evDoFloor(line, FT_LOWER_AND_CHANGE as FloorType);
      break;
    case 86:
      callbacks.evDoDoor(line, VDT_OPEN as VerticalDoorType);
      break;
    case 87:
      callbacks.evDoPlat(line, PT_PERPETUAL_RAISE as PlatType, 0);
      break;
    case 88:
      callbacks.evDoPlat(line, PT_DOWN_WAIT_UP_STAY as PlatType, 0);
      break;
    case 89:
      callbacks.evStopPlat(line);
      break;
    case 90:
      callbacks.evDoDoor(line, VDT_NORMAL as VerticalDoorType);
      break;
    case 91:
      callbacks.evDoFloor(line, FT_RAISE_FLOOR as FloorType);
      break;
    case 92:
      callbacks.evDoFloor(line, FT_RAISE_FLOOR_24 as FloorType);
      break;
    case 93:
      callbacks.evDoFloor(line, FT_RAISE_FLOOR_24_AND_CHANGE as FloorType);
      break;
    case 94:
      callbacks.evDoFloor(line, FT_RAISE_FLOOR_CRUSH as FloorType);
      break;
    case 95:
      callbacks.evDoPlat(line, PT_RAISE_TO_NEAREST_AND_CHANGE as PlatType, 0);
      break;
    case 96:
      callbacks.evDoFloor(line, FT_RAISE_TO_TEXTURE as FloorType);
      break;
    case 97:
      callbacks.evTeleport(line, side, thing);
      break;
    case 98:
      callbacks.evDoFloor(line, FT_TURBO_LOWER as FloorType);
      break;
    case 105:
      callbacks.evDoDoor(line, VDT_BLAZE_RAISE as VerticalDoorType);
      break;
    case 106:
      callbacks.evDoDoor(line, VDT_BLAZE_OPEN as VerticalDoorType);
      break;
    case 107:
      callbacks.evDoDoor(line, VDT_BLAZE_CLOSE as VerticalDoorType);
      break;
    case 120:
      callbacks.evDoPlat(line, PT_BLAZE_DWUS as PlatType, 0);
      break;
    case 126:
      if (thing.player === null) {
        callbacks.evTeleport(line, side, thing);
      }
      break;
    case 128:
      callbacks.evDoFloor(line, FT_RAISE_FLOOR_TO_NEAREST as FloorType);
      break;
    case 129:
      callbacks.evDoFloor(line, FT_RAISE_FLOOR_TURBO as FloorType);
      break;
    default:
      break;
  }
}

// ── P_ShootSpecialLine ─────────────────────────────────────────────

/**
 * P_ShootSpecialLine: dispatch for a hitscan attack impacting a
 * special line.  Only three specials exist: 24 (raise floor), 46
 * (open door), 47 (raise plat to nearest + change).  Non-players
 * are restricted to special 46.
 *
 * `changeSwitchTexture` fires UNCONDITIONALLY for all three cases —
 * vanilla does NOT guard on the EV_* return value.  A failed EV_*
 * call still flips the wall switch texture.
 */
export function pShootSpecialLine(thing: LineTriggerThing, line: LineTriggerLine, callbacks: LineTriggerCallbacks): void {
  if (thing.player === null) {
    if (MONSTER_SHOOT_SPECIALS.indexOf(line.special) === -1) {
      return;
    }
  }

  switch (line.special) {
    case 24:
      callbacks.evDoFloor(line, FT_RAISE_FLOOR as FloorType);
      callbacks.changeSwitchTexture(line, 0);
      break;
    case 46:
      callbacks.evDoDoor(line, VDT_OPEN as VerticalDoorType);
      callbacks.changeSwitchTexture(line, 1);
      break;
    case 47:
      callbacks.evDoPlat(line, PT_RAISE_TO_NEAREST_AND_CHANGE as PlatType, 0);
      callbacks.changeSwitchTexture(line, 0);
      break;
    default:
      break;
  }
}

// ── P_UseSpecialLine ───────────────────────────────────────────────

/**
 * P_UseSpecialLine: dispatch for an actor pressing Use against a
 * special line.  Returns `true` when the press was consumed, `false`
 * when the line rejected the use at the eligibility gate.
 *
 * Eligibility:
 * 1. `side === 1` is rejected unless the special is 124 (the UNUSED
 *    sliding-door code) — vanilla's back-side gate.  Special 124 on
 *    the back falls through the final switch without a matching
 *    case, so the function returns true without any dispatch.
 * 2. Non-player actors must clear ML_SECRET AND have `special` in
 *    {@link MONSTER_USE_SPECIALS}.  Anything else returns false.
 *
 * Dispatch groups:
 * - MANUALS (cases 1, 26-28, 31-34, 117, 118): call `evVerticalDoor`.
 *   No switch flip.
 * - SWITCHES (one-shot, `changeSwitchTexture` with `useAgain = 0`):
 *   cases 7, 9, 11, 14, 15, 18, 20, 21, 23, 29, 41, 49, 50, 51, 55,
 *   71, 101, 102, 103, 111, 112, 113, 122, 127, 131, 133, 135, 137,
 *   140.  `changeSwitchTexture` fires ONLY when the EV_* helper
 *   returns non-zero (vanilla guard pattern), EXCEPT cases 11 and 51
 *   where the switch flip is unconditional because the exit path
 *   never returns.
 * - BUTTONS (repeatable, `changeSwitchTexture` with `useAgain = 1`):
 *   cases 42, 43, 45, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70,
 *   99, 114, 115, 116, 123, 132, 134, 136, 138, 139.  Guarded on the
 *   EV_* return value EXCEPT cases 138 and 139, where the light
 *   helper returns void and the switch flip is unconditional.
 */
export function pUseSpecialLine(thing: LineTriggerThing, line: LineTriggerLine, side: number, callbacks: LineTriggerCallbacks): boolean {
  if (side === 1) {
    if (line.special !== 124) return false;
  }

  if (thing.player === null) {
    if ((line.flags & ML_SECRET) !== 0) return false;
    if (MONSTER_USE_SPECIALS.indexOf(line.special) === -1) return false;
  }

  switch (line.special) {
    // ── MANUALS (no switch flip) ───────────────────────────────
    case 1:
    case 26:
    case 27:
    case 28:
    case 31:
    case 32:
    case 33:
    case 34:
    case 117:
    case 118:
      callbacks.evVerticalDoor(line, thing);
      break;

    // ── SWITCHES (useAgain=0) ──────────────────────────────────
    case 7:
      if (callbacks.evBuildStairs(line, STR_BUILD8 as StairType)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;
    case 9:
      if (callbacks.evDoDonut(line)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;
    case 11:
      callbacks.changeSwitchTexture(line, 0);
      callbacks.gExitLevel();
      break;
    case 14:
      if (callbacks.evDoPlat(line, PT_RAISE_AND_CHANGE as PlatType, 32)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;
    case 15:
      if (callbacks.evDoPlat(line, PT_RAISE_AND_CHANGE as PlatType, 24)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;
    case 18:
      if (callbacks.evDoFloor(line, FT_RAISE_FLOOR_TO_NEAREST as FloorType)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;
    case 20:
      if (callbacks.evDoPlat(line, PT_RAISE_TO_NEAREST_AND_CHANGE as PlatType, 0)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;
    case 21:
      if (callbacks.evDoPlat(line, PT_DOWN_WAIT_UP_STAY as PlatType, 0)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;
    case 23:
      if (callbacks.evDoFloor(line, FT_LOWER_FLOOR_TO_LOWEST as FloorType)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;
    case 29:
      if (callbacks.evDoDoor(line, VDT_NORMAL as VerticalDoorType)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;
    case 41:
      if (callbacks.evDoCeiling(line, CT_LOWER_TO_FLOOR as CeilingType)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;
    case 71:
      if (callbacks.evDoFloor(line, FT_TURBO_LOWER as FloorType)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;
    case 49:
      if (callbacks.evDoCeiling(line, CT_CRUSH_AND_RAISE as CeilingType)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;
    case 50:
      if (callbacks.evDoDoor(line, VDT_CLOSE as VerticalDoorType)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;
    case 51:
      callbacks.changeSwitchTexture(line, 0);
      callbacks.gSecretExitLevel();
      break;
    case 55:
      if (callbacks.evDoFloor(line, FT_RAISE_FLOOR_CRUSH as FloorType)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;
    case 101:
      if (callbacks.evDoFloor(line, FT_RAISE_FLOOR as FloorType)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;
    case 102:
      if (callbacks.evDoFloor(line, FT_LOWER_FLOOR as FloorType)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;
    case 103:
      if (callbacks.evDoDoor(line, VDT_OPEN as VerticalDoorType)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;
    case 111:
      if (callbacks.evDoDoor(line, VDT_BLAZE_RAISE as VerticalDoorType)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;
    case 112:
      if (callbacks.evDoDoor(line, VDT_BLAZE_OPEN as VerticalDoorType)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;
    case 113:
      if (callbacks.evDoDoor(line, VDT_BLAZE_CLOSE as VerticalDoorType)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;
    case 122:
      if (callbacks.evDoPlat(line, PT_BLAZE_DWUS as PlatType, 0)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;
    case 127:
      if (callbacks.evBuildStairs(line, STR_TURBO16 as StairType)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;
    case 131:
      if (callbacks.evDoFloor(line, FT_RAISE_FLOOR_TURBO as FloorType)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;
    case 133:
    case 135:
    case 137:
      if (callbacks.evDoLockedDoor(line, VDT_BLAZE_OPEN as VerticalDoorType, thing)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;
    case 140:
      if (callbacks.evDoFloor(line, FT_RAISE_FLOOR_512 as FloorType)) {
        callbacks.changeSwitchTexture(line, 0);
      }
      break;

    // ── BUTTONS (useAgain=1) ───────────────────────────────────
    case 42:
      if (callbacks.evDoDoor(line, VDT_CLOSE as VerticalDoorType)) {
        callbacks.changeSwitchTexture(line, 1);
      }
      break;
    case 43:
      if (callbacks.evDoCeiling(line, CT_LOWER_TO_FLOOR as CeilingType)) {
        callbacks.changeSwitchTexture(line, 1);
      }
      break;
    case 45:
      if (callbacks.evDoFloor(line, FT_LOWER_FLOOR as FloorType)) {
        callbacks.changeSwitchTexture(line, 1);
      }
      break;
    case 60:
      if (callbacks.evDoFloor(line, FT_LOWER_FLOOR_TO_LOWEST as FloorType)) {
        callbacks.changeSwitchTexture(line, 1);
      }
      break;
    case 61:
      if (callbacks.evDoDoor(line, VDT_OPEN as VerticalDoorType)) {
        callbacks.changeSwitchTexture(line, 1);
      }
      break;
    case 62:
      if (callbacks.evDoPlat(line, PT_DOWN_WAIT_UP_STAY as PlatType, 1)) {
        callbacks.changeSwitchTexture(line, 1);
      }
      break;
    case 63:
      if (callbacks.evDoDoor(line, VDT_NORMAL as VerticalDoorType)) {
        callbacks.changeSwitchTexture(line, 1);
      }
      break;
    case 64:
      if (callbacks.evDoFloor(line, FT_RAISE_FLOOR as FloorType)) {
        callbacks.changeSwitchTexture(line, 1);
      }
      break;
    case 66:
      if (callbacks.evDoPlat(line, PT_RAISE_AND_CHANGE as PlatType, 24)) {
        callbacks.changeSwitchTexture(line, 1);
      }
      break;
    case 67:
      if (callbacks.evDoPlat(line, PT_RAISE_AND_CHANGE as PlatType, 32)) {
        callbacks.changeSwitchTexture(line, 1);
      }
      break;
    case 65:
      if (callbacks.evDoFloor(line, FT_RAISE_FLOOR_CRUSH as FloorType)) {
        callbacks.changeSwitchTexture(line, 1);
      }
      break;
    case 68:
      if (callbacks.evDoPlat(line, PT_RAISE_TO_NEAREST_AND_CHANGE as PlatType, 0)) {
        callbacks.changeSwitchTexture(line, 1);
      }
      break;
    case 69:
      if (callbacks.evDoFloor(line, FT_RAISE_FLOOR_TO_NEAREST as FloorType)) {
        callbacks.changeSwitchTexture(line, 1);
      }
      break;
    case 70:
      if (callbacks.evDoFloor(line, FT_TURBO_LOWER as FloorType)) {
        callbacks.changeSwitchTexture(line, 1);
      }
      break;
    case 114:
      if (callbacks.evDoDoor(line, VDT_BLAZE_RAISE as VerticalDoorType)) {
        callbacks.changeSwitchTexture(line, 1);
      }
      break;
    case 115:
      if (callbacks.evDoDoor(line, VDT_BLAZE_OPEN as VerticalDoorType)) {
        callbacks.changeSwitchTexture(line, 1);
      }
      break;
    case 116:
      if (callbacks.evDoDoor(line, VDT_BLAZE_CLOSE as VerticalDoorType)) {
        callbacks.changeSwitchTexture(line, 1);
      }
      break;
    case 123:
      if (callbacks.evDoPlat(line, PT_BLAZE_DWUS as PlatType, 0)) {
        callbacks.changeSwitchTexture(line, 1);
      }
      break;
    case 132:
      if (callbacks.evDoFloor(line, FT_RAISE_FLOOR_TURBO as FloorType)) {
        callbacks.changeSwitchTexture(line, 1);
      }
      break;
    case 99:
    case 134:
    case 136:
      if (callbacks.evDoLockedDoor(line, VDT_BLAZE_OPEN as VerticalDoorType, thing)) {
        callbacks.changeSwitchTexture(line, 1);
      }
      break;
    case 138:
      callbacks.evLightTurnOn(line, 255);
      callbacks.changeSwitchTexture(line, 1);
      break;
    case 139:
      callbacks.evLightTurnOn(line, 35);
      callbacks.changeSwitchTexture(line, 1);
      break;
    default:
      break;
  }

  return true;
}
