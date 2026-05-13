import { describe, expect, test } from 'bun:test';

import {
  VANILLA_ESC_FREEZES_PAGE,
  VANILLA_ESC_INTERRUPTS_PAGE_TIMER,
  VANILLA_ESCAPE_OPENS_MAIN_MENU_SCANCODE,
  VANILLA_MAIN_MENU_ANCHOR_X,
  VANILLA_MAIN_MENU_ANCHOR_Y,
  VANILLA_MAIN_MENU_INITIAL_CURSOR_ITEM,
  decideEscFromTitle,
} from '../../../src/bootstrap/implement-escape-to-main-menu-from-title.ts';

describe('vanilla ESC-to-main-menu contract', () => {
  test('ESCAPE scancode is 1', () => {
    expect(VANILLA_ESCAPE_OPENS_MAIN_MENU_SCANCODE).toBe(1);
  });

  test('ESC freezes the underlying attract page and interrupts page timer', () => {
    expect(VANILLA_ESC_FREEZES_PAGE).toBe(true);
    expect(VANILLA_ESC_INTERRUPTS_PAGE_TIMER).toBe(true);
  });

  test('M_DOOM lump anchor coordinates are (97, 64) and initial cursor is New Game (0)', () => {
    expect(VANILLA_MAIN_MENU_ANCHOR_X).toBe(97);
    expect(VANILLA_MAIN_MENU_ANCHOR_Y).toBe(64);
    expect(VANILLA_MAIN_MENU_INITIAL_CURSOR_ITEM).toBe(0);
  });
});

describe('decideEscFromTitle', () => {
  test('opens main menu when ESC is pressed during the attract loop and the menu is closed', () => {
    const decision = decideEscFromTitle({ scanCode: 1, attractLoopActive: true, menuAlreadyOpen: false });
    expect(decision.opensMainMenu).toBe(true);
    expect(decision.freezesPage).toBe(true);
    expect(decision.cursorItem).toBe(0);
  });

  test('does not open the menu when ESC is pressed but menu is already open', () => {
    const decision = decideEscFromTitle({ scanCode: 1, attractLoopActive: true, menuAlreadyOpen: true });
    expect(decision.opensMainMenu).toBe(false);
    expect(decision.cursorItem).toBe(-1);
  });

  test('does not open the menu for non-ESC scancodes', () => {
    const decision = decideEscFromTitle({ scanCode: 28, attractLoopActive: true, menuAlreadyOpen: false });
    expect(decision.opensMainMenu).toBe(false);
  });

  test('does not open the menu when attract loop is not active', () => {
    const decision = decideEscFromTitle({ scanCode: 1, attractLoopActive: false, menuAlreadyOpen: false });
    expect(decision.opensMainMenu).toBe(false);
  });
});
