import { expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import { createFrontEndSequence, FRONTEND_KEY_HELP } from '../../../src/ui/frontEndSequence.ts';
import { createMenuState, MenuKind, openMenu } from '../../../src/ui/menus.ts';
import { IMPLEMENT_READ_THIS_HELP_PAGES_RUNTIME_CONTRACT, implementReadThisHelpPages } from '../../../src/playable/front-end-menus/implementReadThisHelpPages.ts';

const IMPLEMENT_READ_THIS_HELP_PAGES_SOURCE_URL = new URL('../../../src/playable/front-end-menus/implementReadThisHelpPages.ts', import.meta.url);

function createMainMenuReadThisState() {
  const menuState = createMenuState();
  openMenu(menuState, MenuKind.Main);
  menuState.itemOn = IMPLEMENT_READ_THIS_HELP_PAGES_RUNTIME_CONTRACT.mainMenuReadThisIndex;
  return menuState;
}

test('locks the exact Bun runtime contract for Read This help pages', () => {
  expect(IMPLEMENT_READ_THIS_HELP_PAGES_RUNTIME_CONTRACT).toEqual({
    auditStepId: '01-008',
    entryLumpToMenuKind: {
      HELP: MenuKind.ReadThis1,
      HELP1: MenuKind.ReadThis2,
      HELP2: MenuKind.ReadThis1,
    },
    frontEndHelpKey: FRONTEND_KEY_HELP,
    mainMenuReadThisIndex: 4,
    operationOrder: ['advanceCurrentPage', 'openFromFrontEndHelpKey', 'openFromMainMenuSelection'],
    runtimeCommand: 'bun run doom.ts',
    stepId: '07-014',
  });
});

test('locks the implementReadThisHelpPages source hash', async () => {
  const sourceText = await Bun.file(IMPLEMENT_READ_THIS_HELP_PAGES_SOURCE_URL).text();
  const sourceHash = createHash('sha256').update(sourceText).digest('hex');

  expect(sourceHash).toBe('51e8a6e0abb2b821a2a991c2d2ee735837d15fb5b10127ae7ea488738edd206c');
});

test('opens the retail Read This page from the front-end help key without disturbing demo playback', () => {
  const frontEnd = createFrontEndSequence('retail');
  const menuState = createMenuState();

  frontEnd.inDemoPlayback = true;

  const result = implementReadThisHelpPages({
    frontEnd,
    gameMode: 'retail',
    menu: menuState,
    operation: 'openFromFrontEndHelpKey',
    runtimeCommand: 'bun run doom.ts',
  });

  expect(result).toEqual({
    action: { kind: 'openHelp', lump: 'HELP1' },
    displayedLump: 'HELP1',
    menuActive: true,
    menuKind: MenuKind.ReadThis2,
    preservedDemoPlayback: true,
  });
  expect(menuState.active).toBe(true);
  expect(menuState.currentMenu).toBe(MenuKind.ReadThis2);
  expect(frontEnd.inDemoPlayback).toBe(true);
  expect(frontEnd.menuActive).toBe(true);
});

test('opens the first Read This page from the Main menu selection', () => {
  const frontEnd = createFrontEndSequence('shareware');
  const menuState = createMainMenuReadThisState();

  frontEnd.inDemoPlayback = true;

  const result = implementReadThisHelpPages({
    frontEnd,
    gameMode: 'shareware',
    menu: menuState,
    operation: 'openFromMainMenuSelection',
    runtimeCommand: 'bun run doom.ts',
  });

  expect(result).toEqual({
    action: { kind: 'openMenu', target: MenuKind.ReadThis1 },
    displayedLump: 'HELP2',
    menuActive: true,
    menuKind: MenuKind.ReadThis1,
    preservedDemoPlayback: true,
  });
  expect(menuState.active).toBe(true);
  expect(menuState.currentMenu).toBe(MenuKind.ReadThis1);
  expect(frontEnd.menuActive).toBe(true);
});

test('advances the first Read This page to the second page', () => {
  const frontEnd = createFrontEndSequence('shareware');
  const menuState = createMenuState();

  openMenu(menuState, MenuKind.ReadThis1);
  frontEnd.menuActive = true;

  const result = implementReadThisHelpPages({
    frontEnd,
    gameMode: 'shareware',
    menu: menuState,
    operation: 'advanceCurrentPage',
    runtimeCommand: 'bun run doom.ts',
  });

  expect(result).toEqual({
    action: { kind: 'openMenu', target: MenuKind.ReadThis2 },
    displayedLump: 'HELP1',
    menuActive: true,
    menuKind: MenuKind.ReadThis2,
    preservedDemoPlayback: true,
  });
  expect(menuState.currentMenu).toBe(MenuKind.ReadThis2);
});

test('emits readThisAdvance from the final Read This page', () => {
  const frontEnd = createFrontEndSequence('shareware');
  const menuState = createMenuState();

  openMenu(menuState, MenuKind.ReadThis2);
  frontEnd.menuActive = true;

  const result = implementReadThisHelpPages({
    frontEnd,
    gameMode: 'shareware',
    menu: menuState,
    operation: 'advanceCurrentPage',
    runtimeCommand: 'bun run doom.ts',
  });

  expect(result).toEqual({
    action: { kind: 'readThisAdvance' },
    displayedLump: 'HELP1',
    menuActive: true,
    menuKind: MenuKind.ReadThis2,
    preservedDemoPlayback: true,
  });
  expect(menuState.currentMenu).toBe(MenuKind.ReadThis2);
});

test('rejects any runtime command other than bun run doom.ts', () => {
  expect(() =>
    implementReadThisHelpPages({
      frontEnd: createFrontEndSequence('shareware'),
      gameMode: 'shareware',
      menu: createMenuState(),
      operation: 'openFromFrontEndHelpKey',
      runtimeCommand: 'bun run src/main.ts',
    }),
  ).toThrow('implementReadThisHelpPages requires bun run doom.ts; received bun run src/main.ts.');
});
