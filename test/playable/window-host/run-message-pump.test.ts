import { createHash } from 'node:crypto';

import { describe, expect, test } from 'bun:test';

import { computeClientDimensions } from '../../../src/host/windowPolicy.ts';
import { RUN_MESSAGE_PUMP_CONTRACT, RUN_MESSAGE_PUMP_CONTRACT_SHA256, runMessagePump } from '../../../src/playable/window-host/runMessagePump.ts';

interface AuditPlayableHostSurfaceManifest {
  readonly commandContracts: {
    readonly targetRuntimeCommand: string;
  };
  readonly currentLauncherHostTransition: {
    readonly call: string;
    readonly defaultScale: number;
  };
}

const auditPlayableHostSurfaceManifest = (await Bun.file(new URL('../../../plan_fps/manifests/01-006-audit-playable-host-surface.json', import.meta.url)).json()) as AuditPlayableHostSurfaceManifest;
const launcherWindowSource = await Bun.file(new URL('../../../src/launcher/win32.ts', import.meta.url)).text();

describe('runMessagePump', () => {
  test('locks the exact contract and stable hash', () => {
    expect(RUN_MESSAGE_PUMP_CONTRACT).toStrictEqual({
      auditedLauncherTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
      defaultClientSize: {
        height: 480,
        width: 640,
      },
      defaultScale: 2,
      deterministicReplayBoundary: 'Process native window messages only and leave tic scheduling and framebuffer presentation timing to later steps.',
      idleSleepMilliseconds: 1,
      nativeMessageSource: {
        closeBranch: 'if (message === WM_CLOSE) {',
        destroyBranch: 'if (message === WM_DESTROY || message === WM_QUIT) {',
        dispatchCall: 'void user32.symbols.DispatchMessageW(messageBuffer.ptr);',
        messageLoop: 'while (user32.symbols.PeekMessageW(messageBuffer.ptr, 0n, 0, 0, PM_REMOVE) !== 0) {',
        sleepCall: 'await Bun.sleep(1);',
        translateCall: 'void user32.symbols.TranslateMessage(messageBuffer.ptr);',
      },
      runtimeCommand: 'bun run doom.ts',
      stepId: '04-010',
      stepSlug: 'run-message-pump',
    });

    expect(RUN_MESSAGE_PUMP_CONTRACT.defaultClientSize).toStrictEqual(computeClientDimensions(2, true));
    expect(auditPlayableHostSurfaceManifest.currentLauncherHostTransition.call).toBe(RUN_MESSAGE_PUMP_CONTRACT.auditedLauncherTransition);
    expect(auditPlayableHostSurfaceManifest.currentLauncherHostTransition.defaultScale).toBe(RUN_MESSAGE_PUMP_CONTRACT.defaultScale);
    expect(auditPlayableHostSurfaceManifest.commandContracts.targetRuntimeCommand).toBe(RUN_MESSAGE_PUMP_CONTRACT.runtimeCommand);
    expect(RUN_MESSAGE_PUMP_CONTRACT_SHA256).toBe(createHash('sha256').update(JSON.stringify(RUN_MESSAGE_PUMP_CONTRACT)).digest('hex'));
  });

  test('locks the contract SHA-256 to a hex literal so silent contract drift is caught', () => {
    expect(RUN_MESSAGE_PUMP_CONTRACT_SHA256).toBe('0bf7a9e8af73a26200d7d7ba19a3efadf9803fd3485291a121e588036896a932');
  });

  test('locks runtime-frozen invariants on the contract and every nested object', () => {
    expect(Object.isFrozen(RUN_MESSAGE_PUMP_CONTRACT)).toBe(true);
    expect(Object.isFrozen(RUN_MESSAGE_PUMP_CONTRACT.nativeMessageSource)).toBe(true);
    expect(Object.isFrozen(RUN_MESSAGE_PUMP_CONTRACT.defaultClientSize)).toBe(true);
  });

  test('locks the live message-pump source evidence', () => {
    expect(launcherWindowSource).toContain(RUN_MESSAGE_PUMP_CONTRACT.nativeMessageSource.messageLoop);
    expect(launcherWindowSource).toContain(RUN_MESSAGE_PUMP_CONTRACT.nativeMessageSource.closeBranch);
    expect(launcherWindowSource).toContain(RUN_MESSAGE_PUMP_CONTRACT.nativeMessageSource.destroyBranch);
    expect(launcherWindowSource).toContain(RUN_MESSAGE_PUMP_CONTRACT.nativeMessageSource.translateCall);
    expect(launcherWindowSource).toContain(RUN_MESSAGE_PUMP_CONTRACT.nativeMessageSource.dispatchCall);
    expect(launcherWindowSource).toContain(RUN_MESSAGE_PUMP_CONTRACT.nativeMessageSource.sleepCall);
  });

  test('continues running after dispatching non-terminal messages', () => {
    expect(
      runMessagePump({
        queuedMessages: ['WM_KEYDOWN', 'WM_MOUSEMOVE'],
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toStrictEqual({
      defaultClientSize: {
        height: 480,
        width: 640,
      },
      destroyWindow: false,
      deterministicReplayCompatible: true,
      idleSleepMilliseconds: 1,
      processedMessages: ['WM_KEYDOWN', 'WM_MOUSEMOVE'],
      terminalReason: 'continue-running',
      translatedAndDispatchedMessages: ['WM_KEYDOWN', 'WM_MOUSEMOVE'],
    });
  });

  test('stops on WM_CLOSE before translating or dispatching it', () => {
    expect(
      runMessagePump({
        queuedMessages: ['WM_PAINT', 'WM_CLOSE', 'WM_MOUSEMOVE'],
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toStrictEqual({
      defaultClientSize: {
        height: 480,
        width: 640,
      },
      destroyWindow: true,
      deterministicReplayCompatible: true,
      idleSleepMilliseconds: 1,
      processedMessages: ['WM_PAINT', 'WM_CLOSE'],
      terminalReason: 'window-close-requested',
      translatedAndDispatchedMessages: ['WM_PAINT'],
    });
  });

  test('stops on WM_QUIT without destroying the window again', () => {
    expect(
      runMessagePump({
        queuedMessages: ['WM_PAINT', 'WM_QUIT', 'WM_MOUSEMOVE'],
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toStrictEqual({
      defaultClientSize: {
        height: 480,
        width: 640,
      },
      destroyWindow: false,
      deterministicReplayCompatible: true,
      idleSleepMilliseconds: 1,
      processedMessages: ['WM_PAINT', 'WM_QUIT'],
      terminalReason: 'window-quit-requested',
      translatedAndDispatchedMessages: ['WM_PAINT'],
    });
  });

  test('rejects non-playable runtime commands', () => {
    expect(() =>
      runMessagePump({
        queuedMessages: [],
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('runMessagePump only supports bun run doom.ts');
  });

  test('rejects an empty-string runtime command at the boundary', () => {
    expect(() =>
      runMessagePump({
        queuedMessages: [],
        runtimeCommand: '',
      }),
    ).toThrow('runMessagePump only supports bun run doom.ts');
  });

  test('returns continue-running with empty arrays when no messages are queued', () => {
    expect(
      runMessagePump({
        queuedMessages: [],
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toStrictEqual({
      defaultClientSize: {
        height: 480,
        width: 640,
      },
      destroyWindow: false,
      deterministicReplayCompatible: true,
      idleSleepMilliseconds: 1,
      processedMessages: [],
      terminalReason: 'continue-running',
      translatedAndDispatchedMessages: [],
    });
  });

  test('stops on WM_DESTROY before translating or dispatching it', () => {
    expect(
      runMessagePump({
        queuedMessages: ['WM_PAINT', 'WM_DESTROY', 'WM_MOUSEMOVE'],
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toStrictEqual({
      defaultClientSize: {
        height: 480,
        width: 640,
      },
      destroyWindow: false,
      deterministicReplayCompatible: true,
      idleSleepMilliseconds: 1,
      processedMessages: ['WM_PAINT', 'WM_DESTROY'],
      terminalReason: 'window-quit-requested',
      translatedAndDispatchedMessages: ['WM_PAINT'],
    });
  });

  test('honors WM_CLOSE priority when followed by WM_DESTROY and WM_QUIT in the same drain', () => {
    expect(
      runMessagePump({
        queuedMessages: ['WM_CLOSE', 'WM_DESTROY', 'WM_QUIT'],
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toStrictEqual({
      defaultClientSize: {
        height: 480,
        width: 640,
      },
      destroyWindow: true,
      deterministicReplayCompatible: true,
      idleSleepMilliseconds: 1,
      processedMessages: ['WM_CLOSE'],
      terminalReason: 'window-close-requested',
      translatedAndDispatchedMessages: [],
    });
  });

  test('returns frozen result with frozen processedMessages and translatedAndDispatchedMessages arrays', () => {
    const closeResult = runMessagePump({
      queuedMessages: ['WM_KEYDOWN', 'WM_CLOSE'],
      runtimeCommand: 'bun run doom.ts',
    });

    expect(Object.isFrozen(closeResult)).toBe(true);
    expect(Object.isFrozen(closeResult.processedMessages)).toBe(true);
    expect(Object.isFrozen(closeResult.translatedAndDispatchedMessages)).toBe(true);
    expect(Object.isFrozen(closeResult.defaultClientSize)).toBe(true);

    const continueResult = runMessagePump({
      queuedMessages: ['WM_PAINT'],
      runtimeCommand: 'bun run doom.ts',
    });

    expect(Object.isFrozen(continueResult)).toBe(true);
    expect(Object.isFrozen(continueResult.processedMessages)).toBe(true);
    expect(Object.isFrozen(continueResult.translatedAndDispatchedMessages)).toBe(true);
  });
});
