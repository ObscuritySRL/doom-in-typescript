import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import { SCREENHEIGHT, SCREENWIDTH } from '../../../src/host/windowPolicy.ts';
import { PRESENT_WINDOWED_FRAMEBUFFER_CONTRACT, presentWindowedFramebuffer } from '../../../src/playable/window-host/presentWindowedFramebuffer.ts';

describe('PRESENT_WINDOWED_FRAMEBUFFER_CONTRACT', () => {
  test('locks the exact contract and audited evidence', async () => {
    expect(PRESENT_WINDOWED_FRAMEBUFFER_CONTRACT).toEqual({
      currentLauncherCommand: 'bun run src/main.ts',
      currentLauncherHostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
      deferredPolicies: {
        aspectCorrection: '04-005 define-aspect-correction-policy',
        blit: '04-011 blit-framebuffer-to-window',
        filtering: '04-013 prevent-host-filtering',
        resize: '04-007 define-resize-policy',
        scaling: '04-006 define-integer-nearest-scaling-policy',
      },
      deterministicReplayCompatibility: {
        createsWindowHandle: false,
        mutatesGameState: false,
        readsReplayInput: false,
        requiresDisplayModeSwitch: false,
      },
      presentationSurface: {
        fullscreen: false,
        mode: 'windowed',
        target: 'win32-window-client-area',
      },
      runtimeCommand: 'bun run doom.ts',
      sourceFramebuffer: {
        height: 200,
        pixelFormat: 'indexed-8-bit',
        width: 320,
      },
      stepId: '04-004',
      stepTitle: 'present-windowed-framebuffer',
    });

    expect(PRESENT_WINDOWED_FRAMEBUFFER_CONTRACT.sourceFramebuffer.height).toBe(SCREENHEIGHT);
    expect(PRESENT_WINDOWED_FRAMEBUFFER_CONTRACT.sourceFramebuffer.width).toBe(SCREENWIDTH);
    expect(createHash('sha256').update(JSON.stringify(PRESENT_WINDOWED_FRAMEBUFFER_CONTRACT)).digest('hex')).toBe('01ef9d465fbbcc8e629f115dfd225d63ce562b6343faa075e0a8caacab27b912');

    const auditManifestText = await Bun.file('plan_fps/manifests/01-006-audit-playable-host-surface.json').text();
    const launcherSourceText = await Bun.file('src/launcher/win32.ts').text();

    expect(auditManifestText).toContain('"schemaVersion": 1');
    expect(auditManifestText).toContain('"currentLauncherCommand": "bun run src/main.ts"');
    expect(auditManifestText).toContain('"targetRuntimeCommand": "bun run doom.ts"');
    expect(auditManifestText).toContain('"call": "runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })"');
    expect(launcherSourceText).toContain('const indexedFrameBuffer = new Uint32Array(SCREENWIDTH * SCREENHEIGHT);');
    expect(launcherSourceText).toContain('void gdi32.StretchDIBits(');
  });
});

