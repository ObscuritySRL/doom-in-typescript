import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { DirectoryEntry } from '../../../src/wad/directory.ts';
import type { IwadResourceCache } from '../../../src/vanilla/iwadResourceCache.ts';
import { VANILLA_MUS_LUMP_PREFIX, VANILLA_SFX_LUMP_PREFIX, buildSoundAndMusicAssets } from '../../../src/vanilla/soundAndMusicAssets.ts';
import type { SoundAndMusicAssetCatalog } from '../../../src/vanilla/soundAndMusicAssets.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const SOUND_AND_MUSIC_ASSETS_RELATIVE_PATH = 'src/vanilla/soundAndMusicAssets.ts';
const SOUND_AND_MUSIC_ASSETS_ABSOLUTE_PATH = join(REPOSITORY_ROOT_DIRECTORY, SOUND_AND_MUSIC_ASSETS_RELATIVE_PATH);

function entry(name: string, size: number): DirectoryEntry {
  return Object.freeze({ name, offset: 0, size });
}

function buildStubResourceCache(directory: readonly DirectoryEntry[]): IwadResourceCache {
  return {
    directory,
    findLump: (lumpName: string): DirectoryEntry | null => directory.find((dirEntry) => dirEntry.name === lumpName) ?? null,
    gameIdentification: Object.freeze({ episodeCount: 1, gameDescription: 'DOOM Shareware', gameMission: 'doom', gameMode: 'shareware' }),
    getAllIndicesForName: (): readonly number[] => Object.freeze([]),
    hasLump: (lumpName: string): boolean => directory.some((dirEntry) => dirEntry.name === lumpName),
    lumpCount: directory.length,
    resolvedPath: 'synthetic://stub.wad',
    wadHeader: Object.freeze({ directoryOffset: 0, lumpCount: directory.length, type: 'IWAD' }),
  };
}

describe('plan_final wad: wire-sound-and-music-assets', () => {
  test('src/vanilla/soundAndMusicAssets.ts exists at the canonical wrapper path and is a regular file', () => {
    expect(existsSync(SOUND_AND_MUSIC_ASSETS_ABSOLUTE_PATH)).toBe(true);
    expect(statSync(SOUND_AND_MUSIC_ASSETS_ABSOLUTE_PATH).isFile()).toBe(true);
  });

  test('src/vanilla/soundAndMusicAssets.ts cites plan_final step 05-006 in a top-of-file comment', () => {
    const fileText = readFileSync(SOUND_AND_MUSIC_ASSETS_ABSOLUTE_PATH, 'utf8');
    expect(fileText).toContain('05-006');
    expect(fileText).toContain('buildSoundAndMusicAssets');
  });

  test('src/vanilla/soundAndMusicAssets.ts embeds NO proprietary IWAD sample or score bytes (per AGENTS.md)', () => {
    const fileText = readFileSync(SOUND_AND_MUSIC_ASSETS_ABSOLUTE_PATH, 'utf8');
    expect(fileText).not.toContain('Uint8Array.from');
    expect(fileText).not.toContain('Buffer.from(');
    expect(fileText).not.toMatch(/0x[0-9a-f]{2},\s*0x[0-9a-f]{2},\s*0x[0-9a-f]{2}/i);
  });

  test('VANILLA_SFX_LUMP_PREFIX and VANILLA_MUS_LUMP_PREFIX pin the canonical 2-byte lump-name prefixes', () => {
    expect(VANILLA_SFX_LUMP_PREFIX).toBe('DS');
    expect(VANILLA_MUS_LUMP_PREFIX).toBe('D_');
  });

  test('buildSoundAndMusicAssets returns a frozen catalog with frozen sfx/mus arrays', () => {
    const cache = buildStubResourceCache([entry('DSPISTOL', 1024), entry('D_E1M1', 2048)]);
    const catalog: SoundAndMusicAssetCatalog = buildSoundAndMusicAssets(cache);
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.sfxLumps)).toBe(true);
    expect(Object.isFrozen(catalog.musLumps)).toBe(true);
  });

  test('buildSoundAndMusicAssets partitions DS-prefixed entries into sfxLumps and D_-prefixed entries into musLumps', () => {
    const directory = [entry('PLAYPAL', 10752), entry('DSPISTOL', 4096), entry('DSITMBK', 8192), entry('D_E1M1', 16384), entry('D_INTRO', 8192), entry('STBAR', 2048)];
    const catalog = buildSoundAndMusicAssets(buildStubResourceCache(directory));
    expect(catalog.sfxLumps.map((sfx) => sfx.name)).toEqual(['DSPISTOL', 'DSITMBK']);
    expect(catalog.musLumps.map((mus) => mus.name)).toEqual(['D_E1M1', 'D_INTRO']);
  });

  test('buildSoundAndMusicAssets preserves directory order in both sfxLumps and musLumps', () => {
    const directory = [entry('DSPISTOL', 4096), entry('D_E1M1', 16384), entry('DSITMBK', 8192), entry('D_E1M2', 16384)];
    const catalog = buildSoundAndMusicAssets(buildStubResourceCache(directory));
    expect(catalog.sfxLumps.map((sfx) => sfx.directoryIndex)).toEqual([0, 2]);
    expect(catalog.musLumps.map((mus) => mus.directoryIndex)).toEqual([1, 3]);
  });

  test('buildSoundAndMusicAssets reports each entry with its canonical DirectoryEntry reference', () => {
    const sfxEntry = entry('DSPISTOL', 4096);
    const musEntry = entry('D_E1M1', 16384);
    const catalog = buildSoundAndMusicAssets(buildStubResourceCache([sfxEntry, musEntry]));
    expect(catalog.sfxLumps[0]!.directoryEntry).toBe(sfxEntry);
    expect(catalog.musLumps[0]!.directoryEntry).toBe(musEntry);
  });

  test('buildSoundAndMusicAssets skips zero-size lumps (matching the I_CacheSFX size > 0 guard)', () => {
    const directory = [entry('DSPISTOL', 0), entry('D_E1M1', 0), entry('DSITMBK', 4096)];
    const catalog = buildSoundAndMusicAssets(buildStubResourceCache(directory));
    expect(catalog.sfxLumps.map((sfx) => sfx.name)).toEqual(['DSITMBK']);
    expect(catalog.musLumps.length).toBe(0);
  });

  test('buildSoundAndMusicAssets folds case so lowercase ds/d_ on disk still resolves to the canonical buckets', () => {
    const directory = [entry('dspistol', 4096), entry('d_e1m1', 16384)];
    const catalog = buildSoundAndMusicAssets(buildStubResourceCache(directory));
    expect(catalog.sfxLumps.length).toBe(1);
    expect(catalog.musLumps.length).toBe(1);
    expect(catalog.sfxLumps[0]!.name).toBe('DSPISTOL');
    expect(catalog.musLumps[0]!.name).toBe('D_E1M1');
  });

  test('buildSoundAndMusicAssets returns empty catalogs for an empty directory without throwing', () => {
    const catalog = buildSoundAndMusicAssets(buildStubResourceCache([]));
    expect(catalog.sfxLumps.length).toBe(0);
    expect(catalog.musLumps.length).toBe(0);
  });

  test('buildSoundAndMusicAssets does not classify non-SFX/MUS lumps that happen to start with D as MUS', () => {
    const directory = [entry('DOOR_OP', 1024), entry('DEMO1', 8192), entry('DEMO2', 8192)];
    const catalog = buildSoundAndMusicAssets(buildStubResourceCache(directory));
    expect(catalog.sfxLumps.length).toBe(0);
    expect(catalog.musLumps.length).toBe(0);
  });
});
