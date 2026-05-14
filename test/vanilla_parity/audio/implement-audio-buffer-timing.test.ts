import { describe, expect, test } from 'bun:test';

import { HARNESS_TIC_RATE_HZ } from '../../../src/audio/audioParity.ts';
import {
  VANILLA_AUDIO_TIMING_BYTES_PER_STEREO_FRAME,
  VANILLA_AUDIO_TIMING_DEFAULT_BYTES_PER_TIC,
  VANILLA_AUDIO_TIMING_DEFAULT_OUTPUT_RATE_HZ,
  VANILLA_AUDIO_TIMING_DEFAULT_SAMPLES_PER_TIC,
  VANILLA_AUDIO_TIMING_TICRATE_HZ,
  vanillaAudioTimingBytesPerTic,
  vanillaAudioTimingSamplesPerTic,
  vanillaAudioTimingValidateOutputRate,
} from '../../../src/audio/implement-audio-buffer-timing.ts';

describe('vanilla audio buffer timing constants', () => {
  test('tic rate = 35 Hz (matches doomdef.h TICRATE)', () => {
    expect(VANILLA_AUDIO_TIMING_TICRATE_HZ).toBe(35);
    expect(VANILLA_AUDIO_TIMING_TICRATE_HZ).toBe(HARNESS_TIC_RATE_HZ);
  });

  test('default output rate = 44100 Hz', () => {
    expect(VANILLA_AUDIO_TIMING_DEFAULT_OUTPUT_RATE_HZ).toBe(44_100);
  });

  test('default samplesPerTic = 1260 (44100 / 35)', () => {
    expect(VANILLA_AUDIO_TIMING_DEFAULT_SAMPLES_PER_TIC).toBe(1260);
    expect(VANILLA_AUDIO_TIMING_DEFAULT_OUTPUT_RATE_HZ / VANILLA_AUDIO_TIMING_TICRATE_HZ).toBe(VANILLA_AUDIO_TIMING_DEFAULT_SAMPLES_PER_TIC);
  });

  test('bytes per stereo frame = 4', () => {
    expect(VANILLA_AUDIO_TIMING_BYTES_PER_STEREO_FRAME).toBe(4);
  });

  test('default bytes per tic = 5040 (1260 × 4)', () => {
    expect(VANILLA_AUDIO_TIMING_DEFAULT_BYTES_PER_TIC).toBe(5040);
    expect(VANILLA_AUDIO_TIMING_DEFAULT_SAMPLES_PER_TIC * VANILLA_AUDIO_TIMING_BYTES_PER_STEREO_FRAME).toBe(VANILLA_AUDIO_TIMING_DEFAULT_BYTES_PER_TIC);
  });
});

describe('vanillaAudioTimingSamplesPerTic', () => {
  test('44100 / 35 = 1260', () => {
    expect(vanillaAudioTimingSamplesPerTic(44100, 35)).toBe(1260);
  });

  test('22050 / 35 = 630', () => {
    expect(vanillaAudioTimingSamplesPerTic(22050, 35)).toBe(630);
  });

  test('throws when rates do not divide evenly', () => {
    expect(() => vanillaAudioTimingSamplesPerTic(44101, 35)).toThrow();
    expect(() => vanillaAudioTimingSamplesPerTic(11000, 35)).toThrow();
  });

  test('rejects non-positive rates', () => {
    expect(() => vanillaAudioTimingSamplesPerTic(0, 35)).toThrow();
    expect(() => vanillaAudioTimingSamplesPerTic(44100, 0)).toThrow();
  });
});

describe('vanillaAudioTimingBytesPerTic', () => {
  test('1260 samples → 5040 bytes', () => {
    expect(vanillaAudioTimingBytesPerTic(1260)).toBe(5040);
  });

  test('630 samples → 2520 bytes', () => {
    expect(vanillaAudioTimingBytesPerTic(630)).toBe(2520);
  });

  test('rejects non-positive samples', () => {
    expect(() => vanillaAudioTimingBytesPerTic(0)).toThrow();
    expect(() => vanillaAudioTimingBytesPerTic(-1)).toThrow();
  });
});

describe('vanillaAudioTimingValidateOutputRate', () => {
  test('accepts multiples of 35 Hz', () => {
    expect(vanillaAudioTimingValidateOutputRate(44100)).toBe(true);
    expect(vanillaAudioTimingValidateOutputRate(22050)).toBe(true);
    expect(vanillaAudioTimingValidateOutputRate(11025)).toBe(true);
    expect(vanillaAudioTimingValidateOutputRate(35)).toBe(true);
  });

  test('rejects non-multiples', () => {
    expect(() => vanillaAudioTimingValidateOutputRate(48000)).toThrow();
    expect(() => vanillaAudioTimingValidateOutputRate(44101)).toThrow();
  });
});
