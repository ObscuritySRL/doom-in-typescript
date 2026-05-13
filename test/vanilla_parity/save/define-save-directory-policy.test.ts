import { describe, expect, test } from 'bun:test';

import {
  isVanillaSaveSlotFilename,
  VANILLA_SAVEGAME_NAME_SIZE,
  VANILLA_SAVE_DIRECTORY_MODE,
  VANILLA_SAVE_DIRECTORY_NAMES_BY_PLATFORM,
  VANILLA_SAVE_SLOT_COUNT,
  VANILLA_SAVE_SLOT_FILENAME_EXTENSION,
  VANILLA_SAVE_SLOT_FILENAME_PREFIX,
  VANILLA_SAVE_STAGING_FILENAME,
  vanillaSaveDirectoryPathSegments,
  vanillaSaveSlotFilename,
} from '../../../src/save/define-save-directory-policy.ts';

describe('vanilla DOOM 1.9 save-directory policy contract', () => {
  test('pins the 6-slot vanilla save count', () => {
    expect(VANILLA_SAVE_SLOT_COUNT).toBe(6);
  });

  test('pins the doomsav%i.dsg filename pattern parts', () => {
    expect(VANILLA_SAVE_SLOT_FILENAME_PREFIX).toBe('doomsav');
    expect(VANILLA_SAVE_SLOT_FILENAME_EXTENSION).toBe('.dsg');
    expect(VANILLA_SAVE_STAGING_FILENAME).toBe('temp.dsg');
    expect(VANILLA_SAVEGAME_NAME_SIZE).toBe(24);
  });

  test('pins the per-platform configDirectory paths Chocolate Doom uses for savegamedir', () => {
    expect(VANILLA_SAVE_DIRECTORY_NAMES_BY_PLATFORM.get('win32')).toEqual(['%APPDATA%', 'Chocolate Doom']);
    expect(VANILLA_SAVE_DIRECTORY_NAMES_BY_PLATFORM.get('linux')).toEqual(['~', '.local', 'share', 'chocolate-doom']);
    expect(VANILLA_SAVE_DIRECTORY_NAMES_BY_PLATFORM.get('darwin')).toEqual(['~', 'Library', 'Application Support', 'Chocolate Doom']);
  });

  test('pins the 0o755 directory creation mode for M_MakeDirectory', () => {
    expect(VANILLA_SAVE_DIRECTORY_MODE).toBe(0o755);
  });

  test('vanillaSaveSlotFilename produces doomsav0.dsg through doomsav5.dsg', () => {
    expect(vanillaSaveSlotFilename(0)).toBe('doomsav0.dsg');
    expect(vanillaSaveSlotFilename(1)).toBe('doomsav1.dsg');
    expect(vanillaSaveSlotFilename(2)).toBe('doomsav2.dsg');
    expect(vanillaSaveSlotFilename(3)).toBe('doomsav3.dsg');
    expect(vanillaSaveSlotFilename(4)).toBe('doomsav4.dsg');
    expect(vanillaSaveSlotFilename(5)).toBe('doomsav5.dsg');
  });

  test('vanillaSaveSlotFilename rejects out-of-range slots', () => {
    expect(() => vanillaSaveSlotFilename(-1)).toThrow(RangeError);
    expect(() => vanillaSaveSlotFilename(6)).toThrow(RangeError);
    expect(() => vanillaSaveSlotFilename(100)).toThrow(RangeError);
    expect(() => vanillaSaveSlotFilename(1.5)).toThrow(RangeError);
  });

  test('isVanillaSaveSlotFilename detects valid slot filenames', () => {
    expect(isVanillaSaveSlotFilename('doomsav0.dsg')).toBe(true);
    expect(isVanillaSaveSlotFilename('doomsav5.dsg')).toBe(true);
    expect(isVanillaSaveSlotFilename('doomsav6.dsg')).toBe(false);
    expect(isVanillaSaveSlotFilename('temp.dsg')).toBe(false);
    expect(isVanillaSaveSlotFilename('doomsav.dsg')).toBe(false);
    expect(isVanillaSaveSlotFilename('doomsav-1.dsg')).toBe(false);
    expect(isVanillaSaveSlotFilename('demo1.lmp')).toBe(false);
    expect(isVanillaSaveSlotFilename('doomsav0a.dsg')).toBe(false);
  });

  test('vanillaSaveDirectoryPathSegments returns frozen segment arrays per platform', () => {
    const linuxSegments = vanillaSaveDirectoryPathSegments('linux');
    expect(Object.isFrozen(linuxSegments)).toBe(true);
    expect(linuxSegments).toEqual(['~', '.local', 'share', 'chocolate-doom']);
    const winSegments = vanillaSaveDirectoryPathSegments('win32');
    expect(winSegments).toEqual(['%APPDATA%', 'Chocolate Doom']);
  });
});
