/**
 * Vanilla DOOM 1.9 A_FireShotgun psprite contract.
 *
 * From Chocolate Doom 2.2.1 p_pspr.c A_FireShotgun and p_map.c P_GunShot:
 *   - Consumes 1 shell ammo on fire.
 *   - Fires 7 pellets via P_GunShot with vanilla bullet damage formula:
 *       damage = 5 * (P_Random() % 3 + 1)  (vanilla bullet base damage)
 *   - Each pellet uses A_BulletSlope (autoaim) with bullet spread:
 *       angle += (P_Random() - P_Random()) << 18   (1/128 angle units spread)
 *   - Plays SFX_SHOTGN.
 *   - Sets player.refire = 0 (no refire damping on shotgun).
 */

export const VANILLA_SHOTGUN_PELLET_COUNT = 7;
export const VANILLA_SHOTGUN_AMMO_PER_SHOT = 1;
export const VANILLA_BULLET_DAMAGE_BASE = 5;
export const VANILLA_BULLET_DAMAGE_MULTIPLIER_MAX = 3;
export const VANILLA_BULLET_SPREAD_ANGLE_SHIFT = 18;

export function computeShotgunPelletDamage(randomBytes: readonly number[]): number {
  // damage = 5 * (P_Random() % 3 + 1)
  const r = randomBytes[0] ?? 0;
  return VANILLA_BULLET_DAMAGE_BASE * ((r % VANILLA_BULLET_DAMAGE_MULTIPLIER_MAX) + 1);
}

export function computeBulletSpreadAngleDelta(randomA: number, randomB: number): number {
  return ((randomA - randomB) << VANILLA_BULLET_SPREAD_ANGLE_SHIFT) | 0;
}
