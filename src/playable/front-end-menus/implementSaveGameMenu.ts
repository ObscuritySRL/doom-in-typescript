import type { FrontEndSequenceState } from '../../ui/frontEndSequence.ts';
import type { MenuState } from '../../ui/menus.ts';

import { setMenuActive } from '../../ui/frontEndSequence.ts';
import { handleMenuKey, KEY_ENTER, MenuKind } from '../../ui/menus.ts';

export const MAIN_MENU_SAVE_GAME_INDEX = 3;
export const REQUIRED_RUNTIME_COMMAND = 'bun run doom.ts';

export const IMPLEMENT_SAVE_GAME_MENU_CONTRACT = Object.freeze({
  audit: Object.freeze({
    launchToMenuManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
    launchToMenuStepId: '01-008',
  }),
  menu: Object.freeze({
    activationKey: 'KEY_ENTER',
    requiredCurrentMenu: MenuKind.Main,
    requiredItemIndex: MAIN_MENU_SAVE_GAME_INDEX,
    requiredItemLump: 'M_SAVEG',
    transitionTarget: MenuKind.Save,
  }),
  runtime: Object.freeze({
    command: REQUIRED_RUNTIME_COMMAND,
    menuActiveAfterTransition: true,
  }),
} as const);

const SAVE_MENU_TRANSITION_ACTION = Object.freeze({
  kind: 'openMenu' as const,
  target: MenuKind.Save as const,
});

export interface ImplementSaveGameMenuOptions {
  readonly command: string;
  readonly frontEndSequence: FrontEndSequenceState;
  readonly menu: MenuState;
}

export interface ImplementSaveGameMenuResult {
  readonly action: {
    readonly kind: 'openMenu';
    readonly target: MenuKind.Save;
  };
  readonly currentMenu: MenuKind.Save;
  readonly demoPlaybackActive: boolean;
  readonly menuActive: true;
}

/**
 * Open the vanilla Save Game menu from the active Main-menu Save Game row.
 *
 * Validates the Bun runtime contract and the Main menu's active Save Game
 * selection (item index 3, lump M_SAVEG), captures `inDemoPlayback` for
 * deterministic replay observers, then dispatches KEY_ENTER through
 * {@link handleMenuKey} so the menu state machine transitions to
 * {@link MenuKind.Save}. Mirrors vanilla m_menu.c's `M_SaveGame` →
 * `M_SetupNextMenu(&SaveDef)` transition (file I/O and `usergame` /
 * `gamestate` guards are out of scope for this menu-navigation step).
 * Synchronizes the front-end sequencer's menu-active gate so the attract
 * loop continues to suppress advance-demo keystrokes while the Save
 * overlay is consuming them.
 *
 * @param options Bun runtime command plus the live menu and front-end states.
 * @returns The dispatched menu action together with the synchronized post-transition state.
 * @example
 * ```ts
 * import { createFrontEndSequence } from "../../ui/frontEndSequence.ts";
 * import { createMenuState, MenuKind, openMenu } from "../../ui/menus.ts";
 * import { implementSaveGameMenu } from "./implementSaveGameMenu.ts";
 *
 * const frontEndSequence = createFrontEndSequence("shareware");
 * const menu = createMenuState();
 * openMenu(menu, MenuKind.Main);
 * menu.itemOn = 3;
 *
 * const result = implementSaveGameMenu({
 *   command: "bun run doom.ts",
 *   frontEndSequence,
 *   menu,
 * });
 *
 * console.log(result.currentMenu); // "save"
 * ```
 */
export function implementSaveGameMenu(options: ImplementSaveGameMenuOptions): ImplementSaveGameMenuResult {
  if (options.command !== REQUIRED_RUNTIME_COMMAND) {
    throw new Error('implementSaveGameMenu requires the exact Bun runtime command "bun run doom.ts".');
  }

  if (!options.menu.active || options.menu.currentMenu !== MenuKind.Main || options.menu.itemOn !== MAIN_MENU_SAVE_GAME_INDEX) {
    throw new Error('implementSaveGameMenu requires the active Main menu Save Game selection.');
  }

  const demoPlaybackActive = options.frontEndSequence.inDemoPlayback;
  const dispatched = handleMenuKey(options.menu, KEY_ENTER);

  if (dispatched.kind !== 'openMenu' || dispatched.target !== MenuKind.Save) {
    throw new Error('Save Game activation failed to open the Save menu.');
  }

  setMenuActive(options.frontEndSequence, true);

  return Object.freeze({
    action: SAVE_MENU_TRANSITION_ACTION,
    currentMenu: MenuKind.Save,
    demoPlaybackActive,
    menuActive: true,
  });
}
