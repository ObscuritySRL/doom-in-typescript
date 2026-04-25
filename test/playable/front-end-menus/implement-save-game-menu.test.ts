import { describe, expect, it } from 'bun:test';

import { createFrontEndSequence } from '../../../src/ui/frontEndSequence.ts';
import { createMenuState, MenuKind, openMenu } from '../../../src/ui/menus.ts';
import { IMPLEMENT_SAVE_GAME_MENU_CONTRACT, implementSaveGameMenu } from '../../../src/playable/front-end-menus/implementSaveGameMenu.ts';

const sourceFileUrl = new URL('../../../src/playable/front-end-menus/implementSaveGameMenu.ts', import.meta.url);
const auditManifestUrl = new URL('../../../plan_fps/manifests/01-008-audit-missing-launch-to-menu.json', import.meta.url);

const sourceText = await Bun.file(sourceFileUrl).text();
const sourceHash = new Bun.CryptoHasher('sha256').update(sourceText).digest('hex');
const launchToMenuAuditManifest = JSON.parse(await Bun.file(auditManifestUrl).text()) as {
  readonly audit: {
    readonly stepId: string;
  };
  readonly commandContracts: {
    readonly targetRuntime: {
      readonly value: string;
    };
  };
  readonly currentLauncher: {
    readonly menuStartImplemented: boolean;
  };
};

