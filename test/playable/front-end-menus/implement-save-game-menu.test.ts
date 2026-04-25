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
    expect(sourceHash).toBe('2b552fa9140c539a9859904eaad24c4781235c1fecfae2cc94f0fe9a87684511');
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
});
