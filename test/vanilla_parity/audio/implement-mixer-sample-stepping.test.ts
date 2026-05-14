import { describe, expect, test } from 'bun:test';

import {
  VANILLA_MIXER_DEFAULT_OUTPUT_RATE,
  VANILLA_MIXER_DMX_NATIVE_RATE,
  VANILLA_MIXER_EXPAND_RATIO_SCALE,
  VANILLA_MIXER_EXPAND_RATIO_SHIFT,
  vanillaMixerExpandRatio,
  vanillaMixerExpandedLength,
  vanillaMixerSourceIndex,
} from '../../../src/audio/implement-mixer-sample-stepping.ts';

describe('vanilla mixer sample-stepping constants', () => {
  test('expand_ratio uses 8 fractional bits (8.8 fixed-point)', () => {
    expect(VANILLA_MIXER_EXPAND_RATIO_SHIFT).toBe(8);
    expect(VANILLA_MIXER_EXPAND_RATIO_SCALE).toBe(256);
    expect(VANILLA_MIXER_EXPAND_RATIO_SCALE).toBe(1 << VANILLA_MIXER_EXPAND_RATIO_SHIFT);
  });

  test('DMX native rate = 11025 Hz, default mixer rate = 44100 Hz', () => {
    expect(VANILLA_MIXER_DMX_NATIVE_RATE).toBe(11_025);
    expect(VANILLA_MIXER_DEFAULT_OUTPUT_RATE).toBe(44_100);
  });
});

describe('vanillaMixerExpandedLength', () => {
  test('11025 → 44100 produces 4x output length', () => {
    expect(vanillaMixerExpandedLength(100, VANILLA_MIXER_DMX_NATIVE_RATE, VANILLA_MIXER_DEFAULT_OUTPUT_RATE)).toBe(400);
    expect(vanillaMixerExpandedLength(1000, VANILLA_MIXER_DMX_NATIVE_RATE, VANILLA_MIXER_DEFAULT_OUTPUT_RATE)).toBe(4000);
  });

  test('22050 → 44100 produces 2x output length (DSITMBK case)', () => {
    expect(vanillaMixerExpandedLength(100, 22050, VANILLA_MIXER_DEFAULT_OUTPUT_RATE)).toBe(200);
  });

  test('zero source produces zero output', () => {
    expect(vanillaMixerExpandedLength(0, VANILLA_MIXER_DMX_NATIVE_RATE, VANILLA_MIXER_DEFAULT_OUTPUT_RATE)).toBe(0);
  });

  test('truncates toward zero (C integer division)', () => {
    // 100 * 44100 / 11026 = 399.96... → trunc = 399
    expect(vanillaMixerExpandedLength(100, 11026, VANILLA_MIXER_DEFAULT_OUTPUT_RATE)).toBe(399);
  });

  test('rejects invalid input', () => {
    expect(() => vanillaMixerExpandedLength(-1, 11025, 44100)).toThrow();
    expect(() => vanillaMixerExpandedLength(100, 0, 44100)).toThrow();
    expect(() => vanillaMixerExpandedLength(100, 11025, -1)).toThrow();
  });
});

describe('vanillaMixerExpandRatio', () => {
  test('1:1 (src=expanded) → ratio 256 (one source step per output)', () => {
    expect(vanillaMixerExpandRatio(100, 100)).toBe(256);
  });

  test('1:4 upsample (src=100, expanded=400) → ratio 64', () => {
    expect(vanillaMixerExpandRatio(100, 400)).toBe(64);
  });

  test('1:2 upsample (src=100, expanded=200) → ratio 128', () => {
    expect(vanillaMixerExpandRatio(100, 200)).toBe(128);
  });

  test('zero expanded length returns 0 (vanilla divide-by-zero)', () => {
    expect(vanillaMixerExpandRatio(100, 0)).toBe(0);
  });
});

describe('vanillaMixerSourceIndex floor-toward-zero stepping', () => {
  test('1:4 upsample (ratio=64): outputs 0..3 all map to src=0; 4..7 map to src=1', () => {
    expect(vanillaMixerSourceIndex(0, 64)).toBe(0);
    expect(vanillaMixerSourceIndex(1, 64)).toBe(0);
    expect(vanillaMixerSourceIndex(2, 64)).toBe(0);
    expect(vanillaMixerSourceIndex(3, 64)).toBe(0);
    expect(vanillaMixerSourceIndex(4, 64)).toBe(1);
    expect(vanillaMixerSourceIndex(7, 64)).toBe(1);
    expect(vanillaMixerSourceIndex(8, 64)).toBe(2);
  });

  test('1:1 (ratio=256): output i maps directly to source i', () => {
    expect(vanillaMixerSourceIndex(0, 256)).toBe(0);
    expect(vanillaMixerSourceIndex(50, 256)).toBe(50);
    expect(vanillaMixerSourceIndex(99, 256)).toBe(99);
  });

  test('1:2 upsample (ratio=128): outputs pair up', () => {
    expect(vanillaMixerSourceIndex(0, 128)).toBe(0);
    expect(vanillaMixerSourceIndex(1, 128)).toBe(0);
    expect(vanillaMixerSourceIndex(2, 128)).toBe(1);
    expect(vanillaMixerSourceIndex(3, 128)).toBe(1);
  });
});
