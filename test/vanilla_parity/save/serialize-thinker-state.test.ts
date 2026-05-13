import { describe, expect, test } from 'bun:test';

import { vanillaPadSavePBytesAdded, vanillaPadSavePOffset, VANILLA_SAVEGAME_PADSAVEP_ALIGNMENT, VANILLA_SAVEGAME_THINKER_CLASS_END, VANILLA_SAVEGAME_THINKER_CLASS_MOBJ } from '../../../src/save/serialize-thinker-state.ts';

describe('vanilla DOOM 1.9 P_ArchiveThinkers PADSAVEP and class-byte contract', () => {
  test('pins the saveg_thinkerclass_t enum end=0 / mobj=1 boundary', () => {
    expect(VANILLA_SAVEGAME_THINKER_CLASS_END).toBe(0);
    expect(VANILLA_SAVEGAME_THINKER_CLASS_MOBJ).toBe(1);
  });

  test('pins PADSAVEP() 4-byte alignment quantum from p_saveg.c', () => {
    expect(VANILLA_SAVEGAME_PADSAVEP_ALIGNMENT).toBe(4);
  });

  test('vanillaPadSavePOffset rounds up to the next 4-byte boundary', () => {
    expect(vanillaPadSavePOffset(0)).toBe(0);
    expect(vanillaPadSavePOffset(1)).toBe(4);
    expect(vanillaPadSavePOffset(2)).toBe(4);
    expect(vanillaPadSavePOffset(3)).toBe(4);
    expect(vanillaPadSavePOffset(4)).toBe(4);
    expect(vanillaPadSavePOffset(5)).toBe(8);
    expect(vanillaPadSavePOffset(7)).toBe(8);
    expect(vanillaPadSavePOffset(8)).toBe(8);
    expect(vanillaPadSavePOffset(100)).toBe(100);
    expect(vanillaPadSavePOffset(155)).toBe(156);
  });

  test('vanillaPadSavePBytesAdded reports 0..3 bytes of pad between class byte and record body', () => {
    expect(vanillaPadSavePBytesAdded(0)).toBe(0);
    expect(vanillaPadSavePBytesAdded(1)).toBe(3);
    expect(vanillaPadSavePBytesAdded(2)).toBe(2);
    expect(vanillaPadSavePBytesAdded(3)).toBe(1);
    expect(vanillaPadSavePBytesAdded(4)).toBe(0);
    expect(vanillaPadSavePBytesAdded(5)).toBe(3);
  });

  test('rejects negative or non-integer offsets', () => {
    expect(() => vanillaPadSavePOffset(-1)).toThrow(RangeError);
    expect(() => vanillaPadSavePOffset(1.5)).toThrow(RangeError);
  });
});
