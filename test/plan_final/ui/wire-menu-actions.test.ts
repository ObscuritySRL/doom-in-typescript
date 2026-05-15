import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { MENU_ACTION_NONE, VANILLA_MENU_ACTION_KINDS, handleMenuKey, openMessage } from '../../../src/vanilla/wireMenuActions.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireMenuActions.ts');

const EXPECTED_MENU_ACTION_KINDS = [
  'adjustMusicVolume',
  'adjustScreenSize',
  'adjustSensitivity',
  'adjustSfxVolume',
  'beginSaveStringEntry',
  'cancelSaveStringEntry',
  'closeMenu',
  'commitSaveStringEntry',
  'endGame',
  'none',
  'openMenu',
  'openMessage',
  'quitGame',
  'readThisAdvance',
  'selectEpisode',
  'selectLoadSlot',
  'selectSaveSlot',
  'selectSkill',
  'toggleDetail',
  'toggleMessages',
];

describe('plan_final ui: wire-menu-actions', () => {
  test('src/vanilla/wireMenuActions.ts exists, is a regular file, and cites plan_final step 07-003', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('07-003');
    expect(fileText).toContain('VANILLA_MENU_ACTION_KINDS');
  });

  test('the facade re-exports from the read-only src/ui/menus.ts without modifying it', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain("from '../ui/menus.ts'");
  });

  test('VANILLA_MENU_ACTION_KINDS pins the complete 20-discriminant vocabulary, frozen and ASCIIbetically sorted', () => {
    expect(VANILLA_MENU_ACTION_KINDS.length).toBe(20);
    expect(Object.isFrozen(VANILLA_MENU_ACTION_KINDS)).toBe(true);
    expect([...VANILLA_MENU_ACTION_KINDS]).toEqual(EXPECTED_MENU_ACTION_KINDS);
    const sortedCopy = [...VANILLA_MENU_ACTION_KINDS].sort();
    expect([...VANILLA_MENU_ACTION_KINDS]).toEqual(sortedCopy);
  });

  test('the manifest exactly matches the MenuAction union kinds declared in src/ui/menus.ts', () => {
    const menusText = readFileSync(join(REPOSITORY_ROOT_DIRECTORY, 'src/ui/menus.ts'), 'utf8');
    const unionStart = menusText.indexOf('export type MenuAction =');
    expect(unionStart).toBeGreaterThanOrEqual(0);
    const unionEnd = menusText.indexOf('export const MENU_ACTION_NONE', unionStart);
    expect(unionEnd).toBeGreaterThan(unionStart);
    const unionBody = menusText.slice(unionStart, unionEnd);
    const declaredKinds = new Set<string>();
    for (const match of unionBody.matchAll(/kind:\s*'([a-zA-Z]+)'/g)) {
      declaredKinds.add(match[1]!);
    }
    expect([...declaredKinds].sort()).toEqual(EXPECTED_MENU_ACTION_KINDS);
  });

  test('MENU_ACTION_NONE is the frozen idle action and handleMenuKey/openMessage are callable', () => {
    expect(MENU_ACTION_NONE.kind).toBe('none');
    expect(Object.isFrozen(MENU_ACTION_NONE)).toBe(true);
    expect(typeof handleMenuKey).toBe('function');
    expect(typeof openMessage).toBe('function');
  });

  test('the re-exported producer is the SAME reference as the read-only menus module exports', async () => {
    const menusSource = await import('../../../src/ui/menus.ts');
    expect(handleMenuKey).toBe(menusSource.handleMenuKey);
    expect(MENU_ACTION_NONE).toBe(menusSource.MENU_ACTION_NONE);
  });
});
