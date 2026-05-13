/**
 * Vanilla DOOM 1.9 A_FireMissile psprite contract.
 *
 * From Chocolate Doom 2.2.1 p_pspr.c A_FireMissile:
 *   - Consumes 1 rocket ammo per shot.
 *   - Spawns MT_ROCKET projectile via P_SpawnPlayerMissile.
 *   - No bullet spread; rocket flies straight from psprite firing position.
 *   - Plays SFX_RLAUNC (rocket launcher sound).
 *   - Rocket explodes via A_Explode on contact with mobj or wall.
 *
 * Rocket explosion damage: P_RadiusAttack with damage=128, radius=128 map units.
 */

export const VANILLA_ROCKET_AMMO_PER_SHOT = 1;
export const VANILLA_ROCKET_PROJECTILE_TYPE = 'MT_ROCKET';
export const VANILLA_ROCKET_EXPLOSION_DAMAGE = 128;
export const VANILLA_ROCKET_EXPLOSION_RADIUS = 128;

export interface RocketFireContract {
  readonly ammoPerShot: number;
  readonly projectileType: string;
  readonly explosionDamage: number;
  readonly explosionRadius: number;
}

export function getVanillaRocketContract(): RocketFireContract {
  return Object.freeze({
    ammoPerShot: VANILLA_ROCKET_AMMO_PER_SHOT,
    projectileType: VANILLA_ROCKET_PROJECTILE_TYPE,
    explosionDamage: VANILLA_ROCKET_EXPLOSION_DAMAGE,
    explosionRadius: VANILLA_ROCKET_EXPLOSION_RADIUS,
  });
}
