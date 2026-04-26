import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import { createFrontEndSequence } from '../../../src/ui/frontEndSequence.ts';
import { createMenuState, MenuKind, openMenu } from '../../../src/ui/menus.ts';
import { IMPLEMENT_SOUND_VOLUME_MENU_RUNTIME_CONTRACT, implementSoundVolumeMenu } from '../../../src/playable/front-end-menus/implementSoundVolumeMenu.ts';

const SOURCE_FILE_URL = new URL('../../../src/playable/front-end-menus/implementSoundVolumeMenu.ts', import.meta.url);
const AUDIT_MANIFEST_URL = new URL('../../../plan_fps/manifests/01-008-audit-missing-launch-to-menu.json', import.meta.url);
const EXPECTED_SOURCE_HASH = '3f3fb5aefbac7ef714fb60f19972be641dd1fae2ea6c0a7a3d0855f4d6350898';

describe('implementSoundVolumeMenu', () => {
  test('locks the exact runtime contract, source hash, and 01-008 audit linkage', async () => {
    expect(IMPLEMENT_SOUND_VOLUME_MENU_RUNTIME_CONTRACT).toEqual({
      auditManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
      expectedCommand: 'bun run doom.ts',
      optionsMenu: {
        kind: MenuKind.Options,
        selectedItemIndex: 7,
        selectedItemLump: 'M_SVOL',
      },
      soundVolumeMenu: {
        firstSelectableItemIndex: 0,
        firstSelectableItemLump: 'M_SFXVOL',
        kind: MenuKind.SoundVolume,
        secondSelectableItemIndex: 2,
        secondSelectableItemLump: 'M_MUSVOL',
      },
      transitionKey: 13,
    });

    const sourceBuffer = await Bun.file(SOURCE_FILE_URL).arrayBuffer();
    const sourceHash = createHash('sha256').update(Buffer.from(sourceBuffer)).digest('hex');
    expect(sourceHash).toBe(EXPECTED_SOURCE_HASH);

    const auditManifestText = await Bun.file(AUDIT_MANIFEST_URL).text();
    expect(auditManifestText).toContain('"stepId": "01-008"');
    expect(auditManifestText).toContain('"value": "bun run doom.ts"');
    expect(auditManifestText).toContain('"menuStartImplemented": false');
  });

  test('opens the sound volume menu from the active options-menu selection', () => {
    const frontEndSequence = createFrontEndSequence('shareware');
    frontEndSequence.inDemoPlayback = true;

    const menu = createMenuState();
    openMenu(menu, MenuKind.Options);
    menu.itemOn = IMPLEMENT_SOUND_VOLUME_MENU_RUNTIME_CONTRACT.optionsMenu.selectedItemIndex;

    const result = implementSoundVolumeMenu({
      command: IMPLEMENT_SOUND_VOLUME_MENU_RUNTIME_CONTRACT.expectedCommand,
      frontEndSequence,
      menu,
    });

    expect(result).toEqual({
      action: { kind: 'openMenu', target: MenuKind.SoundVolume },
      currentMenu: MenuKind.SoundVolume,
      inDemoPlayback: true,
      itemOn: 0,
      menuActive: true,
      selectedItemLump: 'M_SFXVOL',
    });
    expect(menu.currentMenu).toBe(MenuKind.SoundVolume);
    expect(menu.itemOn).toBe(IMPLEMENT_SOUND_VOLUME_MENU_RUNTIME_CONTRACT.soundVolumeMenu.firstSelectableItemIndex);
    expect(frontEndSequence.menuActive).toBe(true);
    expect(frontEndSequence.inDemoPlayback).toBe(true);
  });

  test('rejects commands outside the bun run doom.ts runtime path', () => {
    const frontEndSequence = createFrontEndSequence('shareware');
    const menu = createMenuState();
    openMenu(menu, MenuKind.Options);
    menu.itemOn = IMPLEMENT_SOUND_VOLUME_MENU_RUNTIME_CONTRACT.optionsMenu.selectedItemIndex;

    expect(() =>
      implementSoundVolumeMenu({
        command: 'bun run src/main.ts',
        frontEndSequence,
        menu,
      }),
    ).toThrow('implementSoundVolumeMenu requires "bun run doom.ts".');
  });

  test('rejects when the options cursor is not on Sound Volume', () => {
    const frontEndSequence = createFrontEndSequence('shareware');
    const menu = createMenuState();
    openMenu(menu, MenuKind.Options);
    menu.itemOn = 0;

    expect(() =>
      implementSoundVolumeMenu({
        command: IMPLEMENT_SOUND_VOLUME_MENU_RUNTIME_CONTRACT.expectedCommand,
        frontEndSequence,
        menu,
      }),
    ).toThrow('implementSoundVolumeMenu requires the Sound Volume option to be selected.');
  });

  test('rejects when the menu state is inactive', () => {
    const frontEndSequence = createFrontEndSequence('shareware');
    const menu = createMenuState();

    expect(menu.active).toBe(false);
    expect(() =>
      implementSoundVolumeMenu({
        command: IMPLEMENT_SOUND_VOLUME_MENU_RUNTIME_CONTRACT.expectedCommand,
        frontEndSequence,
        menu,
      }),
    ).toThrow('implementSoundVolumeMenu requires the active Options menu.');
    expect(frontEndSequence.menuActive).toBe(false);
  });

  test('rejects when the active menu is not Options', () => {
    const frontEndSequence = createFrontEndSequence('shareware');
    const menu = createMenuState();
    openMenu(menu, MenuKind.Main);

    expect(() =>
      implementSoundVolumeMenu({
        command: IMPLEMENT_SOUND_VOLUME_MENU_RUNTIME_CONTRACT.expectedCommand,
        frontEndSequence,
        menu,
      }),
    ).toThrow('implementSoundVolumeMenu requires the active Options menu.');
  });

  test('rejects when itemOn points past the last Options item', () => {
    const frontEndSequence = createFrontEndSequence('shareware');
    const menu = createMenuState();
    openMenu(menu, MenuKind.Options);
    menu.itemOn = 999;

    expect(() =>
      implementSoundVolumeMenu({
        command: IMPLEMENT_SOUND_VOLUME_MENU_RUNTIME_CONTRACT.expectedCommand,
        frontEndSequence,
        menu,
      }),
    ).toThrow('implementSoundVolumeMenu requires the Sound Volume option to be selected.');
  });
});
