import { KEY_ENTER, MenuKind, handleMenuKey } from '../../ui/menus.ts';
import type { MenuAction, MenuState } from '../../ui/menus.ts';
import { setMenuActive } from '../../ui/frontEndSequence.ts';
import type { FrontEndSequenceState } from '../../ui/frontEndSequence.ts';

const RUNTIME_COMMAND = 'bun run doom.ts';
const STEP_ID = '07-005';
const STEP_SLUG = 'implement-new-game-menu';

type OpenMenuAction = Extract<MenuAction, { readonly kind: 'openMenu' }>;

export const IMPLEMENT_NEW_GAME_MENU_CONTRACT = Object.freeze({
  auditManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
  requiredCurrentMenu: MenuKind.Main,
  requiredSelectedItemIndex: 0,
  runtimeCommand: RUNTIME_COMMAND,
  stepId: STEP_ID,
  stepSlug: STEP_SLUG,
  transitionKey: KEY_ENTER,
  transitionTargetMenu: MenuKind.Episode,
} as const);

export interface ImplementNewGameMenuOptions {
  readonly frontEndSequence: FrontEndSequenceState;
  readonly menu: MenuState;
  readonly runtimeCommand: string;
}

export interface ImplementNewGameMenuResult {
  readonly currentMenu: MenuKind.Episode;
  readonly frontEndMenuActive: boolean;
  readonly menuAction: OpenMenuAction;
  readonly menuActive: boolean;
  readonly menuItemIndex: number;
  readonly preservedDemoPlayback: boolean;
}

function assertRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== IMPLEMENT_NEW_GAME_MENU_CONTRACT.runtimeCommand) {
    throw new Error(`implementNewGameMenu only supports '${RUNTIME_COMMAND}'.`);
  }
}

function assertMainMenuSelection(menu: MenuState): void {
  if (!menu.active) {
    throw new Error('implementNewGameMenu requires the menu to be active.');
  }

  if (menu.currentMenu !== IMPLEMENT_NEW_GAME_MENU_CONTRACT.requiredCurrentMenu || menu.itemOn !== IMPLEMENT_NEW_GAME_MENU_CONTRACT.requiredSelectedItemIndex) {
    throw new Error('implementNewGameMenu requires an active Main menu with the New Game item selected.');
  }
}

function assertEpisodeMenuAction(menuAction: MenuAction): asserts menuAction is OpenMenuAction {
  if (menuAction.kind !== 'openMenu' || menuAction.target !== IMPLEMENT_NEW_GAME_MENU_CONTRACT.transitionTargetMenu) {
    throw new Error('implementNewGameMenu expected the New Game selection to open the Episode menu.');
  }
}

/**
 * Route the active Main-menu New Game selection into the Episode menu.
 *
 * @param options Bun-runtime, front-end, and menu state required for the transition.
 * @returns The exact menu transition result while preserving demo playback state.
 * @example
 * ```ts
 * const result = implementNewGameMenu({
 *   frontEndSequence,
 *   menu,
 *   runtimeCommand: 'bun run doom.ts',
 * });
 * ```
 */
export function implementNewGameMenu(options: ImplementNewGameMenuOptions): ImplementNewGameMenuResult {
  assertRuntimeCommand(options.runtimeCommand);
  assertMainMenuSelection(options.menu);

  const menuAction = handleMenuKey(options.menu, IMPLEMENT_NEW_GAME_MENU_CONTRACT.transitionKey);
  assertEpisodeMenuAction(menuAction);
  setMenuActive(options.frontEndSequence, options.menu.active);

  return Object.freeze({
    currentMenu: MenuKind.Episode,
    frontEndMenuActive: options.frontEndSequence.menuActive,
    menuAction,
    menuActive: options.menu.active,
    menuItemIndex: options.menu.itemOn,
    preservedDemoPlayback: options.frontEndSequence.inDemoPlayback,
  });
}
