import { setMenuActive } from '../../ui/frontEndSequence.ts';
import type { FrontEndSequenceState } from '../../ui/frontEndSequence.ts';
import { MENU_TREE, MenuKind, openMenu } from '../../ui/menus.ts';
import type { MenuState } from '../../ui/menus.ts';

const REQUIRED_RUNTIME_COMMAND = 'bun run doom.ts';

const MAIN_MENU_LUMP_NAMES = Object.freeze(MENU_TREE[MenuKind.Main].items.map((item) => item.lump));

export const IMPLEMENT_MAIN_MENU_CONTRACT = Object.freeze({
  entryFile: 'doom.ts',
  feature: 'implement-main-menu',
  menuKind: MenuKind.Main,
  preservesDeterministicReplay: true,
  runtime: 'bun',
  runtimeCommand: REQUIRED_RUNTIME_COMMAND,
  subcommand: 'run',
  syncsFrontEndMenuActive: true,
} as const);

export interface ImplementMainMenuOptions {
  readonly frontEnd: FrontEndSequenceState;
  readonly menu: MenuState;
  readonly runtimeCommand: string;
}

export interface ImplementMainMenuResult {
  readonly itemCount: number;
  readonly itemOn: number;
  readonly kind: 'mainMenuReady';
  readonly menuActive: true;
  readonly menuKind: MenuKind.Main;
  readonly menuLumpNames: readonly string[];
  readonly preservesDeterministicReplay: true;
}

function assertRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== REQUIRED_RUNTIME_COMMAND) {
    throw new Error(`implementMainMenu requires ${REQUIRED_RUNTIME_COMMAND}`);
  }
}

/**
 * Open the vanilla main menu through the Bun runtime path and keep the
 * front-end overlay state synchronized without mutating demo playback.
 */
export function implementMainMenu(options: ImplementMainMenuOptions): ImplementMainMenuResult {
  assertRuntimeCommand(options.runtimeCommand);

  openMenu(options.menu, MenuKind.Main);
  setMenuActive(options.frontEnd, true);

  return Object.freeze({
    itemCount: MENU_TREE[MenuKind.Main].items.length,
    itemOn: options.menu.itemOn,
    kind: 'mainMenuReady',
    menuActive: true,
    menuKind: MenuKind.Main,
    menuLumpNames: MAIN_MENU_LUMP_NAMES,
    preservesDeterministicReplay: true,
  });
}
