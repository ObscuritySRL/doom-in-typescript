import { describe, expect, it } from 'bun:test';

import {
  DEFAULT_OUTPUT_SAMPLE_RATE,
  DMX_NATIVE_SAMPLE_RATE,
  EXPAND_RATIO_SCALE,
  EXPAND_RATIO_SHIFT,
  INT16_MAX,
  INT16_MIN,
  MIX_MAX_VOLUME,
  PCM_BYTE_MIDPOINT,
  SEP_LEFT_MAX,
  clipToInt16,
  computeExpandRatio,
  computeExpandedLength,
  computeStereoGains,
  createMixerVoice,
  dmxByteToInt16,
  expandDmxSamples,
  mixVoices,
} from '../../src/audio/pcmMixer.ts';
import type { MixerVoice } from '../../src/audio/pcmMixer.ts';

import { NORM_SEP } from '../../src/audio/spatial.ts';

describe('pcmMixer constants', () => {
  it('PCM_BYTE_MIDPOINT equals 0x80 — the DMX silence byte', () => {
    expect(PCM_BYTE_MIDPOINT).toBe(0x80);
  });

  it('INT16_MIN / INT16_MAX match the C signed-16-bit range', () => {
    expect(INT16_MIN).toBe(-32768);
    expect(INT16_MAX).toBe(32767);
  });

  it('MIX_MAX_VOLUME equals 127 — the chocolate-doom Mix_Volume divisor', () => {
    expect(MIX_MAX_VOLUME).toBe(127);
  });

  it('SEP_LEFT_MAX equals 254 — the (254 - sep) left-gain ceiling', () => {
    expect(SEP_LEFT_MAX).toBe(254);
  });

  it('DMX_NATIVE_SAMPLE_RATE equals 11025 — default DMX rate from F-028', () => {
    expect(DMX_NATIVE_SAMPLE_RATE).toBe(11025);
  });

  it('DEFAULT_OUTPUT_SAMPLE_RATE equals 44100 — reference output rate from F-033', () => {
    expect(DEFAULT_OUTPUT_SAMPLE_RATE).toBe(44100);
  });

  it('EXPAND_RATIO_SHIFT / EXPAND_RATIO_SCALE form the 8.8 step ratio', () => {
    expect(EXPAND_RATIO_SHIFT).toBe(8);
    expect(EXPAND_RATIO_SCALE).toBe(256);
    expect(1 << EXPAND_RATIO_SHIFT).toBe(EXPAND_RATIO_SCALE);
  });
});

describe('dmxByteToInt16 — DMX byte to signed 16-bit', () => {
  it('maps 0x00 to INT16_MIN (-32768)', () => {
    expect(dmxByteToInt16(0x00)).toBe(INT16_MIN);
  });

  it('maps 0xFF to INT16_MAX (32767)', () => {
    expect(dmxByteToInt16(0xff)).toBe(INT16_MAX);
  });

  it('maps DMX silence byte 0x80 to +128 (vanilla replicate-and-subtract quirk)', () => {
    expect(dmxByteToInt16(PCM_BYTE_MIDPOINT)).toBe(128);
  });

  it('maps 0x7F to -127 (one below midpoint decodes just below zero)', () => {
    expect(dmxByteToInt16(0x7f)).toBe(-129);
  });

  it('matches the (b | (b << 8)) - 0x8000 formula for every byte in [0, 255]', () => {
    for (let b = 0; b <= 0xff; b++) {
      expect(dmxByteToInt16(b)).toBe((b | (b << 8)) - 0x8000);
    }
  });

  it('throws RangeError on non-integer input', () => {
    expect(() => dmxByteToInt16(1.5)).toThrow(RangeError);
    expect(() => dmxByteToInt16(Number.NaN)).toThrow(RangeError);
  });

  it('throws RangeError for out-of-range bytes', () => {
    expect(() => dmxByteToInt16(-1)).toThrow(RangeError);
    expect(() => dmxByteToInt16(256)).toThrow(RangeError);
  });
});

