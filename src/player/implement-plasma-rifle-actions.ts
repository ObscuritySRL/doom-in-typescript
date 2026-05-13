/**
 * Vanilla DOOM 1.9 A_FirePlasma psprite contract.
 *
 * From Chocolate Doom 2.2.1 p_pspr.c A_FirePlasma:
 *   - Consumes 1 cell ammo per shot.
 *   - Spawns MT_PLASMA projectile via P_SpawnPlayerMissile.
 *   - Picks one of two muzzle-flash states (PLS1 or PLS2) via P_Random() & 1.
 *   - No bullet spread on plasma (projectile flies straight).
 *   - Plays SFX_PLASMA.
 */

export const VANILLA_PLASMA_AMMO_PER_SHOT = 1;
export const VANILLA_PLASMA_PROJECTILE_TYPE = 'MT_PLASMA';
export const VANILLA_PLASMA_MUZZLE_FLASH_STATE_COUNT = 2;

export function pickPlasmaMuzzleFlashState(randomByte: number): 0 | 1 {
  return (randomByte & 1) as 0 | 1;
}
