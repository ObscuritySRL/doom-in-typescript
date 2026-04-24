import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { LumpLookup } from '../../src/wad/lumpLookup.ts';
import { MUS_HEADER_SIZE } from '../../src/assets/mus.ts';
import { MusEventKind, parseMusScore } from '../../src/audio/musParser.ts';
import type { MusScore } from '../../src/audio/musParser.ts';
import { MUS_DEFAULT_VELOCITY, MUS_TICKS_PER_GAME_TIC } from '../../src/audio/musScheduler.ts';
import {
  DEFAULT_MUSIC_VOLUME,
  MUSIC_VOLUME_MAX,
  MUSIC_VOLUME_MIN,
  MUS_INTRO,
  MUS_INTROA,
  MUS_NONE,
  NUMMUSIC,
  SNDDEVICE_ADLIB,
  SNDDEVICE_AWE32,
  SNDDEVICE_GENMIDI,
  SNDDEVICE_GUS,
  SNDDEVICE_NONE,
  SNDDEVICE_PAS,
  SNDDEVICE_PCSPEAKER,
  SNDDEVICE_SB,
  SNDDEVICE_SOUNDCANVAS,
  SNDDEVICE_WAVEBLASTER,
  advanceMusic,
  changeMusic,
  createMusicSystem,
  isMusicPlaying,
  pauseMusic,
  resolveMusicNumber,
  resumeMusic,
  setMusicVolume,
  startMusic,
  stopMusic,
} from '../../src/audio/musicSystem.ts';
import type { MusicDeviceAction, MusicPlaySongAction, MusicStopSongAction } from '../../src/audio/musicSystem.ts';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const wadHeader = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, wadHeader);
const lookup = new LumpLookup(directory);

function buildMusLump(score: number[]): Buffer {
  const scoreBytes = Buffer.from(score);
  const buf = Buffer.alloc(MUS_HEADER_SIZE + scoreBytes.length);
  buf.write('MUS\x1A', 0, 'ascii');
  buf.writeUInt16LE(scoreBytes.length, 4);
  buf.writeUInt16LE(MUS_HEADER_SIZE, 6);
  buf.writeUInt16LE(1, 8);
  buf.writeUInt16LE(0, 10);
  buf.writeUInt16LE(0, 12);
  buf.writeUInt16LE(0, 14);
  scoreBytes.copy(buf, MUS_HEADER_SIZE);
  return buf;
}

function syntheticScore(score: number[]): Readonly<MusScore> {
  return parseMusScore(buildMusLump(score));
}

function e1m1Score(): Readonly<MusScore> {
  return parseMusScore(lookup.getLumpData('D_E1M1', wadBuffer));
}

describe('music system constants', () => {
  it('MUSIC_VOLUME_MIN is 0 and MUSIC_VOLUME_MAX is 127 matching vanilla I_Error bounds', () => {
    expect(MUSIC_VOLUME_MIN).toBe(0);
    expect(MUSIC_VOLUME_MAX).toBe(127);
  });

  it('DEFAULT_MUSIC_VOLUME is 8 matching vanilla musicVolume default', () => {
    expect(DEFAULT_MUSIC_VOLUME).toBe(8);
  });

  it('MUS_NONE is 0 and NUMMUSIC is 68 matching sounds.h', () => {
    expect(MUS_NONE).toBe(0);
    expect(NUMMUSIC).toBe(68);
  });

  it('MUS_INTRO is 29 and MUS_INTROA is 32 matching sounds.h enum positions', () => {
    expect(MUS_INTRO).toBe(29);
    expect(MUS_INTROA).toBe(32);
  });

  it('SNDDEVICE_* values match the chocolate-doom snddevice_t enum', () => {
    expect(SNDDEVICE_NONE).toBe(0);
    expect(SNDDEVICE_PCSPEAKER).toBe(1);
    expect(SNDDEVICE_ADLIB).toBe(2);
    expect(SNDDEVICE_SB).toBe(3);
    expect(SNDDEVICE_PAS).toBe(4);
    expect(SNDDEVICE_GUS).toBe(5);
    expect(SNDDEVICE_WAVEBLASTER).toBe(6);
    expect(SNDDEVICE_SOUNDCANVAS).toBe(7);
    expect(SNDDEVICE_GENMIDI).toBe(8);
    expect(SNDDEVICE_AWE32).toBe(9);
  });
});

