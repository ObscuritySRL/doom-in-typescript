/**
 * Vanilla DOOM 1.9 floor / ceiling / platform / stair / donut facade.
 *
 * Plan_final step `08-006` (lane: map-world) wires the moving-plane
 * specials — `EV_DoFloor`, `EV_DoCeiling`, `EV_DoPlat` /
 * `EV_StopPlat`, `EV_BuildStairs`, `EV_DoDonut`, the crusher
 * stop/stasis paths, and the per-tic plane movers
 * (`T_MoveFloor` / `T_MoveCeiling` / `T_PlatRaise`) — plus the
 * active-special stasis-restore hooks (`P_ActivateInStasis` /
 * `P_ActivateInStasisCeiling` and the `ActivePlats` / `ActiveCeilings`
 * registries) into one cohesive surface.
 *
 * The read-only `src/specials/floors.ts`, `src/specials/ceilings.ts`,
 * `src/specials/platforms.ts`, and `src/specials/stairsDonut.ts`
 * already implement the per-piece behavior byte-for-byte from
 * Chocolate Doom 2.2.1 `p_floor.c` / `p_ceilng.c` / `p_plats.c`,
 * and are SHA-pinned by the inventory; this module does NOT modify
 * them.  It is a pure re-export barrel plus a frozen invariants
 * manifest.
 *
 * Re-export hygiene: the shared `SFX_STNMOV` / `SFX_PSTOP`
 * constants are surfaced from `floors.ts` only and `SFX_PSTART`
 * from `platforms.ts`, so the barrel has no duplicate export
 * names.  The shared `PlaneMoveResult` (a `doors.ts` re-export of
 * all three plane modules) and the `FloorType` / `CeilingType` /
 * `PlatType` / `StairType` / direction / status `const enum`s are
 * intentionally NOT re-exported — under `verbatimModuleSyntax` a
 * cross-module `const enum` re-export is a runtime hazard and no
 * consumer needs them through this surface.
 *
 * Five parity invariants this step pins:
 *
 *   1. The plane speeds are FRACUNIT per tic: `FLOORSPEED`,
 *      `CEILSPEED`, `PLATSPEED` all equal one map unit per tic.
 *   2. The vanilla waits/caps hold: `CEILWAIT` = 150,
 *      `PLATWAIT` = 3 seconds (`PLATWAIT_TICS` = 105 at 35 Hz),
 *      `MAXCEILINGS` = `MAXPLATS` = 30.
 *   3. Stair speeds derive from `FLOORSPEED`: BUILD8 = /4,
 *      TURBO16 = ×4; the donut moves at FLOORSPEED/2.
 *   4. Each `EV_*` dispatcher returns non-zero only when it spawned
 *      at least one mover (the `if (EV_Do…()) …` guard the line
 *      dispatcher relies on).
 *   5. Active specials are restorable: the `ActivePlats` /
 *      `ActiveCeilings` registries plus `P_ActivateInStasis` /
 *      `P_ActivateInStasisCeiling` are the serialization/stasis
 *      hooks a later save/load step wires.
 *
 * @example
 * ```ts
 * import { evDoFloor, FLOORSPEED, VANILLA_FLOOR_CEILING_PLAT_INVARIANTS } from './wireFloorCeilingPlatformSpecials.ts';
 * FLOORSPEED;                                       // 65536
 * VANILLA_FLOOR_CEILING_PLAT_INVARIANTS.length;     // 5
 * ```
 */

