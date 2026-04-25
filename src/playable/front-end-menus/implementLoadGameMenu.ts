import type { FrontEndSequenceState } from '../../ui/frontEndSequence.ts';
import type { MenuAction, MenuState } from '../../ui/menus.ts';

import { setMenuActive } from '../../ui/frontEndSequence.ts';
import { handleMenuKey, KEY_ENTER, MenuKind } from '../../ui/menus.ts';

export const IMPLEMENT_LOAD_GAME_MENU_CONTRACT = Object.freeze({
  auditManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
  entryMenu: MenuKind.Main,
  requiredMainMenuItemIndex: 2,
  runtimeCommand: 'bun run doom.ts',
  stepId: '07-013',
  stepTitle: 'implement-load-game-menu',
  transitionKey: KEY_ENTER,
  transitionMenu: MenuKind.Load,
});

export interface ImplementLoadGameMenuOptions {
  readonly frontEndSequenceState: FrontEndSequenceState;
  readonly menuState: MenuState;
  readonly runtimeCommand: string;
}

export interface ImplementLoadGameMenuResult {
  readonly action: MenuAction;
  readonly currentMenu: MenuKind.Load;
  readonly inDemoPlayback: boolean;
  readonly menuActive: true;
}

/**
 * Open the vanilla Load Game menu from the active Main-menu Load Game row.
 *
 * @param options Bun runtime command plus the live menu and front-end states.
 * @returns The emitted menu action together with the synchronized front-end replay/menu state.
 * @example
 * ```ts
 * import { createFrontEndSequence } from "../../ui/frontEndSequence.ts";
 * import { createMenuState, MenuKind, openMenu } from "../../ui/menus.ts";
 * import { implementLoadGameMenu } from "./implementLoadGameMenu.ts";
 *
 * const frontEndSequenceState = createFrontEndSequence("shareware");
 * const menuState = createMenuState();
 * openMenu(menuState, MenuKind.Main);
 * menuState.itemOn = 2;
 *
 * const result = implementLoadGameMenu({
 *   frontEndSequenceState,
 *   menuState,
 *   runtimeCommand: "bun run doom.ts",
 * });
 *
 * console.log(result.currentMenu);
 * ```
 */
export function implementLoadGameMenu(options: ImplementLoadGameMenuOptions): ImplementLoadGameMenuResult {
  if (options.runtimeCommand !== IMPLEMENT_LOAD_GAME_MENU_CONTRACT.runtimeCommand) {
    throw new Error('implementLoadGameMenu requires runtime command bun run doom.ts');
  }

  if (!options.menuState.active || options.menuState.currentMenu !== MenuKind.Main) {
    throw new Error('implementLoadGameMenu requires the active Main menu');
  }

  if (options.menuState.itemOn !== IMPLEMENT_LOAD_GAME_MENU_CONTRACT.requiredMainMenuItemIndex) {
    throw new Error('implementLoadGameMenu requires the Load Game menu item');
  }

  const action = handleMenuKey(options.menuState, IMPLEMENT_LOAD_GAME_MENU_CONTRACT.transitionKey);
  if (action.kind !== 'openMenu' || action.target !== MenuKind.Load) {
    throw new Error('implementLoadGameMenu failed to open the Load menu');
  }

  setMenuActive(options.frontEndSequenceState, true);

  return Object.freeze({
    action,
    currentMenu: MenuKind.Load,
    inDemoPlayback: options.frontEndSequenceState.inDemoPlayback,
    menuActive: true,
  });
}
