import { describe, expect, test } from 'bun:test';

import {
  RENDER_FULL_FRAME_EVERY_VISIBLE_TIC_AUDIT_MANIFEST_PATH,
  RENDER_FULL_FRAME_EVERY_VISIBLE_TIC_RUNTIME_COMMAND,
  renderFullFrameEveryVisibleTic,
} from '../../../src/playable/rendering-product-integration/renderFullFrameEveryVisibleTic.ts';
import { SCREENHEIGHT, SCREENWIDTH } from '../../../src/render/projection.ts';

const EXPECTED_FRAMEBUFFER_LENGTH = SCREENWIDTH * SCREENHEIGHT;
const EXPECTED_SOURCE_HASH = 'bfef19e568e7c9a3b1032cda9966c387e6e7146ec250222f2206c4300ff4a650';

interface AuditManifest {
  readonly commandContracts: {
    readonly target: {
      readonly runtimeCommand: string;
    };
  };
  readonly explicitNullSurfaces: readonly AuditManifestNullSurface[];
  readonly schemaVersion: number;
}

interface AuditManifestNullSurface {
  readonly path: string | null;
  readonly reason: string;
  readonly surface: string;
}

describe('renderFullFrameEveryVisibleTic', () => {
  test('locks the Bun command contract and missing-rendering audit surface', async () => {
    const manifest = await readAuditManifest();

    expect(RENDER_FULL_FRAME_EVERY_VISIBLE_TIC_RUNTIME_COMMAND).toBe('bun run doom.ts');
    expect(RENDER_FULL_FRAME_EVERY_VISIBLE_TIC_AUDIT_MANIFEST_PATH).toBe('plan_fps/manifests/01-012-audit-missing-live-rendering.json');
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.commandContracts.target.runtimeCommand).toBe(RENDER_FULL_FRAME_EVERY_VISIBLE_TIC_RUNTIME_COMMAND);
    expect(manifest.explicitNullSurfaces).toContainEqual({
      path: null,
      reason: 'No live framebuffer ownership or pixel buffer path is exposed by the 01-012 read scope.',
      surface: 'live-framebuffer-surface',
    });
  });

  test('locks the formatted implementation source hash', async () => {
    const sourceText = await Bun.file('src/playable/rendering-product-integration/renderFullFrameEveryVisibleTic.ts').text();

    expect(sha256Hex(sourceText)).toBe(EXPECTED_SOURCE_HASH);
  });

  test('renders one full framebuffer for one visible tic', () => {
    const framebuffer = new Uint8Array(EXPECTED_FRAMEBUFFER_LENGTH);
    let externalInvocationCount = 0;

    framebuffer.fill(0xff);

    const evidence = renderFullFrameEveryVisibleTic({
      framebuffer,
      renderFullFrame: (incomingFramebuffer) => {
        const middlePixelIndex = Math.floor(incomingFramebuffer.length / 2);

        externalInvocationCount += 1;
        expect(incomingFramebuffer).toBe(framebuffer);

        incomingFramebuffer.fill(0);
        incomingFramebuffer[0] = 17;
        incomingFramebuffer[middlePixelIndex] = 34;
        incomingFramebuffer[incomingFramebuffer.length - 1] = 51;

        return incomingFramebuffer;
      },
      runtimeCommand: RENDER_FULL_FRAME_EVERY_VISIBLE_TIC_RUNTIME_COMMAND,
      visibleTic: 12,
    });

    expect(externalInvocationCount).toBe(1);
    expect(evidence).toEqual({
      auditManifestPath: RENDER_FULL_FRAME_EVERY_VISIBLE_TIC_AUDIT_MANIFEST_PATH,
      framebufferLength: EXPECTED_FRAMEBUFFER_LENGTH,
      firstPixel: 17,
      lastPixel: 51,
      middlePixel: 34,
      renderedVisibleTic: 12,
      rendererInvocationCount: 1,
      runtimeCommand: RENDER_FULL_FRAME_EVERY_VISIBLE_TIC_RUNTIME_COMMAND,
      viewport: {
        scaledViewWidth: 320,
        viewHeight: 200,
        viewWidth: 320,
        viewWindowX: 0,
        viewWindowY: 0,
      },
    });
  });

  test('rejects non-Bun runtime commands before rendering', () => {
    const framebuffer = new Uint8Array(EXPECTED_FRAMEBUFFER_LENGTH);
    let externalInvocationCount = 0;

    expect(() =>
      renderFullFrameEveryVisibleTic({
        framebuffer,
        renderFullFrame: () => {
          externalInvocationCount += 1;
          return framebuffer;
        },
        runtimeCommand: 'bun run src/main.ts',
        visibleTic: 0,
      }),
    ).toThrow('render full frame every visible tic requires bun run doom.ts');
    expect(externalInvocationCount).toBe(0);
  });

  test('rejects partial framebuffers before rendering', () => {
    const framebuffer = new Uint8Array(EXPECTED_FRAMEBUFFER_LENGTH - 1);
    let externalInvocationCount = 0;

    expect(() =>
      renderFullFrameEveryVisibleTic({
        framebuffer,
        renderFullFrame: () => {
          externalInvocationCount += 1;
          return framebuffer;
        },
        runtimeCommand: RENDER_FULL_FRAME_EVERY_VISIBLE_TIC_RUNTIME_COMMAND,
        visibleTic: 0,
      }),
    ).toThrow(`full-frame rendering requires a ${EXPECTED_FRAMEBUFFER_LENGTH}-byte framebuffer`);
    expect(externalInvocationCount).toBe(0);
  });
});

async function readAuditManifest(): Promise<AuditManifest> {
  const parsedManifest: unknown = await Bun.file(RENDER_FULL_FRAME_EVERY_VISIBLE_TIC_AUDIT_MANIFEST_PATH).json();

  if (!isAuditManifest(parsedManifest)) {
    throw new Error('01-012 rendering audit manifest did not match the expected schema');
  }

  return parsedManifest;
}

function isAuditManifest(value: unknown): value is AuditManifest {
  if (!isRecord(value)) {
    return false;
  }

  const commandContracts = value.commandContracts;
  const explicitNullSurfaces = value.explicitNullSurfaces;
  const schemaVersion = value.schemaVersion;

  if (!isRecord(commandContracts) || !Array.isArray(explicitNullSurfaces) || typeof schemaVersion !== 'number') {
    return false;
  }

  const target = commandContracts.target;

  return isRecord(target) && typeof target.runtimeCommand === 'string' && explicitNullSurfaces.every(isAuditManifestNullSurface);
}

function isAuditManifestNullSurface(value: unknown): value is AuditManifestNullSurface {
  if (!isRecord(value)) {
    return false;
  }

  return (typeof value.path === 'string' || value.path === null) && typeof value.reason === 'string' && typeof value.surface === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sha256Hex(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(value);
  return hasher.digest('hex');
}