export { FLOOR_24_UNIT_OFFSET, FLOOR_512_UNIT_OFFSET, FLOOR_8_UNIT_OFFSET, FLOORSPEED, FloorMove, SFX_PSTOP, SFX_STNMOV, evDoFloor, tMoveFloor } from '../specials/floors.ts';
export type { AdjacentSectorFloorMatch, FloorCallbacks, FloorLine, FloorSector } from '../specials/floors.ts';
export { ActiveCeilings, CEILING_8_UNIT_OFFSET, CEILSPEED, CEILWAIT, Ceiling, MAXCEILINGS, evCeilingCrushStop, evDoCeiling, pActivateInStasisCeiling, tMoveCeiling } from '../specials/ceilings.ts';
export type { CeilingCallbacks, CeilingLine, CeilingSector } from '../specials/ceilings.ts';
export { ActivePlats, MAXPLATS, PLATSPEED, PLATWAIT, PLATWAIT_TICS, Platform, SFX_PSTART, evDoPlat, evStopPlat, pActivateInStasis, tPlatRaise } from '../specials/platforms.ts';
export type { PlatCallbacks, PlatLine, PlatSector } from '../specials/platforms.ts';
export { DONUT_SPEED, STAIR_16_UNIT_SIZE, STAIR_8_UNIT_SIZE, STAIR_BUILD8_SPEED, STAIR_TURBO16_SPEED, evBuildStairs, evDoDonut } from '../specials/stairsDonut.ts';
export type { DonutCallbacks, StairsDonutLine, StairsDonutLinedef, StairsDonutSector } from '../specials/stairsDonut.ts';

/**
 * One pinned floor/ceiling/platform/stair/donut parity invariant.
 */
export interface VanillaFloorCeilingPlatInvariant {
  readonly id:
    | 'ACTIVE_SPECIALS_ARE_RESTORABLE_VIA_STASIS_HOOKS'
    | 'EV_DISPATCHERS_RETURN_NONZERO_ONLY_WHEN_A_MOVER_SPAWNED'
    | 'PLANE_SPEEDS_ARE_ONE_FRACUNIT_PER_TIC'
    | 'STAIR_AND_DONUT_SPEEDS_DERIVE_FROM_FLOORSPEED'
    | 'VANILLA_WAITS_AND_CAPS_HOLD';
  readonly rule: string;
}

/**
 * Frozen manifest of the five floor/ceiling/platform/stair/donut
 * parity invariants this step pins.  A later step that wires these
 * dispatchers into the live world tick + save/load must preserve
 * all five.
 */
export const VANILLA_FLOOR_CEILING_PLAT_INVARIANTS: readonly VanillaFloorCeilingPlatInvariant[] = Object.freeze([
  Object.freeze({
    id: 'ACTIVE_SPECIALS_ARE_RESTORABLE_VIA_STASIS_HOOKS',
    rule: 'The ActivePlats / ActiveCeilings registries plus pActivateInStasis / pActivateInStasisCeiling are the active-special serialization/stasis-restore hooks; a paused (in-stasis) plat or crusher is re-activated by tag without spawning a duplicate thinker.',
  } satisfies VanillaFloorCeilingPlatInvariant),
  Object.freeze({
    id: 'EV_DISPATCHERS_RETURN_NONZERO_ONLY_WHEN_A_MOVER_SPAWNED',
    rule: 'evDoFloor / evDoCeiling / evDoPlat / evBuildStairs / evDoDonut return non-zero only when at least one plane mover was spawned, matching the vanilla if (EV_Do...()) P_ChangeSwitchTexture / line-clear guard.',
  } satisfies VanillaFloorCeilingPlatInvariant),
  Object.freeze({
    id: 'PLANE_SPEEDS_ARE_ONE_FRACUNIT_PER_TIC',
    rule: 'FLOORSPEED, CEILSPEED, and PLATSPEED each equal FRACUNIT (65536) — one map unit per tic, matching p_floor.c / p_ceilng.c / p_plats.c.',
  } satisfies VanillaFloorCeilingPlatInvariant),
  Object.freeze({
    id: 'STAIR_AND_DONUT_SPEEDS_DERIVE_FROM_FLOORSPEED',
    rule: 'STAIR_BUILD8_SPEED = FLOORSPEED / 4, STAIR_TURBO16_SPEED = FLOORSPEED * 4, DONUT_SPEED = FLOORSPEED / 2, with 8/16-unit stair step sizes.',
  } satisfies VanillaFloorCeilingPlatInvariant),
  Object.freeze({
    id: 'VANILLA_WAITS_AND_CAPS_HOLD',
    rule: 'CEILWAIT = 150 tics, PLATWAIT = 3 seconds (PLATWAIT_TICS = 105 at TICRATE 35), and the active-special caps MAXCEILINGS = MAXPLATS = 30 are preserved.',
  } satisfies VanillaFloorCeilingPlatInvariant),
]);