describe('createMusicSystem', () => {
  it('defaults volume to DEFAULT_MUSIC_VOLUME, device to SNDDEVICE_SB, hasIntroA to false', () => {
    const system = createMusicSystem();
    expect(system.musicVolume).toBe(DEFAULT_MUSIC_VOLUME);
    expect(system.musicDevice).toBe(SNDDEVICE_SB);
    expect(system.hasIntroALump).toBe(false);
  });

  it('initializes currentMusicNum=null, scheduler=null, looping=false, paused=false', () => {
    const system = createMusicSystem();
    expect(system.currentMusicNum).toBeNull();
    expect(system.scheduler).toBeNull();
    expect(system.looping).toBe(false);
    expect(system.paused).toBe(false);
  });

  it('honours explicit initialVolume / musicDevice / hasIntroALump options', () => {
    const system = createMusicSystem({ initialVolume: 64, musicDevice: SNDDEVICE_GENMIDI, hasIntroALump: true });
    expect(system.musicVolume).toBe(64);
    expect(system.musicDevice).toBe(SNDDEVICE_GENMIDI);
    expect(system.hasIntroALump).toBe(true);
  });

  it('accepts the boundary volumes 0 and 127', () => {
    expect(createMusicSystem({ initialVolume: 0 }).musicVolume).toBe(0);
    expect(createMusicSystem({ initialVolume: 127 }).musicVolume).toBe(127);
  });

  it('throws RangeError when initialVolume is below 0', () => {
    expect(() => createMusicSystem({ initialVolume: -1 })).toThrow(RangeError);
  });

  it('throws RangeError when initialVolume is above 127', () => {
    expect(() => createMusicSystem({ initialVolume: 128 })).toThrow(RangeError);
  });

  it('throws RangeError when initialVolume is non-integer', () => {
    expect(() => createMusicSystem({ initialVolume: 4.5 })).toThrow(RangeError);
  });

  it('throws RangeError when initialVolume is NaN', () => {
    expect(() => createMusicSystem({ initialVolume: Number.NaN })).toThrow(RangeError);
  });
});

describe('resolveMusicNumber intro→introa substitution', () => {
  it('substitutes MUS_INTRO with MUS_INTROA for SNDDEVICE_ADLIB when D_INTROA exists', () => {
    const system = createMusicSystem({ musicDevice: SNDDEVICE_ADLIB, hasIntroALump: true });
    expect(resolveMusicNumber(system, MUS_INTRO)).toBe(MUS_INTROA);
  });

  it('substitutes MUS_INTRO with MUS_INTROA for SNDDEVICE_SB when D_INTROA exists', () => {
    const system = createMusicSystem({ musicDevice: SNDDEVICE_SB, hasIntroALump: true });
    expect(resolveMusicNumber(system, MUS_INTRO)).toBe(MUS_INTROA);
  });

  it('does NOT substitute when D_INTROA is missing even on an OPL device', () => {
    const system = createMusicSystem({ musicDevice: SNDDEVICE_SB, hasIntroALump: false });
    expect(resolveMusicNumber(system, MUS_INTRO)).toBe(MUS_INTRO);
  });

  it('does NOT substitute when the device is PC speaker (non-OPL)', () => {
    const system = createMusicSystem({ musicDevice: SNDDEVICE_PCSPEAKER, hasIntroALump: true });
    expect(resolveMusicNumber(system, MUS_INTRO)).toBe(MUS_INTRO);
  });

  it('does NOT substitute when the device is GUS (non-OPL)', () => {
    const system = createMusicSystem({ musicDevice: SNDDEVICE_GUS, hasIntroALump: true });
    expect(resolveMusicNumber(system, MUS_INTRO)).toBe(MUS_INTRO);
  });

  it('does NOT substitute when the device is GENMIDI (non-OPL)', () => {
    const system = createMusicSystem({ musicDevice: SNDDEVICE_GENMIDI, hasIntroALump: true });
    expect(resolveMusicNumber(system, MUS_INTRO)).toBe(MUS_INTRO);
  });

  it('does NOT substitute non-MUS_INTRO ids on an OPL device with D_INTROA', () => {
    const system = createMusicSystem({ musicDevice: SNDDEVICE_SB, hasIntroALump: true });
    expect(resolveMusicNumber(system, 1)).toBe(1);
    expect(resolveMusicNumber(system, 15)).toBe(15);
    expect(resolveMusicNumber(system, MUS_INTROA)).toBe(MUS_INTROA);
  });
});

