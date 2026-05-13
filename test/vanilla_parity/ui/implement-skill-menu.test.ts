import { describe, expect, test } from 'bun:test';

import {
  VANILLA_SKILL_MENU_DEFAULT_CURSOR_INDEX,
  VANILLA_SKILL_MENU_TREE,
  VANILLA_SKILL_NIGHTMARE_INDEX,
  VANILLA_SKILL_NIGHTMARE_MESSAGE_KEY,
  VANILLA_SKILL_NIGHTMARE_REQUIRES_CONFIRM,
  deriveVanillaDeferedInitNewArgs,
  getVanillaSkillMenuTree,
  resolveVanillaSkillSelection,
} from '../../../src/ui/implement-skill-menu.ts';

describe('VANILLA_SKILL_MENU_TREE shape', () => {
  test('has 5 skill entries in vanilla order', () => {
    expect(VANILLA_SKILL_MENU_TREE.length).toBe(5);
    expect(VANILLA_SKILL_MENU_TREE.map((item) => item.lumpName)).toEqual(['M_JKILL', 'M_ROUGH', 'M_HURT', 'M_ULTRA', 'M_NMARE']);
  });

  test('skill indices are 0..4 in order', () => {
    expect(VANILLA_SKILL_MENU_TREE.map((item) => item.skillIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  test('hotkeys match vanilla i/h/h/u/n', () => {
    expect(VANILLA_SKILL_MENU_TREE.map((item) => item.hotkey)).toEqual(['i', 'h', 'h', 'u', 'n']);
  });

  test('tree and items are frozen', () => {
    expect(Object.isFrozen(VANILLA_SKILL_MENU_TREE)).toBe(true);
    for (const item of VANILLA_SKILL_MENU_TREE) {
      expect(Object.isFrozen(item)).toBe(true);
    }
  });
});

describe('VANILLA_SKILL_MENU_DEFAULT_CURSOR_INDEX', () => {
  test('default cursor lands on hurtme (index 2)', () => {
    expect(VANILLA_SKILL_MENU_DEFAULT_CURSOR_INDEX).toBe(2);
  });
});

describe('nightmare constants', () => {
  test('nightmare is the 5th and final entry (index 4)', () => {
    expect(VANILLA_SKILL_NIGHTMARE_INDEX).toBe(4);
    expect(VANILLA_SKILL_MENU_TREE[VANILLA_SKILL_NIGHTMARE_INDEX]?.lumpName).toBe('M_NMARE');
  });

  test('nightmare confirm uses the upstream DeHackEd NIGHTMARE key and requires Y/N', () => {
    expect(VANILLA_SKILL_NIGHTMARE_MESSAGE_KEY).toBe('NIGHTMARE');
    expect(VANILLA_SKILL_NIGHTMARE_REQUIRES_CONFIRM).toBe(true);
  });
});

describe('getVanillaSkillMenuTree', () => {
  test('returns the same frozen tree', () => {
    expect(getVanillaSkillMenuTree()).toBe(VANILLA_SKILL_MENU_TREE);
  });
});

describe('resolveVanillaSkillSelection', () => {
  test('non-nightmare picks return start-game', () => {
    for (let i = 0; i < 4; i += 1) {
      expect(resolveVanillaSkillSelection({ choice: i })).toBe('start-game');
    }
  });

  test('nightmare returns nightmare-confirm', () => {
    expect(resolveVanillaSkillSelection({ choice: 4 })).toBe('nightmare-confirm');
  });
});

describe('deriveVanillaDeferedInitNewArgs', () => {
  test('episode 0 (Knee-Deep) maps to one-based 1', () => {
    expect(deriveVanillaDeferedInitNewArgs(0, 2)).toEqual({ skill: 2, episodeOneBased: 1, map: 1 });
  });

  test('episode 3 (Thy Flesh Consumed) maps to one-based 4', () => {
    expect(deriveVanillaDeferedInitNewArgs(3, 3)).toEqual({ skill: 3, episodeOneBased: 4, map: 1 });
  });

  test('map is always 1 (start of episode)', () => {
    for (let epi = 0; epi < 4; epi += 1) {
      expect(deriveVanillaDeferedInitNewArgs(epi, 0).map).toBe(1);
    }
  });

  test('result is frozen', () => {
    expect(Object.isFrozen(deriveVanillaDeferedInitNewArgs(0, 0))).toBe(true);
  });
});