describe('clipToInt16 — saturation', () => {
  it('passes through values already in range', () => {
    expect(clipToInt16(0)).toBe(0);
    expect(clipToInt16(128)).toBe(128);
    expect(clipToInt16(-1)).toBe(-1);
    expect(clipToInt16(INT16_MAX)).toBe(INT16_MAX);
    expect(clipToInt16(INT16_MIN)).toBe(INT16_MIN);
  });

  it('saturates at INT16_MAX for values above 32767', () => {
    expect(clipToInt16(32768)).toBe(INT16_MAX);
    expect(clipToInt16(65535)).toBe(INT16_MAX);
    expect(clipToInt16(1_000_000)).toBe(INT16_MAX);
  });

  it('saturates at INT16_MIN for values below -32768', () => {
    expect(clipToInt16(-32769)).toBe(INT16_MIN);
    expect(clipToInt16(-70000)).toBe(INT16_MIN);
    expect(clipToInt16(-1_000_000)).toBe(INT16_MIN);
  });

  it('truncates fractional accumulators toward zero before clipping', () => {
    expect(clipToInt16(0.9)).toBe(0);
    expect(clipToInt16(-0.9)).toBe(0);
    expect(clipToInt16(32767.9)).toBe(INT16_MAX);
    expect(clipToInt16(-32768.1)).toBe(INT16_MIN);
  });
});

describe('computeExpandedLength — output frame count for a DMX body', () => {
  it('returns 4x the source length at 11025 -> 44100 (integer multiple)', () => {
    expect(computeExpandedLength(1000, DMX_NATIVE_SAMPLE_RATE, DEFAULT_OUTPUT_SAMPLE_RATE)).toBe(4000);
  });

  it('returns 2x the source length at 22050 -> 44100 (DSITMBK case)', () => {
    expect(computeExpandedLength(500, 22050, DEFAULT_OUTPUT_SAMPLE_RATE)).toBe(1000);
  });

  it('returns 0 for an empty source', () => {
    expect(computeExpandedLength(0, DMX_NATIVE_SAMPLE_RATE, DEFAULT_OUTPUT_SAMPLE_RATE)).toBe(0);
  });

  it('uses C integer division (truncation toward zero) for non-integer ratios', () => {
    expect(computeExpandedLength(7, 11025, 44100)).toBe(28);
    expect(computeExpandedLength(3, 11000, 44100)).toBe(Math.trunc((3 * 44100) / 11000));
  });

  it('throws on non-integer or negative source length', () => {
    expect(() => computeExpandedLength(-1, 11025, 44100)).toThrow(RangeError);
    expect(() => computeExpandedLength(1.5, 11025, 44100)).toThrow(RangeError);
  });

  it('throws on non-positive sample rates', () => {
    expect(() => computeExpandedLength(10, 0, 44100)).toThrow(RangeError);
    expect(() => computeExpandedLength(10, 11025, -44100)).toThrow(RangeError);
  });
});

describe('computeExpandRatio — 8.8 fixed-point step', () => {
  it('produces ratio=64 for the 11025->44100 case (step = input/4)', () => {
    const length = 100;
    const expanded = 400;
    expect(computeExpandRatio(length, expanded)).toBe(64);
  });

  it('produces ratio=128 for the 22050->44100 case (step = input/2, DSITMBK)', () => {
    const length = 100;
    const expanded = 200;
    expect(computeExpandRatio(length, expanded)).toBe(128);
  });

  it('returns 0 when expandedLength is 0', () => {
    expect(computeExpandRatio(100, 0)).toBe(0);
  });

  it('produces (i * ratio) >> 8 indices that match i/4 for the 4x upsample case', () => {
    const ratio = computeExpandRatio(100, 400);
    for (let i = 0; i < 400; i++) {
      expect((i * ratio) >> EXPAND_RATIO_SHIFT).toBe(Math.trunc(i / 4));
    }
  });

  it('throws on negative / non-integer lengths', () => {
    expect(() => computeExpandRatio(-1, 10)).toThrow(RangeError);
    expect(() => computeExpandRatio(10, -1)).toThrow(RangeError);
    expect(() => computeExpandRatio(1.5, 10)).toThrow(RangeError);
  });
});

