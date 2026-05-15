/**
 * Vanilla DOOM 1.9 monster look / chase / range facade.
 *
 * Plan_final step `10-003` (lane: ai-specials) wires the monster
 * movement brain: chase-direction selection (`P_NewChaseDir` /
 * `P_Move` / `P_TryWalk` / `A_Chase`), the melee-range and
 * missile-range decisions, and the active-sound emission, over the
 * read-only `src/ai/chase.ts`, `src/ai/meleeRange.ts`, and
 * `src/ai/missileRange.ts` modules.
 *
 * Those modules already implement the byte-exact p_enemy.c
 * behavior and are SHA-pinned by the inventory; this module does
 * NOT modify them.  It is a pure re-export barrel (value/type split
 * for `verbatimModuleSyntax`; the `DirType` `const enum` is
 * intentionally NOT re-exported) plus a frozen invariants manifest.
 * `TargetingContext` is surfaced from `meleeRange.ts` only (both
 * range modules re-export it) so the barrel has no duplicate names.
 *
 * Five parity invariants this step pins:
 *
 *   1. The chase-direction tables cover `NUMDIRS` = 9 (eight compass
 *      directions plus `NODIR`); `X_SPEED` / `Y_SPEED` use the
 *      vanilla 47000 diagonal momentum component.
 *   2. Floating monsters rise/sink at `FLOATSPEED` = 4·FRACUNIT.
 *   3. Melee range is `MELEERANGE` = 64·FRACUNIT; the actual reach
 *      cutoff is `MELEE_BASE_CUTOFF` = `MELEERANGE` −
 *      `MELEE_RADIUS_ADJUST` (20·FRACUNIT).
 *   4. Missile-range decisions use the per-archetype cutoffs/clamps
 *      (`MISSILE_BASE_CUTOFF`, `MISSILE_NO_MELEE_CUTOFF`,
 *      `MISSILE_DIST_CLAMP`, `MISSILE_CYBORG_DIST_CLAMP`,
 *      `MISSILE_VILE_DIST_MAX`, `MISSILE_UNDEAD_DIST_MIN`).
 *   5. `A_Chase` emits the monster's active sound while pursuing,
 *      through the injected `StartSoundFunction`.
 *
 * @example
 * ```ts
 * import { NUMDIRS, MELEERANGE, VANILLA_MONSTER_LOOK_CHASE_INVARIANTS } from './wireMonsterLookChase.ts';
 * NUMDIRS;                                         // 9
 * MELEERANGE;                                      // 4194304
 * VANILLA_MONSTER_LOOK_CHASE_INVARIANTS.length;    // 5
 * ```
 */

export { DIAGS, FLOATSPEED, NUMDIRS, OPPOSITE, X_SPEED, Y_SPEED, chase, move, newChaseDir, tryWalk } from '../ai/chase.ts';
export type { ChaseContext, StartSoundFunction, UseSpecialLineFunction } from '../ai/chase.ts';
export { MELEERANGE, MELEE_BASE_CUTOFF, MELEE_RADIUS_ADJUST, checkMeleeRange } from '../ai/meleeRange.ts';
export type { TargetingContext } from '../ai/meleeRange.ts';
export { MISSILE_BASE_CUTOFF, MISSILE_CYBORG_DIST_CLAMP, MISSILE_DIST_CLAMP, MISSILE_NO_MELEE_CUTOFF, MISSILE_UNDEAD_DIST_MIN, MISSILE_VILE_DIST_MAX, checkMissileRange } from '../ai/missileRange.ts';

/**
 * One pinned monster look/chase/range parity invariant.
 */
export interface VanillaMonsterLookChaseInvariant {
  readonly id: 'CHASE_DIR_TABLE_HAS_EIGHT_DIRS_PLUS_NODIR' | 'FLOATING_MONSTERS_USE_FLOATSPEED' | 'MELEE_RANGE_IS_64_FRACUNIT_LESS_RADIUS_ADJUST' | 'MISSILE_RANGE_USES_PER_ARCHETYPE_CUTOFFS' | 'MOVE_AND_CHASE_EMIT_ACTIVE_SOUND';
  readonly rule: string;
}

/**
 * Frozen manifest of the five monster look/chase/range parity
 * invariants this step pins.  A later step that wires the live
 * monster think loop must preserve all five.
 */
export const VANILLA_MONSTER_LOOK_CHASE_INVARIANTS: readonly VanillaMonsterLookChaseInvariant[] = Object.freeze([
  Object.freeze({
    id: 'CHASE_DIR_TABLE_HAS_EIGHT_DIRS_PLUS_NODIR',
    rule: 'NUMDIRS = 9 (eight compass directions plus NODIR); X_SPEED / Y_SPEED are length-8 momentum tables using the vanilla 47000 diagonal component, and OPPOSITE / DIAGS index by DirType, matching p_enemy.c P_NewChaseDir.',
  } satisfies VanillaMonsterLookChaseInvariant),
  Object.freeze({
    id: 'FLOATING_MONSTERS_USE_FLOATSPEED',
    rule: 'A floating monster adjusts its z toward the target at FLOATSPEED = 4*FRACUNIT per tic, matching the MF_FLOAT branch of P_Move.',
  } satisfies VanillaMonsterLookChaseInvariant),
  Object.freeze({
    id: 'MELEE_RANGE_IS_64_FRACUNIT_LESS_RADIUS_ADJUST',
    rule: 'checkMeleeRange uses MELEERANGE = 64*FRACUNIT with the actual reach cutoff MELEE_BASE_CUTOFF = MELEERANGE - MELEE_RADIUS_ADJUST (20*FRACUNIT), matching p_enemy.c P_CheckMeleeRange.',
  } satisfies VanillaMonsterLookChaseInvariant),
  Object.freeze({
    id: 'MISSILE_RANGE_USES_PER_ARCHETYPE_CUTOFFS',
    rule: 'checkMissileRange uses MISSILE_BASE_CUTOFF / MISSILE_NO_MELEE_CUTOFF and the per-archetype clamps MISSILE_DIST_CLAMP, MISSILE_CYBORG_DIST_CLAMP, MISSILE_VILE_DIST_MAX, MISSILE_UNDEAD_DIST_MIN, matching p_enemy.c P_CheckMissileRange.',
  } satisfies VanillaMonsterLookChaseInvariant),
  Object.freeze({
    id: 'MOVE_AND_CHASE_EMIT_ACTIVE_SOUND',
    rule: 'A_Chase emits the monster active sound while pursuing (P_Random < 3 gate) through the injected StartSoundFunction, matching p_enemy.c A_Chase.',
  } satisfies VanillaMonsterLookChaseInvariant),
]);
