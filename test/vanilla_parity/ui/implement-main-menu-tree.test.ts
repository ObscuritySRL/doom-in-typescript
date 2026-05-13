import { describe, expect, test } from 'bun:test';

import { getVanillaMainMenuItemCount, getVanillaMainMenuTree } from '../../../src/ui/implement-main-menu-tree.ts';

describe('vanilla main menu tree — shareware/registered/retail (non-commercial)', () => {
  test('has 6 items in the exact vanilla order', () => {
    const tree = getVanillaMainMenuTree('shareware');
    expect(tree.length).toBe(6);
    expect(tree.map((item) => item.routine)).toEqual(['M_NewGame', 'M_Options', 'M_LoadGame', 'M_SaveGame', 'M_ReadThis', 'M_QuitDOOM']);
  });

  test('uses exact vanilla M_*** lump names', () => {
    const tree = getVanillaMainMenuTree('shareware');
    expect(tree.map((item) => item.lumpName)).toEqual(['M_NGAME', 'M_OPTION', 'M_LOADG', 'M_SAVEG', 'M_RDTHIS', 'M_QUITG']);
  });

  test('uses exact vanilla one-character hotkeys', () => {
    const tree = getVanillaMainMenuTree('shareware');
    expect(tree.map((item) => item.hotkey)).toEqual(['n', 'o', 'l', 's', 'r', 'q']);
  });

  test('every item is enabled by default', () => {
    const tree = getVanillaMainMenuTree('shareware');
    for (const item of tree) {
      expect(item.enabled).toBe(true);
    }
  });

  test('registered mode has identical menu tree to shareware', () => {
    expect(getVanillaMainMenuTree('registered')).toEqual(getVanillaMainMenuTree('shareware'));
  });

  test('retail (Ultimate Doom) keeps the readthis slot (6 items)', () => {
    const tree = getVanillaMainMenuTree('retail');
    expect(tree.length).toBe(6);
    expect(tree[4]?.routine).toBe('M_ReadThis');
  });
});

describe('vanilla main menu tree — commercial (Doom II)', () => {
  test('drops M_ReadThis, leaving 5 items', () => {
    const tree = getVanillaMainMenuTree('commercial');
    expect(tree.length).toBe(5);
    expect(tree.map((item) => item.routine)).toEqual(['M_NewGame', 'M_Options', 'M_LoadGame', 'M_SaveGame', 'M_QuitDOOM']);
  });

  test('commercial lump names omit M_RDTHIS', () => {
    const tree = getVanillaMainMenuTree('commercial');
    expect(tree.map((item) => item.lumpName)).toEqual(['M_NGAME', 'M_OPTION', 'M_LOADG', 'M_SAVEG', 'M_QUITG']);
  });

  test('commercial hotkeys omit r', () => {
    const tree = getVanillaMainMenuTree('commercial');
    expect(tree.map((item) => item.hotkey)).toEqual(['n', 'o', 'l', 's', 'q']);
  });
});

describe('getVanillaMainMenuItemCount', () => {
  test('shareware/registered/retail all report 6 items', () => {
    expect(getVanillaMainMenuItemCount('shareware')).toBe(6);
    expect(getVanillaMainMenuItemCount('registered')).toBe(6);
    expect(getVanillaMainMenuItemCount('retail')).toBe(6);
  });

  test('commercial reports 5 items', () => {
    expect(getVanillaMainMenuItemCount('commercial')).toBe(5);
  });
});

describe('menu tree immutability', () => {
  test('returned arrays are frozen', () => {
    expect(Object.isFrozen(getVanillaMainMenuTree('shareware'))).toBe(true);
    expect(Object.isFrozen(getVanillaMainMenuTree('commercial'))).toBe(true);
  });

  test('returned items are frozen', () => {
    const tree = getVanillaMainMenuTree('shareware');
    for (const item of tree) {
      expect(Object.isFrozen(item)).toBe(true);
    }
  });
});
