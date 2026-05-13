/**
 * Vanilla DOOM 1.9 P_CheckMissileRange contract.
 *
 * From Chocolate Doom 2.2.1 p_enemy.c P_CheckMissileRange:
 *   Decides whether a monster fires a missile at its target.
 *   Per-monster-type:
 *     - MT_VILE (archvile): only attacks if MISSILERANGE
 *     - Most monsters: random chance scaled by distance.
 *
 *   dist = P_AproxDistance(target.x - mo.x, target.y - mo.y) - 64.
 *   Skull/melee monster: dist /= 2 (more aggressive at range)
 *   Limit dist to 200 max.
 *   if (P_Random() < dist) return false (no missile this tic).
 *
 * Distance approx: |dx| + |dy|/2 (vanilla P_AproxDistance).
 */

export const VANILLA_MISSILE_DISTANCE_OFFSET = 64;
export const VANILLA_MISSILE_DISTANCE_CAP = 200;
export const VANILLA_MELEE_DISTANCE_HALVE_DIVISOR = 2;

export interface MissileRangeInput {
  readonly dx: number;
  readonly dy: number;
  readonly hasMeleeAttack: boolean;
  readonly randomByte: number;
}

export function approxDistance(dx: number, dy: number): number {
  const ax = dx < 0 ? -dx : dx;
  const ay = dy < 0 ? -dy : dy;
  // Vanilla P_AproxDistance: max + min/2 (max(|dx|,|dy|) + min(|dx|,|dy|)/2).
  if (ax < ay) {
    return ax + ay - (ax >> 1);
  }
  return ax + ay - (ay >> 1);
}

export function shouldFireMissile(input: MissileRangeInput): boolean {
  let dist = approxDistance(input.dx, input.dy) - VANILLA_MISSILE_DISTANCE_OFFSET;
  if (input.hasMeleeAttack) {
    dist = Math.floor(dist / VANILLA_MELEE_DISTANCE_HALVE_DIVISOR);
  }
  if (dist > VANILLA_MISSILE_DISTANCE_CAP) {
    dist = VANILLA_MISSILE_DISTANCE_CAP;
  }
  return input.randomByte >= dist;
}
