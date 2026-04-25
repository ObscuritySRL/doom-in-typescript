import { describe, expect, test } from 'bun:test';

import { computeClientDimensions } from '../../../src/host/windowPolicy.ts';
import { HANDLE_CLOSE_BUTTON_CONTRACT, handleCloseButton } from '../../../src/playable/window-host/handleCloseButton.ts';

const MANIFEST_PATH = new URL('../../../plan_fps/manifests/01-006-audit-playable-host-surface.json', import.meta.url);
const MODULE_PATH = new URL('../../../src/playable/window-host/handleCloseButton.ts', import.meta.url);
const SOURCE_PATH = new URL('../../../src/launcher/win32.ts', import.meta.url);
const WINDOW_POLICY_PATH = new URL('../../../src/host/windowPolicy.ts', import.meta.url);

const EXPECTED_MODULE_SHA256 = '2504ff25f669f5f1c27185c10fa774ec1a3b2e47565821a3d911283a7cc91068';

function createSha256(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(value);
  return hasher.digest('hex');
}

describe('HANDLE_CLOSE_BUTTON_CONTRACT', () => {
  test('locks the exact close-button contract', () => {
    expect(HANDLE_CLOSE_BUTTON_CONTRACT).toEqual({
      auditedCurrentLauncherHostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
      defaultClientSize: { height: 480, width: 640 },
      deterministicReplayCompatibility: 'native close-button handling only; gameplay replay state remains untouched',
      laterStep: '04-010 run-message-pump',
      liveCloseButtonHandling: {
        branchSource: `if (message === WM_CLOSE) {
          void user32.symbols.DestroyWindow(windowHandle);
          windowDestroyed = true;
          return;
        }`,
        destroyFunctionCall: 'void user32.symbols.DestroyWindow(windowHandle);',
        returnBehavior: 'mark-window-destroyed-and-return',
      },
      runtimeCommand: 'bun run doom.ts',
      stepId: '04-009',
      stepTitle: 'handle-close-button',
      windowMessages: {
        close: {
          name: 'WM_CLOSE',
          value: 0x0010,
          valueHex: '0x0010',
        },
      },
    });
    expect(HANDLE_CLOSE_BUTTON_CONTRACT.defaultClientSize).toEqual(computeClientDimensions(2, true));
  });

  test('locks a stable module sha256 and live source evidence', async () => {
    const [moduleText, sourceText, windowPolicyText] = await Promise.all([Bun.file(MODULE_PATH).text(), Bun.file(SOURCE_PATH).text(), Bun.file(WINDOW_POLICY_PATH).text()]);

    expect(createSha256(moduleText)).toBe(EXPECTED_MODULE_SHA256);
    expect(sourceText).toContain(HANDLE_CLOSE_BUTTON_CONTRACT.liveCloseButtonHandling.branchSource);
    expect(sourceText).toContain(HANDLE_CLOSE_BUTTON_CONTRACT.liveCloseButtonHandling.destroyFunctionCall);
    expect(windowPolicyText).toContain('computeClientDimensions');
    expect(windowPolicyText).toContain('computeClientDimensions(2, true);');
  });

  test('locks the audited host transition against the 01-006 manifest', async () => {
    const manifest = await Bun.file(MANIFEST_PATH).json();

    expect(HANDLE_CLOSE_BUTTON_CONTRACT.runtimeCommand).toBe(manifest.commandContracts.targetRuntimeCommand);
    expect(HANDLE_CLOSE_BUTTON_CONTRACT.auditedCurrentLauncherHostTransition).toBe(manifest.currentLauncherHostTransition.call);
  });
});

describe('handleCloseButton', () => {
  test('handles WM_CLOSE by destroying the window and returning from the loop', () => {
    expect(handleCloseButton({ runtimeCommand: 'bun run doom.ts', windowMessage: 0x0010 })).toEqual({
      action: 'destroy-window-and-return',
      auditedCurrentLauncherHostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
      defaultClientSize: { height: 480, width: 640 },
      destroyWindow: true,
      deterministicReplayCompatible: true,
      handled: true,
      returnFromLoop: true,
      windowDestroyed: true,
      windowMessage: 0x0010,
    });
  });

  test('leaves non-close messages for the message pump to continue processing', () => {
    expect(handleCloseButton({ runtimeCommand: 'bun run doom.ts', windowMessage: 0x000f })).toEqual({
      action: 'continue-message-pump',
      auditedCurrentLauncherHostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
      defaultClientSize: { height: 480, width: 640 },
      destroyWindow: false,
      deterministicReplayCompatible: true,
      handled: false,
      returnFromLoop: false,
      windowDestroyed: false,
      windowMessage: 0x000f,
    });
  });

  test('rejects non-Bun runtime commands', () => {
    expect(() => handleCloseButton({ runtimeCommand: 'bun run src/main.ts', windowMessage: 0x0010 })).toThrow('handleCloseButton only supports bun run doom.ts');
  });
});
