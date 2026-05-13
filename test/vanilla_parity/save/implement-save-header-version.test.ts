import { describe, expect, test } from 'bun:test';

import {
  decodeVanillaSaveVersionField,
  encodeVanillaSaveVersionField,
  isVanillaSaveVersionCompatible,
  isVanillaSaveVersionFieldCompatible,
  VANILLA_SAVEGAME_INCOMPATIBLE_VERSION_ERROR,
  VANILLA_SAVEGAME_VERSION_CODE,
  VANILLA_SAVEGAME_VERSION_FIELD_OFFSET,
  VANILLA_SAVEGAME_VERSION_MAGIC,
  VANILLA_SAVEGAME_VERSION_SIZE,
} from '../../../src/save/implement-save-header-version.ts';

describe('vanilla DOOM 1.9 save-header version magic contract', () => {
  test('pins VERSION=109 and VERSIONSIZE=16 from doomdef.h / g_game.c', () => {
    expect(VANILLA_SAVEGAME_VERSION_CODE).toBe(109);
    expect(VANILLA_SAVEGAME_VERSION_SIZE).toBe(16);
    expect(VANILLA_SAVEGAME_VERSION_MAGIC).toBe('version 109');
    expect(VANILLA_SAVEGAME_VERSION_FIELD_OFFSET).toBe(24);
  });

  test('pins the rejection error string from G_DoLoadGame', () => {
    expect(VANILLA_SAVEGAME_INCOMPATIBLE_VERSION_ERROR).toBe('Savegame from different version');
  });

  test('encodeVanillaSaveVersionField produces 16-byte NUL-padded "version 109"', () => {
    const bytes = encodeVanillaSaveVersionField();
    expect(bytes.length).toBe(16);
    const expected = [0x76, 0x65, 0x72, 0x73, 0x69, 0x6f, 0x6e, 0x20, 0x31, 0x30, 0x39, 0x00, 0x00, 0x00, 0x00, 0x00];
    for (let i = 0; i < 16; i++) {
      expect(bytes[i]).toBe(expected[i]);
    }
  });

  test('encodeVanillaSaveVersionField rejects magic strings longer than 16 bytes', () => {
    expect(() => encodeVanillaSaveVersionField('A'.repeat(17))).toThrow(RangeError);
    expect(() => encodeVanillaSaveVersionField('A'.repeat(16))).not.toThrow();
  });

  test('encodeVanillaSaveVersionField rejects characters outside the single-byte range', () => {
    expect(() => encodeVanillaSaveVersionField('vérsion 109Ā')).toThrow(RangeError);
  });

  test('decodeVanillaSaveVersionField stops at first NUL byte', () => {
    const bytes = encodeVanillaSaveVersionField();
    expect(decodeVanillaSaveVersionField(bytes)).toBe('version 109');
  });

  test('isVanillaSaveVersionCompatible accepts only "version 109" exactly', () => {
    expect(isVanillaSaveVersionCompatible('version 109')).toBe(true);
    expect(isVanillaSaveVersionCompatible('version 108')).toBe(false);
    expect(isVanillaSaveVersionCompatible('version 110')).toBe(false);
    expect(isVanillaSaveVersionCompatible('Version 109')).toBe(false);
    expect(isVanillaSaveVersionCompatible('VERSION 109')).toBe(false);
    expect(isVanillaSaveVersionCompatible('')).toBe(false);
    expect(isVanillaSaveVersionCompatible('version  109')).toBe(false);
  });

  test('isVanillaSaveVersionFieldCompatible round-trips through encode/decode', () => {
    expect(isVanillaSaveVersionFieldCompatible(encodeVanillaSaveVersionField())).toBe(true);
    expect(isVanillaSaveVersionFieldCompatible(encodeVanillaSaveVersionField('version 108'))).toBe(false);
    expect(isVanillaSaveVersionFieldCompatible(encodeVanillaSaveVersionField('version 110'))).toBe(false);
    expect(isVanillaSaveVersionFieldCompatible(new Uint8Array(16))).toBe(false);
  });

  test('rejects undersized buffers without crashing', () => {
    expect(() => decodeVanillaSaveVersionField(new Uint8Array(15))).toThrow(RangeError);
    expect(isVanillaSaveVersionFieldCompatible(new Uint8Array(15))).toBe(false);
  });
});
