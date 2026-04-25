import { describe, expect, test } from 'bun:test';

import { readFileSync } from 'node:fs';

import { computeClientDimensions, SCREENHEIGHT, SCREENWIDTH } from '../../../src/host/windowPolicy.ts';
import { addScreenshotCaptureHooks, SCREENSHOT_CAPTURE_HOOKS_CONTRACT } from '../../../src/playable/window-host/addScreenshotCaptureHooks.ts';

const AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-006-audit-playable-host-surface.json';
const LAUNCHER_SOURCE_PATH = 'src/launcher/win32.ts';
const EXPECTED_CONTRACT_HASH = '8e39b3a1acc91ad68538a5ba3a63f8fcc61912986aa5c8c1dd68042a610f816e';

function hashContract(): string {
  const cryptoHasher = new Bun.CryptoHasher('sha256');
  cryptoHasher.update(JSON.stringify(SCREENSHOT_CAPTURE_HOOKS_CONTRACT));
  return cryptoHasher.digest('hex');
}

describe('addScreenshotCaptureHooks', () => {
  test('locks the exact screenshot capture hooks contract', () => {
    expect(SCREENSHOT_CAPTURE_HOOKS_CONTRACT).toEqual({
      auditedLauncherTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
      defaultWindowClientArea: {
        height: 480,
        width: 640,
      },
      framebuffer: {
        height: 200,
        width: 320,
      },
      hooks: [
        {
          captureFormat: 'indexed-320x200',
          description: 'Observe the freshly rendered indexed framebuffer before palette expansion.',
          hookId: 'after-render-launcher-frame',
          mutationPolicy: 'observe-only',
          sourceBuffer: 'session.framebuffer',
        },
        {
          captureFormat: 'argb8888-320x200',
          description: 'Observe the palette-expanded ARGB framebuffer before window presentation.',
          hookId: 'after-palette-conversion',
          mutationPolicy: 'observe-only',
          sourceBuffer: 'indexedFrameBytes',
        },
        {
          captureFormat: 'windowed-presentation-plan',
          description: 'Observe the final presentation handoff without mutating timing or blit order.',
          hookId: 'before-window-present',
          mutationPolicy: 'observe-only',
          sourceBuffer: 'presentFrame',
        },
      ],
      liveSourceEvidence: {
        paletteConversionCall: 'convertIndexedFrame(session.framebuffer, indexedFrameBuffer, paletteLookup);',
        presentCall: 'presentFrame(user32.symbols, gdi32.symbols, windowHandle, indexedFrameBytes, indexedFrameHeader, backgroundFillBytes, backgroundFillHeader);',
        renderCall: 'renderLauncherFrame(session);',
      },
      replayCompatibility: 'Observe-only hooks capture framebuffer state without mutating session, input, timing, or presentation order.',
      runtimeCommand: 'bun run doom.ts',
      stepId: '04-014',
      stepTitle: 'add-screenshot-capture-hooks',
    });
    expect(hashContract()).toBe(EXPECTED_CONTRACT_HASH);
  });

  test('matches the audited launcher transition and runtime command contract', () => {
    const auditManifest = JSON.parse(readFileSync(AUDIT_MANIFEST_PATH, 'utf8'));

    expect(auditManifest.commandContracts.targetRuntimeCommand).toBe(SCREENSHOT_CAPTURE_HOOKS_CONTRACT.runtimeCommand);
    expect(auditManifest.currentLauncherHostTransition.call).toBe(SCREENSHOT_CAPTURE_HOOKS_CONTRACT.auditedLauncherTransition);
  });

  test('locks the live source evidence order from the launcher host', () => {
    const launcherSource = readFileSync(LAUNCHER_SOURCE_PATH, 'utf8');
    const renderCallIndex = launcherSource.indexOf(SCREENSHOT_CAPTURE_HOOKS_CONTRACT.liveSourceEvidence.renderCall);
    const paletteConversionCallIndex = launcherSource.indexOf(SCREENSHOT_CAPTURE_HOOKS_CONTRACT.liveSourceEvidence.paletteConversionCall);
    const presentCallIndex = launcherSource.indexOf(SCREENSHOT_CAPTURE_HOOKS_CONTRACT.liveSourceEvidence.presentCall);

    expect(renderCallIndex).toBeGreaterThan(-1);
    expect(paletteConversionCallIndex).toBeGreaterThan(renderCallIndex);
    expect(presentCallIndex).toBeGreaterThan(paletteConversionCallIndex);
  });

  test('returns the capture hook plan for the Bun runtime path', () => {
    const captureHooks = addScreenshotCaptureHooks({ runtimeCommand: 'bun run doom.ts' });

    expect(captureHooks).toBe(SCREENSHOT_CAPTURE_HOOKS_CONTRACT);
    expect(captureHooks.defaultWindowClientArea).toEqual(computeClientDimensions(2, true));
    expect(captureHooks.framebuffer).toEqual({
      height: SCREENHEIGHT,
      width: SCREENWIDTH,
    });
  });

  test('rejects non-Bun runtime commands', () => {
    expect(() => addScreenshotCaptureHooks({ runtimeCommand: 'bun run src/main.ts' })).toThrow('addScreenshotCaptureHooks requires bun run doom.ts');
  });
});