describe('expandDmxSamples — nearest-neighbour resampling', () => {
  it('upsamples 11025 Hz to 44100 Hz by replicating each byte four times', () => {
    const source = Uint8Array.from([0x00, 0x80, 0xff]);
    const expanded = expandDmxSamples(source, DMX_NATIVE_SAMPLE_RATE, DEFAULT_OUTPUT_SAMPLE_RATE);
    expect(expanded.length).toBe(12);
    const s0 = dmxByteToInt16(0x00);
    const s1 = dmxByteToInt16(0x80);
    const s2 = dmxByteToInt16(0xff);
    expect(Array.from(expanded)).toEqual([s0, s0, s0, s0, s1, s1, s1, s1, s2, s2, s2, s2]);
  });

  it('upsamples 22050 Hz to 44100 Hz by replicating each byte twice (DSITMBK case)', () => {
    const source = Uint8Array.from([0x00, 0xff]);
    const expanded = expandDmxSamples(source, 22050, DEFAULT_OUTPUT_SAMPLE_RATE);
    expect(expanded.length).toBe(4);
    const s0 = dmxByteToInt16(0x00);
    const s1 = dmxByteToInt16(0xff);
    expect(Array.from(expanded)).toEqual([s0, s0, s1, s1]);
  });

  it('returns an empty Int16Array for an empty DMX body', () => {
    const expanded = expandDmxSamples(new Uint8Array(0), DMX_NATIVE_SAMPLE_RATE, DEFAULT_OUTPUT_SAMPLE_RATE);
    expect(expanded).toBeInstanceOf(Int16Array);
    expect(expanded.length).toBe(0);
  });

  it('maps DMX silence bytes to +128 throughout (vanilla quirk preserved across expansion)', () => {
    const source = new Uint8Array(10).fill(PCM_BYTE_MIDPOINT);
    const expanded = expandDmxSamples(source, DMX_NATIVE_SAMPLE_RATE, DEFAULT_OUTPUT_SAMPLE_RATE);
    expect(expanded.length).toBe(40);
    for (let i = 0; i < expanded.length; i++) {
      expect(expanded[i]).toBe(128);
    }
  });

  it('uses sample-and-hold (not linear interpolation) — every output sample equals some input byte decoded', () => {
    const source = Uint8Array.from([10, 240]);
    const expanded = expandDmxSamples(source, DMX_NATIVE_SAMPLE_RATE, DEFAULT_OUTPUT_SAMPLE_RATE);
    const allowed = new Set([dmxByteToInt16(10), dmxByteToInt16(240)]);
    for (let i = 0; i < expanded.length; i++) {
      expect(allowed.has(expanded[i]!)).toBe(true);
    }
  });

  it('matches the vanilla (i * ratio) >> 8 index formula verbatim', () => {
    const source = Uint8Array.from([5, 50, 95, 140, 185, 230]);
    const sourceRate = DMX_NATIVE_SAMPLE_RATE;
    const outputRate = DEFAULT_OUTPUT_SAMPLE_RATE;
    const expanded = expandDmxSamples(source, sourceRate, outputRate);
    const expandedLength = computeExpandedLength(source.length, sourceRate, outputRate);
    const ratio = computeExpandRatio(source.length, expandedLength);
    expect(expanded.length).toBe(expandedLength);
    for (let i = 0; i < expandedLength; i++) {
      const src = (i * ratio) >> EXPAND_RATIO_SHIFT;
      expect(expanded[i]).toBe(dmxByteToInt16(source[src]!));
    }
  });

  it('throws TypeError when samples is not a Uint8Array', () => {
    expect(() => expandDmxSamples([0, 1, 2] as unknown as Uint8Array, 11025, 44100)).toThrow(TypeError);
  });
});

describe('computeStereoGains — (vol, sep) -> (left, right)', () => {
  it('computes symmetric-ish pair at NORM_SEP=128 for sfxVolume=15', () => {
    const gains = computeStereoGains(15, NORM_SEP);
    expect(gains.left).toBe(Math.trunc((126 * 15) / 127));
    expect(gains.right).toBe(Math.trunc((128 * 15) / 127));
    expect(gains.left).toBe(14);
    expect(gains.right).toBe(15);
  });

  it('sep=0 mutes the right channel and doubles the left (2 * vol - vol/127 chocolate-doom quirk)', () => {
    const gains = computeStereoGains(127, 0);
    expect(gains.left).toBe(254);
    expect(gains.right).toBe(0);
  });

  it('sep=254 maxes the right channel and zeroes the left (chocolate-doom formula endpoint)', () => {
    const gains = computeStereoGains(127, 254);
    expect(gains.left).toBe(0);
    expect(gains.right).toBe(254);
  });

  it('sep=255 drops left below zero (vanilla unclamped asymmetry kept for parity)', () => {
    const gains = computeStereoGains(127, 255);
    expect(gains.left).toBe(-1);
    expect(gains.right).toBe(255);
  });

  it('volume=0 produces both gains zero regardless of sep', () => {
    for (const sep of [0, 64, NORM_SEP, 192, 254]) {
      const gains = computeStereoGains(0, sep);
      expect(gains.left).toBe(0);
      expect(gains.right).toBe(0);
    }
  });

  it('uses C integer division toward zero (Math.trunc) for small-sep/small-vol', () => {
    const gains = computeStereoGains(5, 100);
    expect(gains.left).toBe(Math.trunc(((254 - 100) * 5) / 127));
    expect(gains.right).toBe(Math.trunc((100 * 5) / 127));
    expect(gains.left).toBe(6);
    expect(gains.right).toBe(3);
  });

  it('throws on non-integer or negative volume', () => {
    expect(() => computeStereoGains(-1, 128)).toThrow(RangeError);
    expect(() => computeStereoGains(1.5, 128)).toThrow(RangeError);
  });

  it('throws on out-of-range separation', () => {
    expect(() => computeStereoGains(15, -1)).toThrow(RangeError);
    expect(() => computeStereoGains(15, 256)).toThrow(RangeError);
    expect(() => computeStereoGains(15, 128.5)).toThrow(RangeError);
  });
});

