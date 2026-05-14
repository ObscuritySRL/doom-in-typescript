import { describe, expect, test } from 'bun:test';

import {
  isVanillaNullMobjIndex,
  VANILLA_FIRST_ARCHIVED_MOBJ_INDEX,
  VANILLA_GAMEACTION_CLEAR_VALUE,
  VANILLA_LOAD_RESTORATION_ORDER,
  VANILLA_NULL_MOBJ_INDEX,
  vanillaRestoreOrderIndex,
} from '../../../src/save/restore-player-mobj-and-world-state.ts';

describe('vanilla DOOM 1.9 G_DoLoadGame state-restoration ordering contract', () => {
  test('pins the canonical restoration step sequence', () => {
    expect(VANILLA_LOAD_RESTORATION_ORDER).toEqual(['P_UnArchivePlayers', 'P_UnArchiveWorld', 'P_UnArchiveThinkers', 'P_UnArchiveSpecials', 'verifySaveGameTerminator', 'P_RestoreTargets', 'clearGameAction']);
  });

  test('P_RestoreTargets runs after all four archive sections and the terminator check', () => {
    expect(vanillaRestoreOrderIndex('P_UnArchivePlayers')).toBeLessThan(vanillaRestoreOrderIndex('P_RestoreTargets'));
    expect(vanillaRestoreOrderIndex('P_UnArchiveSpecials')).toBeLessThan(vanillaRestoreOrderIndex('P_RestoreTargets'));
    expect(vanillaRestoreOrderIndex('verifySaveGameTerminator')).toBeLessThan(vanillaRestoreOrderIndex('P_RestoreTargets'));
    expect(vanillaRestoreOrderIndex('P_RestoreTargets')).toBeLessThan(vanillaRestoreOrderIndex('clearGameAction'));
  });

  test('pins NULL mobj index at 0 with first archived mobj at index 1', () => {
    expect(VANILLA_NULL_MOBJ_INDEX).toBe(0);
    expect(VANILLA_FIRST_ARCHIVED_MOBJ_INDEX).toBe(1);
    expect(isVanillaNullMobjIndex(0)).toBe(true);
    expect(isVanillaNullMobjIndex(1)).toBe(false);
  });

  test('pins ga_nothing as the post-load gameaction value', () => {
    expect(VANILLA_GAMEACTION_CLEAR_VALUE).toBe(0);
  });

  test('vanillaRestoreOrderIndex returns -1 for unknown step names', () => {
    expect(vanillaRestoreOrderIndex('P_DoubleUnArchive')).toBe(-1);
    expect(vanillaRestoreOrderIndex('')).toBe(-1);
  });
});
