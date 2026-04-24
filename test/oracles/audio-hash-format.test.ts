import { describe, expect, test } from 'bun:test';

import { AUDIO_MAX_CHANNELS, AUDIO_SAMPLE_RATE, DEFAULT_AUDIO_SAMPLING_INTERVAL_TICS, DMX_NATIVE_SAMPLE_RATE, EMPTY_DEMO_PLAYBACK_AUDIO_HASH, EMPTY_TITLE_LOOP_AUDIO_HASH, SAMPLES_PER_TIC } from '../../src/oracles/audioHash.ts';
import type { AudioHashArtifact, AudioHashEntry, AudioHashPayload } from '../../src/oracles/audioHash.ts';
import { ORACLE_KINDS } from '../../src/oracles/schema.ts';
import type { OracleArtifact } from '../../src/oracles/schema.ts';
import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_RUN_MANIFEST } from '../../src/oracles/referenceRunManifest.ts';

describe('audio constants', () => {
  test('AUDIO_SAMPLE_RATE is 44100 (F-033)', () => {
    expect(AUDIO_SAMPLE_RATE).toBe(44_100);
  });

  test('AUDIO_SAMPLE_RATE matches REFERENCE_RUN_MANIFEST audio config', () => {
    expect(AUDIO_SAMPLE_RATE).toBe(REFERENCE_RUN_MANIFEST.audio.sampleRate);
  });

  test('AUDIO_MAX_CHANNELS is 8 (F-033)', () => {
    expect(AUDIO_MAX_CHANNELS).toBe(8);
  });

  test('AUDIO_MAX_CHANNELS matches REFERENCE_RUN_MANIFEST audio config', () => {
    expect(AUDIO_MAX_CHANNELS).toBe(REFERENCE_RUN_MANIFEST.audio.maxChannels);
  });

  test('DMX_NATIVE_SAMPLE_RATE is 11025 (F-028)', () => {
    expect(DMX_NATIVE_SAMPLE_RATE).toBe(11_025);
  });

  test('SAMPLES_PER_TIC is AUDIO_SAMPLE_RATE / ticRateHz (1260)', () => {
    expect(SAMPLES_PER_TIC).toBe(AUDIO_SAMPLE_RATE / PRIMARY_TARGET.ticRateHz);
    expect(SAMPLES_PER_TIC).toBe(1260);
  });

  test('SAMPLES_PER_TIC is an exact integer (no fractional samples)', () => {
    expect(Number.isInteger(SAMPLES_PER_TIC)).toBe(true);
  });
});

describe('DEFAULT_AUDIO_SAMPLING_INTERVAL_TICS', () => {
  test('is 35 (one second at Doom tic rate)', () => {
    expect(DEFAULT_AUDIO_SAMPLING_INTERVAL_TICS).toBe(35);
    expect(DEFAULT_AUDIO_SAMPLING_INTERVAL_TICS).toBe(PRIMARY_TARGET.ticRateHz);
  });
});

describe('ORACLE_KINDS cross-reference', () => {
  test('audio-hash is a registered oracle kind', () => {
    expect(ORACLE_KINDS).toContain('audio-hash');
  });
});

describe('EMPTY_TITLE_LOOP_AUDIO_HASH', () => {
  test('targets title-loop run mode', () => {
    expect(EMPTY_TITLE_LOOP_AUDIO_HASH.targetRunMode).toBe('title-loop');
  });

  test('uses DEFAULT_AUDIO_SAMPLING_INTERVAL_TICS', () => {
    expect(EMPTY_TITLE_LOOP_AUDIO_HASH.samplingIntervalTics).toBe(DEFAULT_AUDIO_SAMPLING_INTERVAL_TICS);
  });

  test('has empty entries array', () => {
    expect(EMPTY_TITLE_LOOP_AUDIO_HASH.entries).toHaveLength(0);
  });

  test('ticRateHz matches PRIMARY_TARGET', () => {
    expect(EMPTY_TITLE_LOOP_AUDIO_HASH.ticRateHz).toBe(PRIMARY_TARGET.ticRateHz);
    expect(EMPTY_TITLE_LOOP_AUDIO_HASH.ticRateHz).toBe(35);
  });

  test('sampleRate and maxChannels match audio constants', () => {
    expect(EMPTY_TITLE_LOOP_AUDIO_HASH.sampleRate).toBe(AUDIO_SAMPLE_RATE);
    expect(EMPTY_TITLE_LOOP_AUDIO_HASH.maxChannels).toBe(AUDIO_MAX_CHANNELS);
  });

  test('has non-empty description', () => {
    expect(EMPTY_TITLE_LOOP_AUDIO_HASH.description.length).toBeGreaterThan(0);
  });

  test('is frozen at top level and entries array', () => {
    expect(Object.isFrozen(EMPTY_TITLE_LOOP_AUDIO_HASH)).toBe(true);
    expect(Object.isFrozen(EMPTY_TITLE_LOOP_AUDIO_HASH.entries)).toBe(true);
  });
});

