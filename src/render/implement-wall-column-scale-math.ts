/**
 * Vanilla DOOM 1.9 R_ScaleFromGlobalAngle and wall-column scale clamping contract.
 *
 * From Chocolate Doom 2.2.1 r_main.c R_ScaleFromGlobalAngle and r_segs.c R_StoreWallRange:
 *
 *   fixed_t R_ScaleFromGlobalAngle(angle_t visangle)
 *   {
 *       fixed_t  scale;
 *       angle_t  anglea, angleb;
 *       int      sinea, sineb;
 *       fixed_t  num, den;
 *
 *       anglea = ANG90 + (visangle - viewangle);
 *       angleb = ANG90 + (visangle - rw_normalangle);
 *       sinea = finesine[anglea >> ANGLETOFINESHIFT];
 *       sineb = finesine[angleb >> ANGLETOFINESHIFT];
 *
 *       num = FixedMul(projection, sineb) << detailshift;
 *       den = FixedMul(rw_distance, sinea);
 *
 *       if (den > num >> 16)
 *       {
 *           scale = FixedDiv(num, den);
 *           if (scale > 64 * FRACUNIT) scale = 64 * FRACUNIT;
 *           else if (scale < 256)      scale = 256;
 *       }
 *       else
 *           scale = 64 * FRACUNIT;
 *
 *       return scale;
 *   }
 *
 * Notes for parity:
 *   - The scale clamp is [256, 64 * FRACUNIT] = [256, 4_194_304].
 *     256 is the minimum visible scale (very far walls); 64*FRACUNIT is the closest
 *     allowed (very near walls). The 256 minimum is NOT FRACUNIT — it's the raw value 256.
 *   - The condition `den > num >> 16` is a divide-by-zero / overflow guard. When
 *     den is too small relative to num, the wall is essentially overhead/behind the
 *     camera and the scale saturates to the max (64 * FRACUNIT).
 *   - detailshift left-shifts the numerator so low-detail mode (detailshift=1) keeps
 *     the scale in pixel-doubled units.
 *   - The two angle subtractions use 32-bit BAM wraparound (intentional).
 */

import { FRACUNIT } from '../core/fixed.ts';

export const VANILLA_WALL_SCALE_MAX = 64 * FRACUNIT;
export const VANILLA_WALL_SCALE_MIN = 256;

export interface WallScaleClampInput {
  readonly rawScale: number;
}

export function clampVanillaWallScale(input: WallScaleClampInput): number {
  if (input.rawScale > VANILLA_WALL_SCALE_MAX) {
    return VANILLA_WALL_SCALE_MAX;
  }
  if (input.rawScale < VANILLA_WALL_SCALE_MIN) {
    return VANILLA_WALL_SCALE_MIN;
  }
  return input.rawScale | 0;
}

export interface WallScaleDenominatorGuardInput {
  readonly den: number;
  readonly num: number;
}

export function vanillaWallScaleDenominatorPasses(input: WallScaleDenominatorGuardInput): boolean {
  // Upstream: `if (den > num >> 16)`
  return input.den > input.num >> 16;
}

export function applyVanillaWallScaleSaturated(input: WallScaleDenominatorGuardInput & { rawScale: number }): number {
  if (!vanillaWallScaleDenominatorPasses(input)) {
    return VANILLA_WALL_SCALE_MAX;
  }
  return clampVanillaWallScale({ rawScale: input.rawScale });
}
