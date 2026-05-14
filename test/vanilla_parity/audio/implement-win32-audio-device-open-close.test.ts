import { describe, expect, test } from 'bun:test';

import {
  VANILLA_AUDIO_DEFAULT_MUSIC_SAMPLE_RATE_HZ,
  VANILLA_AUDIO_DEFAULT_SFX_BUFFER_SAMPLES,
  VANILLA_AUDIO_DEFAULT_SFX_SAMPLE_RATE_HZ,
  VANILLA_AUDIO_DOUBLE_BUFFER_COUNT,
  VANILLA_AUDIO_OUTPUT_BITS,
} from '../../../src/audio/implement-win32-audio-device-open-close.ts';

describe('vanilla Win32 audio device constants', () => {
  test('SFX rate 11025 Hz, music rate 49716 Hz', () => {
    expect(VANILLA_AUDIO_DEFAULT_SFX_SAMPLE_RATE_HZ).toBe(11025);
    expect(VANILLA_AUDIO_DEFAULT_MUSIC_SAMPLE_RATE_HZ).toBe(49716);
  });

  test('16-bit output, 2 buffers, 1024 SFX samples per buffer', () => {
    expect(VANILLA_AUDIO_OUTPUT_BITS).toBe(16);
    expect(VANILLA_AUDIO_DOUBLE_BUFFER_COUNT).toBe(2);
    expect(VANILLA_AUDIO_DEFAULT_SFX_BUFFER_SAMPLES).toBe(1024);
  });
});
