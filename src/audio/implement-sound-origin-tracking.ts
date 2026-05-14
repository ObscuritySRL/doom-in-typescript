/**
 * Vanilla DOOM 1.9 S_UpdateSounds per-tic origin tracking contract.
 *
 * From Chocolate Doom 2.2.1 s_sound.c S_UpdateSounds(listener):
 *
 *   For each occupied channel slot, the per-tic update pass:
 *     1. Reaps the slot if I_SoundIsPlaying(handle) is false.
 *     2. Resets volume to snd_SfxVolume and separation to NORM_SEP.
 *     3. If sfxinfo->link is non-null, applies sfx->volume to baseline
 *        volume; stops the slot if resulting volume < 1; clamps to
 *        snd_SfxVolume when greater.
 *     4. Origin guard: ONLY when origin != null AND listener != origin,
 *        recomputes (volume, separation) via S_AdjustSoundParams and
 *        either stops the slot (if inaudible) or pushes the new params
 *        via I_UpdateSoundParams.
 *
 *   The guard `origin && listener != origin` deliberately leaves the
 *   player's own sounds (origin == listener) and anonymous UI sounds
 *   (origin == null) at their started-with volume/separation. A naive
 *   port that always re-spatializes will re-pan the player's footsteps
 *   every tic — a known parity regression to avoid.
 *
 *   NORM_SEP = 128 (centre pan in the 0..255 stereo-separation domain).
 */

export const VANILLA_NORM_SEP = 128;
export const VANILLA_MIN_AUDIBLE_LINK_VOLUME = 1;

export type VanillaUpdateSoundsOriginCase = 'anonymous' | 'self-listener' | 'remote-mobj';

export const VANILLA_UPDATE_SOUNDS_ORIGIN_RULES: Readonly<Record<VanillaUpdateSoundsOriginCase, { readonly callsAdjustSoundParams: boolean }>> = Object.freeze({
  anonymous: Object.freeze({ callsAdjustSoundParams: false }),
  'self-listener': Object.freeze({ callsAdjustSoundParams: false }),
  'remote-mobj': Object.freeze({ callsAdjustSoundParams: true }),
});

export function classifyVanillaOriginCase(origin: number | null, listener: number | null): VanillaUpdateSoundsOriginCase {
  if (origin === null) {
    return 'anonymous';
  }
  if (listener !== null && origin === listener) {
    return 'self-listener';
  }
  return 'remote-mobj';
}
