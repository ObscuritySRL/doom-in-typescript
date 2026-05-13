/**
 * Vanilla Chocolate Doom 2.2.1 menu key mapping contract sourced from chocolate-doom.cfg.
 *
 * Pins each `key_menu_*` value to its DOS scan-code default. The menu key handler
 * (m_menu.c::M_Responder) reads these at config-load time and never re-reads them
 * during the run; subsequent host wiring must source the same defaults.
 */

/** Canonical menu key scan codes from chocolate-doom.cfg key_menu_* defaults. */
export const VANILLA_MENU_KEY_SCAN_CODES = Object.freeze({
  KEY_MENU_ABORT: 49,
  KEY_MENU_ACTIVATE: 1,
  KEY_MENU_BACK: 14,
  KEY_MENU_CONFIRM: 21,
  KEY_MENU_DECSCREEN: 12,
  KEY_MENU_DETAIL: 63,
  KEY_MENU_DOWN: 80,
  KEY_MENU_ENDGAME: 65,
  KEY_MENU_FORWARD: 28,
  KEY_MENU_GAMMA: 87,
  KEY_MENU_HELP: 59,
  KEY_MENU_INCSCREEN: 13,
  KEY_MENU_LEFT: 75,
  KEY_MENU_LOAD: 61,
  KEY_MENU_MESSAGES: 66,
  KEY_MENU_QLOAD: 67,
  KEY_MENU_QSAVE: 64,
  KEY_MENU_QUIT: 68,
  KEY_MENU_RIGHT: 77,
  KEY_MENU_SAVE: 60,
  KEY_MENU_SCREENSHOT: 0,
  KEY_MENU_UP: 72,
  KEY_MENU_VOLUME: 62,
} as const);

/** Whether menu key mapping is re-read on every menu open. Vanilla: no. */
export const VANILLA_REREADS_MENU_KEYS_ON_OPEN = false;

/** Whether menu keys can rebind at runtime via the menu. Vanilla: yes (via the controls submenu). */
export const VANILLA_MENU_KEYS_REBINDABLE_AT_RUNTIME = true;

export type MenuKeyName = keyof typeof VANILLA_MENU_KEY_SCAN_CODES;

export function lookupVanillaMenuKey(menuKeyName: MenuKeyName): number {
  return VANILLA_MENU_KEY_SCAN_CODES[menuKeyName];
}
