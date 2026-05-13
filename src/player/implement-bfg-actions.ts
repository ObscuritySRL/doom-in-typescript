/**
 * Vanilla DOOM 1.9 A_FireBFG / A_BFGSpray psprite contract.
 *
 * From Chocolate Doom 2.2.1 p_pspr.c:
 *   A_FireBFG:
 *     - Consumes BFGCELLS = 40 cell ammo per shot.
 *     - Spawns MT_BFG projectile via P_SpawnPlayerMissile.
 *     - Plays SFX_BFG fire sound.
 *
 *   A_BFGSpray (called when MT_BFG hits something):
 *     - Spawns 40 MT_EXTRABFG rays in 90-degree spread (angle += ANG90/40 per ray).
 *     - Each ray does damage = (P_Random()&7+1) * (P_Random()&7+1) * 15
 *       — but actually iterates summing damage from 15 P_Random rolls.
 *     - Actually vanilla: damage = sum of (P_Random()&7+1) over 15 iterations
 *       per spray ray, then * 15? Let me restate from canonical source:
 *
 *   The vanilla A_BFGSpray damage formula per ray:
 *     damage = 0;
 *     for (j = 0; j < 15; j++)
 *       damage += (P_Random() & 7) + 1;
 *     // damage range: 15..120 per ray (mean ~75)
 */

export const VANILLA_BFG_CELLS_PER_SHOT = 40;
export const VANILLA_BFG_PROJECTILE_TYPE = 'MT_BFG';
export const VANILLA_BFG_SPRAY_RAY_COUNT = 40;
export const VANILLA_BFG_SPRAY_DAMAGE_ROLLS = 15;
export const VANILLA_BFG_SPRAY_DAMAGE_MASK = 7;
export const VANILLA_BFG_SPRAY_TOTAL_ANGLE_SWEEP = 0x40000000; // ANG90

export function computeBfgSprayRayDamage(randomBytes: readonly number[]): number {
  let damage = 0;
  for (let j = 0; j < VANILLA_BFG_SPRAY_DAMAGE_ROLLS; j++) {
    damage += (randomBytes[j] ?? 0) & VANILLA_BFG_SPRAY_DAMAGE_MASK;
    damage += 1;
  }
  return damage;
}
