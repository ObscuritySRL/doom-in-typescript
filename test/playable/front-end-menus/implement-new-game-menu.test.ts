import { expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import { IMPLEMENT_NEW_GAME_MENU_CONTRACT, implementNewGameMenu } from '../../../src/playable/front-end-menus/implementNewGameMenu.ts';
import { createFrontEndSequence } from '../../../src/ui/frontEndSequence.ts';
import { createMenuState, MenuKind, openMenu } from '../../../src/ui/menus.ts';

interface AuditManifest {
  readonly audit: {
    readonly stepId: string;
  };
  readonly explicitNullSurfaces: readonly {
    readonly reason: string;
    readonly surface: string;
  }[];
}

const EXPECTED_CONTRACT = Object.freeze({
  auditManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
  requiredCurrentMenu: MenuKind.Main,
  requiredSelectedItemIndex: 0,
  runtimeCommand: 'bun run doom.ts',
  stepId: '07-005',
  stepSlug: 'implement-new-game-menu',
  transitionKey: 13,
  transitionTargetMenu: MenuKind.Episode,
} as const);

const EXPECTED_SOURCE_HASH = '8f521e7d734733044b3f710ffd4a8d511941a73ac7f5b56ca5352d6d55f5c650';

const auditManifestPath = new URL('../../../plan_fps/manifests/01-008-audit-missing-launch-to-menu.json', import.meta.url);
const sourceFilePath = new URL('../../../src/playable/front-end-menus/implementNewGameMenu.ts', import.meta.url);

const auditManifestText = await Bun.file(auditManifestPath).text();
const auditManifest = JSON.parse(auditManifestText) as AuditManifest;
const sourceHash = createHash('sha256')
  .update(await Bun.file(sourceFilePath).text())
  .digest('hex');

test('locks the exact Bun runtime contract', () => {
  expect(IMPLEMENT_NEW_GAME_MENU_CONTRACT).toEqual(EXPECTED_CONTRACT);
});

test('locks the source hash', () => {
  expect(sourceHash).toBe(EXPECTED_SOURCE_HASH);
});

test('locks the 01-008 launch-to-menu audit linkage', () => {
  expect(auditManifest.audit.stepId).toBe('01-008');
  expect(auditManifest.explicitNullSurfaces.some((surface) => surface.surface === 'launch-to-menu-transition' && surface.reason === 'No allowed file exposes a title/menu startup route before gameplay.')).toBe(true);
});

test('opens the Episode menu from the active New Game selection and preserves demo playback state', () => {
  const frontEndSequence = createFrontEndSequence('shareware');
  const menu = createMenuState();

  frontEndSequence.inDemoPlayback = true;
  openMenu(menu, MenuKind.Main);

  const result = implementNewGameMenu({
    frontEndSequence,
    menu,
    runtimeCommand: IMPLEMENT_NEW_GAME_MENU_CONTRACT.runtimeCommand,
  });

  expect(result).toEqual({
    currentMenu: MenuKind.Episode,
    frontEndMenuActive: true,
    menuAction: { kind: 'openMenu', target: MenuKind.Episode },
    menuActive: true,
    menuItemIndex: 0,
    preservedDemoPlayback: true,
  });
  expect(menu.currentMenu).toBe(MenuKind.Episode);
  expect(menu.itemOn).toBe(0);
  expect(frontEndSequence.menuActive).toBe(true);
  expect(frontEndSequence.inDemoPlayback).toBe(true);
});

test('rejects unsupported runtime commands', () => {
  const frontEndSequence = createFrontEndSequence('shareware');
  const menu = createMenuState();

  openMenu(menu, MenuKind.Main);

  expect(() =>
    implementNewGameMenu({
      frontEndSequence,
      menu,
      runtimeCommand: 'bun run src/main.ts',
    }),
  ).toThrow("implementNewGameMenu only supports 'bun run doom.ts'.");
});

test('rejects non-New-Game menu selections', () => {
  const frontEndSequence = createFrontEndSequence('shareware');
  const menu = createMenuState();

  openMenu(menu, MenuKind.Main);
  menu.itemOn = 1;

  expect(() =>
    implementNewGameMenu({
      frontEndSequence,
      menu,
      runtimeCommand: IMPLEMENT_NEW_GAME_MENU_CONTRACT.runtimeCommand,
    }),
  ).toThrow('implementNewGameMenu requires an active Main menu with the New Game item selected.');
});
