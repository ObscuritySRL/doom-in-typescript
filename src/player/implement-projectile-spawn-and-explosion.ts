/**
 * Vanilla DOOM 1.9 P_SpawnPlayerMissile and P_ExplodeMissile contract.
 *
 * P_SpawnPlayerMissile (p_map.c):
 *   - Aims using A_BulletSlope autoaim cascade.
 *   - Spawns missile at player.mo.x/y/z + (MISSILEHEIGHT = 32 fixed) above floor.
 *   - Sets missile angle, momentum from info.speed (16-bit fixed mul).
 *   - Plays missile's info.seesound.
 *
 * P_ExplodeMissile (p_mobj.c):
 *   - Clear momentum to 0.
 *   - Set state to info.deathstate.
 *   - Random tic adjustment: tics -= P_Random() & 3 (vanilla).
 *   - Clear MF_MISSILE flag; if info.deathsound, play it.
 *   - For rocket: P_RadiusAttack(missile, missile.target, MISSILE_BLAST_DAMAGE=128).
 */

import { FRACBITS, type Fixed } from '../core/fixed.ts';

export const VANILLA_MISSILE_HEIGHT_FIXED: Fixed = (32 << FRACBITS) | 0;
export const VANILLA_ROCKET_BLAST_DAMAGE = 128;
export const VANILLA_BFG_DIRECT_DAMAGE_BASE = 100;
export const VANILLA_BFG_DIRECT_DAMAGE_MULTIPLIER_MAX = 8;
export const VANILLA_MISSILE_DEATH_TIC_RANDOM_MASK = 3;

export function adjustMissileDeathTics(baseTics: number, randomByte: number): number {
  return baseTics - (randomByte & VANILLA_MISSILE_DEATH_TIC_RANDOM_MASK);
}
