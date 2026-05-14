import { describe, expect, test } from 'bun:test';

import {
  VANILLA_MIXER_DMX_MIDPOINT,
  VANILLA_MIXER_DMX_SILENCE_INT16,
  VANILLA_MIXER_INT16_MAX,
  VANILLA_MIXER_INT16_MIN,
  vanillaMixerClipStereo,
  vanillaMixerClipToInt16,
  vanillaMixerDmxByteToInt16,
} from '../../../src/audio/implement-mixer-clipping.ts';

describe('vanilla PCM mixer clipping bounds', () => {
  test('INT16_MIN and INT16_MAX match C int16_t', () => {
    expect(VANILLA_MIXER_INT16_MIN).toBe(-32768);
    expect(VANILLA_MIXER_INT16_MAX).toBe(32767);
  });

  test('DMX silence byte (0x80) decodes to +128, not 0', () => {
    expect(VANILLA_MIXER_DMX_MIDPOINT).toBe(0x80);
    expect(VANILLA_MIXER_DMX_SILENCE_INT16).toBe(128);
    expect(vanillaMixerDmxByteToInt16(0x80)).toBe(128);
  });
});

describe('vanillaMixerClipToInt16', () => {
  test('in-range values pass through unchanged', () => {
    expect(vanillaMixerClipToInt16(0)).toBe(0);
    expect(vanillaMixerClipToInt16(1000)).toBe(1000);
    expect(vanillaMixerClipToInt16(-1000)).toBe(-1000);
  });

  test('exactly INT16_MAX / INT16_MIN are preserved', () => {
    expect(vanillaMixerClipToInt16(VANILLA_MIXER_INT16_MAX)).toBe(VANILLA_MIXER_INT16_MAX);
    expect(vanillaMixerClipToInt16(VANILLA_MIXER_INT16_MIN)).toBe(VANILLA_MIXER_INT16_MIN);
  });

  test('positive overflow saturates at INT16_MAX (no wrap)', () => {
    expect(vanillaMixerClipToInt16(VANILLA_MIXER_INT16_MAX + 1)).toBe(VANILLA_MIXER_INT16_MAX);
    expect(vanillaMixerClipToInt16(50000)).toBe(VANILLA_MIXER_INT16_MAX);
    expect(vanillaMixerClipToInt16(1_000_000)).toBe(VANILLA_MIXER_INT16_MAX);
  });

  test('negative overflow saturates at INT16_MIN (no wrap)', () => {
    expect(vanillaMixerClipToInt16(VANILLA_MIXER_INT16_MIN - 1)).toBe(VANILLA_MIXER_INT16_MIN);
    expect(vanillaMixerClipToInt16(-50000)).toBe(VANILLA_MIXER_INT16_MIN);
    expect(vanillaMixerClipToInt16(-1_000_000)).toBe(VANILLA_MIXER_INT16_MIN);
  });

  test('two voices summing past INT16_MAX clip instead of wrapping', () => {
    const voice1 = 20000;
    const voice2 = 20000;
    // int16 add would wrap: 20000 + 20000 = 40000 → 40000 - 65536 = -25536
    // Vanilla saturates: clip at INT16_MAX = 32767
    expect(vanillaMixerClipToInt16(voice1 + voice2)).toBe(VANILLA_MIXER_INT16_MAX);
    expect(vanillaMixerClipToInt16(voice1 + voice2)).not.toBe(-25536);
  });
});

describe('vanillaMixerClipStereo independent per-channel saturation', () => {
  test('left clipped, right unchanged', () => {
    const { left, right } = vanillaMixerClipStereo(50000, -8000);
    expect(left).toBe(VANILLA_MIXER_INT16_MAX);
    expect(right).toBe(-8000);
  });

  test('both channels saturate to their own bounds', () => {
    const { left, right } = vanillaMixerClipStereo(40000, -40000);
    expect(left).toBe(VANILLA_MIXER_INT16_MAX);
    expect(right).toBe(VANILLA_MIXER_INT16_MIN);
  });

  test('asymmetric in-range stays asymmetric (no joint normalization)', () => {
    const { left, right } = vanillaMixerClipStereo(VANILLA_MIXER_INT16_MAX, -8000);
    expect(left).toBe(VANILLA_MIXER_INT16_MAX);
    expect(right).toBe(-8000);
  });
});

describe('vanillaMixerDmxByteToInt16 boundary samples', () => {
  test('byte 0x00 → INT16_MIN', () => {
    expect(vanillaMixerDmxByteToInt16(0x00)).toBe(VANILLA_MIXER_INT16_MIN);
  });

  test('byte 0xFF → INT16_MAX', () => {
    expect(vanillaMixerDmxByteToInt16(0xff)).toBe(VANILLA_MIXER_INT16_MAX);
  });

  test('byte 0x80 (silence) → +128', () => {
    expect(vanillaMixerDmxByteToInt16(0x80)).toBe(128);
  });

  test('rejects out-of-range bytes', () => {
    expect(() => vanillaMixerDmxByteToInt16(-1)).toThrow();
    expect(() => vanillaMixerDmxByteToInt16(256)).toThrow();
    expect(() => vanillaMixerDmxByteToInt16(1.5)).toThrow();
  });
});