describe('changeMusic', () => {
  it('emits a single play-song action when no prior song is loaded', () => {
    const system = createMusicSystem();
    const score = syntheticScore([0x60]);
    const actions = changeMusic(system, { musicNum: 1, looping: true, score });
    expect(actions).toHaveLength(1);
    expect(actions[0]!.kind).toBe('play-song');
    const play = actions[0] as MusicPlaySongAction;
    expect(play.musicNum).toBe(1);
    expect(play.looping).toBe(true);
    expect(play.score).toBe(score);
  });

  it('updates state: currentMusicNum, scheduler, looping, paused=false', () => {
    const system = createMusicSystem();
    const score = syntheticScore([0x60]);
    changeMusic(system, { musicNum: 7, looping: true, score });
    expect(system.currentMusicNum).toBe(7);
    expect(system.scheduler).not.toBeNull();
    expect(system.looping).toBe(true);
    expect(system.paused).toBe(false);
  });

  it('emits stop-song + play-song when replacing a running track', () => {
    const system = createMusicSystem();
    const first = syntheticScore([0x60]);
    const second = syntheticScore([0x60]);
    changeMusic(system, { musicNum: 1, looping: true, score: first });
    const actions = changeMusic(system, { musicNum: 2, looping: false, score: second });
    expect(actions).toHaveLength(2);
    expect(actions[0]!.kind).toBe('stop-song');
    expect((actions[0] as MusicStopSongAction).musicNum).toBe(1);
    expect(actions[1]!.kind).toBe('play-song');
    expect((actions[1] as MusicPlaySongAction).musicNum).toBe(2);
    expect((actions[1] as MusicPlaySongAction).looping).toBe(false);
    expect(system.currentMusicNum).toBe(2);
    expect(system.looping).toBe(false);
  });

  it('emits resume-song + stop-song + play-song when replacing a paused track', () => {
    const system = createMusicSystem();
    changeMusic(system, { musicNum: 1, looping: true, score: syntheticScore([0x60]) });
    pauseMusic(system);
    expect(system.paused).toBe(true);
    const actions = changeMusic(system, { musicNum: 2, looping: true, score: syntheticScore([0x60]) });
    expect(actions.map((a) => a.kind)).toEqual(['resume-song', 'stop-song', 'play-song']);
    expect((actions[1] as MusicStopSongAction).musicNum).toBe(1);
    expect((actions[2] as MusicPlaySongAction).musicNum).toBe(2);
    expect(system.paused).toBe(false);
  });

  it('is a no-op (empty action list) when requested song matches the currently-playing song', () => {
    const system = createMusicSystem();
    changeMusic(system, { musicNum: 5, looping: true, score: syntheticScore([0x60]) });
    const actions = changeMusic(system, { musicNum: 5, looping: false, score: syntheticScore([0x60]) });
    expect(actions).toEqual([]);
    expect(system.looping).toBe(true);
  });

  it('is a no-op when the substituted intro id equals the currently-playing introa song', () => {
    const system = createMusicSystem({ musicDevice: SNDDEVICE_SB, hasIntroALump: true });
    const score = syntheticScore([0x60]);
    changeMusic(system, { musicNum: MUS_INTROA, looping: false, score });
    const actions = changeMusic(system, { musicNum: MUS_INTRO, looping: false, score });
    expect(actions).toEqual([]);
    expect(system.currentMusicNum).toBe(MUS_INTROA);
  });

  it('applies the intro→introa substitution when changing to MUS_INTRO on an OPL device', () => {
    const system = createMusicSystem({ musicDevice: SNDDEVICE_ADLIB, hasIntroALump: true });
    const score = syntheticScore([0x60]);
    const actions = changeMusic(system, { musicNum: MUS_INTRO, looping: false, score });
    expect(actions).toHaveLength(1);
    expect((actions[0] as MusicPlaySongAction).musicNum).toBe(MUS_INTROA);
    expect(system.currentMusicNum).toBe(MUS_INTROA);
  });

  it('throws RangeError on musicNum <= MUS_NONE', () => {
    const system = createMusicSystem();
    expect(() => changeMusic(system, { musicNum: 0, looping: false, score: syntheticScore([0x60]) })).toThrow(RangeError);
    expect(() => changeMusic(system, { musicNum: -1, looping: false, score: syntheticScore([0x60]) })).toThrow(RangeError);
  });

  it('throws RangeError on musicNum >= NUMMUSIC', () => {
    const system = createMusicSystem();
    expect(() => changeMusic(system, { musicNum: NUMMUSIC, looping: false, score: syntheticScore([0x60]) })).toThrow(RangeError);
    expect(() => changeMusic(system, { musicNum: NUMMUSIC + 10, looping: false, score: syntheticScore([0x60]) })).toThrow(RangeError);
  });

  it('throws RangeError on non-integer musicNum', () => {
    const system = createMusicSystem();
    expect(() => changeMusic(system, { musicNum: 1.5, looping: false, score: syntheticScore([0x60]) })).toThrow(RangeError);
  });

  it('creates a fresh scheduler with the per-channel velocity cache seeded to MUS_DEFAULT_VELOCITY', () => {
    const system = createMusicSystem();
    changeMusic(system, { musicNum: 1, looping: true, score: syntheticScore([0x60]) });
    expect(system.scheduler!.channelVelocities).toHaveLength(16);
    for (const v of system.scheduler!.channelVelocities) {
      expect(v).toBe(MUS_DEFAULT_VELOCITY);
    }
  });

  it('returns a frozen action array with frozen entries', () => {
    const system = createMusicSystem();
    const actions = changeMusic(system, { musicNum: 1, looping: false, score: syntheticScore([0x60]) });
    expect(Object.isFrozen(actions)).toBe(true);
    for (const action of actions) {
      expect(Object.isFrozen(action)).toBe(true);
    }
  });
});

