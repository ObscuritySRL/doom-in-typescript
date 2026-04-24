import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { LumpLookup } from '../../src/wad/lumpLookup.ts';
import { parseSfxLump } from '../../src/audio/sfxLumps.ts';
import { parseMusScore } from '../../src/audio/musParser.ts';
import { NORM_PITCH, NORM_PRIORITY, NUM_CHANNELS } from '../../src/audio/channels.ts';
import { NORM_SEP } from '../../src/audio/spatial.ts';
import { DEFAULT_OUTPUT_SAMPLE_RATE, computeStereoGains } from '../../src/audio/pcmMixer.ts';
import { DoomRandom } from '../../src/core/rng.ts';
import { MUS_TICKS_PER_GAME_TIC } from '../../src/audio/musScheduler.ts';
import { SNDDEVICE_SB } from '../../src/audio/musicSystem.ts';
import { AUDIO_MAX_CHANNELS, AUDIO_SAMPLE_RATE, SAMPLES_PER_TIC } from '../../src/oracles/audioHash.ts';

import {
  HARNESS_SAMPLES_PER_TIC_STEREO,
  HARNESS_SHA256_HEX_LENGTH,
  HARNESS_TIC_RATE_HZ,
  changeHarnessMusic,
  createAudioParityHarness,
  hashPcmBuffer,
  isHarnessMusicPlaying,
  pauseHarnessMusic,
  resumeHarnessMusic,
  runHarnessTic,
  setHarnessMusicVolume,
  startHarnessMusic,
  startHarnessSfx,
  stopHarnessMusic,
  stopHarnessSfxByOrigin,
  toAudioHashEntry,
  updateHarnessSfx,
} from '../../src/audio/audioParity.ts';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const wadHeader = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, wadHeader);
const lookup = new LumpLookup(directory);
const pistolLump = parseSfxLump(lookup.getLumpData('DSPISTOL', wadBuffer));
const shotgunLump = parseSfxLump(lookup.getLumpData('DSSHOTGN', wadBuffer));
const e1m1Score = parseMusScore(lookup.getLumpData('D_E1M1', wadBuffer));

const listener = Object.freeze({ x: 0, y: 0, angle: 0 });

function pistolRequest(harness: ReturnType<typeof createAudioParityHarness>, overrides: Partial<Parameters<typeof startHarnessSfx>[1]['request']> = {}) {
  const origin = overrides.origin !== undefined ? overrides.origin : null;
  const listenerOrigin = overrides.listenerOrigin !== undefined ? overrides.listenerOrigin : origin;
  return {
    sfxId: 1,
    priority: NORM_PRIORITY,
    pitchClass: 'default' as const,
    sourcePosition: null,
    listener,
    sfxVolume: 15,
    isBossMap: false,
    linkVolumeAdjust: null,
    linkPitch: null,
    rng: new DoomRandom(),
    table: harness.channelTable,
    ...overrides,
    origin,
    listenerOrigin,
  };
}

describe('audio parity harness constants', () => {
  it('HARNESS_TIC_RATE_HZ is 35 matching PRIMARY_TARGET.ticRateHz', () => {
    expect(HARNESS_TIC_RATE_HZ).toBe(35);
    expect(HARNESS_TIC_RATE_HZ).toBe(PRIMARY_TARGET.ticRateHz);
  });

  it('HARNESS_SAMPLES_PER_TIC_STEREO equals SAMPLES_PER_TIC * 2 from the audio-hash oracle', () => {
    expect(HARNESS_SAMPLES_PER_TIC_STEREO).toBe(SAMPLES_PER_TIC * 2);
    expect(HARNESS_SAMPLES_PER_TIC_STEREO).toBe(2520);
  });

  it('HARNESS_SHA256_HEX_LENGTH equals 64 (32 bytes × 2 hex chars)', () => {
    expect(HARNESS_SHA256_HEX_LENGTH).toBe(64);
  });
});

