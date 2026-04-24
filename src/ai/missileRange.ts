/**
 * P_CheckMissileRange from p_enemy.c.
 *
 * Gates monster ranged attacks by sight, MF_JUSTHIT retaliation,
 * `reactiontime`, distance rolled against `P_Random()`, and per-type
 * distance overrides. Returns true if the actor should swing/fire
 * this tic.
 *
 * Evaluation order (parity-critical):
 *   1. `actor.target == null` → false (no sight call, no RNG).
 *   2. `P_CheckSight(actor, actor.target)` false → false (advances
 *      validCount via the sight call but consumes no RNG).
 *   3. `MF_JUSTHIT` set → clear the flag and return true
 *      (retaliation always fires, zero RNG).
 *   4. `reactiontime > 0` → false (zero RNG).
 *   5. `dist = P_AproxDistance(dx, dy) - 64*FRACUNIT`.
 *      If `info.meleestate == 0` (no melee state), subtract another
 *      `128*FRACUNIT` so melee-less monsters fire from further away.
 *      Shift down by FRACBITS so `dist` is in map units.
 *   6. Per-type overrides (applied in order):
 *      - VILE: if `dist > 14*64` → false (hard-caps vile fire at
 *        ~896 map units — never consumes RNG on the rejection path).
 *      - UNDEAD (revenant): if `dist < 196` → false (never consumes
 *        RNG on the rejection path); else `dist >>= 1`.
 *      - CYBORG / SPIDER / SKULL: `dist >>= 1`.
 *   7. `dist = min(dist, 200)`; additionally `min(dist, 160)` for CYBORG.
 *   8. `return P_Random() >= dist` (exactly one RNG consumption).
 *
 * Parity-sensitive details:
 * - The `dist` short-circuits in steps 6 (VILE/UNDEAD) happen BEFORE
 *   the single `P_Random()` call — on those paths the RNG stream
 *   position is unchanged.
 * - The base cutoff uses the TARGET-relative octagonal
 *   `P_AproxDistance(ax+ay-min(ax,ay)/2)`, not Euclidean.
 * - The `info.meleestate == 0` subtraction is only exercised by
 *   CYBORG and SPIDER in the base roster; every other missile-capable
 *   monster also has a melee state.
 * - VILE (3), UNDEAD (5), CYBORG (21), SPIDER (19), and SKULL (18)
 *   are the five MobjType indices with per-type distance overrides.
 * - The final clamp orders `>>= 1` before the 200/160 ceilings, so
 *   CYBORG at very high raw distance sees the halved value hit 160,
 *   not 100.
 *
 * The implementation lives in `./targeting.ts` alongside the sight
 * primitives it depends on; this module re-exports it as the canonical
 * entry point and exposes the load-bearing constants for reuse.
 *
 * @example
 * ```ts
 * import { checkMissileRange } from "../src/ai/missileRange.ts";
 * if (actor.info.missilestate !== 0 && checkMissileRange(actor, ctx, rng)) {
 *   actor.flags |= MF_JUSTATTACKED;
 *   setMobjState(actor, actor.info.missilestate, thinkerList);
 * }
 * ```
 */

export { checkMissileRange } from './targeting.ts';
export type { TargetingContext } from './targeting.ts';
export { MISSILE_BASE_CUTOFF, MISSILE_NO_MELEE_CUTOFF, MISSILE_DIST_CLAMP, MISSILE_CYBORG_DIST_CLAMP, MISSILE_VILE_DIST_MAX, MISSILE_UNDEAD_DIST_MIN } from './targeting.ts';
