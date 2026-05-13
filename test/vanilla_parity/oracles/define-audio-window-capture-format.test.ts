import { describe, expect, test } from 'bun:test';

import { AUDIO_MAX_CHANNELS, AUDIO_SAMPLE_RATE, DEFAULT_AUDIO_SAMPLING_INTERVAL_TICS, DMX_NATIVE_SAMPLE_RATE, SAMPLES_PER_TIC } from '../../../src/oracles/audioHash.ts';
import format from './define-audio-window-capture-format.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-013-define-audio-window-capture-format.md';

describe('format identity and metadata', () => {
  test('declares OR-VP-AUDIO-FORMAT-013 oracle id, step 02-013, and oracle lane', () => {
    expect(format.id).toBe('OR-VP-AUDIO-FORMAT-013');
    expect(format.stepId).toBe('02-013');
    expect(format.stepTitle).toBe('Define Audio Window Capture Format');
    expect(format.lane).toBe('oracle');
  });

  test('points to the existing audioHash source module', () => {
    expect(format.sourceModule).toBe('src/oracles/audioHash.ts');
  });

  test('scopes the format to SFX only and references music event log 02-014', () => {
    expect(format.scopeNote.toLowerCase()).toContain('sfx');
    expect(format.scopeNote).toContain('02-014');
  });
});

describe('audio constants match source-level values', () => {
  test('output sample rate is 44100 Hz', () => {
    expect(format.outputSampleRateHz).toBe(AUDIO_SAMPLE_RATE);
    expect(format.outputSampleRateHz).toBe(44_100);
  });

  test('DMX native sample rate is 11025 Hz', () => {
    expect(format.dmxNativeSampleRateHz).toBe(DMX_NATIVE_SAMPLE_RATE);
    expect(format.dmxNativeSampleRateHz).toBe(11_025);
  });

  test('audio max channels is 8 (default.cfg snd_channels)', () => {
    expect(format.audioMaxChannels).toBe(AUDIO_MAX_CHANNELS);
    expect(format.audioMaxChannels).toBe(8);
  });

  test('samples per tic equals AUDIO_SAMPLE_RATE / 35 = 1260', () => {
    expect(format.samplesPerTic).toBe(SAMPLES_PER_TIC);
    expect(format.samplesPerTic).toBe(format.outputSampleRateHz / format.ticRateHz);
    expect(format.samplesPerTic).toBe(1260);
  });
});

describe('tic and hash invariants', () => {
  test('tic rate is 35 Hz and default sampling matches DEFAULT_AUDIO_SAMPLING_INTERVAL_TICS', () => {
    expect(format.ticRateHz).toBe(35);
    expect(format.defaultSamplingIntervalTics).toBe(DEFAULT_AUDIO_SAMPLING_INTERVAL_TICS);
    expect(format.defaultSamplingIntervalTics).toBe(35);
  });

  test('hash algorithm is SHA-256 with 64 hex characters per hash', () => {
    expect(format.hashAlgorithm).toBe('SHA-256');
    expect(format.hashHexLength).toBe(64);
  });

  test('pcm format is signed 16-bit stereo little-endian', () => {
    expect(format.pcmFormat).toBe('signed-16-bit-stereo-little-endian');
  });

  test('entry shape lists exactly tic, hash, activeChannels', () => {
    expect(format.entryShape).toEqual(['tic', 'hash', 'activeChannels']);
  });

  test('entry ordering rule pins ascending-by-tic order', () => {
    expect(format.entryOrderingRule).toBe('ascending-by-tic-number-strict');
  });
});

describe('alignment with plan_vanilla_parity step 02-013', () => {
  test('step file write lock pins the format json and test paths to the oracle lane', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/define-audio-window-capture-format.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/define-audio-window-capture-format.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });
});

describe('failure-mode validation invariants', () => {
  test('samples per tic of 1259 or 1261 would not satisfy the 44100 / 35 contract', () => {
    expect(format.samplesPerTic).not.toBe(1259);
    expect(format.samplesPerTic).not.toBe(1261);
  });

  test('max channels of 7 or 9 would not match default.cfg snd_channels', () => {
    expect(format.audioMaxChannels).not.toBe(7);
    expect(format.audioMaxChannels).not.toBe(9);
  });
});
