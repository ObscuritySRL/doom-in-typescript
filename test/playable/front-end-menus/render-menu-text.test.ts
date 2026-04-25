import { describe, expect, test } from 'bun:test';

import { createFrontEndSequence } from '../../../src/ui/frontEndSequence.ts';
import { createMenuState, MenuItemStatus, MenuKind, openMenu } from '../../../src/ui/menus.ts';
import { RENDER_MENU_TEXT_RUNTIME_CONTRACT, renderMenuText } from '../../../src/playable/front-end-menus/renderMenuText.ts';

const auditManifestUrl = new URL('../../../plan_fps/manifests/01-008-audit-missing-launch-to-menu.json', import.meta.url);
const renderMenuTextSourceUrl = new URL('../../../src/playable/front-end-menus/renderMenuText.ts', import.meta.url);

describe('renderMenuText', () => {
  test('exports the exact Bun-only runtime contract linked to audit 01-008', async () => {
    const auditManifest = JSON.parse(await Bun.file(auditManifestUrl).text()) as {
      readonly audit: {
        readonly schemaVersion: number;
        readonly stepId: string;
        readonly title: string;
      };
      readonly commandContracts: {
        readonly targetRuntime: {
          readonly value: string;
        };
      };
      readonly currentLauncher: {
        readonly launchMode: string;
      };
    };

    expect(RENDER_MENU_TEXT_RUNTIME_CONTRACT).toEqual({
      audit: {
        schemaVersion: 1,
        stepId: '07-018',
        title: 'render-menu-text',
      },
      command: {
        entryFile: 'doom.ts',
        program: 'bun',
        subcommand: 'run',
        value: 'bun run doom.ts',
      },
      sourceAudit: {
        launchMode: 'gameplay-first',
        manifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
        schemaVersion: 1,
        stepId: '01-008',
        title: 'audit-missing-launch-to-menu',
      },
    });

    expect(auditManifest.commandContracts.targetRuntime.value).toBe(RENDER_MENU_TEXT_RUNTIME_CONTRACT.command.value);
    expect({
      launchMode: auditManifest.currentLauncher.launchMode,
      manifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
      schemaVersion: auditManifest.audit.schemaVersion,
      stepId: auditManifest.audit.stepId,
      title: auditManifest.audit.title,
    }).toEqual(RENDER_MENU_TEXT_RUNTIME_CONTRACT.sourceAudit);
  });

  test('locks the renderMenuText source hash', async () => {
    const sourceText = await Bun.file(renderMenuTextSourceUrl).text();
    const hasher = new Bun.CryptoHasher('sha256');

    hasher.update(sourceText);

    expect(hasher.digest('hex')).toBe('d73dbc2be15d86a36a052c74dacbde7ed22715ab38f491bd44adb944ae307d66');
  });

  test('renders the exact options-menu patch rows and synchronizes menu-active state', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    frontEndSequenceState.inDemoPlayback = true;
    openMenu(menuState, MenuKind.Options);
    menuState.itemOn = 3;

    expect(
      renderMenuText({
        frontEndSequenceState,
        menuState,
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toEqual({
      currentMenu: MenuKind.Options,
      entries: [
        {
          index: 0,
          isSelected: false,
          lumpName: 'M_ENDGAM',
          status: MenuItemStatus.Regular,
          x: 60,
          y: 37,
        },
        {
          index: 1,
          isSelected: false,
          lumpName: 'M_MESSG',
          status: MenuItemStatus.Regular,
          x: 60,
          y: 53,
        },
        {
          index: 2,
          isSelected: false,
          lumpName: 'M_DETAIL',
          status: MenuItemStatus.Regular,
          x: 60,
          y: 69,
        },
        {
          index: 3,
          isSelected: true,
          lumpName: 'M_SCRNSZ',
          status: MenuItemStatus.Slider,
          x: 60,
          y: 85,
        },
        {
          index: 5,
          isSelected: false,
          lumpName: 'M_MSENS',
          status: MenuItemStatus.Slider,
          x: 60,
          y: 117,
        },
        {
          index: 7,
          isSelected: false,
          lumpName: 'M_SVOL',
          status: MenuItemStatus.Regular,
          x: 60,
          y: 149,
        },
      ],
      inDemoPlayback: true,
      menuActive: true,
    });

    expect(frontEndSequenceState.menuActive).toBe(true);
  });

  test('returns no text rows for menus whose entries are all blank-save/load slots', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    openMenu(menuState, MenuKind.Load);

    expect(
      renderMenuText({
        frontEndSequenceState,
        menuState,
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toEqual({
      currentMenu: MenuKind.Load,
      entries: [],
      inDemoPlayback: false,
      menuActive: true,
    });
  });

  test('rejects inactive menus after synchronizing the front-end menu flag down', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    frontEndSequenceState.menuActive = true;

    expect(() =>
      renderMenuText({
        frontEndSequenceState,
        menuState,
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toThrow('renderMenuText requires an active menu.');

    expect(frontEndSequenceState.menuActive).toBe(false);
  });

  test('rejects non-Bun runtime commands before mutating front-end state', () => {
    const frontEndSequenceState = createFrontEndSequence('shareware');
    const menuState = createMenuState();

    openMenu(menuState, MenuKind.Main);

    expect(() =>
      renderMenuText({
        frontEndSequenceState,
        menuState,
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('renderMenuText requires `bun run doom.ts`.');

    expect(frontEndSequenceState.menuActive).toBe(false);
  });
});
