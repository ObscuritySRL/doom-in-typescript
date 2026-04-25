import { describe, expect, test } from 'bun:test';

import { createFrontEndSequence } from '../../../src/ui/frontEndSequence.ts';
import { MenuKind, createMenuState, openMenu } from '../../../src/ui/menus.ts';
import { IMPLEMENT_QUIT_CONFIRMATION_CONTRACT, implementQuitConfirmation } from '../../../src/playable/front-end-menus/implementQuitConfirmation.ts';

const IMPLEMENT_QUIT_CONFIRMATION_SOURCE_URL = new URL('../../../src/playable/front-end-menus/implementQuitConfirmation.ts', import.meta.url);
const AUDIT_MANIFEST_URL = new URL('../../../plan_fps/manifests/01-008-audit-missing-launch-to-menu.json', import.meta.url);

function createQuitSelectionFixture() {
  const frontEndSequenceState = createFrontEndSequence('shareware');
  const menuState = createMenuState();

  openMenu(menuState, MenuKind.Main);
  menuState.itemOn = IMPLEMENT_QUIT_CONFIRMATION_CONTRACT.mainMenu.quitItemIndex;

  return { frontEndSequenceState, menuState };
}

describe('implementQuitConfirmation', () => {
  test('locks the exact Bun runtime contract', () => {
    expect(IMPLEMENT_QUIT_CONFIRMATION_CONTRACT).toEqual({
      auditStepId: '01-008',
      confirmation: {
        cancelInputs: ['escape', 'n'],
        confirmActionKind: 'quitGame',
        confirmInputs: ['enter', 'y'],
        needsYesNo: true,
        text: 'are you sure you want to\nquit this great game?',
      },
      mainMenu: {
        kind: MenuKind.Main,
        quitItemIndex: 5,
      },
      requiredRuntimeCommand: 'bun run doom.ts',
    });

    expect(Object.isFrozen(IMPLEMENT_QUIT_CONFIRMATION_CONTRACT)).toBe(true);
    expect(Object.isFrozen(IMPLEMENT_QUIT_CONFIRMATION_CONTRACT.confirmation)).toBe(true);
    expect(Object.isFrozen(IMPLEMENT_QUIT_CONFIRMATION_CONTRACT.mainMenu)).toBe(true);
  });

  test('locks the formatted source hash', async () => {
    const sourceText = await Bun.file(IMPLEMENT_QUIT_CONFIRMATION_SOURCE_URL).text();
    const sourceHash = new Bun.CryptoHasher('sha256').update(sourceText).digest('hex');

    expect(sourceHash).toBe('bfdd949aa97772e9a247e687ca83e26982553e786ac4bc047f1593f0ee0af17a');
  });

  test('locks the 01-008 audit linkage and runtime contract', async () => {
    const auditManifest = (await Bun.file(AUDIT_MANIFEST_URL).json()) as {
      audit: { stepId: string };
      commandContracts: { targetRuntime: { value: string } };
      currentLauncher: { menuStartImplemented: boolean };
    };

    expect(auditManifest.audit.stepId).toBe(IMPLEMENT_QUIT_CONFIRMATION_CONTRACT.auditStepId);
    expect(auditManifest.commandContracts.targetRuntime.value).toBe(IMPLEMENT_QUIT_CONFIRMATION_CONTRACT.requiredRuntimeCommand);
    expect(auditManifest.currentLauncher.menuStartImplemented).toBe(false);
  });

  test('opens the quit confirmation from the Main menu and preserves demo playback state', () => {
    const { frontEndSequenceState, menuState } = createQuitSelectionFixture();

    frontEndSequenceState.inDemoPlayback = true;

    const result = implementQuitConfirmation({
      command: IMPLEMENT_QUIT_CONFIRMATION_CONTRACT.requiredRuntimeCommand,
      frontEndSequenceState,
      menuState,
      request: { kind: 'openConfirmation' },
    });

    expect(result).toMatchObject({
      demoPlaybackPreserved: true,
      frontEndMenuActive: true,
      menuAction: {
        kind: 'openMessage',
        needsYesNo: true,
        onConfirm: { kind: 'quitGame' },
        text: IMPLEMENT_QUIT_CONFIRMATION_CONTRACT.confirmation.text,
      },
      menuMessageActive: true,
      menuMessageNeedsYesNo: true,
      menuMessageString: IMPLEMENT_QUIT_CONFIRMATION_CONTRACT.confirmation.text,
      menuPendingActionKind: 'quitGame',
    });
    expect(menuState.currentMenu).toBe(MenuKind.Main);
    expect(menuState.messageActive).toBe(true);
    expect(frontEndSequenceState.inDemoPlayback).toBe(true);
  });

  test('confirms quit through the Y response path', () => {
    const { frontEndSequenceState, menuState } = createQuitSelectionFixture();

    implementQuitConfirmation({
      command: IMPLEMENT_QUIT_CONFIRMATION_CONTRACT.requiredRuntimeCommand,
      frontEndSequenceState,
      menuState,
      request: { kind: 'openConfirmation' },
    });

    const result = implementQuitConfirmation({
      command: IMPLEMENT_QUIT_CONFIRMATION_CONTRACT.requiredRuntimeCommand,
      frontEndSequenceState,
      menuState,
      request: { input: 'y', kind: 'confirmQuit' },
    });

    expect(result).toMatchObject({
      demoPlaybackPreserved: true,
      frontEndMenuActive: true,
      menuAction: { kind: 'quitGame' },
      menuMessageActive: false,
      menuMessageNeedsYesNo: true,
      menuMessageString: null,
      menuPendingActionKind: null,
    });
    expect(menuState.messageActive).toBe(false);
  });

  test('cancels quit through the Escape response path', () => {
    const { frontEndSequenceState, menuState } = createQuitSelectionFixture();

    implementQuitConfirmation({
      command: IMPLEMENT_QUIT_CONFIRMATION_CONTRACT.requiredRuntimeCommand,
      frontEndSequenceState,
      menuState,
      request: { kind: 'openConfirmation' },
    });

    const result = implementQuitConfirmation({
      command: IMPLEMENT_QUIT_CONFIRMATION_CONTRACT.requiredRuntimeCommand,
      frontEndSequenceState,
      menuState,
      request: { input: 'escape', kind: 'cancelQuit' },
    });

    expect(result).toMatchObject({
      demoPlaybackPreserved: true,
      frontEndMenuActive: true,
      menuAction: { kind: 'none' },
      menuMessageActive: false,
      menuMessageNeedsYesNo: true,
      menuMessageString: null,
      menuPendingActionKind: null,
    });
    expect(menuState.active).toBe(true);
    expect(menuState.currentMenu).toBe(MenuKind.Main);
  });

  test('rejects non-Bun runtime commands', () => {
    const { frontEndSequenceState, menuState } = createQuitSelectionFixture();

    expect(() =>
      implementQuitConfirmation({
        command: 'bun run src/main.ts',
        frontEndSequenceState,
        menuState,
        request: { kind: 'openConfirmation' },
      }),
    ).toThrow('implementQuitConfirmation requires "bun run doom.ts".');
  });
});
