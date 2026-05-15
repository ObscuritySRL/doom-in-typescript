import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  DEFAULT_MUSIC_VOLUME,
  MUS_INTRO,
  MUS_INTROA,
  MUS_NONE,
  MUSIC_VOLUME_MAX,
  MUSIC_VOLUME_MIN,
  NUMMUSIC,
  SNDDEVICE_SB,
  VANILLA_MUSIC_SELECTION_INVARIANTS,
  createMusicSystem,
  isMusicPlaying,
  pauseMusic,
  resolveMusicNumber,
  resumeMusic,
  setMusicVolume,
} from '../../../src/vanilla/wireMusicSelection.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireMusicSelection.ts');

describe('plan_final audio: wire-music-selection', () => {
  test('src/vanilla/wireMusicSelection.ts exists, is a regular file, and cites plan_final step 11-007', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('11-007');
    expect(fileText).toContain('VANILLA_MUSIC_SELECTION_INVARIANTS');
  });

  test('the facade re-exports only from the four read-only music-selection modules', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('../'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../audio/musicSystem.ts', '../ui/finale.ts', '../ui/frontEndSequence.ts', '../ui/intermission.ts']);
  });

  test('VANILLA_MUSIC_SELECTION_INVARIANTS pins the six parity rules and is frozen', () => {
    expect(VANILLA_MUSIC_SELECTION_INVARIANTS.length).toBe(6);
    expect(Object.isFrozen(VANILLA_MUSIC_SELECTION_INVARIANTS)).toBe(true);
    const ids = VANILLA_MUSIC_SELECTION_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual([
      'FINALE_USES_VICTOR_THEN_BUNNY_ON_EPISODE_3',
      'INTERMISSION_USES_MUS_INTER_FOR_DOOM1',
      'LEVEL_MUSIC_RESOLVES_INTRO_TO_INTROA_ON_OPL',
      'MUSIC_VOLUME_INTEGER_0_127_DEFAULT_8',
      'PAUSE_HALTS_MUSIC_AND_RESUME_RESTORES_IT',
      'TITLE_DEMO_PAGE_MUSIC_DRIVEN_BY_SHOWPAGE_ACTION',
    ]);
    for (const invariant of VANILLA_MUSIC_SELECTION_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('the music-volume constants match vanilla', () => {
    expect(MUSIC_VOLUME_MIN).toBe(0);
    expect(MUSIC_VOLUME_MAX).toBe(127);
    expect(DEFAULT_MUSIC_VOLUME).toBe(8);
    expect(NUMMUSIC).toBe(68);
    expect(MUS_NONE).toBe(0);
    expect(MUS_INTRO).toBe(29);
    expect(MUS_INTROA).toBe(32);
  });

  test('a fresh music system has the default volume, no song, and is not playing', () => {
    const system = createMusicSystem();
    expect(system.musicVolume).toBe(DEFAULT_MUSIC_VOLUME);
    expect(system.currentMusicNum).toBeNull();
    expect(system.paused).toBe(false);
    expect(isMusicPlaying(system)).toBe(false);
  });

  test('setMusicVolume emits a set-volume action for valid input and rejects out-of-range', () => {
    const system = createMusicSystem();
    expect(setMusicVolume(system, 64)).toEqual([{ kind: 'set-volume', volume: 64 }]);
    expect(system.musicVolume).toBe(64);
    expect(() => setMusicVolume(system, MUSIC_VOLUME_MAX + 1)).toThrow(RangeError);
    expect(() => setMusicVolume(system, -1)).toThrow(RangeError);
  });

  test('pause and resume are no-ops with no song loaded', () => {
    const system = createMusicSystem();
    expect(pauseMusic(system)).toEqual([]);
    expect(resumeMusic(system)).toEqual([]);
    expect(system.paused).toBe(false);
  });

  test('resolveMusicNumber substitutes MUS_INTRO to MUS_INTROA only on an OPL device with D_INTROA', () => {
    const plain = createMusicSystem({ hasIntroALump: false });
    expect(resolveMusicNumber(plain, MUS_INTRO)).toBe(MUS_INTRO);

    const oplWithIntroA = createMusicSystem({ hasIntroALump: true, musicDevice: SNDDEVICE_SB });
    expect(resolveMusicNumber(oplWithIntroA, MUS_INTRO)).toBe(MUS_INTROA);
    expect(resolveMusicNumber(oplWithIntroA, MUS_INTRO + 1)).toBe(MUS_INTRO + 1);
  });

  test('the re-exported symbols are the SAME references as the read-only musicSystem module', async () => {
    const musicSystemSource = await import('../../../src/audio/musicSystem.ts');
    expect(createMusicSystem).toBe(musicSystemSource.createMusicSystem);
    expect(setMusicVolume).toBe(musicSystemSource.setMusicVolume);
    expect(resolveMusicNumber).toBe(musicSystemSource.resolveMusicNumber);
    expect(NUMMUSIC).toBe(musicSystemSource.NUMMUSIC);
  });
});
