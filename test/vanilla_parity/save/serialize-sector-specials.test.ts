import { describe, expect, test } from 'bun:test';

import {
  isVanillaActiveSpecialClassByte,
  isVanillaSpecialClassByte,
  VANILLA_MAXBUTTONS,
  VANILLA_MAXCEILINGS,
  VANILLA_MAXPLATS,
  VANILLA_SAVE_GAME_TERMINATOR,
  VANILLA_TC_ACTIVE_THINKER_CLASS_COUNT,
  VANILLA_TC_CEILING,
  VANILLA_TC_DOOR,
  VANILLA_TC_ENDSPECIALS,
  VANILLA_TC_FLASH,
  VANILLA_TC_FLOOR,
  VANILLA_TC_GLOW,
  VANILLA_TC_PLAT,
  VANILLA_TC_STROBE,
} from '../../../src/save/serialize-sector-specials.ts';

describe('vanilla DOOM 1.9 P_ArchiveSpecials sector-special class enum', () => {
  test('pins saveg_specialclass_t numeric ordering from p_saveg.c', () => {
    expect(VANILLA_TC_CEILING).toBe(0);
    expect(VANILLA_TC_DOOR).toBe(1);
    expect(VANILLA_TC_FLOOR).toBe(2);
    expect(VANILLA_TC_PLAT).toBe(3);
    expect(VANILLA_TC_FLASH).toBe(4);
    expect(VANILLA_TC_STROBE).toBe(5);
    expect(VANILLA_TC_GLOW).toBe(6);
    expect(VANILLA_TC_ENDSPECIALS).toBe(7);
    expect(VANILLA_TC_ACTIVE_THINKER_CLASS_COUNT).toBe(7);
  });

  test('pins active-list snapshot table caps from p_ceilng.c / p_plats.c / p_spec.c', () => {
    expect(VANILLA_MAXCEILINGS).toBe(30);
    expect(VANILLA_MAXPLATS).toBe(30);
    expect(VANILLA_MAXBUTTONS).toBe(16);
  });

  test('pins doomdef.h SAVE_GAME_TERMINATOR=0x1d trailing byte', () => {
    expect(VANILLA_SAVE_GAME_TERMINATOR).toBe(0x1d);
  });

  test('isVanillaSpecialClassByte accepts 0..7 inclusive', () => {
    for (let i = 0; i <= 7; i++) {
      expect(isVanillaSpecialClassByte(i)).toBe(true);
    }
    expect(isVanillaSpecialClassByte(-1)).toBe(false);
    expect(isVanillaSpecialClassByte(8)).toBe(false);
    expect(isVanillaSpecialClassByte(255)).toBe(false);
  });

  test('isVanillaActiveSpecialClassByte accepts only active thinker classes 0..6', () => {
    for (let i = 0; i <= 6; i++) {
      expect(isVanillaActiveSpecialClassByte(i)).toBe(true);
    }
    expect(isVanillaActiveSpecialClassByte(7)).toBe(false);
    expect(isVanillaActiveSpecialClassByte(8)).toBe(false);
  });
});
