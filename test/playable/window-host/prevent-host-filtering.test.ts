import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import { computeClientDimensions, SCREENHEIGHT, SCREENWIDTH } from '../../../src/host/windowPolicy.ts';
import { PREVENT_HOST_FILTERING_CONTRACT, preventHostFiltering } from '../../../src/playable/window-host/preventHostFiltering.ts';

const EXPECTED_CONTRACT_SHA256 = 'cc9a967044886060e4152e1d72ebb691fbbfa29a7755aaa811108b58caeb838e';

interface AuditPlayableHostSurfaceManifest {
  readonly currentLauncherHostTransition: {
    readonly call: string;
  };
}

function parseAuditPlayableHostSurfaceManifest(manifestText: string): AuditPlayableHostSurfaceManifest {
  const parsedManifest = JSON.parse(manifestText);

  if (
    typeof parsedManifest !== 'object' ||
    parsedManifest === null ||
    !('currentLauncherHostTransition' in parsedManifest) ||
    typeof parsedManifest.currentLauncherHostTransition !== 'object' ||
    parsedManifest.currentLauncherHostTransition === null ||
    !('call' in parsedManifest.currentLauncherHostTransition) ||
    typeof parsedManifest.currentLauncherHostTransition.call !== 'string'
  ) {
    throw new Error('Expected 01-006 audit manifest to expose currentLauncherHostTransition.call.');
  }

  return parsedManifest;
}

describe('preventHostFiltering', () => {
  test('exports the exact host filtering contract', () => {
    expect(PREVENT_HOST_FILTERING_CONTRACT).toEqual({
      auditStepId: '01-006',
      deterministicReplayCompatibility: 'Presentation-only stretch-mode policy; no gameplay timing, input, or simulation state changes.',
      filterPolicy: {
        applyToBlits: ['background-fill', 'gameplay-frame'],
        filteredStretchingAllowed: false,
        liveStretchApi: 'StretchDIBits',
        stretchMode: 'COLORONCOLOR',
      },
      hostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
      launcherSourcePath: 'src/launcher/win32.ts',
      liveSourceRequirements: {
        forbiddenFilterTokens: ['HALFTONE', 'SetStretchBltMode'],
        requiredBlitTokens: [
          'void gdi32.StretchDIBits(deviceContext, 0, 0, clientWidth, clientHeight, 0, 0, 1, 1, backgroundFillBytes.ptr, backgroundFillHeader.ptr, DIB_RGB_COLORS, SRCCOPY);',
          'void gdi32.StretchDIBits(deviceContext, presentationRect.x, presentationRect.y, presentationRect.width, presentationRect.height, 0, 0, SCREENWIDTH, SCREENHEIGHT, indexedFrameBytes.ptr, indexedFrameHeader.ptr, DIB_RGB_COLORS, SRCCOPY);',
        ],
      },
      presentation: {
        defaultClientHeight: 480,
        defaultClientWidth: 640,
        framebufferHeight: 200,
        framebufferWidth: 320,
      },
      runtimeCommand: 'bun run doom.ts',
      stepId: '04-013',
      stepTitle: 'prevent-host-filtering',
      windowPolicySourcePath: 'src/host/windowPolicy.ts',
    });
  });

  test('locks a stable contract hash', () => {
    const contractHash = createHash('sha256').update(JSON.stringify(PREVENT_HOST_FILTERING_CONTRACT)).digest('hex');

    expect(contractHash).toBe(EXPECTED_CONTRACT_SHA256);
  });

  test('anchors the audited launcher transition and live host evidence', async () => {
    const auditManifest = parseAuditPlayableHostSurfaceManifest(await Bun.file('plan_fps/manifests/01-006-audit-playable-host-surface.json').text());
    const launcherSourceText = await Bun.file(PREVENT_HOST_FILTERING_CONTRACT.launcherSourcePath).text();
    const defaultClientDimensions = computeClientDimensions(2, true);

    expect(auditManifest.currentLauncherHostTransition.call).toBe(PREVENT_HOST_FILTERING_CONTRACT.hostTransition);
    expect(defaultClientDimensions.height).toBe(PREVENT_HOST_FILTERING_CONTRACT.presentation.defaultClientHeight);
    expect(defaultClientDimensions.width).toBe(PREVENT_HOST_FILTERING_CONTRACT.presentation.defaultClientWidth);
    expect(SCREENHEIGHT).toBe(PREVENT_HOST_FILTERING_CONTRACT.presentation.framebufferHeight);
    expect(SCREENWIDTH).toBe(PREVENT_HOST_FILTERING_CONTRACT.presentation.framebufferWidth);

    for (const requiredBlitToken of PREVENT_HOST_FILTERING_CONTRACT.liveSourceRequirements.requiredBlitTokens) {
      expect(launcherSourceText.includes(requiredBlitToken)).toBe(true);
    }

    for (const forbiddenFilterToken of PREVENT_HOST_FILTERING_CONTRACT.liveSourceRequirements.forbiddenFilterTokens) {
      expect(launcherSourceText.includes(forbiddenFilterToken)).toBe(false);
    }
  });

  test('returns the frozen contract for the Bun runtime command', () => {
    const filteringPlan = preventHostFiltering({ runtimeCommand: 'bun run doom.ts' });

    expect(filteringPlan).toBe(PREVENT_HOST_FILTERING_CONTRACT);
  });

  test('rejects non-doom runtime commands', () => {
    expect(() => preventHostFiltering({ runtimeCommand: 'bun run src/main.ts' })).toThrow('preventHostFiltering requires runtime command `bun run doom.ts`.');
  });
});
