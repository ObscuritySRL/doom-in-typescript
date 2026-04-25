import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import { computeClientDimensions } from '../../../src/host/windowPolicy.ts';
import { HANDLE_WINDOW_FOCUS_CONTRACT, handleWindowFocus } from '../../../src/playable/window-host/handleWindowFocus.ts';

const WINDOW_HANDLE = 0x1234n;

describe('HANDLE_WINDOW_FOCUS_CONTRACT', () => {
  test('locks the exact contract and hash', () => {
    expect(HANDLE_WINDOW_FOCUS_CONTRACT).toEqual({
      auditedHostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
      currentLauncherCommand: 'bun run src/main.ts',
      defaultClientDimensions: computeClientDimensions(2, true),
      focusDetectionApi: 'GetForegroundWindow',
      focusForegroundExpression: 'const windowIsForeground = foregroundWindowResult === windowHandle;',
      focusInputGuard: 'if (!windowIsForeground) {\n      return false;\n    }',
      focusLossPolicy: {
        allowLiveInput: false,
        clearHeldInput: true,
        clearPressedOnceState: true,
        keepPresentingFrames: true,
        pauseGameLoop: false,
      },
      focusRestorePolicy: {
        allowLiveInput: true,
        clearHeldInput: false,
        clearPressedOnceState: false,
        keepPresentingFrames: true,
        pauseGameLoop: false,
      },
      runtimeCommand: 'bun run doom.ts',
      windowTitleTemplate: 'DOOM Codex - ${session.mapName}',
    });

    expect(createHash('sha256').update(JSON.stringify(HANDLE_WINDOW_FOCUS_CONTRACT)).digest('hex')).toBe('20c8ba3dd03afbd18539d1bf46b7a3227b08c685411230c20147a82d23b55e3c');
  });

  test('matches the audited 01-006 manifest and live window host evidence', async () => {
    const manifest = JSON.parse(await Bun.file('plan_fps/manifests/01-006-audit-playable-host-surface.json').text()) as {
      readonly commandContracts: {
        readonly currentLauncherCommand: string;
        readonly targetRuntimeCommand: string;
      };
      readonly currentLauncherHostTransition: {
        readonly call: string;
        readonly titleTemplate: string;
      };
      readonly schemaVersion: number;
      readonly stepId: string;
    };
    const launcherSource = await Bun.file('src/launcher/win32.ts').text();

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.stepId).toBe('01-006');
    expect(manifest.commandContracts.currentLauncherCommand).toBe(HANDLE_WINDOW_FOCUS_CONTRACT.currentLauncherCommand);
    expect(manifest.commandContracts.targetRuntimeCommand).toBe(HANDLE_WINDOW_FOCUS_CONTRACT.runtimeCommand);
    expect(manifest.currentLauncherHostTransition.call).toBe(HANDLE_WINDOW_FOCUS_CONTRACT.auditedHostTransition);
    expect(manifest.currentLauncherHostTransition.titleTemplate).toBe(HANDLE_WINDOW_FOCUS_CONTRACT.windowTitleTemplate);

    expect(launcherSource).toContain(HANDLE_WINDOW_FOCUS_CONTRACT.focusDetectionApi);
    expect(launcherSource).toContain(HANDLE_WINDOW_FOCUS_CONTRACT.focusForegroundExpression);
    expect(launcherSource).toContain(HANDLE_WINDOW_FOCUS_CONTRACT.focusInputGuard);
  });
});

describe('handleWindowFocus', () => {
  test('returns the foreground focus plan for the Bun runtime path', () => {
    expect(
      handleWindowFocus({
        foregroundWindowHandle: WINDOW_HANDLE,
        runtimeCommand: 'bun run doom.ts',
        windowHandle: WINDOW_HANDLE,
      }),
    ).toEqual({
      allowLiveInput: true,
      clearHeldInput: false,
      clearPressedOnceState: false,
      clientDimensions: computeClientDimensions(2, true),
      deterministicReplayCompatible: true,
      focusState: 'foreground',
      keepPresentingFrames: true,
      pauseGameLoop: false,
      sourceApi: 'GetForegroundWindow',
    });
  });

  test('releases live input while keeping presentation and deterministic replay state untouched when backgrounded', () => {
    expect(
      handleWindowFocus({
        foregroundWindowHandle: WINDOW_HANDLE + 1n,
        runtimeCommand: 'bun run doom.ts',
        windowHandle: WINDOW_HANDLE,
      }),
    ).toEqual({
      allowLiveInput: false,
      clearHeldInput: true,
      clearPressedOnceState: true,
      clientDimensions: computeClientDimensions(2, true),
      deterministicReplayCompatible: true,
      focusState: 'background',
      keepPresentingFrames: true,
      pauseGameLoop: false,
      sourceApi: 'GetForegroundWindow',
    });
  });

  test('rejects non-playable launcher commands', () => {
    expect(() =>
      handleWindowFocus({
        foregroundWindowHandle: WINDOW_HANDLE,
        runtimeCommand: 'bun run src/main.ts',
        windowHandle: WINDOW_HANDLE,
      }),
    ).toThrow('handleWindowFocus requires bun run doom.ts');
  });
});