describe('presentWindowedFramebuffer', () => {
  test('returns the trimmed windowed presentation plan for the Bun runtime command', () => {
    expect(
      presentWindowedFramebuffer({
        clientHeight: 480,
        clientWidth: 640,
        command: 'bun run doom.ts',
        title: '  DOOM Codex - E1M1  ',
      }),
    ).toEqual({
      clientArea: {
        height: 480,
        width: 640,
      },
      currentLauncherCommand: 'bun run src/main.ts',
      currentLauncherHostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
      deferredPolicies: {
        aspectCorrection: '04-005 define-aspect-correction-policy',
        blit: '04-011 blit-framebuffer-to-window',
        filtering: '04-013 prevent-host-filtering',
        resize: '04-007 define-resize-policy',
        scaling: '04-006 define-integer-nearest-scaling-policy',
      },
      deterministicReplayCompatibility: {
        createsWindowHandle: false,
        mutatesGameState: false,
        readsReplayInput: false,
        requiresDisplayModeSwitch: false,
      },
      presentationSurface: {
        fullscreen: false,
        mode: 'windowed',
        target: 'win32-window-client-area',
      },
      runtimeCommand: 'bun run doom.ts',
      sourceFramebuffer: {
        height: 200,
        pixelFormat: 'indexed-8-bit',
        width: 320,
      },
      stepId: '04-004',
      stepTitle: 'present-windowed-framebuffer',
      title: 'DOOM Codex - E1M1',
    });
  });

  test('rejects non-bun runtime commands', () => {
    expect(() =>
      presentWindowedFramebuffer({
        clientHeight: 480,
        clientWidth: 640,
        command: 'bun run src/main.ts',
        title: 'DOOM Codex - E1M1',
      }),
    ).toThrow('presentWindowedFramebuffer requires `bun run doom.ts`, received `bun run src/main.ts`');
  });

  test('rejects invalid client sizes and empty titles', () => {
    expect(() =>
      presentWindowedFramebuffer({
        clientHeight: 480,
        clientWidth: 0,
        command: 'bun run doom.ts',
        title: 'DOOM Codex - E1M1',
      }),
    ).toThrow('presentWindowedFramebuffer requires a positive integer clientWidth, received 0');

    expect(() =>
      presentWindowedFramebuffer({
        clientHeight: -1,
        clientWidth: 640,
        command: 'bun run doom.ts',
        title: 'DOOM Codex - E1M1',
      }),
    ).toThrow('presentWindowedFramebuffer requires a positive integer clientHeight, received -1');

    expect(() =>
      presentWindowedFramebuffer({
        clientHeight: 480,
        clientWidth: 640,
        command: 'bun run doom.ts',
        title: '   ',
      }),
    ).toThrow('presentWindowedFramebuffer requires a non-empty window title');
  });

  test('rejects fractional, NaN, and Infinity client dimensions', () => {
    for (const badWidth of [1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() =>
        presentWindowedFramebuffer({
          clientHeight: 480,
          clientWidth: badWidth,
          command: 'bun run doom.ts',
          title: 'DOOM Codex - E1M1',
        }),
      ).toThrow(`presentWindowedFramebuffer requires a positive integer clientWidth, received ${badWidth}`);
    }

    for (const badHeight of [2.25, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0]) {
      expect(() =>
        presentWindowedFramebuffer({
          clientHeight: badHeight,
          clientWidth: 640,
          command: 'bun run doom.ts',
          title: 'DOOM Codex - E1M1',
        }),
      ).toThrow(`presentWindowedFramebuffer requires a positive integer clientHeight, received ${badHeight}`);
    }
  });

  test('preserves internal whitespace in the title and rejects tab-only titles', () => {
    const plan = presentWindowedFramebuffer({
      clientHeight: 480,
      clientWidth: 640,
      command: 'bun run doom.ts',
      title: '\tDOOM\tCodex - E1M1\n',
    });

    expect(plan.title).toBe('DOOM\tCodex - E1M1');
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.clientArea)).toBe(true);

    expect(() =>
      presentWindowedFramebuffer({
        clientHeight: 480,
        clientWidth: 640,
        command: 'bun run doom.ts',
        title: '\t\n\r ',
      }),
    ).toThrow('presentWindowedFramebuffer requires a non-empty window title');
  });

  test('accepts MAX_SAFE_INTEGER client dimensions', () => {
    const plan = presentWindowedFramebuffer({
      clientHeight: Number.MAX_SAFE_INTEGER,
      clientWidth: Number.MAX_SAFE_INTEGER,
      command: 'bun run doom.ts',
      title: 'DOOM Codex',
    });

    expect(plan.clientArea).toEqual({
      height: Number.MAX_SAFE_INTEGER,
      width: Number.MAX_SAFE_INTEGER,
    });
  });
});
