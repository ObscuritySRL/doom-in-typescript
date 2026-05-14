import { describe, expect, test } from 'bun:test';

import {
  VANILLA_DOOM2_MUSIC_LUMPS_BY_MAP,
  VANILLA_REGISTERED_ONLY_MUSIC_LUMPS,
  VANILLA_SHAREWARE_AVAILABLE_MUSIC_EPISODES,
  VANILLA_SHARED_MUSIC_LUMPS,
  vanillaMusicLumpForDoom1Map,
  vanillaMusicLumpForDoom2Map,
} from '../../../src/audio/implement-music-selection-by-map-and-game-mode.ts';
import { PRIMARY_TARGET } from '../../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../../src/reference/policy.ts';
import { parseWadDirectory } from '../../../src/wad/directory.ts';
import { parseWadHeader } from '../../../src/wad/header.ts';

const wadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const wadBuffer = Buffer.from(await Bun.file(wadPath).arrayBuffer());
const header = parseWadHeader(wadBuffer);
const directory = parseWadDirectory(wadBuffer, header);
const lumpNames = new Set(directory.map((entry) => entry.name));

describe('vanilla music selection by map and game mode pin', () => {
  test('DOOM 1 E1 maps map to D_E1M1..D_E1M9', () => {
    for (let mapInEpisode = 1; mapInEpisode <= 9; mapInEpisode += 1) {
      expect(vanillaMusicLumpForDoom1Map(1, mapInEpisode)).toBe(`D_E1M${mapInEpisode}`);
    }
  });

  test('DOOM 1 E2 and E3 map to their own episode music', () => {
    expect(vanillaMusicLumpForDoom1Map(2, 5)).toBe('D_E2M5');
    expect(vanillaMusicLumpForDoom1Map(3, 1)).toBe('D_E3M1');
  });

  test('Ultimate Doom Episode 4 reuses Episode 1 music', () => {
    for (let mapInEpisode = 1; mapInEpisode <= 9; mapInEpisode += 1) {
      expect(vanillaMusicLumpForDoom1Map(4, mapInEpisode)).toBe(`D_E1M${mapInEpisode}`);
    }
  });

  test('DOOM 1 out-of-range episode/map throws RangeError', () => {
    expect(() => vanillaMusicLumpForDoom1Map(0, 1)).toThrow(RangeError);
    expect(() => vanillaMusicLumpForDoom1Map(5, 1)).toThrow(RangeError);
    expect(() => vanillaMusicLumpForDoom1Map(1, 0)).toThrow(RangeError);
    expect(() => vanillaMusicLumpForDoom1Map(1, 10)).toThrow(RangeError);
  });

  test('DOOM 2 has exactly 35 map-music lumps for MAP01..MAP35', () => {
    expect(VANILLA_DOOM2_MUSIC_LUMPS_BY_MAP).toHaveLength(35);
  });

  test('DOOM 2 MAP01 -> D_RUNNIN, MAP02 -> D_STALKS, MAP30 -> D_OPENIN', () => {
    expect(vanillaMusicLumpForDoom2Map(1)).toBe('D_RUNNIN');
    expect(vanillaMusicLumpForDoom2Map(2)).toBe('D_STALKS');
    expect(vanillaMusicLumpForDoom2Map(30)).toBe('D_OPENIN');
  });

  test('DOOM 2 out-of-range map throws RangeError', () => {
    expect(() => vanillaMusicLumpForDoom2Map(0)).toThrow(RangeError);
    expect(() => vanillaMusicLumpForDoom2Map(36)).toThrow(RangeError);
  });

  test('shared music lump names cover intro / introAlternate / intermission / victory', () => {
    expect(VANILLA_SHARED_MUSIC_LUMPS.intro).toBe('D_INTRO');
    expect(VANILLA_SHARED_MUSIC_LUMPS.introAlternate).toBe('D_INTROA');
    expect(VANILLA_SHARED_MUSIC_LUMPS.intermission).toBe('D_INTER');
    expect(VANILLA_SHARED_MUSIC_LUMPS.victory).toBe('D_VICTOR');
  });

  test('shareware IWAD declares only Episode 1 as music-available', () => {
    expect([...VANILLA_SHAREWARE_AVAILABLE_MUSIC_EPISODES]).toEqual([1]);
  });

  test('every shareware E1 music lump exists in DOOM1.WAD', () => {
    for (let mapInEpisode = 1; mapInEpisode <= 9; mapInEpisode += 1) {
      const lumpName = vanillaMusicLumpForDoom1Map(1, mapInEpisode);
      expect(lumpNames.has(lumpName)).toBe(true);
    }
  });

  test('all shared music lumps exist in DOOM1.WAD', () => {
    for (const lumpName of Object.values(VANILLA_SHARED_MUSIC_LUMPS)) {
      expect(lumpNames.has(lumpName)).toBe(true);
    }
  });

  test('shareware DOOM1.WAD does NOT ship E2 or E3 music lumps', () => {
    expect(lumpNames.has('D_E2M1')).toBe(false);
    expect(lumpNames.has('D_E3M1')).toBe(false);
  });

  test('D_BUNNY is registered-only and absent from shareware DOOM1.WAD', () => {
    expect(VANILLA_REGISTERED_ONLY_MUSIC_LUMPS.bunny).toBe('D_BUNNY');
    expect(lumpNames.has('D_BUNNY')).toBe(false);
  });
});
