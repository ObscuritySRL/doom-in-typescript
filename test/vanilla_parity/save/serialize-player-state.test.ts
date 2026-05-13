import { describe, expect, test } from 'bun:test';

import {
  VANILLA_MAXPLAYERS,
  VANILLA_SAVEGAME_AMMO_COUNT,
  VANILLA_SAVEGAME_CARD_COUNT,
  VANILLA_SAVEGAME_FRAG_COUNT,
  VANILLA_SAVEGAME_PLAYER_SIZE,
  VANILLA_SAVEGAME_POWER_COUNT,
  VANILLA_SAVEGAME_PSPRITE_COUNT,
  VANILLA_SAVEGAME_PSPRITE_SIZE,
  VANILLA_SAVEGAME_TICCMD_SIZE,
  VANILLA_SAVEGAME_WEAPON_COUNT,
  vanillaSerializedPlayerSlotByteLength,
  vanillaSerializedPlayersByteLength,
} from '../../../src/save/serialize-player-state.ts';

describe('vanilla DOOM 1.9 P_ArchivePlayers contract', () => {
  test('pins doomdef.h MAXPLAYERS=4 and the canonical 280-byte per-player record', () => {
    expect(VANILLA_MAXPLAYERS).toBe(4);
    expect(VANILLA_SAVEGAME_PLAYER_SIZE).toBe(280);
  });

  test('pins the embedded ticcmd_t=8 and pspritedef_t=16 record sizes', () => {
    expect(VANILLA_SAVEGAME_TICCMD_SIZE).toBe(8);
    expect(VANILLA_SAVEGAME_PSPRITE_SIZE).toBe(16);
    expect(VANILLA_SAVEGAME_PSPRITE_COUNT).toBe(2);
  });

  test('pins doomdef.h NUMAMMO=4, NUMWEAPONS=9, NUMCARDS=6, NUMPOWERS=6, NUMFRAGS=4', () => {
    expect(VANILLA_SAVEGAME_AMMO_COUNT).toBe(4);
    expect(VANILLA_SAVEGAME_WEAPON_COUNT).toBe(9);
    expect(VANILLA_SAVEGAME_CARD_COUNT).toBe(6);
    expect(VANILLA_SAVEGAME_POWER_COUNT).toBe(6);
    expect(VANILLA_SAVEGAME_FRAG_COUNT).toBe(4);
  });

  test('absent player slots contribute zero bytes; present slots contribute 280', () => {
    expect(vanillaSerializedPlayerSlotByteLength(false)).toBe(0);
    expect(vanillaSerializedPlayerSlotByteLength(true)).toBe(280);
  });

  test('total bytes equal 280 * count of present slots', () => {
    expect(vanillaSerializedPlayersByteLength([true, false, false, false])).toBe(280);
    expect(vanillaSerializedPlayersByteLength([true, true, true, true])).toBe(1120);
    expect(vanillaSerializedPlayersByteLength([false, false, false, false])).toBe(0);
    expect(vanillaSerializedPlayersByteLength([true, false, true, false])).toBe(560);
  });

  test('rejects presence arrays whose length does not equal MAXPLAYERS', () => {
    expect(() => vanillaSerializedPlayersByteLength([true])).toThrow(RangeError);
    expect(() => vanillaSerializedPlayersByteLength([])).toThrow(RangeError);
    expect(() => vanillaSerializedPlayersByteLength([true, true, true])).toThrow(RangeError);
    expect(() => vanillaSerializedPlayersByteLength([true, true, true, true, true])).toThrow(RangeError);
  });
});
