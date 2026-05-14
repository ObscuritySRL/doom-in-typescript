import { describe, expect, test } from 'bun:test';

import {
  VANILLA_NUMOPL2CHANNELS,
  VANILLA_NUMOPL3CHANNELS,
  VANILLA_OPERATORS_PER_CHANNEL,
  VANILLA_OPL_BITS_PER_SAMPLE,
  VANILLA_OPL_SAMPLE_RATE_HZ,
  VANILLA_OPL_STEREO_CHANNELS,
  describeVanillaOplSynthesis,
} from '../../../src/audio/implement-opl-synthesis-core.ts';

describe('vanilla OPL synthesis constants', () => {
  test('sample rate is 44100 Hz', () => {
    expect(VANILLA_OPL_SAMPLE_RATE_HZ).toBe(44100);
  });

  test('OPL2 has 9 channels (YM3812)', () => {
    expect(VANILLA_NUMOPL2CHANNELS).toBe(9);
  });

  test('OPL3 has 18 channels (YMF262)', () => {
    expect(VANILLA_NUMOPL3CHANNELS).toBe(18);
  });

  test('each FM channel has 2 operators (modulator+carrier)', () => {
    expect(VANILLA_OPERATORS_PER_CHANNEL).toBe(2);
  });

  test('stereo output: 2 channels, 16-bit samples', () => {
    expect(VANILLA_OPL_STEREO_CHANNELS).toBe(2);
    expect(VANILLA_OPL_BITS_PER_SAMPLE).toBe(16);
  });
});

describe('describeVanillaOplSynthesis', () => {
  test('OPL2 mode: 9 channels, 18 operators, 44100 Hz', () => {
    const c = describeVanillaOplSynthesis('opl2');
    expect(c.mode).toBe('opl2');
    expect(c.channelCount).toBe(9);
    expect(c.operatorCount).toBe(18);
    expect(c.sampleRateHz).toBe(44100);
  });

  test('OPL3 mode: 18 channels, 36 operators', () => {
    const c = describeVanillaOplSynthesis('opl3');
    expect(c.channelCount).toBe(18);
    expect(c.operatorCount).toBe(36);
  });
});
