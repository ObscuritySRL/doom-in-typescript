/**
 * Vanilla DOOM 1.9 monster-attack codepointer facade.
 *
 * Plan_final step `10-004` (lane: ai-specials) wires the monster
 * attack codepointers for the shareware (Knee-Deep in the Dead)
 * roster — zombieman, shotgun guy, chaingunner, imp, demon/spectre,
 * cacodemon, and the Baron of Hell (the E1M8 boss) — together with
 * the shared `A_FaceTarget` pre-attack turn, over the read-only
 * `src/ai/attacks.ts` module.
 *
 * That module already implements the byte-exact p_enemy.c attack
 * codepointers and is SHA-pinned by the inventory; this module does
 * NOT modify it.  It is a pure re-export barrel (value/type split
 * for `verbatimModuleSyntax`, no `const enum`s) plus a frozen
 * invariants manifest.  The full 105-codepointer registry stays
 * owned by `attacks.ts`; this facade surfaces the named-roster
 * attacks plus the registry count / wiring entry point.
 *
 * Five parity invariants this step pins:
 *
 *   1. `A_FaceTarget` runs before every monster attack codepointer,
 *      turning the actor to its target (with the shadow-target
 *      angle jitter), matching p_enemy.c.
 *   2. The hitscan zombies use `A_PosAttack` (zombieman),
 *      `A_SPosAttack` (shotgun guy, 3-pellet spread), and
 *      `A_CPosAttack` / `A_CPosRefire` (chaingunner).
 *   3. `A_TroopAttack` (imp) and `A_BruisAttack` (baron) each branch:
 *      melee bite/claw when in melee range, else spawn the missile.
 *   4. `A_SargAttack` (demon/spectre) is a pure melee bite — no
 *      projectile branch.
 *   5. `wireMonsterAttackActions` registers exactly
 *      `MONSTER_ATTACK_ACTION_COUNT` = 105 codepointers.
 *
 * @example
 * ```ts
 * import { MONSTER_ATTACK_ACTION_COUNT, aTroopAttack, VANILLA_MONSTER_ATTACK_INVARIANTS } from './wireMonsterAttacks.ts';
 * MONSTER_ATTACK_ACTION_COUNT;                  // 105
 * typeof aTroopAttack;                          // 'function'
 * VANILLA_MONSTER_ATTACK_INVARIANTS.length;     // 5
 * ```
 */

export {
  MONSTER_ATTACK_ACTION_COUNT,
  aBruisAttack,
  aCPosAttack,
  aCPosRefire,
  aFaceTarget,
  aHeadAttack,
  aPosAttack,
  aSPosAttack,
  aSargAttack,
  aTroopAttack,
  getMonsterAttackContext,
  setMonsterAttackContext,
  wireMonsterAttackActions,
} from '../ai/attacks.ts';
export type { MonsterAttackContext } from '../ai/attacks.ts';

/**
 * One pinned monster-attack parity invariant.
 */
export interface VanillaMonsterAttackInvariant {
  readonly id: 'FACE_TARGET_PRECEDES_EVERY_MONSTER_ATTACK' | 'HITSCAN_ZOMBIES_USE_POS_SPOS_CPOS_ATTACKS' | 'IMP_AND_BARON_HAVE_MELEE_OR_MISSILE_BRANCHES' | 'MONSTER_ATTACK_REGISTRY_HAS_105_ACTIONS' | 'SARG_DEMON_ATTACK_IS_PURE_MELEE_BITE';
  readonly rule: string;
}

/**
 * Frozen manifest of the five monster-attack parity invariants this
 * step pins.  A later step that wires the live monster think loop
 * must preserve all five.
 */
export const VANILLA_MONSTER_ATTACK_INVARIANTS: readonly VanillaMonsterAttackInvariant[] = Object.freeze([
  Object.freeze({
    id: 'FACE_TARGET_PRECEDES_EVERY_MONSTER_ATTACK',
    rule: 'A_FaceTarget turns the actor toward its target before the attack codepointer fires, applying the shadow-target (MF_SHADOW) angle jitter, matching p_enemy.c A_FaceTarget.',
  } satisfies VanillaMonsterAttackInvariant),
  Object.freeze({
    id: 'HITSCAN_ZOMBIES_USE_POS_SPOS_CPOS_ATTACKS',
    rule: 'Zombieman uses A_PosAttack (single bullet), shotgun guy A_SPosAttack (3-pellet spread), and chaingunner A_CPosAttack with A_CPosRefire as the refire gate, matching p_enemy.c.',
  } satisfies VanillaMonsterAttackInvariant),
  Object.freeze({
    id: 'IMP_AND_BARON_HAVE_MELEE_OR_MISSILE_BRANCHES',
    rule: 'A_TroopAttack (imp) and A_BruisAttack (Baron of Hell, the E1M8 shareware boss) each do a melee attack when in melee range, otherwise spawn the corresponding missile, matching p_enemy.c.',
  } satisfies VanillaMonsterAttackInvariant),
  Object.freeze({
    id: 'MONSTER_ATTACK_REGISTRY_HAS_105_ACTIONS',
    rule: 'wireMonsterAttackActions registers exactly MONSTER_ATTACK_ACTION_COUNT = 105 monster-attack codepointers (the full p_enemy.c action set, of which this facade surfaces the shareware-roster subset).',
  } satisfies VanillaMonsterAttackInvariant),
  Object.freeze({
    id: 'SARG_DEMON_ATTACK_IS_PURE_MELEE_BITE',
    rule: 'A_SargAttack (demon / spectre) is a pure melee bite with no projectile branch, matching p_enemy.c A_SargAttack.',
  } satisfies VanillaMonsterAttackInvariant),
]);
