import { describe, expect, test } from 'bun:test';

import {
  formatVanillaUnknownThinkerClassError,
  isVanillaRecognizedThinkerClass,
  isVanillaTerminatorByte,
  VANILLA_BAD_SAVEGAME_ERROR_STRING,
  VANILLA_RECOGNIZED_THINKER_CLASSES,
  VANILLA_UNKNOWN_THINKER_CLASS_ERROR_TEMPLATE,
} from '../../../src/save/reject-corrupted-save-bytes.ts';

describe('vanilla DOOM 1.9 corrupted-save detection contract', () => {
  test('pins the I_Error "Bad savegame" reject string used by G_DoLoadGame', () => {
    expect(VANILLA_BAD_SAVEGAME_ERROR_STRING).toBe('Bad savegame');
  });

  test('pins the "Unknown tclass %i in savegame" template used by P_UnArchive*', () => {
    expect(VANILLA_UNKNOWN_THINKER_CLASS_ERROR_TEMPLATE).toBe('Unknown tclass %i in savegame');
  });

  test('lists 0..7 as recognized thinker class bytes', () => {
    for (let i = 0; i <= 7; i++) {
      expect(isVanillaRecognizedThinkerClass(i)).toBe(true);
    }
    expect(isVanillaRecognizedThinkerClass(8)).toBe(false);
    expect(isVanillaRecognizedThinkerClass(255)).toBe(false);
    expect(VANILLA_RECOGNIZED_THINKER_CLASSES.size).toBe(8);
  });

  test('formatVanillaUnknownThinkerClassError interpolates the decimal class byte', () => {
    expect(formatVanillaUnknownThinkerClassError(8)).toBe('Unknown tclass 8 in savegame');
    expect(formatVanillaUnknownThinkerClassError(42)).toBe('Unknown tclass 42 in savegame');
    expect(formatVanillaUnknownThinkerClassError(255)).toBe('Unknown tclass 255 in savegame');
  });

  test('isVanillaTerminatorByte detects the default 0x1d file-end byte', () => {
    expect(isVanillaTerminatorByte(0x1d)).toBe(true);
    expect(isVanillaTerminatorByte(0)).toBe(false);
    expect(isVanillaTerminatorByte(0x1c)).toBe(false);
    expect(isVanillaTerminatorByte(0x1e)).toBe(false);
  });

  test('isVanillaTerminatorByte accepts an explicit expected value for round-trip oracle tests', () => {
    expect(isVanillaTerminatorByte(7, 7)).toBe(true);
    expect(isVanillaTerminatorByte(0, 0)).toBe(true);
  });
});
