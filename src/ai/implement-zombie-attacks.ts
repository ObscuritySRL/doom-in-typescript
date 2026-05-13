/**
 * Vanilla DOOM 1.9 zombie/shotgunner/chaingunner attack contracts.
 *
 * From Chocolate Doom 2.2.1 p_enemy.c:
 *   A_PosAttack (former human / zombieman):
 *     damage = ((P_Random() % 5) + 1) * 3   // 3, 6, 9, 12, 15
 *     1 bullet via P_LineAttack at MISSILERANGE; SFX_PISTOL.
 *     Bullet spread angle: (P_Random() - P_Random()) << 20.
 *
 *   A_SPosAttack (shotgun guy):
 *     for (i = 0; i < 3; i++) damage = ((P_Random() % 5) + 1) * 3
 *     3 bullets at MISSILERANGE; SFX_SHOTGN.
 *     Bullet spread per pellet: (P_Random() - P_Random()) << 20.
 *
 *   A_CPosAttack (chaingunner):
 *     damage = ((P_Random() % 5) + 1) * 3
 *     1 bullet per call (called per tic via state chain); SFX_SHOTGN.
 *     A_CPosRefire continues firing on each tic until target lost.
 *
 * Vanilla quirk: SFX_SHOTGN sound is shared by shotgun guy AND chaingunner.
 */

export const VANILLA_ZOMBIE_DAMAGE_RNG_MODULO = 5;
export const VANILLA_ZOMBIE_DAMAGE_MULTIPLIER = 3;
export const VANILLA_ZOMBIE_BULLET_SPREAD_SHIFT = 20;

export const VANILLA_POS_ATTACK_BULLETS = 1;
export const VANILLA_SPOS_ATTACK_BULLETS = 3;
export const VANILLA_CPOS_ATTACK_BULLETS = 1;

export function computeZombieBulletDamage(randomByte: number): number {
  return ((randomByte % VANILLA_ZOMBIE_DAMAGE_RNG_MODULO) + 1) * VANILLA_ZOMBIE_DAMAGE_MULTIPLIER;
}

export function computeZombieBulletSpreadAngleDelta(randomA: number, randomB: number): number {
  return ((randomA - randomB) << VANILLA_ZOMBIE_BULLET_SPREAD_SHIFT) | 0;
}
