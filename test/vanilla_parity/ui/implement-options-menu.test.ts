import { describe, expect, test } from 'bun:test';

import {
  VANILLA_OPTIONS_ENTRY_COUNT,
  VANILLA_OPTIONS_INDEX_DETAIL,
  VANILLA_OPTIONS_INDEX_ENDGAME,
  VANILLA_OPTIONS_INDEX_MESSAGES,
  VANILLA_OPTIONS_INDEX_MSENS,
  VANILLA_OPTIONS_INDEX_SCRNSIZE,
  VANILLA_OPTIONS_INDEX_SVOL,
  VANILLA_OPTIONS_MENU_TREE,
  getVanillaOptionsMenuTree,
  vanillaOptionsItemIsCursorEligible,
} from '../../../src/ui/implement-options-menu.ts';

describe('options menu tree shape', () => {
  test('has 8 entries including two separators', () => {
    expect(VANILLA_OPTIONS_MENU_TREE.length).toBe(8);
    expect(VANILLA_OPTIONS_ENTRY_COUNT).toBe(8);
  });

  test('separator entries are at indices 4 and 6', () => {
    expect(VANILLA_OPTIONS_MENU_TREE[4]?.kind).toBe('separator');
    expect(VANILLA_OPTIONS_MENU_TREE[6]?.kind).toBe('separator');
  });

  test('selectables are at endgame/messages/detail/svol (status byte 1)', () => {
    expect(VANILLA_OPTIONS_MENU_TREE[VANILLA_OPTIONS_INDEX_ENDGAME]?.kind).toBe('selectable');
    expect(VANILLA_OPTIONS_MENU_TREE[VANILLA_OPTIONS_INDEX_MESSAGES]?.kind).toBe('selectable');
    expect(VANILLA_OPTIONS_MENU_TREE[VANILLA_OPTIONS_INDEX_DETAIL]?.kind).toBe('selectable');
    expect(VANILLA_OPTIONS_MENU_TREE[VANILLA_OPTIONS_INDEX_SVOL]?.kind).toBe('selectable');
  });

  test('sliders are at scrnsize/msens (status byte 2)', () => {
    expect(VANILLA_OPTIONS_MENU_TREE[VANILLA_OPTIONS_INDEX_SCRNSIZE]?.kind).toBe('slider');
    expect(VANILLA_OPTIONS_MENU_TREE[VANILLA_OPTIONS_INDEX_MSENS]?.kind).toBe('slider');
    expect(VANILLA_OPTIONS_MENU_TREE[VANILLA_OPTIONS_INDEX_SCRNSIZE]?.statusByte).toBe(2);
    expect(VANILLA_OPTIONS_MENU_TREE[VANILLA_OPTIONS_INDEX_MSENS]?.statusByte).toBe(2);
  });

  test('separators carry -1 status byte and empty lump name', () => {
    for (const idx of [4, 6]) {
      const sep = VANILLA_OPTIONS_MENU_TREE[idx];
      expect(sep?.statusByte).toBe(-1);
      expect(sep?.lumpName).toBe('');
      expect(sep?.routine).toBeNull();
    }
  });
});

describe('options menu lump names', () => {
  test('match vanilla M_ENDGAM/M_MESSG/M_DETAIL/M_SCRNSZ/M_MSENS/M_SVOL in order', () => {
    expect(VANILLA_OPTIONS_MENU_TREE.map((item) => item.lumpName)).toEqual(['M_ENDGAM', 'M_MESSG', 'M_DETAIL', 'M_SCRNSZ', '', 'M_MSENS', '', 'M_SVOL']);
  });
});

describe('options menu routines', () => {
  test('selectables and sliders route to upstream m_menu.c routines', () => {
    expect(VANILLA_OPTIONS_MENU_TREE.map((item) => item.routine)).toEqual(['M_EndGame', 'M_ChangeMessages', 'M_ChangeDetail', 'M_SizeDisplay', null, 'M_ChangeSensitivity', null, 'M_Sound']);
  });
});

describe('options menu hotkeys', () => {
  test('match vanilla e/m/g/s/_/m/_/s order', () => {
    expect(VANILLA_OPTIONS_MENU_TREE.map((item) => item.hotkey)).toEqual(['e', 'm', 'g', 's', null, 'm', null, 's']);
  });
});

describe('vanillaOptionsItemIsCursorEligible', () => {
  test('returns true for selectables and sliders', () => {
    expect(vanillaOptionsItemIsCursorEligible(VANILLA_OPTIONS_MENU_TREE[0]!)).toBe(true);
    expect(vanillaOptionsItemIsCursorEligible(VANILLA_OPTIONS_MENU_TREE[3]!)).toBe(true);
  });

  test('returns false for separators', () => {
    expect(vanillaOptionsItemIsCursorEligible(VANILLA_OPTIONS_MENU_TREE[4]!)).toBe(false);
    expect(vanillaOptionsItemIsCursorEligible(VANILLA_OPTIONS_MENU_TREE[6]!)).toBe(false);
  });
});

describe('getVanillaOptionsMenuTree', () => {
  test('returns the same frozen tree', () => {
    expect(getVanillaOptionsMenuTree()).toBe(VANILLA_OPTIONS_MENU_TREE);
    expect(Object.isFrozen(getVanillaOptionsMenuTree())).toBe(true);
  });
});
