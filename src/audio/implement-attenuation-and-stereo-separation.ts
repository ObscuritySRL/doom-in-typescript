/**
 * Vanilla DOOM 1.9 distance attenuation and stereo separation contract.
 *
 * From Chocolate Doom 2.2.1 s_sound.c (S_AdjustSoundParams and the four
 * macros that anchor it):
 *
 *   #define S_CLIPPING_DIST (1200 * FRACUNIT)
 *   #define S_CLOSE_DIST    (200  * FRACUNIT)
 *   #define S_ATTENUATOR    ((S_CLIPPING_DIST - S_CLOSE_DIST) >> FRACBITS) // 1000
 *   #define S_STEREO_SWING  (96   * FRACUNIT)
 *   #define NORM_SEP        128
 *
 *   Approximate distance (Game Gems I p.428 "fast Euclidean"):
 *     approx_dist = |dx| + |dy| - min(|dx|, |dy|) / 2
 *
 *   Audibility (S_AdjustSoundParams return value):
 *     - if (gamemap != 8 && approx_dist > S_CLIPPING_DIST) -> 0 (inaudible)
 *     - else recompute (vol, sep); return (vol > 0).
 *
 *   Stereo separation (after angle = R_PointToAngle2 rebased on listener angle):
 *     sep = 128 - (FixedMul(S_STEREO_SWING, finesine[angle >> ANGLETOFINESHIFT]) >> FRACBITS)
 *
 *   Volume:
 *     - approx_dist < S_CLOSE_DIST     -> vol = snd_SfxVolume   (full)
 *     - gamemap == 8 (boss maps E?M8)  -> dist clamped to clipping; vol scaled from 15..snd_SfxVolume
 *     - otherwise                       -> vol = snd_SfxVolume * (CLIPPING - dist >> FRACBITS) / ATTENUATOR
 *
 *   Gamemap 8 is the boss-map exception (E1M8 / E2M8 / E3M8 / E4M8); on
 *   those maps the cutoff is suppressed and there's a 15-unit volume floor.
 */

import { FRACBITS, type Fixed } from '../core/fixed.ts';

export const VANILLA_S_CLIPPING_DIST_FIXED: Fixed = ((1200 << FRACBITS) | 0) as Fixed;
export const VANILLA_S_CLOSE_DIST_FIXED: Fixed = ((200 << FRACBITS) | 0) as Fixed;
export const VANILLA_S_ATTENUATOR = ((VANILLA_S_CLIPPING_DIST_FIXED - VANILLA_S_CLOSE_DIST_FIXED) >> FRACBITS) | 0;
export const VANILLA_S_STEREO_SWING_FIXED: Fixed = ((96 << FRACBITS) | 0) as Fixed;
export const VANILLA_NORM_SEP_CENTRE_PAN = 128;
export const VANILLA_BOSS_MAP_VOLUME_FLOOR = 15;
export const VANILLA_BOSS_GAMEMAP_NUMBER = 8;

/**
 * "Fast approximate Euclidean" distance from Game Programming Gems I (p.428):
 *   approx_dist = |dx| + |dy| - min(|dx|, |dy|) / 2
 *
 * Inputs are signed fixed-point world deltas. Output is in the same fixed
 * units. The asymmetric subtract favours diagonals slightly, and the result
 * is always non-negative.
 */
export function vanillaApproxDistanceFixed(dxFixed: Fixed, dyFixed: Fixed): Fixed {
  const adx = Math.abs(dxFixed) | 0;
  const ady = Math.abs(dyFixed) | 0;
  const minAxis = adx < ady ? adx : ady;
  return ((adx + ady - (minAxis >> 1)) | 0) as Fixed;
}

/**
 * S_AdjustSoundParams audibility cutoff:
 *   - on gamemap 8 (boss maps) sounds remain audible at any distance
 *     (volume is still scaled below);
 *   - on any other map, anything farther than S_CLIPPING_DIST is rejected.
 */
export function vanillaIsSoundAudibleByClipping(approxDistFixed: Fixed, gamemap: number): boolean {
  if (gamemap === VANILLA_BOSS_GAMEMAP_NUMBER) {
    return true;
  }
  return approxDistFixed <= VANILLA_S_CLIPPING_DIST_FIXED;
}

/**
 * S_AdjustSoundParams volume curve (separate from the audibility gate above).
 *
 *   approx_dist < S_CLOSE_DIST                            -> snd_SfxVolume
 *   gamemap == 8                                          -> 15 + (sfxVolume-15) * (CLIP-dist) / ATTENUATOR
 *   otherwise (CLOSE_DIST <= dist <= CLIPPING_DIST)       -> sfxVolume * (CLIP-dist) / ATTENUATOR
 *
 * On gamemap 8 the dist is clamped to S_CLIPPING_DIST before the scaling
 * fraction is computed; that's how a sound far past the clipping distance
 * still produces the 15-unit floor.
 */
export function vanillaComputeSfxVolume(approxDistFixed: Fixed, sfxVolume: number, gamemap: number): number {
  if (approxDistFixed < VANILLA_S_CLOSE_DIST_FIXED) {
    return sfxVolume | 0;
  }
  if (gamemap === VANILLA_BOSS_GAMEMAP_NUMBER) {
    const clampedDist = approxDistFixed > VANILLA_S_CLIPPING_DIST_FIXED ? VANILLA_S_CLIPPING_DIST_FIXED : approxDistFixed;
    const numerator = ((sfxVolume - VANILLA_BOSS_MAP_VOLUME_FLOOR) * ((VANILLA_S_CLIPPING_DIST_FIXED - clampedDist) >> FRACBITS)) | 0;
    return (VANILLA_BOSS_MAP_VOLUME_FLOOR + numerator / VANILLA_S_ATTENUATOR) | 0;
  }
  return ((sfxVolume * ((VANILLA_S_CLIPPING_DIST_FIXED - approxDistFixed) >> FRACBITS)) / VANILLA_S_ATTENUATOR) | 0;
}