describe('startMusic', () => {
  it('delegates to changeMusic with looping=false (mirrors vanilla S_StartMusic)', () => {
    const system = createMusicSystem();
    const actions = startMusic(system, { musicNum: 3, score: syntheticScore([0x60]) });
    expect(actions).toHaveLength(1);
    const play = actions[0] as MusicPlaySongAction;
    expect(play.looping).toBe(false);
    expect(system.looping).toBe(false);
  });
});

describe('stopMusic', () => {
  it('returns empty action list when no song is loaded', () => {
    const system = createMusicSystem();
    expect(stopMusic(system)).toEqual([]);
    expect(system.currentMusicNum).toBeNull();
  });

  it('emits stop-song and clears state when a playing song exists', () => {
    const system = createMusicSystem();
    changeMusic(system, { musicNum: 4, looping: true, score: syntheticScore([0x60]) });
    const actions = stopMusic(system);
    expect(actions).toHaveLength(1);
    expect(actions[0]!.kind).toBe('stop-song');
    expect((actions[0] as MusicStopSongAction).musicNum).toBe(4);
    expect(system.currentMusicNum).toBeNull();
    expect(system.scheduler).toBeNull();
    expect(system.looping).toBe(false);
    expect(system.paused).toBe(false);
  });

  it('emits resume-song before stop-song when the song is paused (vanilla I_ResumeSong → I_StopSong order)', () => {
    const system = createMusicSystem();
    changeMusic(system, { musicNum: 6, looping: true, score: syntheticScore([0x60]) });
    pauseMusic(system);
    const actions = stopMusic(system);
    expect(actions.map((a) => a.kind)).toEqual(['resume-song', 'stop-song']);
    expect((actions[1] as MusicStopSongAction).musicNum).toBe(6);
    expect(system.paused).toBe(false);
  });
});

describe('pauseMusic', () => {
  it('returns empty action list when no song is loaded', () => {
    const system = createMusicSystem();
    expect(pauseMusic(system)).toEqual([]);
    expect(system.paused).toBe(false);
  });

  it('returns empty action list when the song is already paused', () => {
    const system = createMusicSystem();
    changeMusic(system, { musicNum: 1, looping: true, score: syntheticScore([0x60]) });
    pauseMusic(system);
    expect(pauseMusic(system)).toEqual([]);
    expect(system.paused).toBe(true);
  });

  it('emits pause-song and sets paused=true for a playing song', () => {
    const system = createMusicSystem();
    changeMusic(system, { musicNum: 1, looping: true, score: syntheticScore([0x60]) });
    const actions = pauseMusic(system);
    expect(actions).toHaveLength(1);
    expect(actions[0]!.kind).toBe('pause-song');
    expect(system.paused).toBe(true);
  });
});

describe('resumeMusic', () => {
  it('returns empty action list when no song is loaded', () => {
    const system = createMusicSystem();
    expect(resumeMusic(system)).toEqual([]);
  });

  it('returns empty action list when the song is not paused', () => {
    const system = createMusicSystem();
    changeMusic(system, { musicNum: 1, looping: true, score: syntheticScore([0x60]) });
    expect(resumeMusic(system)).toEqual([]);
    expect(system.paused).toBe(false);
  });

  it('emits resume-song and clears paused for a paused song', () => {
    const system = createMusicSystem();
    changeMusic(system, { musicNum: 1, looping: true, score: syntheticScore([0x60]) });
    pauseMusic(system);
    const actions = resumeMusic(system);
    expect(actions).toHaveLength(1);
    expect(actions[0]!.kind).toBe('resume-song');
    expect(system.paused).toBe(false);
  });
});

