import { describe, expect, test } from 'bun:test';

import {
  VANILLA_DEFAULT_PITCH_BIAS,
  VANILLA_DEFAULT_PITCH_RANDOM_MASK,
  VANILLA_NORM_PITCH,
  VANILLA_PITCH_CLAMP_MAX,
  VANILLA_PITCH_CLAMP_MIN,
  VANILLA_PITCH_PERTURBATION_DEFAULT,
  VANILLA_PITCH_PERTURBATION_SAW,
  VANILLA_SAW_PITCH_BIAS,
  VANILLA_SAW_PITCH_RANDOM_MASK,
  VANILLA_SFX_ITEMUP_ID,
  VANILLA_SFX_SAWHIT_ID,
  VANILLA_SFX_SAWUP_ID,
  VANILLA_SFX_TINK_ID,
  vanillaClampPitch,
  vanillaComputeStartPitch,
  vanillaComputeStartVolume,
  vanillaIsSawSfxId,
  vanillaSelectPitchPerturbation,
  vanillaSfxSkipsPitchPerturbation,
} from '../../../src/audio/implement-pitch-and-volume-semantics.ts';

describe('vanilla pitch/volume constants', () => {
  test('NORM_PITCH = 128 with 0..255 clamp range', () => {
    expect(VANILLA_NORM_PITCH).toBe(128);
    expect(VANILLA_PITCH_CLAMP_MIN).toBe(0);
    expect(VANILLA_PITCH_CLAMP_MAX).toBe(255);
  });

  test('saw perturbation bias=8 mask=0x0f gives ±range of [-7..+8]', () => {
    expect(VANILLA_SAW_PITCH_BIAS).toBe(8);
    expect(VANILLA_SAW_PITCH_RANDOM_MASK).toBe(0x0f);
  });

  test('default perturbation bias=16 mask=0x1f gives range of [-15..+16]', () => {
    expect(VANILLA_DEFAULT_PITCH_BIAS).toBe(16);
    expect(VANILLA_DEFAULT_PITCH_RANDOM_MASK).toBe(0x1f);
  });

  test('saw band sfx_sawup=10..sfx_sawhit=13; sfx_itemup=32, sfx_tink=87', () => {
    expect(VANILLA_SFX_SAWUP_ID).toBe(10);
    expect(VANILLA_SFX_SAWHIT_ID).toBe(13);
    expect(VANILLA_SFX_ITEMUP_ID).toBe(32);
    expect(VANILLA_SFX_TINK_ID).toBe(87);
  });
});

describe('vanillaClampPitch', () => {
  test('clamps below 0 to 0, above 255 to 255, preserves in-range', () => {
    expect(vanillaClampPitch(-5)).toBe(0);
    expect(vanillaClampPitch(300)).toBe(255);
    expect(vanillaClampPitch(128)).toBe(128);
    expect(vanillaClampPitch(0)).toBe(0);
    expect(vanillaClampPitch(255)).toBe(255);
  });
});

describe('saw band detection', () => {
  test('sfx_sawup..sfx_sawhit inclusive', () => {
    expect(vanillaIsSawSfxId(10)).toBe(true);
    expect(vanillaIsSawSfxId(11)).toBe(true);
    expect(vanillaIsSawSfxId(13)).toBe(true);
    expect(vanillaIsSawSfxId(9)).toBe(false);
    expect(vanillaIsSawSfxId(14)).toBe(false);
  });
});

describe('itemup/tink skip-perturbation set', () => {
  test('exactly sfx_itemup and sfx_tink', () => {
    expect(vanillaSfxSkipsPitchPerturbation(32)).toBe(true);
    expect(vanillaSfxSkipsPitchPerturbation(87)).toBe(true);
    expect(vanillaSfxSkipsPitchPerturbation(0)).toBe(false);
    expect(vanillaSfxSkipsPitchPerturbation(1)).toBe(false);
    expect(vanillaSfxSkipsPitchPerturbation(33)).toBe(false);
  });
});

