/**
 * Vanilla DOOM 1.9 sfx pitch and volume semantics for S_StartSound.
 *
 * From Chocolate Doom 2.2.1 s_sound.c:
 *
 *   #define NORM_PITCH 128
 *   #define NORM_PRIORITY 64
 *   #define NORM_SEP 128
 *
 *   In S_StartSound:
 *     pitch = NORM_PITCH;
 *     if (sfx->link) {
 *       volume += sfx->volume;
 *       pitch = sfx->pitch;        // linked entries override the baseline
 *       if (volume < 1) return;     // inaudible, drop entirely
 *       if (volume > snd_SfxVolume) volume = snd_SfxVolume;
 *     }
 *
 *     // pitch perturbation:
 *     if (sfx_id >= sfx_sawup && sfx_id <= sfx_sawhit)
 *       pitch += 8 - (M_Random() & 15);
 *     else if (sfx_id != sfx_itemup && sfx_id != sfx_tink)
 *       pitch += 16 - (M_Random() & 31);
 *     pitch = Clamp(pitch);         // clamps to 0..255
 *
 *   Saw band: sfx_sawup, sfx_sawidl, sfx_sawful, sfx_sawhit. Perturbation
 *   range is [-7..+8] (8 - 0..15).
 *
 *   Item-pickup and ammo-tink keep an exact NORM_PITCH (no perturbation)
 *   so their bell-like sound stays recognisable across plays.
 *
 *   All other sfx perturb by [-15..+16] (16 - 0..31).
 *
 *   Clamp pins pitch into the 0..255 byte range; M_Random returns 0..255
 *   so the addition can never escape int width.
 */

export const VANILLA_NORM_PITCH = 128;
export const VANILLA_PITCH_CLAMP_MIN = 0;
export const VANILLA_PITCH_CLAMP_MAX = 255;

export const VANILLA_SAW_PITCH_RANDOM_MASK = 0x0f;
export const VANILLA_SAW_PITCH_BIAS = 8;
export const VANILLA_DEFAULT_PITCH_RANDOM_MASK = 0x1f;
export const VANILLA_DEFAULT_PITCH_BIAS = 16;

/** Numeric ids matching sounds.h sfxenum_t order — saw band lives between sfx_sawup and sfx_sawhit. */
export const VANILLA_SFX_SAWUP_ID = 10;
export const VANILLA_SFX_SAWHIT_ID = 13;
/** sfx ids whose pitch is left at NORM_PITCH (no random perturbation). */
export const VANILLA_SFX_ITEMUP_ID = 32;
export const VANILLA_SFX_TINK_ID = 87;

export interface VanillaPitchPerturbationDescriptor {
  readonly bias: number;
  readonly randomMask: number;
}

export const VANILLA_PITCH_PERTURBATION_SAW: VanillaPitchPerturbationDescriptor = Object.freeze({
  bias: VANILLA_SAW_PITCH_BIAS,
  randomMask: VANILLA_SAW_PITCH_RANDOM_MASK,
});

export const VANILLA_PITCH_PERTURBATION_DEFAULT: VanillaPitchPerturbationDescriptor = Object.freeze({
  bias: VANILLA_DEFAULT_PITCH_BIAS,
  randomMask: VANILLA_DEFAULT_PITCH_RANDOM_MASK,
});

export function vanillaClampPitch(pitch: number): number {
  if (pitch < VANILLA_PITCH_CLAMP_MIN) {
    return VANILLA_PITCH_CLAMP_MIN;
  }
  if (pitch > VANILLA_PITCH_CLAMP_MAX) {
    return VANILLA_PITCH_CLAMP_MAX;
  }
  return pitch | 0;
}

export function vanillaIsSawSfxId(sfxId: number): boolean {
  return sfxId >= VANILLA_SFX_SAWUP_ID && sfxId <= VANILLA_SFX_SAWHIT_ID;
}

export function vanillaSfxSkipsPitchPerturbation(sfxId: number): boolean {
  return sfxId === VANILLA_SFX_ITEMUP_ID || sfxId === VANILLA_SFX_TINK_ID;
}

/**
 * Returns NULL for sfx_itemup and sfx_tink (no perturbation); SAW descriptor for
 * sfx_sawup..sfx_sawhit; DEFAULT descriptor for everything else.
 */
export function vanillaSelectPitchPerturbation(sfxId: number): VanillaPitchPerturbationDescriptor | null {
  if (vanillaSfxSkipsPitchPerturbation(sfxId)) {
    return null;
  }
  if (vanillaIsSawSfxId(sfxId)) {
    return VANILLA_PITCH_PERTURBATION_SAW;
  }
  return VANILLA_PITCH_PERTURBATION_DEFAULT;
}

/**
 * Models the full S_StartSound pitch path: starts at NORM_PITCH (or sfx_link
 * pitch override when supplied), applies the per-sfx perturbation if any,
 * then clamps to 0..255.
 */
export function vanillaComputeStartPitch(input: { readonly sfxId: number; readonly linkPitch: number | null; readonly randomByte: number }): number {
  const basePitch = input.linkPitch !== null ? input.linkPitch : VANILLA_NORM_PITCH;
  const descriptor = vanillaSelectPitchPerturbation(input.sfxId);
  if (descriptor === null) {
    return vanillaClampPitch(basePitch);
  }
  const perturbed = basePitch + descriptor.bias - (input.randomByte & descriptor.randomMask);
  return vanillaClampPitch(perturbed);
}

/**
 * Models the volume initialization in S_StartSound. Returns null when the
 * sound is inaudible (link adjustment dropped volume below 1) so the caller
 * skips it entirely; otherwise returns a volume clamped to snd_SfxVolume.
 */
export function vanillaComputeStartVolume(input: { readonly sfxVolume: number; readonly linkVolumeDelta: number | null }): number | null {
  if (input.linkVolumeDelta === null) {
    return input.sfxVolume | 0;
  }
  const adjusted = input.sfxVolume + input.linkVolumeDelta;
  if (adjusted < 1) {
    return null;
  }
  if (adjusted > input.sfxVolume) {
    return input.sfxVolume | 0;
  }
  return adjusted | 0;
}