describe('createMixerVoice — convenience constructor', () => {
  it('installs gains from computeStereoGains and starts at position 0', () => {
    const samples = Int16Array.from([1000, 2000, 3000]);
    const voice = createMixerVoice(samples, 15, NORM_SEP);
    expect(voice.samples).toBe(samples);
    expect(voice.position).toBe(0);
    expect(voice.finished).toBe(false);
    expect(voice.leftGain).toBe(14);
    expect(voice.rightGain).toBe(15);
  });

  it('marks an empty voice finished immediately', () => {
    const voice = createMixerVoice(new Int16Array(0), 15, NORM_SEP);
    expect(voice.finished).toBe(true);
  });

  it('throws TypeError when samples is not an Int16Array', () => {
    expect(() => createMixerVoice([1, 2, 3] as unknown as Int16Array, 15, NORM_SEP)).toThrow(TypeError);
  });
});

function voiceOf(samples: Int16Array, left: number, right: number): MixerVoice {
  return { samples, position: 0, leftGain: left, rightGain: right, finished: false };
}

describe('mixVoices — clipping-and-stepping', () => {
  it('returns an all-zero interleaved buffer when no voices are active', () => {
    const output = mixVoices([], 4);
    expect(output).toBeInstanceOf(Int16Array);
    expect(output.length).toBe(8);
    expect(Array.from(output)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('returns an all-zero buffer for frameCount=0 regardless of voices', () => {
    const samples = Int16Array.from([1000, 2000]);
    const voice = voiceOf(samples, MIX_MAX_VOLUME, MIX_MAX_VOLUME);
    const output = mixVoices([voice], 0);
    expect(output.length).toBe(0);
    expect(voice.position).toBe(0);
    expect(voice.finished).toBe(false);
  });

  it('passes a single centre-panned voice through unchanged when gain == MIX_MAX_VOLUME', () => {
    const samples = Int16Array.from([100, -200, 300]);
    const voice = voiceOf(samples, MIX_MAX_VOLUME, MIX_MAX_VOLUME);
    const output = mixVoices([voice], 3);
    expect(Array.from(output)).toEqual([100, 100, -200, -200, 300, 300]);
    expect(voice.position).toBe(3);
    expect(voice.finished).toBe(true);
  });

  it('advances position by one per frame and marks finished on the tic that exhausts the buffer', () => {
    const samples = Int16Array.from([1, 2, 3, 4]);
    const voice = voiceOf(samples, MIX_MAX_VOLUME, MIX_MAX_VOLUME);
    mixVoices([voice], 2);
    expect(voice.position).toBe(2);
    expect(voice.finished).toBe(false);
    mixVoices([voice], 2);
    expect(voice.position).toBe(4);
    expect(voice.finished).toBe(true);
  });

  it('contributes silence for frames beyond the end of a voice', () => {
    const samples = Int16Array.from([500, 500]);
    const voice = voiceOf(samples, MIX_MAX_VOLUME, MIX_MAX_VOLUME);
    const output = mixVoices([voice], 4);
    expect(Array.from(output)).toEqual([500, 500, 500, 500, 0, 0, 0, 0]);
    expect(voice.finished).toBe(true);
  });

  it('skips an already-finished voice even if position < samples.length', () => {
    const samples = Int16Array.from([123, 456]);
    const voice: MixerVoice = {
      samples,
      position: 0,
      leftGain: MIX_MAX_VOLUME,
      rightGain: MIX_MAX_VOLUME,
      finished: true,
    };
    const output = mixVoices([voice], 2);
    expect(Array.from(output)).toEqual([0, 0, 0, 0]);
    expect(voice.position).toBe(0);
  });

  it('saturates positive overflow at INT16_MAX instead of wrapping', () => {
    const a = voiceOf(Int16Array.from([INT16_MAX, INT16_MAX]), MIX_MAX_VOLUME, MIX_MAX_VOLUME);
    const b = voiceOf(Int16Array.from([INT16_MAX, INT16_MAX]), MIX_MAX_VOLUME, MIX_MAX_VOLUME);
    const output = mixVoices([a, b], 2);
    expect(Array.from(output)).toEqual([INT16_MAX, INT16_MAX, INT16_MAX, INT16_MAX]);
  });

  it('saturates negative overflow at INT16_MIN instead of wrapping', () => {
    const a = voiceOf(Int16Array.from([INT16_MIN, INT16_MIN]), MIX_MAX_VOLUME, MIX_MAX_VOLUME);
    const b = voiceOf(Int16Array.from([INT16_MIN, INT16_MIN]), MIX_MAX_VOLUME, MIX_MAX_VOLUME);
    const output = mixVoices([a, b], 2);
    expect(Array.from(output)).toEqual([INT16_MIN, INT16_MIN, INT16_MIN, INT16_MIN]);
  });

  it('pans a single voice with sep=0 to the left channel only', () => {
    const samples = Int16Array.from([1270]);
    const { left, right } = computeStereoGains(127, 0);
    const voice = voiceOf(samples, left, right);
    const output = mixVoices([voice], 1);
    expect(output[0]).toBe(Math.trunc((1270 * left) / MIX_MAX_VOLUME));
    expect(output[1]).toBe(0);
  });

  it('pans a single voice with sep=254 to the right channel only', () => {
    const samples = Int16Array.from([1270]);
    const { left, right } = computeStereoGains(127, 254);
    const voice = voiceOf(samples, left, right);
    const output = mixVoices([voice], 1);
    expect(output[0]).toBe(0);
    expect(output[1]).toBe(Math.trunc((1270 * right) / MIX_MAX_VOLUME));
  });

  it('mixes two voices additively using per-voice gains', () => {
    const a = voiceOf(Int16Array.from([1000]), 64, 0);
    const b = voiceOf(Int16Array.from([1000]), 0, 64);
    const output = mixVoices([a, b], 1);
    const expectedL = Math.trunc((1000 * 64) / MIX_MAX_VOLUME);
    const expectedR = Math.trunc((1000 * 64) / MIX_MAX_VOLUME);
    expect(output[0]).toBe(expectedL);
    expect(output[1]).toBe(expectedR);
  });

  it('reuses a caller-supplied output buffer and zeros stale contents before mixing', () => {
    const reusable = new Int16Array(6);
    reusable.fill(0x4444);
    const samples = Int16Array.from([10, 20, 30]);
    const voice = voiceOf(samples, MIX_MAX_VOLUME, MIX_MAX_VOLUME);
    const result = mixVoices([voice], 3, reusable);
    expect(result).toBe(reusable);
    expect(Array.from(result)).toEqual([10, 10, 20, 20, 30, 30]);
  });

  it('throws when output length does not match frameCount*2', () => {
    const samples = Int16Array.from([1]);
    const voice = voiceOf(samples, MIX_MAX_VOLUME, MIX_MAX_VOLUME);
    expect(() => mixVoices([voice], 3, new Int16Array(4))).toThrow(RangeError);
  });

  it('throws RangeError on negative or non-integer frameCount', () => {
    expect(() => mixVoices([], -1)).toThrow(RangeError);
    expect(() => mixVoices([], 1.5)).toThrow(RangeError);
  });

  it('handles one tic of output (1260 frames) without overflow for eight active voices', () => {
    const samples = new Int16Array(1260).fill(INT16_MAX);
    const voices: MixerVoice[] = [];
    for (let i = 0; i < 8; i++) {
      voices.push(voiceOf(new Int16Array(samples), MIX_MAX_VOLUME, MIX_MAX_VOLUME));
    }
    const output = mixVoices(voices, 1260);
    expect(output.length).toBe(2520);
    for (let f = 0; f < 1260; f++) {
      expect(output[f * 2]).toBe(INT16_MAX);
      expect(output[f * 2 + 1]).toBe(INT16_MAX);
    }
    for (const voice of voices) {
      expect(voice.finished).toBe(true);
    }
  });
});
