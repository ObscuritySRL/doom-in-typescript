/**
 * Vanilla DOOM 1.9 mobj state-transition facade.
 *
 * Plan_final step `10-005` (lane: ai-specials) wires the mobj
 * state-transition path — `P_SetMobjState` plus the pain / death /
 * gib / explode / fall codepointers and their death sound events —
 * over the read-only `src/ai/stateTransitions.ts` and the
 * `src/world/mobj.ts` `setMobjState` primitive.
 *
 * Those modules already implement the byte-exact p_mobj.c
 * `P_SetMobjState` and p_enemy.c pain/death codepointers and are
 * SHA-pinned by the inventory; this module does NOT modify them.
 * It is a pure re-export barrel (value/type split for
 * `verbatimModuleSyntax`; the `StateNum` / `SpriteNum` / `MobjType`
 * `const enum`s from mobj.ts are intentionally NOT re-exported)
 * plus a frozen invariants manifest.
 *
 * Five parity invariants this step pins:
 *
 *   1. Every animation/pain/death/missile/respawn transition goes
 *      through `setMobjState` (`P_SetMobjState`), which walks the
 *      STATES tics chain and runs each state's action.
 *   2. `wirePainDeathActions` registers exactly
 *      `PAIN_DEATH_ACTION_COUNT` = 69 codepointers (A_Pain /
 *      A_Scream / A_XScream / A_PlayerScream / A_Fall / A_Explode …).
 *   3. `A_Explode` deals `EXPLODE_DAMAGE` = 128 splash via the
 *      injected radius-attack callback.
 *   4. A player whose health drops below
 *      `PLAYER_SCREAM_GIB_HEALTH` = −50 plays the high gib death
 *      scream instead of the normal death scream.
 *   5. Death sound events use the fixed vanilla sfx ids
 *      (`SFX_SLOP` 31, `SFX_PLDETH` 54, `SFX_PDIEHI` 55,
 *      `SFX_PODTH1..3` 56–58, `SFX_BGDTH1..2` 59–60).
 *
 * @example
 * ```ts
 * import { PAIN_DEATH_ACTION_COUNT, EXPLODE_DAMAGE, VANILLA_STATE_TRANSITION_INVARIANTS } from './wireStateTransitions.ts';
 * PAIN_DEATH_ACTION_COUNT;                       // 69
 * EXPLODE_DAMAGE;                                // 128
 * VANILLA_STATE_TRANSITION_INVARIANTS.length;    // 5
 * ```
 */

export {
  EXPLODE_DAMAGE,
  PAIN_DEATH_ACTION_COUNT,
  PLAYER_SCREAM_GIB_HEALTH,
  SFX_BGDTH1,
  SFX_BGDTH2,
  SFX_PDIEHI,
  SFX_PLDETH,
  SFX_PODTH1,
  SFX_PODTH2,
  SFX_PODTH3,
  SFX_SLOP,
  aExplode,
  aFall,
  aPain,
  aPlayerScream,
  aScream,
  aXScream,
  clearStateTransitionContext,
  getStateTransitionContext,
  setStateTransitionContext,
  wirePainDeathActions,
} from '../ai/stateTransitions.ts';
export type { RadiusAttackCallback, StartSoundFunction, StateTransitionContext } from '../ai/stateTransitions.ts';
export { setMobjState } from '../world/mobj.ts';
export type { Mobj } from '../world/mobj.ts';

/**
 * One pinned mobj state-transition parity invariant.
 */
export interface VanillaStateTransitionInvariant {
  readonly id: 'EXPLODE_DAMAGE_IS_128_VIA_RADIUS_CALLBACK' | 'GIB_DEATH_BELOW_NEGATIVE_FIFTY_HEALTH' | 'PAIN_DEATH_REGISTRY_HAS_69_ACTIONS' | 'SET_MOBJ_STATE_DRIVES_ALL_TRANSITIONS' | 'SOUND_EVENTS_USE_FIXED_DEATH_SFX_IDS';
  readonly rule: string;
}

/**
 * Frozen manifest of the five mobj state-transition parity
 * invariants this step pins.  A later step that wires the live
 * thinker tick must preserve all five.
 */
export const VANILLA_STATE_TRANSITION_INVARIANTS: readonly VanillaStateTransitionInvariant[] = Object.freeze([
  Object.freeze({
    id: 'EXPLODE_DAMAGE_IS_128_VIA_RADIUS_CALLBACK',
    rule: 'A_Explode applies EXPLODE_DAMAGE = 128 splash damage through the injected radius-attack callback, matching p_enemy.c A_Explode -> P_RadiusAttack(thing, thing->target, 128).',
  } satisfies VanillaStateTransitionInvariant),
  Object.freeze({
    id: 'GIB_DEATH_BELOW_NEGATIVE_FIFTY_HEALTH',
    rule: 'A player whose health falls below PLAYER_SCREAM_GIB_HEALTH = -50 plays the high gib death scream (SFX_PDIEHI) instead of SFX_PLDETH, matching p_enemy.c A_PlayerScream.',
  } satisfies VanillaStateTransitionInvariant),
  Object.freeze({
    id: 'PAIN_DEATH_REGISTRY_HAS_69_ACTIONS',
    rule: 'wirePainDeathActions registers exactly PAIN_DEATH_ACTION_COUNT = 69 pain/death/fall/explode codepointers (A_Pain, A_Scream, A_XScream, A_PlayerScream, A_Fall, A_Explode, ...).',
  } satisfies VanillaStateTransitionInvariant),
  Object.freeze({
    id: 'SET_MOBJ_STATE_DRIVES_ALL_TRANSITIONS',
    rule: 'Every animation / pain / death / missile / respawn transition is driven by setMobjState (P_SetMobjState), which walks the STATES tics chain and runs each state action; mobjstate S_NULL removes the mobj.',
  } satisfies VanillaStateTransitionInvariant),
  Object.freeze({
    id: 'SOUND_EVENTS_USE_FIXED_DEATH_SFX_IDS',
    rule: 'Death sound events use the fixed vanilla sfx ids SFX_SLOP 31, SFX_PLDETH 54, SFX_PDIEHI 55, SFX_PODTH1..3 56-58, SFX_BGDTH1..2 59-60.',
  } satisfies VanillaStateTransitionInvariant),
]);