describe('vanillaSelectPitchPerturbation', () => {
  test('saw band selects the SAW descriptor', () => {
    expect(vanillaSelectPitchPerturbation(10)).toBe(VANILLA_PITCH_PERTURBATION_SAW);
    expect(vanillaSelectPitchPerturbation(13)).toBe(VANILLA_PITCH_PERTURBATION_SAW);
  });

  test('itemup and tink select null (no perturbation)', () => {
    expect(vanillaSelectPitchPerturbation(VANILLA_SFX_ITEMUP_ID)).toBeNull();
    expect(vanillaSelectPitchPerturbation(VANILLA_SFX_TINK_ID)).toBeNull();
  });

  test('every other sfx selects the DEFAULT descriptor', () => {
    expect(vanillaSelectPitchPerturbation(1)).toBe(VANILLA_PITCH_PERTURBATION_DEFAULT);
    expect(vanillaSelectPitchPerturbation(33)).toBe(VANILLA_PITCH_PERTURBATION_DEFAULT);
  });
});

describe('vanillaComputeStartPitch', () => {
  test('itemup pitch stays at NORM_PITCH regardless of random byte', () => {
    expect(vanillaComputeStartPitch({ sfxId: 32, linkPitch: null, randomByte: 0 })).toBe(128);
    expect(vanillaComputeStartPitch({ sfxId: 32, linkPitch: null, randomByte: 200 })).toBe(128);
  });

  test('saw band: NORM + 8 - (random & 15) covers [121..136]', () => {
    expect(vanillaComputeStartPitch({ sfxId: 10, linkPitch: null, randomByte: 0 })).toBe(128 + 8);
    expect(vanillaComputeStartPitch({ sfxId: 10, linkPitch: null, randomByte: 15 })).toBe(128 + 8 - 15);
  });

  test('default: NORM + 16 - (random & 31) covers [113..144]', () => {
    expect(vanillaComputeStartPitch({ sfxId: 1, linkPitch: null, randomByte: 0 })).toBe(128 + 16);
    expect(vanillaComputeStartPitch({ sfxId: 1, linkPitch: null, randomByte: 31 })).toBe(128 + 16 - 31);
  });

  test('linkPitch overrides NORM as the baseline before perturbation', () => {
    expect(vanillaComputeStartPitch({ sfxId: 1, linkPitch: 100, randomByte: 0 })).toBe(100 + 16);
    expect(vanillaComputeStartPitch({ sfxId: VANILLA_SFX_ITEMUP_ID, linkPitch: 200, randomByte: 0 })).toBe(200);
  });

  test('clamps perturbed pitch into 0..255 range', () => {
    // Force a negative result by starting low
    expect(vanillaComputeStartPitch({ sfxId: 1, linkPitch: 10, randomByte: 31 })).toBe(0);
  });
});

describe('vanillaComputeStartVolume', () => {
  test('no link: returns sfxVolume unchanged', () => {
    expect(vanillaComputeStartVolume({ sfxVolume: 8, linkVolumeDelta: null })).toBe(8);
  });

  test('link adds delta and clamps above to sfxVolume', () => {
    expect(vanillaComputeStartVolume({ sfxVolume: 8, linkVolumeDelta: 100 })).toBe(8);
  });

  test('link below 1 returns null (drop the sound)', () => {
    expect(vanillaComputeStartVolume({ sfxVolume: 8, linkVolumeDelta: -10 })).toBeNull();
    expect(vanillaComputeStartVolume({ sfxVolume: 8, linkVolumeDelta: -8 })).toBeNull(); // 8 + -8 = 0 dropped
  });

  test('link 8 + -7 = 1 stays audible (positive after clamp)', () => {
    expect(vanillaComputeStartVolume({ sfxVolume: 8, linkVolumeDelta: -7 })).toBe(1);
  });
});
