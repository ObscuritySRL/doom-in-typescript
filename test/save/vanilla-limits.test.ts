import { describe, expect, test } from 'bun:test';

import { SAVEGAME_EOF } from '../../src/save/loadgame.ts';
import { VANILLA_SAVEGAME_LIMIT_SIZE, VANILLA_SAVEGAME_OVERRUN_ERROR, assertVanillaSaveGameByteLength, writeVanillaSaveGame } from '../../src/save/vanillaLimits.ts';

const BASE_SECTIONS = {
  header: Uint8Array.from([0x01, 0x02]),
  mobjs: Uint8Array.from([0x07]),
  players: Uint8Array.from([0x03]),
  specials: Uint8Array.from([0x08]),
  world: Uint8Array.from([0x04, 0x05, 0x06]),
};

describe('VANILLA_SAVEGAME_LIMIT_SIZE', () => {
  test('locks the canonical `SAVEGAMESIZE` ceiling to 0x2C000 bytes', () => {
    expect(VANILLA_SAVEGAME_LIMIT_SIZE).toBe(0x2c000);
  });
});

describe('assertVanillaSaveGameByteLength', () => {
  test('accepts a savegame exactly at the vanilla ceiling', () => {
    expect(() => assertVanillaSaveGameByteLength(VANILLA_SAVEGAME_LIMIT_SIZE, 1)).not.toThrow();
  });

  test('throws the canonical overrun error only when the final byte count exceeds the limit', () => {
    expect(() => assertVanillaSaveGameByteLength(VANILLA_SAVEGAME_LIMIT_SIZE + 1, 1)).toThrow(VANILLA_SAVEGAME_OVERRUN_ERROR);
  });

  test('treats a zero compatibility flag as unlimited savegame size', () => {
    expect(() => assertVanillaSaveGameByteLength(VANILLA_SAVEGAME_LIMIT_SIZE + 1, 0)).not.toThrow();
  });
});

describe('writeVanillaSaveGame', () => {
  test('writes sections in Doom save order and appends the canonical EOF marker', () => {
    const bytes = writeVanillaSaveGame(BASE_SECTIONS);

    expect(bytes).toEqual(Uint8Array.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, SAVEGAME_EOF]));
  });

  test('applies the limit after appending the EOF marker, so a pre-EOF payload of limit-1 bytes still fits', () => {
    const bytes = writeVanillaSaveGame({
      header: new Uint8Array(VANILLA_SAVEGAME_LIMIT_SIZE - 1),
      mobjs: new Uint8Array(0),
      players: new Uint8Array(0),
      specials: new Uint8Array(0),
      world: new Uint8Array(0),
    });

    expect(bytes.length).toBe(VANILLA_SAVEGAME_LIMIT_SIZE);
    expect(bytes[bytes.length - 1]).toBe(SAVEGAME_EOF);
  });

  test('throws once the post-EOF length crosses the vanilla ceiling unless the compatibility flag disables it', () => {
    const oversizedSections = {
      header: new Uint8Array(VANILLA_SAVEGAME_LIMIT_SIZE),
      mobjs: new Uint8Array(0),
      players: new Uint8Array(0),
      specials: new Uint8Array(0),
      world: new Uint8Array(0),
    };

    expect(() => writeVanillaSaveGame(oversizedSections)).toThrow(VANILLA_SAVEGAME_OVERRUN_ERROR);

    const bytes = writeVanillaSaveGame(oversizedSections, 0);

    expect(bytes.length).toBe(VANILLA_SAVEGAME_LIMIT_SIZE + 1);
    expect(bytes[bytes.length - 1]).toBe(SAVEGAME_EOF);
  });
});
