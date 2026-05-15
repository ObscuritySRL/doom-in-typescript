import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_OUTPUT_SAMPLE_RATE, MIX_MAX_VOLUME, createMixerVoice } from '../../../src/audio/pcmMixer.ts';
import {
  VANILLA_AUDIO_DEFAULT_MUSIC_SAMPLE_RATE_HZ,
  VANILLA_AUDIO_DEFAULT_SFX_BUFFER_SAMPLES,
  VANILLA_AUDIO_DEFAULT_SFX_SAMPLE_RATE_HZ,
  VANILLA_AUDIO_DOUBLE_BUFFER_COUNT,
  VANILLA_AUDIO_OUTPUT_BITS,
} from '../../../src/audio/implement-win32-audio-device-open-close.ts';
import { createPcmMixerWin32Output } from '../../../src/vanilla/pcmMixerWin32Output.ts';
import type { PcmMixerWin32Output } from '../../../src/vanilla/pcmMixerWin32Output.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const RELATIVE_PATH = 'src/vanilla/pcmMixerWin32Output.ts';
const ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, RELATIVE_PATH);

describe('plan_final audio: wire-pcm-mixer-win32-output', () => {
  test('src/vanilla/pcmMixerWin32Output.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(ABSOLUTE_PATH)).toBe(true);
    expect(statSync(ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/pcmMixerWin32Output.ts cites plan_final step 11-005 in a top-of-file comment', () => {
    const fileText = readFileSync(ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('11-005');
    expect(fileText).toContain('createPcmMixerWin32Output');
  });

  test('src/vanilla/pcmMixerWin32Output.ts imports read-only audio primitives from src/audio/ without modifying them', () => {
    const fileText = readFileSync(ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain("from '../audio/pcmMixer.ts'");
    expect(fileText).toContain("from '../audio/implement-win32-audio-device-open-close.ts'");
    expect(fileText).toContain('expandDmxSamples');
    expect(fileText).toContain('mixVoices');
  });

  test('createPcmMixerWin32Output returns a frozen artifact carrying the canonical Win32 audio parameters', () => {
    const audio: PcmMixerWin32Output = createPcmMixerWin32Output();
    expect(Object.isFrozen(audio)).toBe(true);
    expect(audio.outputBitsPerSample).toBe(VANILLA_AUDIO_OUTPUT_BITS);
    expect(audio.outputDoubleBufferCount).toBe(VANILLA_AUDIO_DOUBLE_BUFFER_COUNT);
    expect(audio.outputChannelCount).toBe(2);
    expect(audio.outputSampleRateHz).toBe(DEFAULT_OUTPUT_SAMPLE_RATE);
    expect(audio.mixerSfxBufferSampleCount).toBe(VANILLA_AUDIO_DEFAULT_SFX_BUFFER_SAMPLES);
    expect(audio.nativeSfxSampleRateHz).toBe(VANILLA_AUDIO_DEFAULT_SFX_SAMPLE_RATE_HZ);
    expect(audio.nativeMusicSampleRateHz).toBe(VANILLA_AUDIO_DEFAULT_MUSIC_SAMPLE_RATE_HZ);
    expect(audio.mixerMaxVolume).toBe(MIX_MAX_VOLUME);
    expect(audio.vanillaSfxChannelCount).toBe(8);
  });

  test('shutdownPolicy is a frozen descriptor that names every Win32 audio resource that must be released', () => {
    const audio = createPcmMixerWin32Output();
    expect(Object.isFrozen(audio.shutdownPolicy)).toBe(true);
    expect(audio.shutdownPolicy.closesWaveOutHandle).toBe(true);
    expect(audio.shutdownPolicy.drainsDoubleBufferQueue).toBe(true);
    expect(audio.shutdownPolicy.releasesMixerBuffers).toBe(true);
    expect(audio.shutdownPolicy.waitsForLastBufferToFlush).toBe(true);
  });

  test('mix(voices, frameCount) returns an Int16Array of length frameCount * 2 (stereo) with silence when voices is empty', () => {
    const audio = createPcmMixerWin32Output();
    const mixed = audio.mix([], 128);
    expect(mixed).toBeInstanceOf(Int16Array);
    expect(mixed.length).toBe(128 * 2);
    for (let sampleIndex = 0; sampleIndex < mixed.length; sampleIndex += 1) {
      expect(mixed[sampleIndex]).toBe(0);
    }
  });

  test('mix(voices, frameCount) emits non-zero samples when given a single voice', () => {
    const audio = createPcmMixerWin32Output();
    const samples = new Int16Array(64);
    for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
      samples[sampleIndex] = 1000;
    }
    const voice = createMixerVoice(samples, MIX_MAX_VOLUME, 128);
    const mixed = audio.mix([voice], 64);
    let totalAbsolute = 0;
    for (const value of mixed) totalAbsolute += Math.abs(value);
    expect(totalAbsolute).toBeGreaterThan(0);
  });

  test('expandDmxSamplesToOutputRate produces an Int16Array sized to the canonical output rate ratio', () => {
    const audio = createPcmMixerWin32Output();
    const dmxBytes = new Uint8Array(11025);
    for (let sampleIndex = 0; sampleIndex < dmxBytes.length; sampleIndex += 1) dmxBytes[sampleIndex] = 0x80;
    const expanded = audio.expandDmxSamplesToOutputRate(dmxBytes, audio.nativeSfxSampleRateHz);
    expect(expanded).toBeInstanceOf(Int16Array);
    const expectedLength = Math.floor((11025 * audio.outputSampleRateHz) / audio.nativeSfxSampleRateHz);
    expect(Math.abs(expanded.length - expectedLength)).toBeLessThanOrEqual(1);
  });

  test('mix returns the same Int16Array instance when output is supplied (in-place mixing)', () => {
    const audio = createPcmMixerWin32Output();
    const output = new Int16Array(64 * 2);
    const result = audio.mix([], 64, output);
    expect(result).toBe(output);
  });
});
