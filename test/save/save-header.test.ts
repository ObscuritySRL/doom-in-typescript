import { describe, expect, test } from 'bun:test';

import type { SaveGameHeader } from '../../src/save/saveHeader';

import { SAVEGAME_DESCRIPTION_SIZE, SAVEGAME_HEADER_SIZE, SAVEGAME_VERSION_CODE, SAVEGAME_VERSION_SIZE, SAVEGAME_VERSION_TEXT, readSaveGameHeader, writeSaveGameHeader } from '../../src/save/saveHeader';

function byteString(value: string): number[] {
  return Array.from(value, (character) => character.charCodeAt(0));
}

const BASE_HEADER = {
  description: 'E1M1: Hangar',
  gameepisode: 1,
  gamemap: 1,
  gameskill: 2,
  leveltime: 0x12_34_56,
  playeringame: [1, 0, 0, 0] as const,
} satisfies SaveGameHeader;

describe('SAVEGAME_HEADER_SIZE', () => {
  test('matches the canonical header layout', () => {
    expect(SAVEGAME_HEADER_SIZE).toBe(50);
  });
});

describe('writeSaveGameHeader', () => {
  test('writes the canonical Doom 1.9 header bytes', () => {
    const bytes = writeSaveGameHeader(BASE_HEADER);

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(SAVEGAME_HEADER_SIZE);
    expect(Array.from(bytes.slice(0, BASE_HEADER.description.length))).toEqual(byteString(BASE_HEADER.description));
    expect(Array.from(bytes.slice(BASE_HEADER.description.length, SAVEGAME_DESCRIPTION_SIZE))).toEqual(new Array(SAVEGAME_DESCRIPTION_SIZE - BASE_HEADER.description.length).fill(0));
    expect(Array.from(bytes.slice(SAVEGAME_DESCRIPTION_SIZE, SAVEGAME_DESCRIPTION_SIZE + SAVEGAME_VERSION_TEXT.length))).toEqual(byteString(SAVEGAME_VERSION_TEXT));
    expect(Array.from(bytes.slice(SAVEGAME_DESCRIPTION_SIZE + SAVEGAME_VERSION_TEXT.length, SAVEGAME_DESCRIPTION_SIZE + SAVEGAME_VERSION_SIZE))).toEqual(new Array(SAVEGAME_VERSION_SIZE - SAVEGAME_VERSION_TEXT.length).fill(0));

    const headerStart = SAVEGAME_DESCRIPTION_SIZE + SAVEGAME_VERSION_SIZE;

    expect(Array.from(bytes.slice(headerStart, headerStart + 3))).toEqual([BASE_HEADER.gameskill, BASE_HEADER.gameepisode, BASE_HEADER.gamemap]);
    expect(Array.from(bytes.slice(headerStart + 3, headerStart + 7))).toEqual([1, 0, 0, 0]);
    expect(Array.from(bytes.slice(headerStart + 7, headerStart + 10))).toEqual([0x12, 0x34, 0x56]);
  });

  test('accepts a full 24-byte description without adding a terminator byte', () => {
    const description = 'ABCDEFGHIJKLMNOPQRSTUVWX';
    const bytes = writeSaveGameHeader({
      ...BASE_HEADER,
      description,
    });

    expect(description.length).toBe(SAVEGAME_DESCRIPTION_SIZE);
    expect(Array.from(bytes.slice(0, SAVEGAME_DESCRIPTION_SIZE))).toEqual(byteString(description));
  });

  test('truncates leveltime to the low 24 bits like the reference save writer', () => {
    const bytes = writeSaveGameHeader({
      ...BASE_HEADER,
      leveltime: 0x12_34_56_78,
    });

    const headerStart = SAVEGAME_DESCRIPTION_SIZE + SAVEGAME_VERSION_SIZE;

    expect(Array.from(bytes.slice(headerStart + 7, headerStart + 10))).toEqual([0x34, 0x56, 0x78]);
  });

  test('rejects descriptions longer than the fixed 24-byte field', () => {
    expect(() =>
      writeSaveGameHeader({
        ...BASE_HEADER,
        description: 'ABCDEFGHIJKLMNOPQRSTUVWXY',
      }),
    ).toThrow(RangeError);
  });
});

describe('readSaveGameHeader', () => {
  test('round-trips a canonical header', () => {
    const bytes = writeSaveGameHeader(BASE_HEADER);
    const parsed = readSaveGameHeader(bytes);

    expect(parsed).toEqual(BASE_HEADER);
    expect(parsed).not.toBeNull();
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed?.playeringame)).toBe(true);
  });

  test('returns null when the version string does not match the expected Doom 1.9 value', () => {
    const bytes = writeSaveGameHeader(BASE_HEADER);

    bytes[SAVEGAME_DESCRIPTION_SIZE + SAVEGAME_VERSION_TEXT.length - 1] = '8'.charCodeAt(0);

    expect(readSaveGameHeader(bytes)).toBeNull();
  });

  test('reconstructs the three-byte leveltime field from the serialized bytes', () => {
    const bytes = writeSaveGameHeader({
      ...BASE_HEADER,
      leveltime: 0xab_cd_ef_01,
    });
    const parsed = readSaveGameHeader(bytes);

    expect(parsed?.leveltime).toBe(0xcd_ef_01);
  });

  test('throws when the buffer is shorter than the fixed header size', () => {
    expect(() => readSaveGameHeader(new Uint8Array(SAVEGAME_HEADER_SIZE - 1))).toThrow(RangeError);
  });
});

describe('SAVEGAME_VERSION_TEXT', () => {
  test('pins the canonical Doom 1.9 version string', () => {
    expect(SAVEGAME_VERSION_CODE).toBe(109);
    expect(SAVEGAME_VERSION_TEXT).toBe('version 109');
  });
});
