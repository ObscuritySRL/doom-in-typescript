import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  HU_FONTEND,
  HU_FONTSTART,
  LINEHEIGHT,
  MAX_LOAD_SAVE_SLOTS,
  SAVESTRINGSIZE,
  SKULLXOFF,
  SKULL_ANIM_TIME,
  VANILLA_MENU_RENDERING_ENTRY_POINTS,
  closeMenu,
  createMenuState,
  handleMenuKey,
  huFontLumpName,
  openMenu,
  openMessage,
  tickMenu,
} from '../../../src/vanilla/wireMenuRendering.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireMenuRendering.ts');

describe('plan_final ui: wire-menu-rendering', () => {
  test('src/vanilla/wireMenuRendering.ts exists, is a regular file, and cites plan_final step 07-002', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('07-002');
    expect(fileText).toContain('VANILLA_MENU_RENDERING_ENTRY_POINTS');
  });

  test('the facade re-exports from the read-only menus + assets modules without modifying them', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain("from '../ui/menus.ts'");
    expect(fileText).toContain("from '../ui/assets.ts'");
  });

  test('VANILLA_MENU_RENDERING_ENTRY_POINTS pins the seven canonical entry points and is frozen', () => {
    expect(VANILLA_MENU_RENDERING_ENTRY_POINTS).toEqual(['closeMenu', 'createMenuState', 'handleMenuKey', 'huFontLumpName', 'openMenu', 'openMessage', 'tickMenu']);
    expect(Object.isFrozen(VANILLA_MENU_RENDERING_ENTRY_POINTS)).toBe(true);
  });

  test('the menu layout constants pin the vanilla m_menu.c / hu_stuff.c values', () => {
    expect(LINEHEIGHT).toBe(16);
    expect(SKULLXOFF).toBe(-32);
    expect(SKULL_ANIM_TIME).toBe(8);
    expect(SAVESTRINGSIZE).toBe(24);
    expect(MAX_LOAD_SAVE_SLOTS).toBe(6);
    expect(HU_FONTSTART).toBe(0x21);
    expect(HU_FONTEND).toBe(0x5f);
  });

  test('every wired menu function is re-exported as a callable function', () => {
    expect(typeof createMenuState).toBe('function');
    expect(typeof openMenu).toBe('function');
    expect(typeof closeMenu).toBe('function');
    expect(typeof openMessage).toBe('function');
    expect(typeof tickMenu).toBe('function');
    expect(typeof handleMenuKey).toBe('function');
    expect(typeof huFontLumpName).toBe('function');
  });

  test('huFontLumpName resolves the STCFN-prefixed HU-font patch lump for a printable char', () => {
    const lumpName = huFontLumpName(HU_FONTSTART);
    expect(typeof lumpName).toBe('string');
    expect(lumpName).toContain('STCFN');
  });

  test('the re-exported functions are the SAME references as the read-only source modules export', async () => {
    const menusSource = await import('../../../src/ui/menus.ts');
    const assetsSource = await import('../../../src/ui/assets.ts');
    expect(createMenuState).toBe(menusSource.createMenuState);
    expect(handleMenuKey).toBe(menusSource.handleMenuKey);
    expect(huFontLumpName).toBe(assetsSource.huFontLumpName);
  });
});
