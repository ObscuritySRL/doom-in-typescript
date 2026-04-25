import { describe, expect, test } from 'bun:test';

import { LOCK_INTERNAL_320X200_FRAMEBUFFER_CONTRACT, lockInternal320x200Framebuffer } from '../../../src/playable/window-host/lockInternal320x200Framebuffer.ts';

interface AuditPlayableHostSurfaceManifest {
  readonly commandContracts: {
    readonly currentLauncherCommand: string;
    readonly currentPackageScript: string;
    readonly targetRuntimeCommand: string;
  };
  readonly currentLauncherHostTransition: {
    readonly call: string;
    readonly defaultScale: number;
    readonly titleTemplate: string;
  };
  readonly stepId: string;
}

function isAuditPlayableHostSurfaceManifest(value: unknown): value is AuditPlayableHostSurfaceManifest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const manifestRecord = value as Record<string, unknown>;
  const commandContracts = manifestRecord.commandContracts;
  const currentLauncherHostTransition = manifestRecord.currentLauncherHostTransition;

  if (typeof commandContracts !== 'object' || commandContracts === null) {
    return false;
  }

  if (typeof currentLauncherHostTransition !== 'object' || currentLauncherHostTransition === null) {
    return false;
  }

  const commandContractRecord = commandContracts as Record<string, unknown>;
  const hostTransitionRecord = currentLauncherHostTransition as Record<string, unknown>;

  return (
    typeof commandContractRecord.currentLauncherCommand === 'string' &&
    typeof commandContractRecord.currentPackageScript === 'string' &&
    typeof commandContractRecord.targetRuntimeCommand === 'string' &&
    typeof hostTransitionRecord.call === 'string' &&
    typeof hostTransitionRecord.defaultScale === 'number' &&
    typeof hostTransitionRecord.titleTemplate === 'string' &&
    manifestRecord.stepId === '01-006'
  );
}

async function readAuditManifest(): Promise<AuditPlayableHostSurfaceManifest> {
  const auditManifestText = await Bun.file(new URL('../../../plan_fps/manifests/01-006-audit-playable-host-surface.json', import.meta.url)).text();
  const parsedManifest: unknown = JSON.parse(auditManifestText);

  if (!isAuditPlayableHostSurfaceManifest(parsedManifest)) {
    throw new TypeError('01-006 playable host manifest does not match the expected shape');
  }

  return parsedManifest;
}

describe('lockInternal320x200Framebuffer', () => {
  test('exports the exact framebuffer contract', () => {
    expect(LOCK_INTERNAL_320X200_FRAMEBUFFER_CONTRACT).toEqual({
      commandContract: {
        currentLauncherCommand: 'bun run src/main.ts',
        currentPackageScript: 'bun run start',
        runtimeTargetCommand: 'bun run doom.ts',
      },
      currentLauncherHostTransition: {
        call: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
        defaultScale: 2,
        titleTemplate: 'DOOM Codex - ${session.mapName}',
      },
      deterministicReplayCompatibility: {
        compatible: true,
        reason: 'Locks framebuffer geometry only and does not consume input, mutate gameplay state, or create a window.',
      },
      framebuffer: {
        aspectCorrectedDisplayHeight: 240,
        height: 200,
        indexedByteLength: 64_000,
        indexedBytesPerPixel: 1,
        paletteEntries: 256,
        pixelCount: 64_000,
        presentationByteLength: 256_000,
        presentationBytesPerPixel: 4,
        width: 320,
      },
      liveHostEvidence: {
        convertedFrameBufferAllocation: 'const indexedFrameBuffer = new Uint32Array(SCREENWIDTH * SCREENHEIGHT);',
        presentationBitmapHeader: 'const indexedFrameHeader = buildBitmapInfoHeader(SCREENWIDTH, SCREENHEIGHT);',
        presentationBlit:
          'void gdi32.StretchDIBits(deviceContext, presentationRect.x, presentationRect.y, presentationRect.width, presentationRect.height, 0, 0, SCREENWIDTH, SCREENHEIGHT, indexedFrameBytes.ptr, indexedFrameHeader.ptr, DIB_RGB_COLORS, SRCCOPY);',
      },
      stepId: '04-003',
      stepTitle: 'lock-internal-320x200-framebuffer',
    });
  });

  test('matches the stable contract sha256 hash', () => {
    const contractHash = new Bun.CryptoHasher('sha256').update(JSON.stringify(LOCK_INTERNAL_320X200_FRAMEBUFFER_CONTRACT)).digest('hex');

    expect(contractHash).toBe('b949af7600b3750c911d26dcc46652f88274dd2563440bdf85e255ae19b0c5eb');
  });

  test('matches the audited playable host transition', async () => {
    const auditManifest = await readAuditManifest();

    expect(auditManifest.commandContracts.currentLauncherCommand).toBe(LOCK_INTERNAL_320X200_FRAMEBUFFER_CONTRACT.commandContract.currentLauncherCommand);
    expect(auditManifest.commandContracts.currentPackageScript).toBe(LOCK_INTERNAL_320X200_FRAMEBUFFER_CONTRACT.commandContract.currentPackageScript);
    expect(auditManifest.commandContracts.targetRuntimeCommand).toBe(LOCK_INTERNAL_320X200_FRAMEBUFFER_CONTRACT.commandContract.runtimeTargetCommand);
    expect(auditManifest.currentLauncherHostTransition.call).toBe(LOCK_INTERNAL_320X200_FRAMEBUFFER_CONTRACT.currentLauncherHostTransition.call);
    expect(auditManifest.currentLauncherHostTransition.defaultScale).toBe(LOCK_INTERNAL_320X200_FRAMEBUFFER_CONTRACT.currentLauncherHostTransition.defaultScale);
    expect(auditManifest.currentLauncherHostTransition.titleTemplate).toBe(LOCK_INTERNAL_320X200_FRAMEBUFFER_CONTRACT.currentLauncherHostTransition.titleTemplate);
  });

  test('anchors its live evidence in src/launcher/win32.ts', async () => {
    const windowHostSource = await Bun.file(new URL('../../../src/launcher/win32.ts', import.meta.url)).text();

    expect(windowHostSource).toContain(LOCK_INTERNAL_320X200_FRAMEBUFFER_CONTRACT.liveHostEvidence.convertedFrameBufferAllocation);
    expect(windowHostSource).toContain(LOCK_INTERNAL_320X200_FRAMEBUFFER_CONTRACT.liveHostEvidence.presentationBitmapHeader);
    expect(windowHostSource).toContain(LOCK_INTERNAL_320X200_FRAMEBUFFER_CONTRACT.liveHostEvidence.presentationBlit);
  });

  test('returns the locked framebuffer plan for the Bun runtime command', () => {
    expect(lockInternal320x200Framebuffer('bun run doom.ts')).toEqual({
      aspectCorrectedDisplayHeight: 240,
      command: 'bun run doom.ts',
      currentLauncherCommand: 'bun run src/main.ts',
      height: 200,
      indexedByteLength: 64_000,
      pixelCount: 64_000,
      presentationByteLength: 256_000,
      titleTemplate: 'DOOM Codex - ${session.mapName}',
      width: 320,
    });
  });

  test('rejects non-Bun runtime commands', () => {
    expect(() => lockInternal320x200Framebuffer('bun run src/main.ts')).toThrow('lockInternal320x200Framebuffer requires bun run doom.ts, received bun run src/main.ts');
  });
});