describe('createAudioParityHarness defaults', () => {
  it('returns a harness with vanilla 8-channel table, 44100 Hz rate, 35 Hz tic rate, 1260 samples per tic', () => {
    const harness = createAudioParityHarness();
    expect(harness.channelTable.capacity).toBe(NUM_CHANNELS);
    expect(harness.channelTable.capacity).toBe(AUDIO_MAX_CHANNELS);
    expect(harness.outputSampleRate).toBe(AUDIO_SAMPLE_RATE);
    expect(harness.outputSampleRate).toBe(DEFAULT_OUTPUT_SAMPLE_RATE);
    expect(harness.ticRateHz).toBe(HARNESS_TIC_RATE_HZ);
    expect(harness.samplesPerTic).toBe(SAMPLES_PER_TIC);
    expect(harness.samplesPerTic).toBe(1260);
    expect(harness.tic).toBe(0);
    expect(harness.voices.size).toBe(0);
  });

  it('seeds the music system with vanilla defaults (volume 8, device SB, no D_INTROA)', () => {
    const harness = createAudioParityHarness();
    expect(harness.music.musicVolume).toBe(8);
    expect(harness.music.musicDevice).toBe(SNDDEVICE_SB);
    expect(harness.music.hasIntroALump).toBe(false);
    expect(harness.music.currentMusicNum).toBeNull();
    expect(harness.music.scheduler).toBeNull();
  });

  it('forwards music options to createMusicSystem', () => {
    const harness = createAudioParityHarness({ music: { initialVolume: 42, hasIntroALump: true } });
    expect(harness.music.musicVolume).toBe(42);
    expect(harness.music.hasIntroALump).toBe(true);
  });

  it('allows explicit channel capacity / sample rate overrides', () => {
    const harness = createAudioParityHarness({ channelCapacity: 4, outputSampleRate: 22050, ticRateHz: 35 });
    expect(harness.channelTable.capacity).toBe(4);
    expect(harness.outputSampleRate).toBe(22050);
    expect(harness.samplesPerTic).toBe(630);
  });

  it('rejects non-positive / non-integer outputSampleRate', () => {
    expect(() => createAudioParityHarness({ outputSampleRate: 0 })).toThrow(RangeError);
    expect(() => createAudioParityHarness({ outputSampleRate: -44100 })).toThrow(RangeError);
    expect(() => createAudioParityHarness({ outputSampleRate: 44100.5 })).toThrow(RangeError);
  });

  it('rejects non-positive / non-integer ticRateHz', () => {
    expect(() => createAudioParityHarness({ ticRateHz: 0 })).toThrow(RangeError);
    expect(() => createAudioParityHarness({ ticRateHz: -35 })).toThrow(RangeError);
    expect(() => createAudioParityHarness({ ticRateHz: 35.1 })).toThrow(RangeError);
  });

  it('rejects non-integer samplesPerTic (outputSampleRate not divisible by ticRateHz)', () => {
    expect(() => createAudioParityHarness({ outputSampleRate: 44100, ticRateHz: 17 })).toThrow(RangeError);
  });

  it('rejects non-positive / non-integer channelCapacity', () => {
    expect(() => createAudioParityHarness({ channelCapacity: 0 })).toThrow(RangeError);
    expect(() => createAudioParityHarness({ channelCapacity: -1 })).toThrow(RangeError);
    expect(() => createAudioParityHarness({ channelCapacity: 2.5 })).toThrow(RangeError);
  });
});

