import { setMenuActive } from '../../ui/frontEndSequence.ts';
import type { FrontEndSequenceState } from '../../ui/frontEndSequence.ts';
import { KEY_ENTER, MenuKind, handleMenuKey } from '../../ui/menus.ts';
import type { MenuAction, MenuState } from '../../ui/menus.ts';

export const IMPLEMENT_OPTIONS_MENU_CONTRACT = Object.freeze({
  auditManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
  command: 'bun run doom.ts',
  mainMenuKind: MenuKind.Main,
  mainMenuOptionsIndex: 1,
  stepId: '07-008',
  stepTitle: 'implement-options-menu',
  targetMenuKind: MenuKind.Options,
} as const);

export interface ImplementOptionsMenuOptions {
  readonly frontEndSequenceState: FrontEndSequenceState;
  readonly menuState: MenuState;
  readonly runtimeCommand: string;
}

export interface ImplementOptionsMenuResult {
  readonly action: Extract<MenuAction, { readonly kind: 'openMenu' }>;
  readonly command: typeof IMPLEMENT_OPTIONS_MENU_CONTRACT.command;
  readonly currentMenu: MenuKind.Options;
  readonly inDemoPlayback: boolean;
  readonly itemOn: number;
  readonly kind: 'optionsMenu';
  readonly menuActive: true;
  readonly previousMenu: MenuKind.Main;
}

/**
 * Open the Options menu from the active Main menu through the vanilla menu responder path.
 *
 * @param options Runtime command and mutable front-end/menu state that must already be positioned on Main -> Options.
 * @returns The frozen Options-menu transition result after `menus.ts` handles `KEY_ENTER`.
 * @example
 * ```ts
 * import { createFrontEndSequence } from '../../ui/frontEndSequence.ts';
 * import { MenuKind, createMenuState, openMenu } from '../../ui/menus.ts';
 * import { implementOptionsMenu } from './implementOptionsMenu.ts';
 *
 * const menuState = createMenuState();
 * openMenu(menuState, MenuKind.Main);
 * menuState.itemOn = 1;
 *
 * const frontEndSequenceState = createFrontEndSequence('shareware');
 * const result = implementOptionsMenu({
 *   frontEndSequenceState,
 *   menuState,
 *   runtimeCommand: 'bun run doom.ts',
 * });
 *
 * console.log(result.currentMenu); // "options"
 * ```
 */
export function implementOptionsMenu(options: ImplementOptionsMenuOptions): ImplementOptionsMenuResult {
  if (options.runtimeCommand !== IMPLEMENT_OPTIONS_MENU_CONTRACT.command) {
    throw new Error('Implement options menu requires `bun run doom.ts`.');
  }

  if (!options.menuState.active || options.menuState.currentMenu !== MenuKind.Main) {
    throw new Error('Implement options menu requires the active Main menu.');
  }

  if (options.menuState.itemOn !== IMPLEMENT_OPTIONS_MENU_CONTRACT.mainMenuOptionsIndex) {
    throw new Error('Implement options menu requires the Main menu Options selection.');
  }

  const previousMenu = options.menuState.currentMenu;
  const menuAction = handleMenuKey(options.menuState, KEY_ENTER);

  if (menuAction.kind !== 'openMenu' || menuAction.target !== MenuKind.Options) {
    throw new Error('Implement options menu failed to open the Options menu.');
  }

  setMenuActive(options.frontEndSequenceState, options.menuState.active);

  return Object.freeze({
    action: menuAction,
    command: IMPLEMENT_OPTIONS_MENU_CONTRACT.command,
    currentMenu: MenuKind.Options,
    inDemoPlayback: options.frontEndSequenceState.inDemoPlayback,
    itemOn: options.menuState.itemOn,
    kind: 'optionsMenu',
    menuActive: true,
    previousMenu,
  });
}
