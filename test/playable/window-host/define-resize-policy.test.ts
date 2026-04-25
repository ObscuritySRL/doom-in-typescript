import { describe, expect, test } from 'bun:test';

import { computeClientDimensions } from '../../../src/host/windowPolicy.ts';
import { DEFINE_RESIZE_POLICY_CONTRACT, defineResizePolicy } from '../../../src/playable/window-host/defineResizePolicy.ts';

interface AuditPlayableHostSurfaceManifest {
  readonly commandContracts: {
    readonly currentLauncherCommand: string;
    readonly targetRuntimeCommand: string;
  };
  readonly currentLauncherHostTransition: {
    readonly call: string;
  };
}

function sha256Hex(value: unknown): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(JSON.stringify(value));
  return hasher.digest('hex');
}

describe('defineResizePolicy', () => {
  test('exports the exact resize policy contract and stable hash', () => {
    expect(DEFINE_RESIZE_POLICY_CONTRACT).toEqual({
      auditedHostTransition: {
        call: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
        liveClientAreaSource: 'GetClientRect(windowHandle, clientRectBuffer.ptr)',
        sourceWindowStyleHex: '0x10cf0000',
      },
      commandContracts: {
        currentLauncherCommand: 'bun run src/main.ts',
        targetRuntimeCommand: 'bun run doom.ts',
      },
      deterministicReplayCompatibility: {
        affectsGameplayState: false,
        affectsInputStream: false,
        affectsTickScheduling: false,
        scope: 'presentation-only',
      },
      resizePolicy: {
        aspectRatioCorrect: true,
        centersIntegerPresentationWithinClientArea: true,
        defaultClientArea: {
          height: 480,
          width: 640,
        },
        minimumClientArea: {
          height: 240,
          width: 320,
        },
        resizeSource: 'live-client-rect',
        scalingMode: 'integer-nearest-fit',
      },
      sourceEvidencePaths: ['plan_fps/manifests/01-006-audit-playable-host-surface.json', 'src/host/windowPolicy.ts', 'src/launcher/win32.ts'],
    });
    expect(sha256Hex(DEFINE_RESIZE_POLICY_CONTRACT)).toBe('ccf32748c9e9460bf772fa9a5613ec5af0ec113f523ffdd4125143c3f9342564');
  });

  test('locks the audited host transition and live resize evidence', async () => {
    const manifestText = await Bun.file('plan_fps/manifests/01-006-audit-playable-host-surface.json').text();
    const manifest = JSON.parse(manifestText) as AuditPlayableHostSurfaceManifest;
    const win32Source = await Bun.file('src/launcher/win32.ts').text();
    const windowPolicySource = await Bun.file('src/host/windowPolicy.ts').text();

    expect(manifest.commandContracts.currentLauncherCommand).toBe(DEFINE_RESIZE_POLICY_CONTRACT.commandContracts.currentLauncherCommand);
    expect(manifest.commandContracts.targetRuntimeCommand).toBe(DEFINE_RESIZE_POLICY_CONTRACT.commandContracts.targetRuntimeCommand);
    expect(manifest.currentLauncherHostTransition.call).toBe(DEFINE_RESIZE_POLICY_CONTRACT.auditedHostTransition.call);

    expect(win32Source).toContain('const WINDOW_STYLE = 0x10cf_0000;');
    expect(win32Source).toContain('GetClientRect(windowHandle, clientRectBuffer.ptr)');
    expect(windowPolicySource).toContain('export function computeScaleMultiplier');
    expect(windowPolicySource).toContain('export function computeClientDimensions');
  });

  test('defines the integer-fit resize plan for oversized client areas', () => {
    expect(defineResizePolicy('bun run doom.ts', 800, 600)).toEqual({
      appliedPresentationArea: {
        height: 480,
        width: 640,
      },
      appliedScaleMultiplier: 2,
      aspectRatioCorrect: true,
      centeredOffset: {
        x: 80,
        y: 60,
      },
      deterministicReplayCompatible: true,
      effectiveClientArea: {
        height: 600,
        width: 800,
      },
      requestedClientArea: {
        height: 600,
        width: 800,
      },
      runtimeCommand: 'bun run doom.ts',
      windowStyleHex: '0x10cf0000',
    });
  });

  test('clamps undersized client areas to the 1x minimum presentation size', () => {
    const minimumClientArea = computeClientDimensions(1, true);

    expect(defineResizePolicy('bun run doom.ts', 200, 100)).toEqual({
      appliedPresentationArea: minimumClientArea,
      appliedScaleMultiplier: 1,
      aspectRatioCorrect: true,
      centeredOffset: {
        x: 0,
        y: 0,
      },
      deterministicReplayCompatible: true,
      effectiveClientArea: minimumClientArea,
      requestedClientArea: {
        height: 100,
        width: 200,
      },
      runtimeCommand: 'bun run doom.ts',
      windowStyleHex: '0x10cf0000',
    });
  });

  test('rejects runtime commands outside the Bun playable path', () => {
    expect(() => defineResizePolicy('bun run src/main.ts', 640, 480)).toThrow('defineResizePolicy requires bun run doom.ts; received bun run src/main.ts');
  });
});
