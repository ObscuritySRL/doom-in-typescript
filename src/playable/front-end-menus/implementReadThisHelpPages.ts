import type { GameMode } from '../../bootstrap/gameMode.ts';
import type { FrontEndKeyAction, FrontEndSequenceState, HelpLump } from '../../ui/frontEndSequence.ts';
import type { MenuAction, MenuState } from '../../ui/menus.ts';

import { FRONTEND_KEY_HELP, getInitialHelpLump, handleFrontEndKey, setMenuActive } from '../../ui/frontEndSequence.ts';
import { handleMenuKey, KEY_ENTER, MenuKind, openMenu } from '../../ui/menus.ts';

export const IMPLEMENT_READ_THIS_HELP_PAGES_RUNTIME_CONTRACT = Object.freeze({
  auditStepId: '01-008',
  entryLumpToMenuKind: Object.freeze({
    HELP: MenuKind.ReadThis1,
    HELP1: MenuKind.ReadThis2,
    HELP2: MenuKind.ReadThis1,
  }),
  frontEndHelpKey: FRONTEND_KEY_HELP,
  mainMenuReadThisIndex: 4,
  operationOrder: Object.freeze(['advanceCurrentPage', 'openFromFrontEndHelpKey', 'openFromMainMenuSelection'] as const),
  runtimeCommand: 'bun run doom.ts',
  stepId: '07-014',
});

export type ReadThisHelpPagesOperation = 'advanceCurrentPage' | 'openFromFrontEndHelpKey' | 'openFromMainMenuSelection';

export interface ImplementReadThisHelpPagesOptions {
  readonly frontEnd: FrontEndSequenceState;
  readonly gameMode: GameMode;
  readonly menu: MenuState;
  readonly operation: ReadThisHelpPagesOperation;
  readonly runtimeCommand: string;
}

export interface ReadThisHelpPagesResult {
  readonly action: FrontEndKeyAction | MenuAction;
  readonly displayedLump: HelpLump;
  readonly menuActive: boolean;
  readonly menuKind: MenuKind.ReadThis1 | MenuKind.ReadThis2;
  readonly preservedDemoPlayback: boolean;
}

function assertRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== IMPLEMENT_READ_THIS_HELP_PAGES_RUNTIME_CONTRACT.runtimeCommand) {
    throw new Error(`implementReadThisHelpPages requires ${IMPLEMENT_READ_THIS_HELP_PAGES_RUNTIME_CONTRACT.runtimeCommand}; received ${runtimeCommand}.`);
  }
}

function isReadThisMenuKind(menuKind: MenuKind): menuKind is MenuKind.ReadThis1 | MenuKind.ReadThis2 {
  return menuKind === MenuKind.ReadThis1 || menuKind === MenuKind.ReadThis2;
}

function resolveDisplayedLump(gameMode: GameMode, menuKind: MenuKind.ReadThis1 | MenuKind.ReadThis2): HelpLump {
  if (menuKind === MenuKind.ReadThis2) {
    return 'HELP1';
  }

  return getInitialHelpLump(gameMode);
}

function resolveEntryMenuKind(lump: HelpLump): MenuKind.ReadThis1 | MenuKind.ReadThis2 {
  return IMPLEMENT_READ_THIS_HELP_PAGES_RUNTIME_CONTRACT.entryLumpToMenuKind[lump];
}

function createResult(action: FrontEndKeyAction | MenuAction, frontEnd: FrontEndSequenceState, gameMode: GameMode, menuKind: MenuKind.ReadThis1 | MenuKind.ReadThis2, startingDemoPlayback: boolean): ReadThisHelpPagesResult {
  return {
    action,
    displayedLump: resolveDisplayedLump(gameMode, menuKind),
    menuActive: frontEnd.menuActive,
    menuKind,
    preservedDemoPlayback: frontEnd.inDemoPlayback === startingDemoPlayback,
  };
}

function openFromFrontEndHelpKey(options: ImplementReadThisHelpPagesOptions): ReadThisHelpPagesResult {
  const startingDemoPlayback = options.frontEnd.inDemoPlayback;
  const action = handleFrontEndKey(options.frontEnd, IMPLEMENT_READ_THIS_HELP_PAGES_RUNTIME_CONTRACT.frontEndHelpKey);

  if (action.kind !== 'openHelp') {
    throw new Error('Read This help pages require the front-end help key to open a help page.');
  }

  const menuKind = resolveEntryMenuKind(action.lump);
  openMenu(options.menu, menuKind);
  setMenuActive(options.frontEnd, true);

  return createResult(action, options.frontEnd, options.gameMode, menuKind, startingDemoPlayback);
}

function openFromMainMenuSelection(options: ImplementReadThisHelpPagesOptions): ReadThisHelpPagesResult {
  const startingDemoPlayback = options.frontEnd.inDemoPlayback;

  if (!options.menu.active || options.menu.currentMenu !== MenuKind.Main) {
    throw new Error('Read This help pages require the active Main menu.');
  }

  if (options.menu.itemOn !== IMPLEMENT_READ_THIS_HELP_PAGES_RUNTIME_CONTRACT.mainMenuReadThisIndex) {
    throw new Error('Read This help pages require the Main menu Read This selection.');
  }

  const action = handleMenuKey(options.menu, KEY_ENTER);

  if (action.kind !== 'openMenu' || action.target !== MenuKind.ReadThis1) {
    throw new Error('Read This selection did not open the first Read This menu.');
  }

  setMenuActive(options.frontEnd, true);

  return createResult(action, options.frontEnd, options.gameMode, MenuKind.ReadThis1, startingDemoPlayback);
}

function advanceCurrentPage(options: ImplementReadThisHelpPagesOptions): ReadThisHelpPagesResult {
  const startingDemoPlayback = options.frontEnd.inDemoPlayback;

  if (!options.menu.active || !isReadThisMenuKind(options.menu.currentMenu)) {
    throw new Error('Read This help pages can only advance from an active Read This menu.');
  }

  const startingMenuKind = options.menu.currentMenu;
  const action = handleMenuKey(options.menu, KEY_ENTER);

  if (startingMenuKind === MenuKind.ReadThis1) {
    if (action.kind !== 'openMenu' || action.target !== MenuKind.ReadThis2) {
      throw new Error('The first Read This page did not advance to the second Read This menu.');
    }

    setMenuActive(options.frontEnd, true);

    return createResult(action, options.frontEnd, options.gameMode, MenuKind.ReadThis2, startingDemoPlayback);
  }

  if (action.kind !== 'readThisAdvance') {
    throw new Error('The final Read This page did not emit the readThisAdvance action.');
  }

  setMenuActive(options.frontEnd, true);

  return createResult(action, options.frontEnd, options.gameMode, MenuKind.ReadThis2, startingDemoPlayback);
}

export function implementReadThisHelpPages(options: ImplementReadThisHelpPagesOptions): ReadThisHelpPagesResult {
  assertRuntimeCommand(options.runtimeCommand);

  switch (options.operation) {
    case 'advanceCurrentPage':
      return advanceCurrentPage(options);
    case 'openFromFrontEndHelpKey':
      return openFromFrontEndHelpKey(options);
    case 'openFromMainMenuSelection':
      return openFromMainMenuSelection(options);
  }
}