describe('startHarnessSfx', () => {
  it('allocates a channel, installs a voice, and returns a started result for an anonymous pistol shot', () => {
    const harness = createAudioParityHarness();
    const result = startHarnessSfx(harness, { sfxLump: pistolLump, request: pistolRequest(harness) });
    expect(result.kind).toBe('started');
    if (result.kind !== 'started') return;
    expect(result.cnum).toBe(0);
    expect(result.volume).toBe(15);
    expect(result.separation).toBe(NORM_SEP);
    expect(harness.voices.size).toBe(1);
    const voice = harness.voices.get(0)!;
    expect(voice.samples.length).toBeGreaterThan(0);
    expect(voice.position).toBe(0);
    expect(voice.finished).toBe(false);
    const expectedGains = computeStereoGains(15, NORM_SEP);
    expect(voice.leftGain).toBe(expectedGains.left);
    expect(voice.rightGain).toBe(expectedGains.right);
  });

  it('rejects a request whose table is not the harness channel table', () => {
    const harness = createAudioParityHarness();
    const other = createAudioParityHarness();
    expect(() => startHarnessSfx(harness, { sfxLump: pistolLump, request: pistolRequest(harness, { table: other.channelTable }) })).toThrow(RangeError);
  });

  it('does not install a voice when startSound returns link-silenced', () => {
    const harness = createAudioParityHarness();
    const result = startHarnessSfx(harness, {
      sfxLump: pistolLump,
      request: pistolRequest(harness, { linkVolumeAdjust: -100, linkPitch: NORM_PITCH }),
    });
    expect(result.kind).toBe('link-silenced');
    expect(harness.voices.size).toBe(0);
  });

  it('does not install a voice when startSound returns no-channel (all slots higher priority)', () => {
    const harness = createAudioParityHarness({ channelCapacity: 1 });
    const first = startHarnessSfx(harness, { sfxLump: pistolLump, request: pistolRequest(harness, { origin: 1, priority: 32 }) });
    expect(first.kind).toBe('started');
    const second = startHarnessSfx(harness, { sfxLump: pistolLump, request: pistolRequest(harness, { origin: 2, priority: 64 }) });
    expect(second.kind).toBe('no-channel');
    expect(harness.voices.size).toBe(1);
    expect(harness.voices.get(0)!.leftGain).not.toBeUndefined();
  });

  it('replaces the voice when a later start reuses the same origin', () => {
    const harness = createAudioParityHarness();
    const first = startHarnessSfx(harness, { sfxLump: pistolLump, request: pistolRequest(harness, { origin: 7 }) });
    expect(first.kind).toBe('started');
    const voiceBefore = harness.voices.get(0)!;
    const second = startHarnessSfx(harness, { sfxLump: shotgunLump, request: pistolRequest(harness, { origin: 7 }) });
    expect(second.kind).toBe('started');
    if (second.kind !== 'started') return;
    expect(second.cnum).toBe(0);
    const voiceAfter = harness.voices.get(0)!;
    expect(voiceAfter).not.toBe(voiceBefore);
    expect(voiceAfter.samples).not.toBe(voiceBefore.samples);
  });
});

describe('stopHarnessSfxByOrigin', () => {
  it('frees the channel slot and drops the voice on an origin match', () => {
    const harness = createAudioParityHarness();
    const result = startHarnessSfx(harness, { sfxLump: pistolLump, request: pistolRequest(harness, { origin: 42 }) });
    expect(result.kind).toBe('started');
    const cnum = stopHarnessSfxByOrigin(harness, 42);
    expect(cnum).toBe(0);
    expect(harness.channelTable.channels[0]!.sfxId).toBeNull();
    expect(harness.voices.size).toBe(0);
  });

  it('is a no-op when no channel matches', () => {
    const harness = createAudioParityHarness();
    startHarnessSfx(harness, { sfxLump: pistolLump, request: pistolRequest(harness, { origin: 42 }) });
    const cnum = stopHarnessSfxByOrigin(harness, 99);
    expect(cnum).toBeNull();
    expect(harness.voices.size).toBe(1);
  });

  it('is a no-op for a null origin (vanilla anonymous-sound guard)', () => {
    const harness = createAudioParityHarness();
    startHarnessSfx(harness, { sfxLump: pistolLump, request: pistolRequest(harness, { origin: 7 }) });
    const cnum = stopHarnessSfxByOrigin(harness, null);
    expect(cnum).toBeNull();
    expect(harness.voices.size).toBe(1);
  });
});

describe('updateHarnessSfx', () => {
  it('reaps the voice for a channel that becomes not-playing via soundOrigins.updateSounds', () => {
    const harness = createAudioParityHarness();
    startHarnessSfx(harness, { sfxLump: pistolLump, request: pistolRequest(harness, { origin: 1 }) });
    expect(harness.voices.size).toBe(1);

    const channelState = Array.from({ length: harness.channelTable.capacity }, (_, cnum) => ({
      isPlaying: cnum !== 0,
      sourcePosition: null,
      linkVolumeAdjust: null,
    }));

    const actions = updateHarnessSfx(harness, {
      table: harness.channelTable,
      listener,
      listenerOrigin: 1,
      sfxVolume: 15,
      isBossMap: false,
      channelState,
    });

    expect(actions.length).toBe(1);
    expect(actions[0]!.kind).toBe('stop');
    expect(actions[0]!.cnum).toBe(0);
    expect(harness.voices.size).toBe(0);
  });

  it('rewrites voice gains in place on update-params actions', () => {
    const harness = createAudioParityHarness();
    startHarnessSfx(harness, {
      sfxLump: pistolLump,
      request: pistolRequest(harness, {
        origin: 5,
        sourcePosition: { x: 500 * 65536, y: 0 },
        listenerOrigin: 1,
      }),
    });
    expect(harness.voices.size).toBe(1);
    const beforeGains = { left: harness.voices.get(0)!.leftGain, right: harness.voices.get(0)!.rightGain };

    const channelState = Array.from({ length: harness.channelTable.capacity }, (_, cnum) => ({
      isPlaying: true,
      sourcePosition: cnum === 0 ? { x: 800 * 65536, y: 400 * 65536 } : null,
      linkVolumeAdjust: null,
    }));

    const actions = updateHarnessSfx(harness, {
      table: harness.channelTable,
      listener,
      listenerOrigin: 1,
      sfxVolume: 15,
      isBossMap: false,
      channelState,
    });

    const updateAction = actions.find((a) => a.kind === 'update-params');
    expect(updateAction).toBeDefined();
    const voice = harness.voices.get(0)!;
    const expected = computeStereoGains(updateAction!.volume!, updateAction!.separation!);
    expect(voice.leftGain).toBe(expected.left);
    expect(voice.rightGain).toBe(expected.right);
    expect({ left: voice.leftGain, right: voice.rightGain }).not.toEqual(beforeGains);
  });

  it('rejects a request whose table is not the harness channel table', () => {
    const harness = createAudioParityHarness();
    const other = createAudioParityHarness();
    expect(() =>
      updateHarnessSfx(harness, {
        table: other.channelTable,
        listener,
        listenerOrigin: null,
        sfxVolume: 15,
        isBossMap: false,
        channelState: [],
      }),
    ).toThrow(RangeError);
  });
});

