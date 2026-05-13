/**
 * Vanilla Chocolate Doom 2.2.1 ESC-from-title-loop-to-main-menu contract.
 *
 * Pressing ESCAPE (scancode 1) at any attract-loop page interrupts the page
 * timer, calls M_StartControlPanel, sets menuactive = true, and freezes the
 * page rendering at the current frame. The main menu opens at offset
 * (97, 64) in screen coordinates (M_DOOM lump anchor) with the cursor
 * positioned on "New Game" (currentMenu->lastOn).
 */

import { VANILLA_KEY_SCAN_CODES } from './implement-keyboard-scan-code-mapping.ts';

/** ESCAPE scancode for opening the main menu. */
export const VANILLA_ESCAPE_OPENS_MAIN_MENU_SCANCODE = VANILLA_KEY_SCAN_CODES.KEY_ESCAPE;

/** Whether ESC freezes the attract page underneath the menu. Vanilla: yes. */
export const VANILLA_ESC_FREEZES_PAGE = true;

/** Whether ESC also interrupts the page-timer countdown. Vanilla: yes (paused while menu is open). */
export const VANILLA_ESC_INTERRUPTS_PAGE_TIMER = true;

/** M_DOOM lump anchor X coordinate. */
export const VANILLA_MAIN_MENU_ANCHOR_X = 97;

/** M_DOOM lump anchor Y coordinate. */
export const VANILLA_MAIN_MENU_ANCHOR_Y = 64;

/** Initial menu item cursor index (0 = New Game). */
export const VANILLA_MAIN_MENU_INITIAL_CURSOR_ITEM = 0;

export interface EscFromTitleInput {
  readonly scanCode: number;
  readonly attractLoopActive: boolean;
  readonly menuAlreadyOpen: boolean;
}

export interface EscFromTitleDecision {
  readonly opensMainMenu: boolean;
  readonly freezesPage: boolean;
  readonly cursorItem: number;
}

export function decideEscFromTitle(input: EscFromTitleInput): EscFromTitleDecision {
  const shouldOpen = input.scanCode === VANILLA_ESCAPE_OPENS_MAIN_MENU_SCANCODE && input.attractLoopActive && !input.menuAlreadyOpen;
  return Object.freeze({
    opensMainMenu: shouldOpen,
    freezesPage: shouldOpen && VANILLA_ESC_FREEZES_PAGE,
    cursorItem: shouldOpen ? VANILLA_MAIN_MENU_INITIAL_CURSOR_ITEM : -1,
  });
}
