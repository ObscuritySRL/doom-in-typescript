import { describe, expect, test } from 'bun:test';

import {
  isVanillaThinkerClassByte,
  VANILLA_SAVEGAME_MAPTHING_SIZE,
  VANILLA_SAVEGAME_MOBJ_SIZE,
  VANILLA_SAVEGAME_THINKER_CLASS_BYTE_SIZE,
  VANILLA_SAVEGAME_THINKER_CLASS_END,
  VANILLA_SAVEGAME_THINKER_CLASS_MOBJ,
  vanillaSerializedMobjBlockByteLength,
} from '../../../src/save/serialize-mobj-state.ts';

describe('vanilla DOOM 1.9 P_ArchiveThinkers mobj contract', () => {
  test('pins p_saveg.c mobj_t record size at 154 bytes and embedded mapthing_t at 10', () => {
    expect(VANILLA_SAVEGAME_MOBJ_SIZE).toBe(154);
    expect(VANILLA_SAVEGAME_MAPTHING_SIZE).toBe(10);
  });

  test('pins the saveg_thinkerclass_t enum end=0 / mobj=1 boundary', () => {
    expect(VANILLA_SAVEGAME_THINKER_CLASS_END).toBe(0);
    expect(VANILLA_SAVEGAME_THINKER_CLASS_MOBJ).toBe(1);
    expect(VANILLA_SAVEGAME_THINKER_CLASS_BYTE_SIZE).toBe(1);
  });

  test('total mobj block bytes = mobjCount * (1 class byte + 154 record bytes) + 1 terminator byte', () => {
    expect(vanillaSerializedMobjBlockByteLength(0)).toBe(1);
    expect(vanillaSerializedMobjBlockByteLength(1)).toBe(156);
    expect(vanillaSerializedMobjBlockByteLength(2)).toBe(311);
    expect(vanillaSerializedMobjBlockByteLength(10)).toBe(1551);
    expect(vanillaSerializedMobjBlockByteLength(100)).toBe(15501);
  });

  test('rejects non-negative-integer mobj counts', () => {
    expect(() => vanillaSerializedMobjBlockByteLength(-1)).toThrow(RangeError);
    expect(() => vanillaSerializedMobjBlockByteLength(1.5)).toThrow(RangeError);
  });

  test('isVanillaThinkerClassByte accepts only 0 (end) and 1 (mobj)', () => {
    expect(isVanillaThinkerClassByte(0)).toBe(true);
    expect(isVanillaThinkerClassByte(1)).toBe(true);
    expect(isVanillaThinkerClassByte(2)).toBe(false);
    expect(isVanillaThinkerClassByte(255)).toBe(false);
  });
});
