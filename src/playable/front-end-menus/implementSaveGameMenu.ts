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

export function implementSaveGameMenu(options: ImplementSaveGameMenuOptions): ImplementSaveGameMenuResult {
  if (options.command !== REQUIRED_RUNTIME_COMMAND) {
    throw new Error('implementSaveGameMenu requires the exact Bun runtime command "bun run doom.ts".');
  }

  if (!options.menu.active || options.menu.currentMenu !== MenuKind.Main || options.menu.itemOn !== MAIN_MENU_SAVE_GAME_INDEX) {
    throw new Error('implementSaveGameMenu requires the active Main menu Save Game selection.');
  }

  const demoPlaybackActive = options.frontEndSequence.inDemoPlayback;
  const action = handleMenuKey(options.menu, KEY_ENTER);

  if (action.kind !== 'openMenu' || action.target !== MenuKind.Save) {
    throw new Error('Save Game activation failed to open the Save menu.');
  }

  setMenuActive(options.frontEndSequence, options.menu.active);

  if (!options.frontEndSequence.menuActive) {
    throw new Error('Save Game activation must keep the front-end menu overlay active.');
  }

  return Object.freeze({
    action: Object.freeze({ kind: 'openMenu', target: MenuKind.Save } as const),
    currentMenu: MenuKind.Save,
    demoPlaybackActive,
    menuActive: true,
  });
}
