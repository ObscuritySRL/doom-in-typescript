import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

import { createFrontEndSequence } from '../../../src/ui/frontEndSequence.ts';
import { createMenuState, MenuKind, openMenu } from '../../../src/ui/menus.ts';
import { IMPLEMENT_LOAD_GAME_MENU_CONTRACT, implementLoadGameMenu } from '../../../src/playable/front-end-menus/implementLoadGameMenu.ts';

const SOURCE_FILE_URL = new URL('../../../src/playable/front-end-menus/implementLoadGameMenu.ts', import.meta.url);
const AUDIT_MANIFEST_URL = new URL('../../../plan_fps/manifests/01-008-audit-missing-launch-to-menu.json', import.meta.url);

describe('implementLoadGameMenu', () => {
  test('locks the exact Bun-only contract', () => {
    expect(IMPLEMENT_LOAD_GAME_MENU_CONTRACT).toEqual({
      auditManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
      entryMenu: MenuKind.Main,
      requiredMainMenuItemIndex: 2,
      runtimeCommand: 'bun run doom.ts',
      stepId: '07-013',
      stepTitle: 'implement-load-game-menu',
      transitionKey: 13,
      transitionMenu: MenuKind.Load,
    });
  });

  test('locks the source hash', async () => {
    const sourceText = await Bun.file(SOURCE_FILE_URL).text();
    const sourceHash = createHash('sha256').update(sourceText).digest('hex');

    expect(sourceHash).toBe('9351497803fbf43a101cb9f71c654f0af2deb4b03c4c8561f7cc5322991ff560');
  });

  test('locks the 01-008 audit linkage', async () => {
    const auditManifest = (await Bun.file(AUDIT_MANIFEST_URL).json()) as {
      readonly commandContracts: {
        readonly targetRuntime: {
          readonly value: string;
        };
      };
      readonly currentLauncher: {
        readonly menuStartImplemented: boolean;
      };
    };

    expect(auditManifest.commandContracts.targetRuntime.value).toBe(IMPLEMENT_LOAD_GAME_MENU_CONTRACT.runtimeCommand);
    expect(auditManifest.currentLauncher.menuStartImplemented).toBe(false);
  });

  test('opens the load menu and preserves deterministic replay state', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    frontEndSequenceState.inDemoPlayback = true;
    openMenu(menuState, MenuKind.Main);
    menuState.itemOn = IMPLEMENT_LOAD_GAME_MENU_CONTRACT.requiredMainMenuItemIndex;

    const result = implementLoadGameMenu({
      frontEndSequenceState,
      menuState,
      runtimeCommand: IMPLEMENT_LOAD_GAME_MENU_CONTRACT.runtimeCommand,
    });

    expect(result).toEqual({
      action: { kind: 'openMenu', target: MenuKind.Load },
      currentMenu: MenuKind.Load,
      inDemoPlayback: true,
      menuActive: true,
    });
    expect(menuState.active).toBe(true);
    expect(menuState.currentMenu).toBe(MenuKind.Load);
    expect(frontEndSequenceState.inDemoPlayback).toBe(true);
    expect(frontEndSequenceState.menuActive).toBe(true);
  });

  test('rejects the wrong runtime command', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    openMenu(menuState, MenuKind.Main);
    menuState.itemOn = IMPLEMENT_LOAD_GAME_MENU_CONTRACT.requiredMainMenuItemIndex;

    expect(() =>
      implementLoadGameMenu({
        frontEndSequenceState,
        menuState,
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('implementLoadGameMenu requires runtime command bun run doom.ts');
  });

  test('rejects the wrong main-menu selection', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    openMenu(menuState, MenuKind.Main);

    expect(() =>
      implementLoadGameMenu({
        frontEndSequenceState,
        menuState,
        runtimeCommand: IMPLEMENT_LOAD_GAME_MENU_CONTRACT.runtimeCommand,
      }),
    ).toThrow('implementLoadGameMenu requires the Load Game menu item');
  });
});
