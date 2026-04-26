import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import { createFrontEndSequence } from '../../../src/ui/frontEndSequence.ts';
import { MenuKind, createMenuState, openMenu } from '../../../src/ui/menus.ts';
import { IMPLEMENT_OPTIONS_MENU_CONTRACT, implementOptionsMenu } from '../../../src/playable/front-end-menus/implementOptionsMenu.ts';

const IMPLEMENT_OPTIONS_MENU_SOURCE_PATH = new URL('../../../src/playable/front-end-menus/implementOptionsMenu.ts', import.meta.url);
const LAUNCH_TO_MENU_AUDIT_PATH = new URL('../../../plan_fps/manifests/01-008-audit-missing-launch-to-menu.json', import.meta.url);

describe('implementOptionsMenu', () => {
  test('locks the exact runtime contract and launch-to-menu audit linkage', async () => {
    const launchToMenuAudit = (await Bun.file(LAUNCH_TO_MENU_AUDIT_PATH).json()) as {
      readonly commandContracts: {
        readonly targetRuntime: {
          readonly value: string;
        };
      };
      readonly currentLauncher: {
        readonly menuStartImplemented: boolean;
      };
    };

    expect(IMPLEMENT_OPTIONS_MENU_CONTRACT).toEqual({
      auditManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
      command: 'bun run doom.ts',
      mainMenuKind: MenuKind.Main,
      mainMenuOptionsIndex: 1,
      stepId: '07-008',
      stepTitle: 'implement-options-menu',
      targetMenuKind: MenuKind.Options,
    });
    expect(launchToMenuAudit.commandContracts.targetRuntime.value).toBe(IMPLEMENT_OPTIONS_MENU_CONTRACT.command);
    expect(launchToMenuAudit.currentLauncher.menuStartImplemented).toBe(false);
  });

  test('locks the implementation source hash', async () => {
    const sourceText = await Bun.file(IMPLEMENT_OPTIONS_MENU_SOURCE_PATH).text();
    const sourceHash = createHash('sha256').update(sourceText).digest('hex');

    expect(sourceHash).toBe('00f366c0d9f7e4453936bbd5a1a91202803fb65a182ecb81643fe18313268639');
  });

  test('opens the options menu from the active main-menu selection and preserves demo playback state', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    frontEndSequenceState.inDemoPlayback = true;

    const menuState = createMenuState();
    openMenu(menuState, MenuKind.Main);
    menuState.itemOn = IMPLEMENT_OPTIONS_MENU_CONTRACT.mainMenuOptionsIndex;

    const result = implementOptionsMenu({
      frontEndSequenceState,
      menuState,
      runtimeCommand: IMPLEMENT_OPTIONS_MENU_CONTRACT.command,
    });

    expect(result).toEqual({
      action: { kind: 'openMenu', target: MenuKind.Options },
      command: 'bun run doom.ts',
      currentMenu: MenuKind.Options,
      inDemoPlayback: true,
      itemOn: 0,
      kind: 'optionsMenu',
      menuActive: true,
      previousMenu: MenuKind.Main,
    });
    expect(menuState.currentMenu).toBe(MenuKind.Options);
    expect(frontEndSequenceState.menuActive).toBe(true);
    expect(frontEndSequenceState.inDemoPlayback).toBe(true);
  });

  test('rejects a non-Bun runtime command', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();
    openMenu(menuState, MenuKind.Main);
    menuState.itemOn = IMPLEMENT_OPTIONS_MENU_CONTRACT.mainMenuOptionsIndex;

    expect(() =>
      implementOptionsMenu({
        frontEndSequenceState,
        menuState,
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('Implement options menu requires `bun run doom.ts`.');
  });

  test('rejects the wrong main-menu selection', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();
    openMenu(menuState, MenuKind.Main);
    menuState.itemOn = 0;

    expect(() =>
      implementOptionsMenu({
        frontEndSequenceState,
        menuState,
        runtimeCommand: IMPLEMENT_OPTIONS_MENU_CONTRACT.command,
      }),
    ).toThrow('Implement options menu requires the Main menu Options selection.');
  });

  test('rejects an inactive menu state without firing handleMenuKey', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();
    menuState.itemOn = IMPLEMENT_OPTIONS_MENU_CONTRACT.mainMenuOptionsIndex;

    expect(menuState.active).toBe(false);
    expect(() =>
      implementOptionsMenu({
        frontEndSequenceState,
        menuState,
        runtimeCommand: IMPLEMENT_OPTIONS_MENU_CONTRACT.command,
      }),
    ).toThrow('Implement options menu requires the active Main menu.');
    expect(menuState.currentMenu).toBe(MenuKind.Main);
    expect(menuState.itemOn).toBe(IMPLEMENT_OPTIONS_MENU_CONTRACT.mainMenuOptionsIndex);
    expect(frontEndSequenceState.menuActive).toBe(false);
  });

  test('rejects when the active menu is not the Main menu', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();
    openMenu(menuState, MenuKind.Options);
    menuState.itemOn = IMPLEMENT_OPTIONS_MENU_CONTRACT.mainMenuOptionsIndex;

    expect(() =>
      implementOptionsMenu({
        frontEndSequenceState,
        menuState,
        runtimeCommand: IMPLEMENT_OPTIONS_MENU_CONTRACT.command,
      }),
    ).toThrow('Implement options menu requires the active Main menu.');
    expect(menuState.currentMenu).toBe(MenuKind.Options);
    expect(frontEndSequenceState.menuActive).toBe(false);
  });
});