describe('runHarnessTic sfx mixing', () => {
  it('produces an Int16Array of exactly samplesPerTic * 2 slots', () => {
    const harness = createAudioParityHarness();
    const output = runHarnessTic(harness);
    expect(output.sfxFrames).toBeInstanceOf(Int16Array);
    expect(output.sfxFrames.length).toBe(HARNESS_SAMPLES_PER_TIC_STEREO);
    expect(output.sfxFrames.length).toBe(SAMPLES_PER_TIC * 2);
  });

  it('increments the harness tic counter and reports the pre-increment tic in the output', () => {
    const harness = createAudioParityHarness();
    const first = runHarnessTic(harness);
    const second = runHarnessTic(harness);
    expect(first.tic).toBe(0);
    expect(second.tic).toBe(1);
    expect(harness.tic).toBe(2);
  });

  it('emits 2520 zero samples when no voices are active (silent mix)', () => {
    const harness = createAudioParityHarness();
    const output = runHarnessTic(harness);
    expect(output.activeChannels).toBe(0);
    for (let i = 0; i < output.sfxFrames.length; i++) {
      expect(output.sfxFrames[i]).toBe(0);
    }
  });

  it('activeChannels reflects occupied channel count at end of tic', () => {
    const harness = createAudioParityHarness();
    startHarnessSfx(harness, { sfxLump: pistolLump, request: pistolRequest(harness, { origin: 1 }) });
    startHarnessSfx(harness, { sfxLump: pistolLump, request: pistolRequest(harness, { origin: 2 }) });
    const output = runHarnessTic(harness);
    expect(output.activeChannels).toBe(2);
  });

  it('returns a uppercase 64-character hex SHA-256 digest', () => {
    const harness = createAudioParityHarness();
    const output = runHarnessTic(harness);
    expect(output.sfxHash).toMatch(/^[0-9A-F]{64}$/);
    expect(output.sfxHash.length).toBe(HARNESS_SHA256_HEX_LENGTH);
  });

  it('silent-mix hash is stable across runs (determinism anchor)', () => {
    const h1 = runHarnessTic(createAudioParityHarness()).sfxHash;
    const h2 = runHarnessTic(createAudioParityHarness()).sfxHash;
    expect(h1).toBe(h2);
  });

  it('two harnesses with identical pistol-shot input produce identical hashes across many tics', () => {
    function simulate() {
      const harness = createAudioParityHarness();
      startHarnessSfx(harness, { sfxLump: pistolLump, request: pistolRequest(harness, { origin: 1, rng: new DoomRandom() }) });
      const hashes: string[] = [];
      for (let i = 0; i < 5; i++) {
        hashes.push(runHarnessTic(harness).sfxHash);
      }
      return hashes;
    }
    const a = simulate();
    const b = simulate();
    expect(a).toEqual(b);
    expect(new Set(a).size).toBeGreaterThan(1);
  });

  it('hash differs for pistol vs shotgun first-tic mix (different PCM content)', () => {
    const pistolHarness = createAudioParityHarness();
    startHarnessSfx(pistolHarness, { sfxLump: pistolLump, request: pistolRequest(pistolHarness, { origin: 1, rng: new DoomRandom() }) });
    const pistolHash = runHarnessTic(pistolHarness).sfxHash;

    const shotgunHarness = createAudioParityHarness();
    startHarnessSfx(shotgunHarness, { sfxLump: shotgunLump, request: pistolRequest(shotgunHarness, { origin: 1, rng: new DoomRandom() }) });
    const shotgunHash = runHarnessTic(shotgunHarness).sfxHash;

    expect(pistolHash).not.toBe(shotgunHash);
  });

  it('reaps voices whose samples finish during the mix', () => {
    const harness = createAudioParityHarness({ outputSampleRate: 35, ticRateHz: 35 });
    const tinyLump = { ...pistolLump, samples: Buffer.from([0x80, 0x81, 0x82, 0x80]), sampleCount: 4, playableSampleStart: 1, playableSampleCount: 2 };
    startHarnessSfx(harness, { sfxLump: tinyLump, request: pistolRequest(harness, { origin: 1, rng: new DoomRandom() }) });
    expect(harness.voices.size).toBe(1);
    runHarnessTic(harness);
    expect(harness.voices.size).toBe(0);
  });

  it('carries unfinished voices across tics without churn', () => {
    const harness = createAudioParityHarness();
    startHarnessSfx(harness, { sfxLump: pistolLump, request: pistolRequest(harness, { origin: 1, rng: new DoomRandom() }) });
    const voice = harness.voices.get(0)!;
    expect(voice.finished).toBe(false);
    runHarnessTic(harness);
    expect(harness.voices.size).toBe(1);
    expect(harness.voices.get(0)).toBe(voice);
    expect(voice.position).toBeGreaterThan(0);
  });
});

