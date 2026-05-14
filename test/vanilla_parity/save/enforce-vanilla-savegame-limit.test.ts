import { describe, expect, test } from 'bun:test';

import {
  assertVanillaSaveGameLimit,
  VANILLA_SAVEGAMESIZE,
  VANILLA_SAVEGAMESIZE_DECIMAL,
  VANILLA_SAVEGAME_BUFFER_OVERRUN_ERROR,
  VANILLA_SAVEGAME_LIMIT_DEFAULT_ENABLED,
  vanillaSaveGameLimitExceeded,
} from '../../../src/save/enforce-vanilla-savegame-limit.ts';

describe('vanilla DOOM 1.9 savegame size limit contract', () => {
  test('pins g_game.c SAVEGAMESIZE=0x2c000 (180224 bytes)', () => {
    expect(VANILLA_SAVEGAMESIZE).toBe(0x2c000);
    expect(VANILLA_SAVEGAMESIZE_DECIMAL).toBe(180224);
    expect(VANILLA_SAVEGAMESIZE).toBe(VANILLA_SAVEGAMESIZE_DECIMAL);
  });

  test('pins the I_Error "Savegame buffer overrun" exact string', () => {
    expect(VANILLA_SAVEGAME_BUFFER_OVERRUN_ERROR).toBe('Savegame buffer overrun');
  });

  test('pins vanilla_savegame_limit=1 default-enabled flag from chocolate-doom.cfg', () => {
    expect(VANILLA_SAVEGAME_LIMIT_DEFAULT_ENABLED).toBe(1);
  });

  test('limit fires at >= 0x2c000 bytes (vanilla uses >= not >)', () => {
    expect(vanillaSaveGameLimitExceeded(VANILLA_SAVEGAMESIZE - 1)).toBe(false);
    expect(vanillaSaveGameLimitExceeded(VANILLA_SAVEGAMESIZE)).toBe(true);
    expect(vanillaSaveGameLimitExceeded(VANILLA_SAVEGAMESIZE + 1)).toBe(true);
    expect(vanillaSaveGameLimitExceeded(0)).toBe(false);
    expect(vanillaSaveGameLimitExceeded(180223)).toBe(false);
    expect(vanillaSaveGameLimitExceeded(180224)).toBe(true);
  });

  test('rejects non-integer and negative byte counts', () => {
    expect(() => vanillaSaveGameLimitExceeded(-1)).toThrow(RangeError);
    expect(() => vanillaSaveGameLimitExceeded(1.5)).toThrow(RangeError);
  });

  test('assertVanillaSaveGameLimit throws the I_Error string on overrun', () => {
    expect(() => assertVanillaSaveGameLimit(VANILLA_SAVEGAMESIZE)).toThrow('Savegame buffer overrun');
    expect(() => assertVanillaSaveGameLimit(VANILLA_SAVEGAMESIZE - 1)).not.toThrow();
    expect(() => assertVanillaSaveGameLimit(0)).not.toThrow();
  });
});
