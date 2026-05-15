/**
 * Vanilla DOOM 1.9 damage / target-acquisition / sound-propagation
 * facade.
 *
 * Plan_final step `10-002` (lane: ai-specials) wires the shared
 * combat primitives: line-of-sight target acquisition
 * (`P_CheckSight` / `P_LookForPlayers`), melee/missile range
 * decisions (`P_CheckMeleeRange` / `P_CheckMissileRange`), the
 * radius (splash) attack (`P_RadiusAttack`), and sound target
 * propagation (`P_NoiseAlert`), over the read-only
 * `src/ai/targeting.ts`, `src/ai/soundPropagation.ts`, and
 * `src/world/radiusAttack.ts` modules.
 *
 * Those modules already implement the byte-exact p_enemy.c /
 * p_sight.c / p_map.c behavior and are SHA-pinned by the inventory;
 * this module does NOT modify them.  It is a pure re-export barrel
 * (value/type split for `verbatimModuleSyntax`, no `const enum`s)
 * plus a frozen invariants manifest.
 *
 * Five parity invariants this step pins:
 *
 *   1. Target acquisition requires line of sight: `lookForPlayers`
 *      only wakes on a `checkSight`-visible player.
 *   2. The forward-vs-360 vision is gated by `lookForPlayers`'s
 *      `allaround` flag (a sleeping monster only sees its ~180°
 *      front arc until alerted).
 *   3. Melee/missile range use the fixed vanilla cutoffs
 *      (`MISSILE_BASE_CUTOFF` = 64·FRACUNIT, `_NO_MELEE_CUTOFF` =
 *      128·FRACUNIT) with the per-archetype distance clamps
 *      (`MISSILE_DIST_CLAMP` 200, `_CYBORG_DIST_CLAMP` 160,
 *      `_VILE_DIST_MAX` 896, `_UNDEAD_DIST_MIN` 196).
 *   4. `radiusAttack` applies splash damage that falls off with
 *      distance and is gated by the line-of-sight callback.
 *   5. `noiseAlert` flood-fills the wake-up through sound-blocking
 *      lines using the generation-stamped `SoundState` from
 *      `createSoundState`.
 *
 * @example
 * ```ts
 * import { createSoundState, MISSILE_BASE_CUTOFF, VANILLA_DAMAGE_TARGETING_INVARIANTS } from './wireDamageAndTargeting.ts';
 * createSoundState(4).sectorValidcount.length;          // 4
 * MISSILE_BASE_CUTOFF;                                   // 4194304
 * VANILLA_DAMAGE_TARGETING_INVARIANTS.length;            // 5
 * ```
 */

export {
  MISSILE_BASE_CUTOFF,
  MISSILE_CYBORG_DIST_CLAMP,
  MISSILE_DIST_CLAMP,
  MISSILE_NO_MELEE_CUTOFF,
  MISSILE_UNDEAD_DIST_MIN,
  MISSILE_VILE_DIST_MAX,
  checkMeleeRange,
  checkMissileRange,
  checkSight,
  lookForPlayers,
} from '../ai/targeting.ts';
export type { PlayerLike, TargetingContext } from '../ai/targeting.ts';
export { createSoundState, noiseAlert } from '../ai/soundPropagation.ts';
export type { SoundState } from '../ai/soundPropagation.ts';
export { radiusAttack } from '../world/radiusAttack.ts';
export type { CheckSightFunction, RadiusAttackCallbacks } from '../world/radiusAttack.ts';

/**
 * One pinned damage / targeting / sound-propagation parity invariant.
 */
export interface VanillaDamageTargetingInvariant {
  readonly id:
    | 'LOOKFORPLAYERS_FOV_GATED_BY_ALLAROUND'
    | 'MELEE_AND_MISSILE_RANGE_USE_FIXED_CUTOFFS'
    | 'NOISE_ALERT_FLOOD_FILLS_THROUGH_SOUND_LINES'
    | 'RADIUS_ATTACK_DAMAGE_FALLS_OFF_BY_DISTANCE'
    | 'TARGET_ACQUISITION_REQUIRES_LINE_OF_SIGHT';
  readonly rule: string;
}

/**
 * Frozen manifest of the five damage / targeting / sound-propagation
 * parity invariants this step pins.  A later step that wires the
 * live monster think loop must preserve all five.
 */
export const VANILLA_DAMAGE_TARGETING_INVARIANTS: readonly VanillaDamageTargetingInvariant[] = Object.freeze([
  Object.freeze({
    id: 'LOOKFORPLAYERS_FOV_GATED_BY_ALLAROUND',
    rule: 'lookForPlayers only scans the ~180-degree front arc until the allaround flag is set (a freshly-spawned monster cannot see a player behind it), matching p_enemy.c P_LookForPlayers.',
  } satisfies VanillaDamageTargetingInvariant),
  Object.freeze({
    id: 'MELEE_AND_MISSILE_RANGE_USE_FIXED_CUTOFFS',
    rule: 'checkMeleeRange / checkMissileRange use the fixed cutoffs MISSILE_BASE_CUTOFF (64*FRACUNIT) and MISSILE_NO_MELEE_CUTOFF (128*FRACUNIT) with the per-archetype clamps MISSILE_DIST_CLAMP 200, MISSILE_CYBORG_DIST_CLAMP 160, MISSILE_VILE_DIST_MAX 896, MISSILE_UNDEAD_DIST_MIN 196.',
  } satisfies VanillaDamageTargetingInvariant),
  Object.freeze({
    id: 'NOISE_ALERT_FLOOD_FILLS_THROUGH_SOUND_LINES',
    rule: 'noiseAlert flood-fills the wake-up through sound-blocking lines using the generation-stamped SoundState created by createSoundState (validcount advances once per alert; per-sector stamps gate revisits).',
  } satisfies VanillaDamageTargetingInvariant),
  Object.freeze({
    id: 'RADIUS_ATTACK_DAMAGE_FALLS_OFF_BY_DISTANCE',
    rule: 'radiusAttack applies splash damage that falls off linearly with distance from the spot and is gated by the line-of-sight callback, matching p_map.c P_RadiusAttack / PIT_RadiusAttack.',
  } satisfies VanillaDamageTargetingInvariant),
  Object.freeze({
    id: 'TARGET_ACQUISITION_REQUIRES_LINE_OF_SIGHT',
    rule: 'lookForPlayers acquires a target only when checkSight reports an unobstructed line of sight to that player, matching p_sight.c P_CheckSight.',
  } satisfies VanillaDamageTargetingInvariant),
]);
