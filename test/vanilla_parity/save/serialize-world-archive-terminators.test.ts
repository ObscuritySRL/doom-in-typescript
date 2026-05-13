import { describe, expect, test } from 'bun:test';

import {
  isVanillaArchiveSectionTerminator,
  isVanillaSaveGameFileTerminator,
  VANILLA_BAD_SAVEGAME_ERROR,
  VANILLA_SAVE_GAME_FILE_TERMINATOR_BYTE,
  VANILLA_SAVE_SECTION_ORDER,
  VANILLA_SPECIALS_SECTION_TERMINATOR_BYTE,
  VANILLA_THINKERS_SECTION_TERMINATOR_BYTE,
} from '../../../src/save/serialize-world-archive-terminators.ts';

describe('vanilla DOOM 1.9 savegame section terminator contract', () => {
  test('pins the distinct tc_end=0 and tc_endspecials=7 section markers', () => {
    expect(VANILLA_THINKERS_SECTION_TERMINATOR_BYTE).toBe(0);
    expect(VANILLA_SPECIALS_SECTION_TERMINATOR_BYTE).toBe(7);
    expect(VANILLA_THINKERS_SECTION_TERMINATOR_BYTE).not.toBe(VANILLA_SPECIALS_SECTION_TERMINATOR_BYTE);
  });

  test('pins doomdef.h SAVE_GAME_TERMINATOR=0x1d file-end byte', () => {
    expect(VANILLA_SAVE_GAME_FILE_TERMINATOR_BYTE).toBe(0x1d);
  });

  test('pins the G_DoLoadGame "Bad savegame" reject error', () => {
    expect(VANILLA_BAD_SAVEGAME_ERROR).toBe('Bad savegame');
  });

  test('pins canonical section order header -> players -> world -> thinkers -> specials -> fileTerminator', () => {
    expect(VANILLA_SAVE_SECTION_ORDER).toEqual(['header', 'players', 'world', 'thinkers', 'specials', 'fileTerminator']);
  });

  test('isVanillaSaveGameFileTerminator detects only 0x1d', () => {
    expect(isVanillaSaveGameFileTerminator(0x1d)).toBe(true);
    expect(isVanillaSaveGameFileTerminator(0)).toBe(false);
    expect(isVanillaSaveGameFileTerminator(7)).toBe(false);
    expect(isVanillaSaveGameFileTerminator(0x1c)).toBe(false);
    expect(isVanillaSaveGameFileTerminator(0x1e)).toBe(false);
  });

  test('isVanillaArchiveSectionTerminator detects 0 (tc_end) and 7 (tc_endspecials)', () => {
    expect(isVanillaArchiveSectionTerminator(0)).toBe(true);
    expect(isVanillaArchiveSectionTerminator(7)).toBe(true);
    expect(isVanillaArchiveSectionTerminator(1)).toBe(false);
    expect(isVanillaArchiveSectionTerminator(0x1d)).toBe(false);
  });
});
