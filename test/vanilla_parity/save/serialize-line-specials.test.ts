import { describe, expect, test } from 'bun:test';

import {
  isVanillaLineSpecialCleared,
  VANILLA_LINE_FLAGS_FIELD_WIDTH,
  VANILLA_LINE_SPECIAL_FIELD_WIDTH,
  VANILLA_LINE_SPECIAL_NONE,
  VANILLA_LINE_TAG_FIELD_WIDTH,
  VANILLA_SAVEGAME_LINE_BASE_SIZE,
  VANILLA_SAVEGAME_SIDE_SIZE,
  vanillaSerializedLineByteLength,
} from '../../../src/save/serialize-line-specials.ts';

describe('vanilla DOOM 1.9 line-special serialization contract', () => {
  test('pins p_saveg.c per-line base layout of 6 bytes (flags + special + tag)', () => {
    expect(VANILLA_SAVEGAME_LINE_BASE_SIZE).toBe(6);
    expect(VANILLA_LINE_FLAGS_FIELD_WIDTH).toBe(2);
    expect(VANILLA_LINE_SPECIAL_FIELD_WIDTH).toBe(2);
    expect(VANILLA_LINE_TAG_FIELD_WIDTH).toBe(2);
    expect(VANILLA_LINE_FLAGS_FIELD_WIDTH + VANILLA_LINE_SPECIAL_FIELD_WIDTH + VANILLA_LINE_TAG_FIELD_WIDTH).toBe(VANILLA_SAVEGAME_LINE_BASE_SIZE);
  });

  test('pins the SAVEGAME_SIDE_SIZE=10 per-sidedef payload (textureoffset, rowoffset, toptex, bottomtex, midtex)', () => {
    expect(VANILLA_SAVEGAME_SIDE_SIZE).toBe(10);
  });

  test('total per-line bytes = 6 + sidedefCount * 10', () => {
    expect(vanillaSerializedLineByteLength(0)).toBe(6);
    expect(vanillaSerializedLineByteLength(1)).toBe(16);
    expect(vanillaSerializedLineByteLength(2)).toBe(26);
  });

  test('rejects sidedef counts outside the vanilla 0..2 range at runtime', () => {
    const callWith =
      (n: number): (() => number) =>
      () =>
        vanillaSerializedLineByteLength(n as 0 | 1 | 2);
    expect(callWith(3)).toThrow(RangeError);
    expect(callWith(-1)).toThrow(RangeError);
  });

  test('special=0 represents a cleared / triggered single-use line', () => {
    expect(VANILLA_LINE_SPECIAL_NONE).toBe(0);
    expect(isVanillaLineSpecialCleared(0)).toBe(true);
    expect(isVanillaLineSpecialCleared(1)).toBe(false);
    expect(isVanillaLineSpecialCleared(11)).toBe(false);
    expect(isVanillaLineSpecialCleared(97)).toBe(false);
  });
});
