/**
 * Vanilla DOOM 1.9 P_BulletSlope autoaim contract.
 *
 * From Chocolate Doom 2.2.1 p_pspr.c P_BulletSlope:
 *   1. P_AimLineAttack(mo, an,                    16*64*FRACUNIT);  // forward
 *   2. if (!linetarget) P_AimLineAttack(mo, an + (1<<26), 16*64*FRACUNIT);
 *   3. if (!linetarget) P_AimLineAttack(mo, an - (1<<26), 16*64*FRACUNIT);
 *
 * 1 << 26 is the BAM offset = ANG90 / 16 / 8 ≈ 0.7° spread for the secondary
 * cone scans. The 16*64*FRACUNIT range is the bullet aim range (1024 map
 * units = 16 * MELEERANGE).
 *
 * P_AimLineAttack: traces a divline-style path; for each line crossing,
 * checks z-slope intersection against mobj z-extent and returns the
 * highest-priority shootable target's slope. shootthing tracks the source
 * mobj so AimLineAttack ignores it.
 *
 * Vanilla quirk: secondary cone shifts use BAM `+= 1<<26` and `-= 1<<26`
 * (not the more common (1<<27) used elsewhere). This is parity-critical.
 */

import type { Fixed } from '../core/fixed.ts';

export const VANILLA_BULLET_AIM_RANGE: Fixed = 16 * 64 * 0x1_0000;
export const VANILLA_AUTOAIM_CONE_SHIFT_BAM = 1 << 26;

export interface AutoaimAngleSequenceStep {
  readonly bamOffset: number;
  readonly description: string;
}

/** P_BulletSlope tries 3 angle offsets in this order. */
export const VANILLA_AUTOAIM_ANGLE_SEQUENCE: readonly AutoaimAngleSequenceStep[] = Object.freeze([
  Object.freeze({ bamOffset: 0, description: 'forward (player angle)' }),
  Object.freeze({ bamOffset: VANILLA_AUTOAIM_CONE_SHIFT_BAM, description: 'left cone (+1<<26)' }),
  Object.freeze({ bamOffset: -VANILLA_AUTOAIM_CONE_SHIFT_BAM, description: 'right cone (-1<<26)' }),
]);