describe('implementSaveGameMenu', () => {
  it('locks the exact Bun runtime contract and launch audit linkage', () => {
    expect(IMPLEMENT_SAVE_GAME_MENU_CONTRACT).toEqual({
      audit: {
        launchToMenuManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
        launchToMenuStepId: '01-008',
      },
      menu: {
        activationKey: 'KEY_ENTER',
        requiredCurrentMenu: MenuKind.Main,
        requiredItemIndex: 3,
        requiredItemLump: 'M_SAVEG',
        transitionTarget: MenuKind.Save,
      },
      runtime: {
        command: 'bun run doom.ts',
        menuActiveAfterTransition: true,
      },
    });

    expect(launchToMenuAuditManifest.audit.stepId).toBe(IMPLEMENT_SAVE_GAME_MENU_CONTRACT.audit.launchToMenuStepId);
    expect(launchToMenuAuditManifest.commandContracts.targetRuntime.value).toBe(IMPLEMENT_SAVE_GAME_MENU_CONTRACT.runtime.command);
    expect(launchToMenuAuditManifest.currentLauncher.menuStartImplemented).toBe(false);
  });

  it('locks the source hash', () => {
    expect(sourceHash).toBe('48d18e93cb7325bbd8f0e6bc4ddbf4c458b804e2803e154dfe612666afbfa745');
  });

  it('opens the save menu and preserves replay-relevant demo state', () => {
    const frontEndSequence = createFrontEndSequence('shareware');
    frontEndSequence.inDemoPlayback = true;

    const menu = createMenuState();
    openMenu(menu, MenuKind.Main);
    menu.itemOn = 3;

    const result = implementSaveGameMenu({
      command: 'bun run doom.ts',
      frontEndSequence,
      menu,
    });

    expect(result).toEqual({
      action: { kind: 'openMenu', target: MenuKind.Save },
      currentMenu: MenuKind.Save,
      demoPlaybackActive: true,
      menuActive: true,
    });
    expect(menu.active).toBe(true);
    expect(menu.currentMenu).toBe(MenuKind.Save);
    expect(menu.itemOn).toBe(0);
    expect(frontEndSequence.inDemoPlayback).toBe(true);
    expect(frontEndSequence.menuActive).toBe(true);
  });

  it('reports demoPlaybackActive false when the title loop is not playing a demo', () => {
    const frontEndSequence = createFrontEndSequence('shareware');
    expect(frontEndSequence.inDemoPlayback).toBe(false);

    const menu = createMenuState();
    openMenu(menu, MenuKind.Main);
    menu.itemOn = 3;

    const result = implementSaveGameMenu({
      command: 'bun run doom.ts',
      frontEndSequence,
      menu,
    });

    expect(result.demoPlaybackActive).toBe(false);
    expect(result.menuActive).toBe(true);
    expect(frontEndSequence.menuActive).toBe(true);
  });

  it('returns the frozen module-level transition action singleton across calls', () => {
    const seqA = createFrontEndSequence('shareware');
    const menuA = createMenuState();
    openMenu(menuA, MenuKind.Main);
    menuA.itemOn = 3;

    const seqB = createFrontEndSequence('shareware');
    const menuB = createMenuState();
    openMenu(menuB, MenuKind.Main);
    menuB.itemOn = 3;

    const resultA = implementSaveGameMenu({ command: 'bun run doom.ts', frontEndSequence: seqA, menu: menuA });
    const resultB = implementSaveGameMenu({ command: 'bun run doom.ts', frontEndSequence: seqB, menu: menuB });

    expect(resultA.action).toBe(resultB.action);
    expect(Object.isFrozen(resultA.action)).toBe(true);
    expect(Object.isFrozen(resultA)).toBe(true);
  });

  it('rejects a non-Bun runtime command', () => {
    const frontEndSequence = createFrontEndSequence('shareware');
    const menu = createMenuState();
    openMenu(menu, MenuKind.Main);
    menu.itemOn = 3;

    expect(() =>
      implementSaveGameMenu({
        command: 'bun run src/main.ts',
        frontEndSequence,
        menu,
      }),
    ).toThrow('implementSaveGameMenu requires the exact Bun runtime command "bun run doom.ts".');
  });

  it('rejects an empty runtime command', () => {
    const frontEndSequence = createFrontEndSequence('shareware');
    const menu = createMenuState();
    openMenu(menu, MenuKind.Main);
    menu.itemOn = 3;

    expect(() =>
      implementSaveGameMenu({
        command: '',
        frontEndSequence,
        menu,
      }),
    ).toThrow('implementSaveGameMenu requires the exact Bun runtime command "bun run doom.ts".');
  });

  it('rejects the wrong active menu selection', () => {
    const frontEndSequence = createFrontEndSequence('shareware');
    const menu = createMenuState();
    openMenu(menu, MenuKind.Main);
    menu.itemOn = 2;

    expect(() =>
      implementSaveGameMenu({
        command: 'bun run doom.ts',
        frontEndSequence,
        menu,
      }),
    ).toThrow('implementSaveGameMenu requires the active Main menu Save Game selection.');
  });

  it('rejects an inactive menu state even when the cursor is on the Save row', () => {
    const frontEndSequence = createFrontEndSequence('shareware');
    const menu = createMenuState();
    menu.currentMenu = MenuKind.Main;
    menu.itemOn = 3;
    expect(menu.active).toBe(false);

    expect(() =>
      implementSaveGameMenu({
        command: 'bun run doom.ts',
        frontEndSequence,
        menu,
      }),
    ).toThrow('implementSaveGameMenu requires the active Main menu Save Game selection.');
  });

  it('rejects a non-Main currentMenu even when the cursor is on row 3', () => {
    const frontEndSequence = createFrontEndSequence('shareware');
    const menu = createMenuState();
    openMenu(menu, MenuKind.Options);
    menu.itemOn = 3;

    expect(() =>
      implementSaveGameMenu({
        command: 'bun run doom.ts',
        frontEndSequence,
        menu,
      }),
    ).toThrow('implementSaveGameMenu requires the active Main menu Save Game selection.');
  });

  it('does not mutate the menu when the runtime command is rejected', () => {
    const frontEndSequence = createFrontEndSequence('shareware');
    const menu = createMenuState();
    openMenu(menu, MenuKind.Main);
    menu.itemOn = 3;
    const beforeMenu = menu.currentMenu;
    const beforeItemOn = menu.itemOn;
    const beforeMenuActive = frontEndSequence.menuActive;

    expect(() =>
      implementSaveGameMenu({
        command: 'bun run src/main.ts',
        frontEndSequence,
        menu,
      }),
    ).toThrow();

    expect(menu.currentMenu).toBe(beforeMenu);
    expect(menu.itemOn).toBe(beforeItemOn);
    expect(frontEndSequence.menuActive).toBe(beforeMenuActive);
  });
});