describe('setMusicVolume', () => {
  it('emits set-volume and updates state', () => {
    const system = createMusicSystem();
    const actions = setMusicVolume(system, 12);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({ kind: 'set-volume', volume: 12 });
    expect(system.musicVolume).toBe(12);
  });

  it('emits set-volume even when no song is loaded (vanilla always calls I_SetMusicVolume)', () => {
    const system = createMusicSystem();
    expect(system.currentMusicNum).toBeNull();
    const actions = setMusicVolume(system, 0);
    expect(actions).toHaveLength(1);
    expect(actions[0]!.kind).toBe('set-volume');
  });

  it('emits set-volume even when the new volume matches the current volume (idempotent)', () => {
    const system = createMusicSystem({ initialVolume: 10 });
    const actions = setMusicVolume(system, 10);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({ kind: 'set-volume', volume: 10 });
  });

  it('accepts the boundary volumes 0 and 127', () => {
    const system = createMusicSystem();
    setMusicVolume(system, 0);
    expect(system.musicVolume).toBe(0);
    setMusicVolume(system, 127);
    expect(system.musicVolume).toBe(127);
  });

  it('throws RangeError on volume < 0', () => {
    const system = createMusicSystem();
    expect(() => setMusicVolume(system, -1)).toThrow(RangeError);
  });

  it('throws RangeError on volume > 127', () => {
    const system = createMusicSystem();
    expect(() => setMusicVolume(system, 128)).toThrow(RangeError);
  });

  it('throws RangeError on non-integer volume', () => {
    const system = createMusicSystem();
    expect(() => setMusicVolume(system, 10.5)).toThrow(RangeError);
  });

  it('throws RangeError on NaN volume', () => {
    const system = createMusicSystem();
    expect(() => setMusicVolume(system, Number.NaN)).toThrow(RangeError);
  });
});

describe('isMusicPlaying', () => {
  it('is false after createMusicSystem', () => {
    expect(isMusicPlaying(createMusicSystem())).toBe(false);
  });

  it('is true after changeMusic', () => {
    const system = createMusicSystem();
    changeMusic(system, { musicNum: 1, looping: true, score: syntheticScore([0x60]) });
    expect(isMusicPlaying(system)).toBe(true);
  });

  it('remains true while paused (vanilla I_MusicIsPlaying returns true for loaded paused songs)', () => {
    const system = createMusicSystem();
    changeMusic(system, { musicNum: 1, looping: true, score: syntheticScore([0x60]) });
    pauseMusic(system);
    expect(isMusicPlaying(system)).toBe(true);
  });

  it('is false after stopMusic', () => {
    const system = createMusicSystem();
    changeMusic(system, { musicNum: 1, looping: true, score: syntheticScore([0x60]) });
    stopMusic(system);
    expect(isMusicPlaying(system)).toBe(false);
  });
});

