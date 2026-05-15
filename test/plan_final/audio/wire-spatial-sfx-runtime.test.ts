import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  BOSS_MAP_MIN_VOLUME,
  BOSS_MAP_NUMBER,
  NORM_SEP,
  S_CLIPPING_DIST,
  S_CLOSE_DIST,
  S_STEREO_SWING,
  VANILLA_SPATIAL_SFX_ENTRY_POINTS,
  adjustSoundParams,
  buildChannelUpdateStates,
  updateSounds,
} from '../../../src/vanilla/wireSpatialSfxRuntime.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireSpatialSfxRuntime.ts');
const FRACUNIT = 1 << 16;

describe('plan_final audio: wire-spatial-sfx-runtime', () => {
  test('src/vanilla/wireSpatialSfxRuntime.ts exists, is a regular file, and cites plan_final step 11-003', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('11-003');
    expect(fileText).toContain('VANILLA_SPATIAL_SFX_ENTRY_POINTS');
  });

  test('the facade re-exports from the read-only spatial + soundOrigins modules without modifying them', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain("from '../audio/spatial.ts'");
    expect(fileText).toContain("from '../audio/soundOrigins.ts'");
  });

  test('VANILLA_SPATIAL_SFX_ENTRY_POINTS pins the three canonical entry points and is frozen', () => {
    expect(VANILLA_SPATIAL_SFX_ENTRY_POINTS).toEqual(['adjustSoundParams', 'buildChannelUpdateStates', 'updateSounds']);
    expect(Object.isFrozen(VANILLA_SPATIAL_SFX_ENTRY_POINTS)).toBe(true);
  });

  test('the spatial-attenuation constants pin the vanilla s_sound.c fixed-point values', () => {
    expect(S_CLOSE_DIST).toBe(200 * FRACUNIT);
    expect(S_CLIPPING_DIST).toBe(1200 * FRACUNIT);
    expect(S_STEREO_SWING).toBe(96 * FRACUNIT);
    expect(NORM_SEP).toBe(128);
    expect(BOSS_MAP_MIN_VOLUME).toBe(15);
    expect(BOSS_MAP_NUMBER).toBe(8);
  });

  test('every wired spatial-SFX function is re-exported as a callable function', () => {
    expect(typeof adjustSoundParams).toBe('function');
    expect(typeof updateSounds).toBe('function');
    expect(typeof buildChannelUpdateStates).toBe('function');
  });

  test('the re-exported functions are the SAME references as the read-only source modules export', async () => {
    const spatialSource = await import('../../../src/audio/spatial.ts');
    const soundOriginsSource = await import('../../../src/audio/soundOrigins.ts');
    expect(adjustSoundParams).toBe(spatialSource.adjustSoundParams);
    expect(updateSounds).toBe(soundOriginsSource.updateSounds);
    expect(buildChannelUpdateStates).toBe(soundOriginsSource.buildChannelUpdateStates);
  });
});
