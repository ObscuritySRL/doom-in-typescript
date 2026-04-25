import { describe, expect, test } from 'bun:test';

import { computeClientDimensions } from '../../../src/host/windowPolicy.ts';
import { CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT, createBunCompatibleWin32Window } from '../../../src/playable/window-host/createBunCompatibleWin32Window.ts';

type PlayableHostAuditManifest = {
  readonly commandContracts: {
    readonly currentLauncherCommand: string;
    readonly targetRuntimeCommand: string;
  };
  readonly currentLauncherHostTransition: {
    readonly call: string;
    readonly defaultScale: number;
    readonly initialView: string;
    readonly titleTemplate: string;
    readonly toggleViewControl: string;
  };
  readonly schemaVersion: number;
  readonly stepId: string;
};

function hashValue(value: unknown): string {
  return new Bun.CryptoHasher('sha256').update(JSON.stringify(value)).digest('hex');
}

describe('createBunCompatibleWin32Window', () => {
  test('exports the exact Bun-compatible Win32 window contract', () => {
    expect(CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT).toEqual({
      bunCompatibility: {
        createWindowLibrary: 'user32.dll',
        createWindowSymbol: 'CreateWindowExW',
        foreignFunctionInterfaceModule: 'bun:ffi',
        wideStringEncoding: 'utf16le',
        windowClassName: 'STATIC',
      },
      currentLauncherTransition: {
        currentLauncherCommand: 'bun run src/main.ts',
        hostFile: 'src/launcher/win32.ts',
        hostFunction: 'runLauncherWindow',
        initialView: 'gameplay',
        titleTemplate: 'DOOM Codex - ${session.mapName}',
        toggleViewControl: 'Tab',
      },
      currentWindowImplementation: {
        windowShowCommand: 5,
        windowStyleHex: '0x10cf0000',
      },
      deterministicReplayCompatibility: {
        createsNativeWindowOnly: true,
        loadsNoIwadBytes: true,
        mutatesNoGameplayState: true,
        mutatesNoGlobalRandomSeed: true,
        readsNoReplayInput: true,
        requiresLaterStepsForPresentation: ['04-004', '04-010'],
      },
      stepId: '04-001',
      stepTitle: 'create-bun-compatible-win32-window',
      targetRuntime: {
        entryFile: 'doom.ts',
        program: 'bun',
        runtimeCommand: 'bun run doom.ts',
        subcommand: 'run',
      },
      windowPolicy: {
        aspectRatioCorrect: true,
        defaultClientHeight: 480,
        defaultClientWidth: 640,
        defaultScale: 2,
        screenHeight: 200,
        screenWidth: 320,
      },
    });
    expect(hashValue(CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT)).toBe('50cfa29a78e53fc4821a58e5046c4509f5caf60e2d13cde36fe9fec9b5528a4b');
  });

  test('locks the audited playable host transition and current source evidence', async () => {
    const manifest = (await Bun.file('plan_fps/manifests/01-006-audit-playable-host-surface.json').json()) as PlayableHostAuditManifest;
    const currentWindowHostSource = await Bun.file('src/launcher/win32.ts').text();

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.stepId).toBe('01-006');
    expect(manifest.commandContracts.currentLauncherCommand).toBe(CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT.currentLauncherTransition.currentLauncherCommand);
    expect(manifest.commandContracts.targetRuntimeCommand).toBe(CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT.targetRuntime.runtimeCommand);
    expect(manifest.currentLauncherHostTransition.call).toContain(CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT.currentLauncherTransition.hostFunction);
    expect(manifest.currentLauncherHostTransition.defaultScale).toBe(CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT.windowPolicy.defaultScale);
    expect(manifest.currentLauncherHostTransition.initialView).toBe(CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT.currentLauncherTransition.initialView);
    expect(manifest.currentLauncherHostTransition.titleTemplate).toBe(CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT.currentLauncherTransition.titleTemplate);
    expect(manifest.currentLauncherHostTransition.toggleViewControl).toBe(CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT.currentLauncherTransition.toggleViewControl);

    expect(currentWindowHostSource).toContain('CreateWindowExW');
    expect(currentWindowHostSource).toContain('STATIC\\0');
    expect(currentWindowHostSource).toContain('WINDOW_STYLE = 0x10cf_0000');
    expect(currentWindowHostSource).toContain('ShowWindow(windowHandle, SW_SHOW)');
    expect(computeClientDimensions(2, true)).toEqual({
      height: CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT.windowPolicy.defaultClientHeight,
      width: CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT.windowPolicy.defaultClientWidth,
    });
  });

  test('creates the exact Bun-compatible Win32 window plan for the playable runtime path', () => {
    expect(
      createBunCompatibleWin32Window({
        command: 'bun run doom.ts',
        scale: 3,
        title: 'DOOM Codex - E1M1',
      }),
    ).toEqual({
      aspectRatioCorrect: true,
      clientSize: {
        height: 720,
        width: 960,
      },
      command: 'bun run doom.ts',
      createWindowLibrary: 'user32.dll',
      createWindowSymbol: 'CreateWindowExW',
      currentLauncherCommand: 'bun run src/main.ts',
      foreignFunctionInterfaceModule: 'bun:ffi',
      initialView: 'gameplay',
      requestedScale: 3,
      title: 'DOOM Codex - E1M1',
      titlePolicyDeferredStep: '04-002',
      wideStringEncoding: 'utf16le',
      windowClassName: 'STATIC',
      windowShowCommand: 5,
      windowStyleHex: '0x10cf0000',
    });
    expect(computeClientDimensions(3, true)).toEqual({ height: 720, width: 960 });
  });

  test('rejects non-Bun runtime commands and invalid window requests', () => {
    expect(() =>
      createBunCompatibleWin32Window({
        command: 'bun run src/main.ts',
        title: 'DOOM Codex - E1M1',
      }),
    ).toThrow('createBunCompatibleWin32Window requires bun run doom.ts, received bun run src/main.ts');
    expect(() =>
      createBunCompatibleWin32Window({
        command: 'bun run doom.ts',
        scale: 0,
        title: 'DOOM Codex - E1M1',
      }),
    ).toThrow('createBunCompatibleWin32Window requires an integer scale of at least 1, received 0');
    expect(() =>
      createBunCompatibleWin32Window({
        command: 'bun run doom.ts',
        title: '   ',
      }),
    ).toThrow('createBunCompatibleWin32Window requires a non-empty window title');
  });
});