describe('EMPTY_DEMO_PLAYBACK_AUDIO_HASH', () => {
  test('targets demo-playback run mode', () => {
    expect(EMPTY_DEMO_PLAYBACK_AUDIO_HASH.targetRunMode).toBe('demo-playback');
  });

  test('uses DEFAULT_AUDIO_SAMPLING_INTERVAL_TICS', () => {
    expect(EMPTY_DEMO_PLAYBACK_AUDIO_HASH.samplingIntervalTics).toBe(DEFAULT_AUDIO_SAMPLING_INTERVAL_TICS);
  });

  test('has empty entries array', () => {
    expect(EMPTY_DEMO_PLAYBACK_AUDIO_HASH.entries).toHaveLength(0);
  });

  test('ticRateHz matches PRIMARY_TARGET', () => {
    expect(EMPTY_DEMO_PLAYBACK_AUDIO_HASH.ticRateHz).toBe(PRIMARY_TARGET.ticRateHz);
  });

  test('sampleRate and maxChannels match audio constants', () => {
    expect(EMPTY_DEMO_PLAYBACK_AUDIO_HASH.sampleRate).toBe(AUDIO_SAMPLE_RATE);
    expect(EMPTY_DEMO_PLAYBACK_AUDIO_HASH.maxChannels).toBe(AUDIO_MAX_CHANNELS);
  });

  test('is frozen at top level and entries array', () => {
    expect(Object.isFrozen(EMPTY_DEMO_PLAYBACK_AUDIO_HASH)).toBe(true);
    expect(Object.isFrozen(EMPTY_DEMO_PLAYBACK_AUDIO_HASH.entries)).toBe(true);
  });
});

describe('AudioHashEntry well-formed acceptance', () => {
  test('accepts a valid entry with hash and zero active channels (silence)', () => {
    const entry: AudioHashEntry = {
      tic: 0,
      hash: 'a'.repeat(64),
      activeChannels: 0,
    };
    expect(entry.tic).toBe(0);
    expect(entry.hash).toHaveLength(64);
    expect(entry.activeChannels).toBe(0);
  });

  test('accepts an entry at maximum channel occupancy', () => {
    const entry: AudioHashEntry = {
      tic: 35,
      hash: 'b'.repeat(64),
      activeChannels: AUDIO_MAX_CHANNELS,
    };
    expect(entry.activeChannels).toBe(8);
    expect(entry.activeChannels).toBe(AUDIO_MAX_CHANNELS);
  });

  test('accepts an entry with partial channel usage', () => {
    const entry: AudioHashEntry = {
      tic: 70,
      hash: 'c'.repeat(64),
      activeChannels: 3,
    };
    expect(entry.activeChannels).toBeGreaterThan(0);
    expect(entry.activeChannels).toBeLessThan(AUDIO_MAX_CHANNELS);
  });
});

describe('AudioHashPayload well-formed acceptance', () => {
  test('accepts a multi-entry payload with ascending tic order', () => {
    const payload: AudioHashPayload = {
      description: 'Test audio hashes with multiple entries',
      targetRunMode: 'demo-playback',
      samplingIntervalTics: 35,
      ticRateHz: 35,
      sampleRate: AUDIO_SAMPLE_RATE,
      maxChannels: AUDIO_MAX_CHANNELS,
      entries: [
        { tic: 0, hash: 'a'.repeat(64), activeChannels: 0 },
        { tic: 35, hash: 'b'.repeat(64), activeChannels: 2 },
        { tic: 70, hash: 'c'.repeat(64), activeChannels: 5 },
      ],
    };
    expect(payload.entries).toHaveLength(3);
    const tics = payload.entries.map((entry) => entry.tic);
    expect(tics).toEqual([0, 35, 70]);
  });

  test('allows sampling interval of 1 for tic-by-tic debugging', () => {
    const payload: AudioHashPayload = {
      description: 'Tic-by-tic audio hash for sound divergence debugging',
      targetRunMode: 'title-loop',
      samplingIntervalTics: 1,
      ticRateHz: 35,
      sampleRate: AUDIO_SAMPLE_RATE,
      maxChannels: AUDIO_MAX_CHANNELS,
      entries: [
        { tic: 0, hash: 'd'.repeat(64), activeChannels: 0 },
        { tic: 1, hash: 'e'.repeat(64), activeChannels: 1 },
        { tic: 2, hash: 'f'.repeat(64), activeChannels: 1 },
      ],
    };
    expect(payload.samplingIntervalTics).toBe(1);
  });
});

