/**
 * Vanilla DOOM 1.9 Spider Mastermind (MT_SPIDER) attack contract.
 *
 * From Chocolate Doom 2.2.1 p_enemy.c A_SPosAttack (reused) and the spider's
 * state machine:
 *   Spider uses a refired chaingun bullet attack:
 *     - Each shot: damage = ((P_Random()%5)+1)*3 (same as shotgun guy)
 *     - Spread: angle += (P_Random()-P_Random())<<21 (slightly tighter)
 *     - Fires bursts of 1 bullet per A_SPosAttack call.
 *   A_SpidRefire decides whether to keep firing (P_CheckSight + random gate).
 *
 * MT_SPIDER = 20. Registered/retail IWAD only (E3M8).
 */

export const VANILLA_MT_SPIDER = 20;
export const VANILLA_SPIDER_DAMAGE_RNG_MODULO = 5;
export const VANILLA_SPIDER_DAMAGE_MULTIPLIER = 3;
export const VANILLA_SPIDER_BULLET_SPREAD_SHIFT = 21;

export function computeSpiderBulletDamage(randomByte: number): number {
  return ((randomByte % VANILLA_SPIDER_DAMAGE_RNG_MODULO) + 1) * VANILLA_SPIDER_DAMAGE_MULTIPLIER;
}

export function computeSpiderBulletSpreadAngleDelta(randomA: number, randomB: number): number {
  return ((randomA - randomB) << VANILLA_SPIDER_BULLET_SPREAD_SHIFT) | 0;
}
