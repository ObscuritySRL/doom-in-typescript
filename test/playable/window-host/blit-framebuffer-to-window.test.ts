import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

import { BLIT_FRAMEBUFFER_TO_WINDOW_CONTRACT, blitFramebufferToWindow } from '../../../src/playable/window-host/blitFramebufferToWindow.ts';

interface PlayableHostAuditManifest {
  readonly currentLauncherHostTransition: {
    readonly call: string;
  };
}

const REPOSITORY_ROOT = resolve(import.meta.dir, '..', '..', '..');

function computeSha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parsePlayableHostAuditManifest(jsonText: string): PlayableHostAuditManifest {
  const parsedValue: unknown = JSON.parse(jsonText);

  if (!isRecord(parsedValue)) {
    throw new TypeError('Playable host audit manifest must be a JSON object.');
  }

  const currentLauncherHostTransition = parsedValue.currentLauncherHostTransition;

  if (!isRecord(currentLauncherHostTransition) || typeof currentLauncherHostTransition.call !== 'string') {
    throw new TypeError('Playable host audit manifest must contain currentLauncherHostTransition.call.');
  }

  return {
    currentLauncherHostTransition: {
      call: currentLauncherHostTransition.call,
    },
  };
}

function readRepositoryFile(relativePath: string): Promise<string> {
  return Bun.file(resolve(REPOSITORY_ROOT, relativePath)).text();
}

describe('BLIT_FRAMEBUFFER_TO_WINDOW_CONTRACT', () => {
  test('locks the exact contract object and hash', () => {
    expect(BLIT_FRAMEBUFFER_TO_WINDOW_CONTRACT).toEqual({
      aspectRatioCorrect: true,
      auditedHostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
      backgroundFillColor: 0xff00_0000,
      backgroundFillHeight: 1,
      backgroundFillWidth: 1,
      bitmapHeaderEncoding: 'bi-rgb-32-bit-top-down',
      blitFunctionName: 'StretchDIBits',
      clientRectFunctionName: 'GetClientRect',
      deviceContextAcquireFunctionName: 'GetDC',
      deviceContextReleaseFunctionName: 'ReleaseDC',
      liveSourceEvidence: [
        'presentFrame(user32.symbols, gdi32.symbols, windowHandle, indexedFrameBytes, indexedFrameHeader, backgroundFillBytes, backgroundFillHeader);',
        'const presentationRect = computePresentationRect(clientWidth, clientHeight, true);',
        'void gdi32.StretchDIBits(deviceContext, 0, 0, clientWidth, clientHeight, 0, 0, 1, 1, backgroundFillBytes.ptr, backgroundFillHeader.ptr, DIB_RGB_COLORS, SRCCOPY);',
        'void gdi32.StretchDIBits(deviceContext, presentationRect.x, presentationRect.y, presentationRect.width, presentationRect.height, 0, 0, SCREENWIDTH, SCREENHEIGHT, indexedFrameBytes.ptr, indexedFrameHeader.ptr, DIB_RGB_COLORS, SRCCOPY);',
        'void user32.ReleaseDC(windowHandle, deviceContext);',
      ],
      presentationRectFunctionName: 'computePresentationRect',
      runtimeCommand: 'bun run doom.ts',
      sourceFramebufferHeight: 200,
      sourceFramebufferWidth: 320,
    });
    expect(computeSha256(JSON.stringify(BLIT_FRAMEBUFFER_TO_WINDOW_CONTRACT))).toBe('d7ac57eb15de80db7b8b303745ba8807de8047d2a36c160f60272360ffb7e2c3');
  });

  test('matches the audited launcher transition and live blit source evidence', async () => {
    const playableHostAuditManifest = parsePlayableHostAuditManifest(await readRepositoryFile('plan_fps/manifests/01-006-audit-playable-host-surface.json'));
    const windowHostSource = await readRepositoryFile('src/launcher/win32.ts');
    const windowPolicySource = await readRepositoryFile('src/host/windowPolicy.ts');

    expect(playableHostAuditManifest.currentLauncherHostTransition.call).toBe(BLIT_FRAMEBUFFER_TO_WINDOW_CONTRACT.auditedHostTransition);
    for (const sourceEvidence of BLIT_FRAMEBUFFER_TO_WINDOW_CONTRACT.liveSourceEvidence) {
      expect(windowHostSource).toContain(sourceEvidence);
    }
    expect(windowPolicySource).toContain('export function computePresentationRect(');
    expect(windowPolicySource).toContain('export const SCREENHEIGHT = 200;');
    expect(windowPolicySource).toContain('export const SCREENWIDTH = 320;');
  });
});

describe('blitFramebufferToWindow', () => {
  test('creates the expected background fill and framebuffer blit plan', () => {
    expect(
      blitFramebufferToWindow({
        clientHeight: 480,
        clientWidth: 800,
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toEqual({
      backgroundFill: {
        destinationHeight: 480,
        destinationWidth: 800,
        destinationX: 0,
        destinationY: 0,
        sourceHeight: 1,
        sourceWidth: 1,
      },
      deterministicReplayCompatible: true,
      framebufferBlit: {
        destinationHeight: 480,
        destinationWidth: 640,
        destinationX: 80,
        destinationY: 0,
        sourceHeight: 200,
        sourceWidth: 320,
      },
      isNoOp: false,
      runtimeCommand: 'bun run doom.ts',
      transition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
    });
  });

  test('returns a no-op plan when the client area is non-positive', () => {
    expect(
      blitFramebufferToWindow({
        clientHeight: -1,
        clientWidth: 0,
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toEqual({
      backgroundFill: {
        destinationHeight: 0,
        destinationWidth: 0,
        destinationX: 0,
        destinationY: 0,
        sourceHeight: 1,
        sourceWidth: 1,
      },
      deterministicReplayCompatible: true,
      framebufferBlit: {
        destinationHeight: 0,
        destinationWidth: 0,
        destinationX: 0,
        destinationY: 0,
        sourceHeight: 200,
        sourceWidth: 320,
      },
      isNoOp: true,
      runtimeCommand: 'bun run doom.ts',
      transition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
    });
  });

  test('rejects a non-playable runtime command', () => {
    expect(() =>
      blitFramebufferToWindow({
        clientHeight: 480,
        clientWidth: 640,
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('blitFramebufferToWindow requires bun run doom.ts; received bun run src/main.ts');
  });
});
