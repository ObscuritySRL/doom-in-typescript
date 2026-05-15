import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  EMPTY_DEMO_PLAYBACK_MUSIC_EVENT_LOG,
  EMPTY_TITLE_LOOP_MUSIC_EVENT_LOG,
  HARNESS_SHA256_HEX_LENGTH,
  HARNESS_TIC_RATE_HZ,
  MIDI_PERCUSSION_CHANNEL,
  MUS_MAX_CHANNELS,
  MUS_PERCUSSION_CHANNEL,
  MUSIC_EVENT_KINDS,
  MUSIC_VOLUME_MAX,
  MUSIC_VOLUME_MIN,
  VANILLA_AUDIO_HASH_WINDOW_INVARIANTS,
  createAudioParityHarness,
  hashPcmBuffer,
  isHarnessMusicPlaying,
} from '../../../src/vanilla/wireAudioHashWindows.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireAudioHashWindows.ts');

describe('plan_final audio: wire-audio-hash-windows', () => {
  test('src/vanilla/wireAudioHashWindows.ts exists, is a regular file, and cites plan_final step 11-008', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('11-008');
    expect(fileText).toContain('VANILLA_AUDIO_HASH_WINDOW_INVARIANTS');
  });

  test('the facade re-exports only from the two read-only audio-hash modules', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('../'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../audio/audioParity.ts', '../oracles/musicEventLog.ts']);
  });

  test('VANILLA_AUDIO_HASH_WINDOW_INVARIANTS pins the five parity rules and is frozen', () => {
    expect(VANILLA_AUDIO_HASH_WINDOW_INVARIANTS.length).toBe(5);
    expect(Object.isFrozen(VANILLA_AUDIO_HASH_WINDOW_INVARIANTS)).toBe(true);
    const ids = VANILLA_AUDIO_HASH_WINDOW_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual([
      'HARNESS_TIC_RATE_IS_35HZ_WITH_INTEGER_SAMPLES_PER_TIC',
      'MIXED_PCM_HASHED_AS_64_HEX_SHA256_PER_TIC',
      'MUSIC_EVENT_LOG_HAS_FOUR_DETERMINISTIC_KINDS',
      'MUS_USES_16_CHANNELS_PERCUSSION_15_MIDI_9',
      'SFX_START_PATH_IS_DETERMINISTIC_THROUGH_THE_HARNESS',
    ]);
    for (const invariant of VANILLA_AUDIO_HASH_WINDOW_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('the harness and MUS constants match vanilla', () => {
    expect(HARNESS_TIC_RATE_HZ).toBe(35);
    expect(HARNESS_SHA256_HEX_LENGTH).toBe(64);
    expect(MUS_MAX_CHANNELS).toBe(16);
    expect(MUS_PERCUSSION_CHANNEL).toBe(15);
    expect(MIDI_PERCUSSION_CHANNEL).toBe(9);
    expect(MUSIC_VOLUME_MIN).toBe(0);
    expect(MUSIC_VOLUME_MAX).toBe(15);
  });

  test('the music-event log exposes exactly the four deterministic kinds with frozen empty baselines', () => {
    expect([...MUSIC_EVENT_KINDS]).toEqual(['change-music', 'pause-music', 'resume-music', 'stop-music']);
    expect(Object.isFrozen(MUSIC_EVENT_KINDS)).toBe(true);
    expect(Object.isFrozen(EMPTY_TITLE_LOOP_MUSIC_EVENT_LOG)).toBe(true);
    expect(Object.isFrozen(EMPTY_DEMO_PLAYBACK_MUSIC_EVENT_LOG)).toBe(true);
  });

  test('hashPcmBuffer is a deterministic 64-hex SHA-256 over the mixed PCM', () => {
    const bufferA = new Int16Array([0, 1, -1, 32767, -32768, 100]);
    const bufferB = new Int16Array([0, 1, -1, 32767, -32768, 101]);
    const hashA = hashPcmBuffer(bufferA);
    expect(hashA).toHaveLength(HARNESS_SHA256_HEX_LENGTH);
    expect(hashA).toMatch(/^[0-9A-F]{64}$/);
    expect(hashPcmBuffer(new Int16Array([0, 1, -1, 32767, -32768, 100]))).toBe(hashA);
    expect(hashPcmBuffer(bufferB)).not.toBe(hashA);
  });

  test('createAudioParityHarness builds a fresh deterministic harness with no song playing', () => {
    const harness = createAudioParityHarness();
    expect(harness.tic).toBe(0);
    expect(harness.ticRateHz).toBe(HARNESS_TIC_RATE_HZ);
    expect(harness.outputSampleRate % harness.ticRateHz).toBe(0);
    expect(harness.samplesPerTic).toBe(harness.outputSampleRate / harness.ticRateHz);
    expect(isHarnessMusicPlaying(harness)).toBe(false);
    expect(() => createAudioParityHarness({ ticRateHz: 33 })).toThrow(RangeError);
  });

  test('the re-exported symbols are the SAME references as the read-only source modules', async () => {
    const audioParitySource = await import('../../../src/audio/audioParity.ts');
    const musicEventLogSource = await import('../../../src/oracles/musicEventLog.ts');
    expect(hashPcmBuffer).toBe(audioParitySource.hashPcmBuffer);
    expect(createAudioParityHarness).toBe(audioParitySource.createAudioParityHarness);
    expect(MUSIC_EVENT_KINDS).toBe(musicEventLogSource.MUSIC_EVENT_KINDS);
    expect(MUS_MAX_CHANNELS).toBe(musicEventLogSource.MUS_MAX_CHANNELS);
  });
});