describe('advanceMusic', () => {
  it('returns empty array when no song is loaded', () => {
    const system = createMusicSystem();
    expect(advanceMusic(system, 10)).toEqual([]);
  });

  it('returns empty array when the song is paused', () => {
    const system = createMusicSystem();
    changeMusic(system, { musicNum: 1, looping: true, score: syntheticScore([0x00, 60, 0x60]) });
    pauseMusic(system);
    const dispatched = advanceMusic(system, 5);
    expect(dispatched).toEqual([]);
    expect(system.scheduler!.eventIndex).toBe(0);
  });

  it('advances the scheduler by gameTics × MUS_TICKS_PER_GAME_TIC quickticks', () => {
    const system = createMusicSystem();
    changeMusic(system, { musicNum: 1, looping: false, score: syntheticScore([0x60]) });
    advanceMusic(system, 2);
    expect(system.scheduler!.elapsedQuickticks).toBe(2 * MUS_TICKS_PER_GAME_TIC);
  });

  it('returns the dispatched events for the supplied window', () => {
    const system = createMusicSystem();
    changeMusic(system, { musicNum: 1, looping: false, score: syntheticScore([0x00, 60, 0x60]) });
    const dispatched = advanceMusic(system, 1);
    expect(dispatched).toHaveLength(2);
    expect(dispatched[0]!.event.kind).toBe(MusEventKind.ReleaseNote);
    expect(dispatched[1]!.event.kind).toBe(MusEventKind.ScoreEnd);
  });

  it('resumes scheduler advance after resumeMusic', () => {
    const system = createMusicSystem();
    changeMusic(system, { musicNum: 1, looping: true, score: syntheticScore([0x80, 60, 8, 0x60]) });
    pauseMusic(system);
    expect(advanceMusic(system, 10)).toEqual([]);
    expect(system.scheduler!.elapsedQuickticks).toBe(0);
    resumeMusic(system);
    const dispatched = advanceMusic(system, 1);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.event.kind).toBe(MusEventKind.ReleaseNote);
  });

  it('throws RangeError on negative gameTics', () => {
    const system = createMusicSystem();
    expect(() => advanceMusic(system, -1)).toThrow(RangeError);
  });

  it('throws RangeError on non-integer gameTics', () => {
    const system = createMusicSystem();
    expect(() => advanceMusic(system, 1.5)).toThrow(RangeError);
  });

  it('throws RangeError on NaN gameTics', () => {
    const system = createMusicSystem();
    expect(() => advanceMusic(system, Number.NaN)).toThrow(RangeError);
  });

  it('returns empty array (no scheduler advance) when gameTics=0 on a loaded song', () => {
    const system = createMusicSystem();
    changeMusic(system, { musicNum: 1, looping: true, score: syntheticScore([0x60]) });
    expect(advanceMusic(system, 0)).toEqual([]);
    expect(system.scheduler!.elapsedQuickticks).toBe(0);
  });
});

describe('parity: D_E1M1 playback through the music system', () => {
  it('re-initializes the per-channel velocity cache on every song change', () => {
    const system = createMusicSystem();
    changeMusic(system, { musicNum: 1, looping: false, score: e1m1Score() });
    const before = system.scheduler!.channelVelocities.slice();
    // Advance long enough to mutate the cache on at least one channel.
    advanceMusic(system, 70);
    const mutated = system.scheduler!.channelVelocities.some((v) => v !== MUS_DEFAULT_VELOCITY);
    expect(mutated).toBe(true);
    // Change to a different song — the new scheduler must start with every channel at the default.
    changeMusic(system, { musicNum: 2, looping: false, score: syntheticScore([0x60]) });
    for (const v of system.scheduler!.channelVelocities) {
      expect(v).toBe(MUS_DEFAULT_VELOCITY);
    }
    expect(before.every((v) => v === MUS_DEFAULT_VELOCITY)).toBe(true);
  });

  it('progresses the scheduler deterministically across repeated advance calls', () => {
    const systemA = createMusicSystem();
    const systemB = createMusicSystem();
    changeMusic(systemA, { musicNum: 1, looping: false, score: e1m1Score() });
    changeMusic(systemB, { musicNum: 1, looping: false, score: e1m1Score() });
    const dispatchedA = [...advanceMusic(systemA, 35), ...advanceMusic(systemA, 35)];
    const dispatchedB = advanceMusic(systemB, 70);
    expect(dispatchedA.length).toBe(dispatchedB.length);
    for (let i = 0; i < dispatchedA.length; i++) {
      expect(dispatchedA[i]!.musQuicktick).toBe(dispatchedB[i]!.musQuicktick);
      expect(dispatchedA[i]!.event.kind).toBe(dispatchedB[i]!.event.kind);
    }
  });
});

describe('action freeze invariants', () => {
  it('stopMusic returns a frozen action array with frozen entries', () => {
    const system = createMusicSystem();
    changeMusic(system, { musicNum: 1, looping: true, score: syntheticScore([0x60]) });
    const actions: readonly MusicDeviceAction[] = stopMusic(system);
    expect(Object.isFrozen(actions)).toBe(true);
    for (const action of actions) {
      expect(Object.isFrozen(action)).toBe(true);
    }
  });

  it('pauseMusic / resumeMusic / setMusicVolume return frozen actions', () => {
    const system = createMusicSystem();
    changeMusic(system, { musicNum: 1, looping: true, score: syntheticScore([0x60]) });
    const pause = pauseMusic(system);
    const resume = resumeMusic(system);
    const volume = setMusicVolume(system, 5);
    for (const list of [pause, resume, volume]) {
      expect(Object.isFrozen(list)).toBe(true);
      for (const action of list) {
        expect(Object.isFrozen(action)).toBe(true);
      }
    }
  });
});
