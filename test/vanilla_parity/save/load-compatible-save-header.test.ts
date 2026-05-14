import { describe, expect, test } from 'bun:test';

import {
  decodeVanillaLeveltime,
  encodeVanillaLeveltime,
  VANILLA_LEVELTIME_MAX_REPRESENTABLE,
  VANILLA_LOAD_HEADER_DESCRIPTION_BYTES,
  VANILLA_LOAD_HEADER_GAMEEPISODE_BYTES,
  VANILLA_LOAD_HEADER_GAMEMAP_BYTES,
  VANILLA_LOAD_HEADER_GAMESKILL_BYTES,
  VANILLA_LOAD_HEADER_LEVELTIME_BYTES,
  VANILLA_LOAD_HEADER_PLAYERINGAME_BYTES,
  VANILLA_LOAD_HEADER_TOTAL_BYTES,
  VANILLA_LOAD_HEADER_VERSION_BYTES,
  vanillaPlayerPresent,
} from '../../../src/save/load-compatible-save-header.ts';

describe('vanilla DOOM 1.9 G_DoLoadGame header byte layout contract', () => {
  test('pins the per-field byte widths from g_game.c', () => {
    expect(VANILLA_LOAD_HEADER_DESCRIPTION_BYTES).toBe(24);
    expect(VANILLA_LOAD_HEADER_VERSION_BYTES).toBe(16);
    expect(VANILLA_LOAD_HEADER_GAMESKILL_BYTES).toBe(1);
    expect(VANILLA_LOAD_HEADER_GAMEEPISODE_BYTES).toBe(1);
    expect(VANILLA_LOAD_HEADER_GAMEMAP_BYTES).toBe(1);
    expect(VANILLA_LOAD_HEADER_PLAYERINGAME_BYTES).toBe(4);
    expect(VANILLA_LOAD_HEADER_LEVELTIME_BYTES).toBe(3);
  });

  test('pins total header bytes = 50', () => {
    expect(VANILLA_LOAD_HEADER_TOTAL_BYTES).toBe(50);
  });

  test('pins max representable leveltime at 2^24 - 1 tics (~ 5.3 hours)', () => {
    expect(VANILLA_LEVELTIME_MAX_REPRESENTABLE).toBe((1 << 24) - 1);
    expect(VANILLA_LEVELTIME_MAX_REPRESENTABLE).toBe(16777215);
  });

  test('decodeVanillaLeveltime concatenates bytes as high<<16 | mid<<8 | low', () => {
    expect(decodeVanillaLeveltime(0, 0, 0)).toBe(0);
    expect(decodeVanillaLeveltime(0, 0, 1)).toBe(1);
    expect(decodeVanillaLeveltime(0, 1, 0)).toBe(256);
    expect(decodeVanillaLeveltime(1, 0, 0)).toBe(65536);
    expect(decodeVanillaLeveltime(0xff, 0xff, 0xff)).toBe(VANILLA_LEVELTIME_MAX_REPRESENTABLE);
    expect(decodeVanillaLeveltime(0x12, 0x34, 0x56)).toBe(0x123456);
  });

  test('encodeVanillaLeveltime round-trips through decode', () => {
    for (const leveltime of [0, 1, 35, 1000, 65536, 1000000, VANILLA_LEVELTIME_MAX_REPRESENTABLE]) {
      const [high, mid, low] = encodeVanillaLeveltime(leveltime);
      expect(decodeVanillaLeveltime(high, mid, low)).toBe(leveltime);
    }
  });

  test('encodeVanillaLeveltime rejects negative or non-integer values', () => {
    expect(() => encodeVanillaLeveltime(-1)).toThrow(RangeError);
    expect(() => encodeVanillaLeveltime(1.5)).toThrow(RangeError);
  });

  test('vanillaPlayerPresent treats any non-zero byte as present (vanilla bool quirk)', () => {
    expect(vanillaPlayerPresent(0)).toBe(false);
    expect(vanillaPlayerPresent(1)).toBe(true);
    expect(vanillaPlayerPresent(0xff)).toBe(true);
    expect(vanillaPlayerPresent(0x42)).toBe(true);
  });
});
