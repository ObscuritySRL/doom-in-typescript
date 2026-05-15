/**
 * Vanilla DOOM 1.9 projectile-weapon wiring facade.
 *
 * Plan_final step `09-006` (lane: player-weapons-items) wires the
 * projectile weapons — rocket (`A_FireMissile`), plasma
 * (`A_FirePlasma`), BFG (`A_FireBFG` / `A_BFGSpray`) — together with
 * the projectile spawn (`P_SpawnPlayerMissile`), missile explosion
 * (`P_ExplodeMissile` + `P_RadiusAttack` splash), and the
 * damage/sound callbacks, over the read-only
 * `src/player/projectiles.ts` and `src/world/radiusAttack.ts`.
 *
 * Those modules already implement the byte-exact p_pspr.c /
 * p_mobj.c / p_map.c behavior and are SHA-pinned by the inventory;
 * this module does NOT modify them.  It is a pure re-export barrel
 * (value/type split for `verbatimModuleSyntax`, no `const enum`s)
 * plus a frozen invariants manifest.
 *
 * Five parity invariants this step pins:
 *
 *   1. `wireProjectileActions` registers exactly
 *      `PROJECTILE_ACTION_COUNT` = 4 weapon codepointers
 *      (A_FireMissile / A_FirePlasma / A_FireBFG / A_BFGSpray).
 *   2. Projectile auto-aim sweeps `PROJECTILE_AIM_RANGE` =
 *      16·64·FRACUNIT and nudges by `PROJECTILE_AIM_NUDGE` = 1<<26.
 *   3. A spawned missile starts at `MISSILE_SPAWN_Z_OFFSET` =
 *      4·8·FRACUNIT above the shooter and `checkMissileSpawn`
 *      advances it by a `MISSILE_TIC_JITTER_MASK`-masked tic.
 *   4. The BFG spray is `BFG_SPRAY_RAY_COUNT` = 40 rays across the
 *      `BFG_SPRAY_HALF_ARC` (ANG90/2) at `BFG_SPRAY_RAY_STEP`
 *      (ANG90/40), each ray rolling `BFG_SPRAY_DAMAGE_ROLLS` = 15
 *      damage units masked by `BFG_SPRAY_DAMAGE_MASK` = 7.
 *   5. `explodeMissile` resolves splash through `radiusAttack`
 *      (distance-falloff, line-of-sight gated).
 *
 * @example
 * ```ts
 * import { PROJECTILE_ACTION_COUNT, BFG_SPRAY_RAY_COUNT, VANILLA_PROJECTILE_WEAPON_INVARIANTS } from './wireProjectileWeapons.ts';
 * PROJECTILE_ACTION_COUNT;                        // 4
 * BFG_SPRAY_RAY_COUNT;                            // 40
 * VANILLA_PROJECTILE_WEAPON_INVARIANTS.length;    // 5
 * ```
 */

export {
  BFG_SPRAY_DAMAGE_MASK,
  BFG_SPRAY_DAMAGE_ROLLS,
  BFG_SPRAY_HALF_ARC,
  BFG_SPRAY_RAY_COUNT,
  BFG_SPRAY_RAY_STEP,
  EXTRABFG_Z_SHIFT,
  MISSILE_SPAWN_Z_OFFSET,
  MISSILE_TIC_JITTER_MASK,
  PLASMA_FLASH_JITTER_MASK,
  PROJECTILE_ACTION_COUNT,
  PROJECTILE_AIM_NUDGE,
  PROJECTILE_AIM_RANGE,
  aBFGSpray,
  aFireBFG,
  aFireMissile,
  aFirePlasma,
  checkMissileSpawn,
  explodeMissile,
  getProjectileContext,
  setProjectileContext,
  spawnPlayerMissile,
  wireProjectileActions,
} from '../player/projectiles.ts';
export type { ProjectileAimLineAttackFunction, ProjectileAimResult, ProjectileContext } from '../player/projectiles.ts';
export { radiusAttack } from '../world/radiusAttack.ts';
export type { CheckSightFunction, RadiusAttackCallbacks } from '../world/radiusAttack.ts';

/**
 * One pinned projectile-weapon parity invariant.
 */
export interface VanillaProjectileWeaponInvariant {
  readonly id: 'BFG_SPRAY_IS_40_RAYS_OVER_ANG90_HALF_ARC' | 'EXPLODE_MISSILE_APPLIES_RADIUS_ATTACK' | 'MISSILE_SPAWN_USES_FIXED_Z_OFFSET_AND_JITTER' | 'PROJECTILE_AUTOAIM_USES_AIM_RANGE_AND_NUDGE' | 'WIRE_REGISTERS_FOUR_PROJECTILE_ACTIONS';
  readonly rule: string;
}

/**
 * Frozen manifest of the five projectile-weapon parity invariants
 * this step pins.  A later step that wires the live weapon state
 * machine must preserve all five.
 */
export const VANILLA_PROJECTILE_WEAPON_INVARIANTS: readonly VanillaProjectileWeaponInvariant[] = Object.freeze([
  Object.freeze({
    id: 'BFG_SPRAY_IS_40_RAYS_OVER_ANG90_HALF_ARC',
    rule: 'aBFGSpray fires BFG_SPRAY_RAY_COUNT = 40 tracers across BFG_SPRAY_HALF_ARC (ANG90/2) at BFG_SPRAY_RAY_STEP (ANG90/40), each accumulating BFG_SPRAY_DAMAGE_ROLLS = 15 rolls masked by BFG_SPRAY_DAMAGE_MASK = 7, matching p_pspr.c A_BFGSpray.',
  } satisfies VanillaProjectileWeaponInvariant),
  Object.freeze({
    id: 'EXPLODE_MISSILE_APPLIES_RADIUS_ATTACK',
    rule: 'explodeMissile resolves splash damage through radiusAttack (linear distance falloff, line-of-sight gated), matching p_mobj.c P_ExplodeMissile -> p_map.c P_RadiusAttack.',
  } satisfies VanillaProjectileWeaponInvariant),
  Object.freeze({
    id: 'MISSILE_SPAWN_USES_FIXED_Z_OFFSET_AND_JITTER',
    rule: 'spawnPlayerMissile starts the missile at MISSILE_SPAWN_Z_OFFSET = 4*8*FRACUNIT above the shooter and checkMissileSpawn advances it by a MISSILE_TIC_JITTER_MASK (3)-masked tic; the plasma muzzle flash jitters by PLASMA_FLASH_JITTER_MASK = 1.',
  } satisfies VanillaProjectileWeaponInvariant),
  Object.freeze({
    id: 'PROJECTILE_AUTOAIM_USES_AIM_RANGE_AND_NUDGE',
    rule: 'Projectile auto-aim sweeps PROJECTILE_AIM_RANGE = 16*64*FRACUNIT and nudges the aim search by PROJECTILE_AIM_NUDGE = 1<<26 to each side, matching p_pspr.c P_SpawnPlayerMissile aim.',
  } satisfies VanillaProjectileWeaponInvariant),
  Object.freeze({
    id: 'WIRE_REGISTERS_FOUR_PROJECTILE_ACTIONS',
    rule: 'wireProjectileActions registers exactly PROJECTILE_ACTION_COUNT = 4 weapon codepointers: A_FireMissile, A_FirePlasma, A_FireBFG, A_BFGSpray.',
  } satisfies VanillaProjectileWeaponInvariant),
]);