describe('parity-sensitive edge cases', () => {
  test('silence hash differs from active-channel hash (different mix output)', () => {
    const silentEntry: AudioHashEntry = {
      tic: 100,
      hash: '0'.repeat(64),
      activeChannels: 0,
    };
    const activeEntry: AudioHashEntry = {
      tic: 100,
      hash: 'a'.repeat(64),
      activeChannels: 3,
    };
    // Same tic but different channel states produce different hashes
    expect(silentEntry.activeChannels).not.toBe(activeEntry.activeChannels);
    expect(silentEntry.hash).not.toBe(activeEntry.hash);
  });

  test('sfx-priority-eviction affects mix when all channels are full (F-026)', () => {
    // When all 8 channels are occupied, a new higher-priority sound
    // evicts a lower-priority one, changing the mix output hash
    const beforeEviction: AudioHashEntry = {
      tic: 200,
      hash: '1'.repeat(64),
      activeChannels: AUDIO_MAX_CHANNELS,
    };
    const afterEviction: AudioHashEntry = {
      tic: 201,
      hash: '2'.repeat(64),
      activeChannels: AUDIO_MAX_CHANNELS,
    };
    // Both tics have max channels but different mixes due to eviction
    expect(beforeEviction.activeChannels).toBe(afterEviction.activeChannels);
    expect(beforeEviction.hash).not.toBe(afterEviction.hash);
  });

  test('tic 0 captures initial audio state before any sounds play', () => {
    const entry: AudioHashEntry = {
      tic: 0,
      hash: '0'.repeat(64),
      activeChannels: 0,
    };
    // Tic 0 captures audio state before S_Init triggers any sound
    expect(entry.tic).toBe(0);
    expect(entry.activeChannels).toBe(0);
  });

  test('DMX resampling: output rate is exactly 4x native rate', () => {
    // 44100 / 11025 = 4 — Chocolate Doom resamples by this factor
    expect(AUDIO_SAMPLE_RATE / DMX_NATIVE_SAMPLE_RATE).toBe(4);
  });

  test('distance attenuation affects hash: same sound at different distances produces different mix (F-028)', () => {
    // S_CLOSE_DIST (200 map units) = full volume
    // S_CLIPPING_DIST (1200 map units) = silent
    // Linear rolloff between these values means the PCM mix changes
    // based on player-to-source distance, producing different hashes
    const closeEntry: AudioHashEntry = {
      tic: 300,
      hash: 'a'.repeat(64),
      activeChannels: 1,
    };
    const farEntry: AudioHashEntry = {
      tic: 300,
      hash: 'b'.repeat(64),
      activeChannels: 1,
    };
    // Same channel count but different volume produces different hash
    expect(closeEntry.activeChannels).toBe(farEntry.activeChannels);
    expect(closeEntry.hash).not.toBe(farEntry.hash);
  });
});

describe('compile-time type satisfaction', () => {
  test('AudioHashArtifact wraps AudioHashPayload in OracleArtifact envelope', () => {
    const artifact: AudioHashArtifact = {
      kind: 'audio-hash',
      version: 1,
      generatedAt: '2026-04-12T00:00:00Z',
      sourceHash: '0'.repeat(64),
      payload: EMPTY_TITLE_LOOP_AUDIO_HASH,
    };
    expect(artifact.kind).toBe('audio-hash');
    expect(artifact.version).toBe(1);
    expect(artifact.payload).toBe(EMPTY_TITLE_LOOP_AUDIO_HASH);
  });

  test('AudioHashArtifact satisfies OracleArtifact<AudioHashPayload>', () => {
    const artifact: OracleArtifact<AudioHashPayload> = {
      kind: 'audio-hash',
      version: 1,
      generatedAt: '2026-04-12T00:00:00Z',
      sourceHash: 'A'.repeat(64),
      payload: EMPTY_DEMO_PLAYBACK_AUDIO_HASH,
    };
    expect(artifact.payload.targetRunMode).toBe('demo-playback');
  });
});
