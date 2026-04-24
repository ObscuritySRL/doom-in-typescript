/**
 * P_CheckMeleeRange from p_enemy.c.
 *
 * Canonical gate used by every monster's Chase step to decide between
 * walking toward the target and transitioning to its meleestate. For
 * C1 we emulate gameversion 1.9, so the 1.5+ formula applies:
 *
 *   cutoff = MELEERANGE - 20*FRACUNIT + target.info.radius
 *   melee? = dist < cutoff && P_CheckSight(actor, target)
 *
 * Parity-critical details preserved from Chocolate Doom:
 *
 * - `dist` is the octagonal P_AproxDistance (`ax + ay - min(ax,ay)/2`),
 *   not the Euclidean norm — so a target at (45,45) reads as 56 map
 *   units, not 63.
 * - The comparison is strict `>=`: a target sitting exactly at the
 *   cutoff is out of range and no melee fires that tic.
 * - The radius adjustment is the TARGET's radius, not the actor's —
 *   wide targets (barrels, demons) can be struck from slightly further
 *   away because their bounding cylinder already closes the gap.
 * - P_CheckSight is required and REJECT-gated; any sight short-circuit
 *   (reject bit, closed opening, slope occlusion) blocks the melee.
 * - Returns false with no side effects when `actor.target` is null.
 * - Consumes no RNG.
 *
 * The implementation lives in `./targeting.ts` alongside the sight
 * primitives it depends on; this module re-exports it as the canonical
 * entry point and exposes the load-bearing constants for reuse.
 *
 * @example
 * ```ts
 * import { checkMeleeRange } from "../src/ai/meleeRange.ts";
 * if (actor.info.meleestate !== 0 && checkMeleeRange(actor, context)) {
 *   setMobjState(actor, actor.info.meleestate, thinkerList);
 * }
 * ```
 */

import type { Fixed } from '../core/fixed.ts';
import { FRACUNIT } from '../core/fixed.ts';

export { checkMeleeRange } from './targeting.ts';
export type { TargetingContext } from './targeting.ts';

/** `MELEERANGE` from p_local.h: `64 * FRACUNIT` (0x40_0000). */
export const MELEERANGE: Fixed = (64 * FRACUNIT) | 0;

/**
 * `20 * FRACUNIT` — the radius adjustment added in exe_doom_1_5+.
 * P_CheckMeleeRange uses `MELEERANGE - 20*FRACUNIT + target.info.radius`
 * as the cutoff so wider targets are reachable from slightly further
 * away. At the base roster's default radii (barrels 10, most monsters
 * 20, cacodemon 31, mancubus 48), the practical cutoff spans 54–92
 * map units.
 */
export const MELEE_RADIUS_ADJUST: Fixed = (20 * FRACUNIT) | 0;

/**
 * `MELEERANGE - MELEE_RADIUS_ADJUST` = `44 * FRACUNIT` — the distance
 * cutoff when the target has no info record (info === null) or a
 * zero-radius info. Vanilla would crash on null info; we return the
 * conservative fall-back to keep the port null-safe without changing
 * observed behavior for any spawnable mobj.
 */
export const MELEE_BASE_CUTOFF: Fixed = (MELEERANGE - MELEE_RADIUS_ADJUST) | 0;