describe('harness music integration', () => {
  it('isHarnessMusicPlaying reflects the music system state', () => {
    const harness = createAudioParityHarness();
    expect(isHarnessMusicPlaying(harness)).toBe(false);
    changeHarnessMusic(harness, { musicNum: 1, looping: true, score: e1m1Score });
    expect(isHarnessMusicPlaying(harness)).toBe(true);
    stopHarnessMusic(harness);
    expect(isHarnessMusicPlaying(harness)).toBe(false);
  });

  it('dispatches music events during runHarnessTic after changeHarnessMusic', () => {
    const harness = createAudioParityHarness();
    changeHarnessMusic(harness, { musicNum: 1, looping: true, score: e1m1Score });
    let totalDispatched = 0;
    for (let i = 0; i < 10; i++) {
      totalDispatched += runHarnessTic(harness).dispatchedMusicEvents.length;
    }
    expect(totalDispatched).toBeGreaterThan(0);
  });

  it('MUS_TICKS_PER_GAME_TIC quickticks elapse per tic (verifies advanceMusic(1) integration)', () => {
    const harness = createAudioParityHarness();
    changeHarnessMusic(harness, { musicNum: 1, looping: true, score: e1m1Score });
    runHarnessTic(harness);
    expect(harness.music.scheduler!.elapsedQuickticks).toBe(MUS_TICKS_PER_GAME_TIC);
  });

  it('pause halts music event dispatch but runHarnessTic still emits silent sfx', () => {
    const harness = createAudioParityHarness();
    changeHarnessMusic(harness, { musicNum: 1, looping: true, score: e1m1Score });
    runHarnessTic(harness);
    pauseHarnessMusic(harness);
    const paused = runHarnessTic(harness);
    expect(paused.dispatchedMusicEvents.length).toBe(0);
    expect(paused.sfxFrames.length).toBe(HARNESS_SAMPLES_PER_TIC_STEREO);
  });

  it('resume restarts music event dispatch', () => {
    const harness = createAudioParityHarness();
    changeHarnessMusic(harness, { musicNum: 1, looping: true, score: e1m1Score });
    pauseHarnessMusic(harness);
    const paused = runHarnessTic(harness);
    expect(paused.dispatchedMusicEvents.length).toBe(0);
    resumeHarnessMusic(harness);
    let resumedCount = 0;
    for (let i = 0; i < 5; i++) {
      resumedCount += runHarnessTic(harness).dispatchedMusicEvents.length;
    }
    expect(resumedCount).toBeGreaterThan(0);
  });

  it('startHarnessMusic delegates to startMusic (looping=false)', () => {
    const harness = createAudioParityHarness();
    startHarnessMusic(harness, { musicNum: 1, score: e1m1Score });
    expect(harness.music.looping).toBe(false);
    expect(harness.music.currentMusicNum).toBe(1);
  });

  it('setHarnessMusicVolume updates state and emits set-volume', () => {
    const harness = createAudioParityHarness();
    const actions = setHarnessMusicVolume(harness, 42);
    expect(harness.music.musicVolume).toBe(42);
    expect(actions.length).toBe(1);
    expect(actions[0]!.kind).toBe('set-volume');
  });
});

