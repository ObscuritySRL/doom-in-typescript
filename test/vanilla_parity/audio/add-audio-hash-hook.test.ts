import { describe, expect, test } from 'bun:test';

import { AUDIO_MAX_CHANNELS, AUDIO_SAMPLE_RATE, SAMPLES_PER_TIC } from '../../../src/oracles/audioHash.ts';
import {
  VANILLA_AUDIO_HASH_HOOK_BYTES_PER_TIC,
  VANILLA_AUDIO_HASH_HOOK_DEFAULT_SAMPLING_INTERVAL_TICS,
  VANILLA_AUDIO_HASH_HOOK_MAX_CHANNELS,
  VANILLA_AUDIO_HASH_HOOK_PHASE,
  VANILLA_AUDIO_HASH_HOOK_SAMPLES_PER_TIC,
  VANILLA_AUDIO_HASH_HOOK_SAMPLE_RATE_HZ,
  VANILLA_AUDIO_HASH_HOOK_SCOPE,
  vanillaAudioHashShouldSample,
  vanillaAudioHashValidateBufferBytes,
  vanillaAudioHashValidateChannelCount,
} from '../../../src/audio/add-audio-hash-hook.ts';

describe('vanilla audio hash hook constants', () => {
  test('sample rate = 44100 Hz', () => {
    expect(VANILLA_AUDIO_HASH_HOOK_SAMPLE_RATE_HZ).toBe(44_100);
    expect(VANILLA_AUDIO_HASH_HOOK_SAMPLE_RATE_HZ).toBe(AUDIO_SAMPLE_RATE);
  });

  test('samples per tic = 1260 (44100 / 35)', () => {
    expect(VANILLA_AUDIO_HASH_HOOK_SAMPLES_PER_TIC).toBe(1260);
    expect(VANILLA_AUDIO_HASH_HOOK_SAMPLES_PER_TIC).toBe(SAMPLES_PER_TIC);
  });

  test('bytes per tic = 5040 (1260 × 4)', () => {
    expect(VANILLA_AUDIO_HASH_HOOK_BYTES_PER_TIC).toBe(5040);
    expect(VANILLA_AUDIO_HASH_HOOK_BYTES_PER_TIC).toBe(VANILLA_AUDIO_HASH_HOOK_SAMPLES_PER_TIC * 4);
  });

  test('max channels = 8 (snd_channels default)', () => {
    expect(VANILLA_AUDIO_HASH_HOOK_MAX_CHANNELS).toBe(8);
    expect(VANILLA_AUDIO_HASH_HOOK_MAX_CHANNELS).toBe(AUDIO_MAX_CHANNELS);
  });

  test('default sampling interval = 35 tics (1 second)', () => {
    expect(VANILLA_AUDIO_HASH_HOOK_DEFAULT_SAMPLING_INTERVAL_TICS).toBe(35);
  });

  test('hook phase = after-mix-before-enqueue', () => {
    expect(VANILLA_AUDIO_HASH_HOOK_PHASE).toBe('after-mix-before-enqueue');
  });

  test('hash scope is SFX-only (music goes through music-event-log)', () => {
    expect(VANILLA_AUDIO_HASH_HOOK_SCOPE).toBe('sfx-mix-only');
  });
});

describe('vanillaAudioHashShouldSample', () => {
  test('interval=35 samples once per second at 35 Hz tic rate', () => {
    expect(vanillaAudioHashShouldSample(0, 35)).toBe(true);
    expect(vanillaAudioHashShouldSample(34, 35)).toBe(false);
    expect(vanillaAudioHashShouldSample(35, 35)).toBe(true);
    expect(vanillaAudioHashShouldSample(70, 35)).toBe(true);
  });

  test('interval=1 samples every tic', () => {
    expect(vanillaAudioHashShouldSample(0, 1)).toBe(true);
    expect(vanillaAudioHashShouldSample(100, 1)).toBe(true);
  });

  test('rejects invalid input', () => {
    expect(() => vanillaAudioHashShouldSample(0, 0)).toThrow();
    expect(() => vanillaAudioHashShouldSample(-1, 35)).toThrow();
  });
});

describe('vanillaAudioHashValidateBufferBytes', () => {
  test('accepts 5040 bytes', () => {
    expect(vanillaAudioHashValidateBufferBytes(5040)).toBe(true);
  });

  test('rejects wrong-size buffers', () => {
    expect(() => vanillaAudioHashValidateBufferBytes(5039)).toThrow();
    expect(() => vanillaAudioHashValidateBufferBytes(5041)).toThrow();
    expect(() => vanillaAudioHashValidateBufferBytes(0)).toThrow();
    expect(() => vanillaAudioHashValidateBufferBytes(10080)).toThrow(); // 2 tics worth
  });
});

describe('vanillaAudioHashValidateChannelCount', () => {
  test('accepts 0..8', () => {
    expect(vanillaAudioHashValidateChannelCount(0)).toBe(true);
    expect(vanillaAudioHashValidateChannelCount(4)).toBe(true);
    expect(vanillaAudioHashValidateChannelCount(8)).toBe(true);
  });

  test('rejects out-of-range and non-integer', () => {
    expect(() => vanillaAudioHashValidateChannelCount(-1)).toThrow();
    expect(() => vanillaAudioHashValidateChannelCount(9)).toThrow();
    expect(() => vanillaAudioHashValidateChannelCount(1.5)).toThrow();
  });
});
