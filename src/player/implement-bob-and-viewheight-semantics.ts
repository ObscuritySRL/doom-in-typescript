/**
 * Vanilla DOOM 1.9 P_CalcHeight bob and viewheight contract.
 *
 * From Chocolate Doom 2.2.1 p_user.c P_CalcHeight:
 *   bob = (FixedMul(momx, momx) + FixedMul(momy, momy)) >> 2;
 *   if (bob > MAXBOB) bob = MAXBOB;   // MAXBOB = 0x100000 (16 pixels fixed)
 *
 * The view bob oscillation phase = finesine[(FINEANGLES/20 * leveltime) &
 * FINEMASK]. The viewheight smoothing has deltaviewheight nudge each tic,
 * targeting VIEWHEIGHT (41 * FRACUNIT) when on the ground.
 *
 * Vanilla quirk: in the airborne / CF_NOMOMENTUM branch, viewz is computed
 * twice — first clamped against the ceiling, then unconditionally overridden
 * to mobj.z + viewheight. This must be preserved for parity.
 */

import type { Fixed } from '../core/fixed.ts';
import { fixedMul } from '../core/fixed.ts';

export const VANILLA_MAXBOB: Fixed = 0x10_0000;
export const VANILLA_BOB_RIGHT_SHIFT = 2;

export function computeVanillaBobAmplitude(momentumX: Fixed, momentumY: Fixed): Fixed {
  const squared = (fixedMul(momentumX, momentumX) + fixedMul(momentumY, momentumY)) | 0;
  const halved = squared >> VANILLA_BOB_RIGHT_SHIFT;
  if (halved > VANILLA_MAXBOB) {
    return VANILLA_MAXBOB;
  }
  return halved;
}