describe('hashPcmBuffer', () => {
  it('returns a 64-character uppercase hex string for any Int16Array', () => {
    const buf = new Int16Array([0, 1, -1, 32767, -32768, 128]);
    const hash = hashPcmBuffer(buf);
    expect(hash).toMatch(/^[0-9A-F]{64}$/);
  });

  it('is deterministic for identical content', () => {
    const a = new Int16Array([1, 2, 3, 4, 5]);
    const b = new Int16Array([1, 2, 3, 4, 5]);
    expect(hashPcmBuffer(a)).toBe(hashPcmBuffer(b));
  });

  it('differs for different content (one-byte flip)', () => {
    const a = new Int16Array([1, 2, 3, 4, 5]);
    const b = new Int16Array([1, 2, 3, 4, 6]);
    expect(hashPcmBuffer(a)).not.toBe(hashPcmBuffer(b));
  });

  it('returns the empty-buffer SHA-256 (uppercase) for a zero-length Int16Array', () => {
    const expected = 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855';
    expect(hashPcmBuffer(new Int16Array(0))).toBe(expected);
  });
});

describe('toAudioHashEntry', () => {
  it('converts a tic output into a frozen AudioHashEntry matching the oracle shape', () => {
    const harness = createAudioParityHarness();
    startHarnessSfx(harness, { sfxLump: pistolLump, request: pistolRequest(harness, { origin: 1, rng: new DoomRandom() }) });
    const output = runHarnessTic(harness);
    const entry = toAudioHashEntry(output);
    expect(entry.tic).toBe(output.tic);
    expect(entry.hash).toBe(output.sfxHash);
    expect(entry.activeChannels).toBe(output.activeChannels);
    expect(Object.isFrozen(entry)).toBe(true);
  });
});

describe('audio parity edge cases', () => {
  it('two overlapping anonymous pistol shots mix without channel collision', () => {
    const harness = createAudioParityHarness();
    const a = startHarnessSfx(harness, { sfxLump: pistolLump, request: pistolRequest(harness, { origin: null, rng: new DoomRandom() }) });
    const b = startHarnessSfx(harness, { sfxLump: pistolLump, request: pistolRequest(harness, { origin: null, rng: new DoomRandom() }) });
    expect(a.kind).toBe('started');
    expect(b.kind).toBe('started');
    if (a.kind !== 'started' || b.kind !== 'started') return;
    expect(a.cnum).not.toBe(b.cnum);
    expect(harness.voices.size).toBe(2);
    const output = runHarnessTic(harness);
    expect(output.activeChannels).toBe(2);
    expect(output.sfxFrames.length).toBe(HARNESS_SAMPLES_PER_TIC_STEREO);
  });

  it('voice position advances by exactly samplesPerTic after one tic', () => {
    const harness = createAudioParityHarness();
    startHarnessSfx(harness, { sfxLump: pistolLump, request: pistolRequest(harness, { origin: 1, rng: new DoomRandom() }) });
    const voice = harness.voices.get(0)!;
    const initial = voice.position;
    runHarnessTic(harness);
    expect(voice.position - initial).toBe(harness.samplesPerTic);
  });

  it('stopHarnessSfxByOrigin prevents the next tic from mixing that voice', () => {
    const harness = createAudioParityHarness();
    startHarnessSfx(harness, { sfxLump: pistolLump, request: pistolRequest(harness, { origin: 1, rng: new DoomRandom() }) });
    const beforeStopTic = runHarnessTic(harness);
    stopHarnessSfxByOrigin(harness, 1);
    const afterStopTic = runHarnessTic(harness);
    expect(afterStopTic.activeChannels).toBe(0);
    expect(afterStopTic.sfxHash).not.toBe(beforeStopTic.sfxHash);
    for (let i = 0; i < afterStopTic.sfxFrames.length; i++) {
      expect(afterStopTic.sfxFrames[i]).toBe(0);
    }
  });
});
