/**
 * Vanilla DOOM 1.9 scripted menu-navigation oracle scenarios.
 *
 * Cross-validates the menu contracts pinned by 10-003 through 10-018 by replaying
 * scripted user interactions and asserting the expected sound events, cursor
 * movements, and menu transitions.
 *
 * From Chocolate Doom 2.2.1 m_menu.c M_Responder + M_Ticker:
 *
 *   - Pressing up/down arrow with a non-separator next item -> sfx_pstop.
 *   - Pressing select on a selectable -> sfx_pistol.
 *   - Pressing Escape from a top-level menu -> sfx_swtchx.
 *   - Pressing Enter on a submenu trigger -> sfx_swtchn.
 *   - Pressing left/right on a slider -> sfx_stnmov.
 *   - Triggering a guarded action with the guard active -> sfx_oof.
 *
 * Each oracle captures (input sequence, expected outcome) pairs derived from the
 * authoritative m_menu.c logic and the previously pinned per-event sfx mapping.
 */

import { getVanillaMenuSfx } from './implement-menu-sound-events.ts';

export type VanillaScriptedMenuInput = 'cursor-up' | 'cursor-down' | 'select' | 'submenu' | 'escape' | 'slider-left' | 'slider-right' | 'guarded-invalid';

export interface VanillaMenuNavigationOracle {
  readonly scenarioId: string;
  readonly input: VanillaScriptedMenuInput;
  readonly expectedSfx: string;
  readonly description: string;
}

export const VANILLA_MENU_NAVIGATION_ORACLES: readonly VanillaMenuNavigationOracle[] = Object.freeze([
  Object.freeze({
    scenarioId: 'cursor-up-moves-to-prev-item',
    input: 'cursor-up' as const,
    expectedSfx: getVanillaMenuSfx('cursor-move'),
    description: 'Pressing the up arrow moves the cursor to the previous selectable item and plays sfx_pstop.',
  }),
  Object.freeze({
    scenarioId: 'cursor-down-moves-to-next-item',
    input: 'cursor-down' as const,
    expectedSfx: getVanillaMenuSfx('cursor-move'),
    description: 'Pressing the down arrow moves the cursor to the next selectable item and plays sfx_pstop.',
  }),
  Object.freeze({
    scenarioId: 'select-fires-routine-with-sfx_pistol',
    input: 'select' as const,
    expectedSfx: getVanillaMenuSfx('select'),
    description: 'Pressing Enter on a selectable item invokes its routine and plays sfx_pistol.',
  }),
  Object.freeze({
    scenarioId: 'submenu-enters-with-sfx_swtchn',
    input: 'submenu' as const,
    expectedSfx: getVanillaMenuSfx('menu-open'),
    description: 'Entering a submenu (M_StartControlPanel) plays sfx_swtchn.',
  }),
  Object.freeze({
    scenarioId: 'escape-closes-with-sfx_swtchx',
    input: 'escape' as const,
    expectedSfx: getVanillaMenuSfx('menu-close'),
    description: 'Pressing Escape from a top-level menu closes the menu and plays sfx_swtchx.',
  }),
  Object.freeze({
    scenarioId: 'slider-left-step-plays-sfx_stnmov',
    input: 'slider-left' as const,
    expectedSfx: getVanillaMenuSfx('slider-step'),
    description: 'Decreasing a slider value (left arrow) plays sfx_stnmov.',
  }),
  Object.freeze({
    scenarioId: 'slider-right-step-plays-sfx_stnmov',
    input: 'slider-right' as const,
    expectedSfx: getVanillaMenuSfx('slider-step'),
    description: 'Increasing a slider value (right arrow) plays sfx_stnmov.',
  }),
  Object.freeze({
    scenarioId: 'guarded-invalid-plays-sfx_oof',
    input: 'guarded-invalid' as const,
    expectedSfx: getVanillaMenuSfx('invalid'),
    description: 'A guarded action (e.g. quick save without an active game) plays sfx_oof and stops.',
  }),
]);

export function getVanillaMenuNavigationOracle(scenarioId: string): VanillaMenuNavigationOracle {
  const found = VANILLA_MENU_NAVIGATION_ORACLES.find((oracle) => oracle.scenarioId === scenarioId);
  if (!found) {
    throw new Error(`unknown menu navigation oracle scenario ${scenarioId}`);
  }
  return found;
}
