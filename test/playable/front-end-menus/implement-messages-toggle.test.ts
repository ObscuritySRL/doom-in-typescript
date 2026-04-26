import { describe, expect, test } from 'bun:test';

import { createFrontEndSequence } from '../../../src/ui/frontEndSequence.ts';
import { KEY_DOWNARROW, MenuKind, createMenuState, handleMenuKey, openMenu } from '../../../src/ui/menus.ts';
import { IMPLEMENT_MESSAGES_TOGGLE_CONTRACT, implementMessagesToggle } from '../../../src/playable/front-end-menus/implementMessagesToggle.ts';

interface LaunchToMenuAuditManifest {
  readonly commandContracts: {
    readonly targetRuntime: {
      readonly value: string;
    };
  };
  readonly explicitNullSurfaces: readonly {
    readonly surface: string;
  }[];
  readonly audit: {
    readonly stepId: string;
  };
}

function createMessagesSelectionState() {
  const frontEnd = createFrontEndSequence('shareware');
  const menu = createMenuState();

  openMenu(menu, MenuKind.Options);
  handleMenuKey(menu, KEY_DOWNARROW);

  return { frontEnd, menu };
}

function isLaunchToMenuAuditManifest(value: unknown): value is LaunchToMenuAuditManifest {
  if (typeof value !== 'object' || value === null) return false;

  const auditValue = Reflect.get(value, 'audit');
  const commandContractsValue = Reflect.get(value, 'commandContracts');
  const explicitNullSurfacesValue = Reflect.get(value, 'explicitNullSurfaces');

  if (typeof auditValue !== 'object' || auditValue === null) return false;
  if (typeof commandContractsValue !== 'object' || commandContractsValue === null) return false;
  if (!Array.isArray(explicitNullSurfacesValue)) return false;

  const targetRuntimeValue = Reflect.get(commandContractsValue, 'targetRuntime');

  if (typeof targetRuntimeValue !== 'object' || targetRuntimeValue === null) return false;

  return typeof Reflect.get(auditValue, 'stepId') === 'string' && typeof Reflect.get(targetRuntimeValue, 'value') === 'string';
}

describe('implementMessagesToggle', () => {
  test('locks the Bun runtime contract and 01-008 audit linkage', async () => {
    expect(IMPLEMENT_MESSAGES_TOGGLE_CONTRACT).toEqual({
      audit: {
        missingLaunchToMenuManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
        requiredStepId: '01-008',
        requiredSurface: 'launch-to-menu-transition',
      },
      messagesOption: {
        actionKind: 'toggleMessages',
        itemOn: 1,
        lump: 'M_MESSG',
        menu: MenuKind.Options,
      },
      runtime: {
        entryFile: 'doom.ts',
        program: 'bun',
        subcommand: 'run',
        value: 'bun run doom.ts',
      },
      statusMessages: {
        disabled: 'Messages OFF',
        enabled: 'Messages ON',
      },
    });

    const manifestValue: unknown = await Bun.file(IMPLEMENT_MESSAGES_TOGGLE_CONTRACT.audit.missingLaunchToMenuManifestPath).json();

    expect(isLaunchToMenuAuditManifest(manifestValue)).toBe(true);
    if (!isLaunchToMenuAuditManifest(manifestValue)) {
      throw new Error('01-008 launch-to-menu audit manifest shape changed.');
    }

    expect(manifestValue.audit.stepId).toBe(IMPLEMENT_MESSAGES_TOGGLE_CONTRACT.audit.requiredStepId);
    expect(manifestValue.commandContracts.targetRuntime.value).toBe(IMPLEMENT_MESSAGES_TOGGLE_CONTRACT.runtime.value);
    expect(manifestValue.explicitNullSurfaces.some(({ surface }) => surface === IMPLEMENT_MESSAGES_TOGGLE_CONTRACT.audit.requiredSurface)).toBe(true);
  });

  test('locks the implementation source hash', async () => {
    const sourcePath = new URL('../../../src/playable/front-end-menus/implementMessagesToggle.ts', import.meta.url);
    const sourceText = await Bun.file(sourcePath).text();
    const hasher = new Bun.CryptoHasher('sha256');

    hasher.update(sourceText);

    expect(hasher.digest('hex')).toBe('a5f5192762ea246e5d75a203d283bde2a4cb5793abc9bb32264891926667d8fa');
  });

  test('toggles messages on without disturbing menu or replay state', () => {
    const { frontEnd, menu } = createMessagesSelectionState();

    frontEnd.inDemoPlayback = true;

    const result = implementMessagesToggle({
      frontEnd,
      menu,
      messagesEnabled: false,
      runtimeCommand: 'bun run doom.ts',
    });

    expect(result).toEqual({
      action: { kind: 'toggleMessages' },
      frontEndMenuActive: true,
      inDemoPlayback: true,
      menuActive: true,
      menuItemOn: 1,
      messagesEnabled: true,
      statusMessage: 'Messages ON',
    });
    expect(menu.currentMenu).toBe(MenuKind.Options);
    expect(menu.messageActive).toBe(false);
  });

  test('toggles messages off on a second activation', () => {
    const { frontEnd, menu } = createMessagesSelectionState();

    const result = implementMessagesToggle({
      frontEnd,
      menu,
      messagesEnabled: true,
      runtimeCommand: 'bun run doom.ts',
    });

    expect(result.messagesEnabled).toBe(false);
    expect(result.statusMessage).toBe('Messages OFF');
    expect(frontEnd.menuActive).toBe(true);
  });

  test('rejects non-Bun runtime commands', () => {
    const { frontEnd, menu } = createMessagesSelectionState();

    expect(() =>
      implementMessagesToggle({
        frontEnd,
        menu,
        messagesEnabled: false,
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('Implement messages toggle requires bun run doom.ts.');
  });

  test('rejects calls when the Messages item is not selected', () => {
    const frontEnd = createFrontEndSequence('shareware');
    const menu = createMenuState();

    openMenu(menu, MenuKind.Options);

    expect(() =>
      implementMessagesToggle({
        frontEnd,
        menu,
        messagesEnabled: false,
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toThrow('Implement messages toggle requires the Messages menu item.');
  });

  test('rejects calls when the menu is inactive', () => {
    const frontEnd = createFrontEndSequence('shareware');
    const menu = createMenuState();

    expect(menu.active).toBe(false);
    expect(() =>
      implementMessagesToggle({
        frontEnd,
        menu,
        messagesEnabled: false,
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toThrow('Implement messages toggle requires an active menu.');
    expect(frontEnd.menuActive).toBe(false);
  });

  test('rejects calls when the active menu is not the Options menu', () => {
    const frontEnd = createFrontEndSequence('shareware');
    const menu = createMenuState();

    openMenu(menu, MenuKind.Main);
    menu.itemOn = IMPLEMENT_MESSAGES_TOGGLE_CONTRACT.messagesOption.itemOn;

    expect(() =>
      implementMessagesToggle({
        frontEnd,
        menu,
        messagesEnabled: false,
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toThrow('Implement messages toggle requires the Options menu.');
    expect(menu.currentMenu).toBe(MenuKind.Main);
    expect(frontEnd.menuActive).toBe(false);
  });
});
