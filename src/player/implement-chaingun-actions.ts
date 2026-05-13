/**
 * Vanilla DOOM 1.9 A_FireCGun psprite contract.
 *
 * From Chocolate Doom 2.2.1 p_pspr.c A_FireCGun and p_map.c P_GunShot:
 *   - Consumes 1 clip ammo per shot.
 *   - Fires 1 bullet via P_GunShot with bullet damage 5*(rng%3+1).
 *   - Uses A_BulletSlope (autoaim).
 *   - When player.refire is set, adds bullet spread: angle += (rng-rng)<<18.
 *   - When refire is 0, fires without spread (accurate first shot).
 *   - Plays SFX_PISTOL (chaingun reuses pistol sound).
 *   - Cycles between two psprite states (CHAIN1/CHAIN2) for muzzle flash.
 */

export const VANILLA_CHAINGUN_AMMO_PER_SHOT = 1;
export const VANILLA_CHAINGUN_PSPRITE_FRAME_COUNT = 2;
export const VANILLA_CHAINGUN_BULLET_DAMAGE_BASE = 5;
export const VANILLA_CHAINGUN_BULLET_DAMAGE_MULTIPLIER_MAX = 3;

export interface ChainGunFireInput {
  readonly refireSet: boolean;
  readonly randomDamage: number;
  readonly randomAngleA: number;
  readonly randomAngleB: number;
}

export interface ChainGunFireResult {
  readonly damage: number;
  readonly angleDelta: number;
}

export function applyChainGunFire(input: ChainGunFireInput): ChainGunFireResult {
  const damage = VANILLA_CHAINGUN_BULLET_DAMAGE_BASE * ((input.randomDamage % VANILLA_CHAINGUN_BULLET_DAMAGE_MULTIPLIER_MAX) + 1);
  const angleDelta = input.refireSet ? ((input.randomAngleA - input.randomAngleB) << 18) | 0 : 0;
  return Object.freeze({ damage, angleDelta });
}
