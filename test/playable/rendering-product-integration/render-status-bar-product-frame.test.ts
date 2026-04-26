import { describe, expect, test } from 'bun:test';

import { RENDER_STATUS_BAR_PRODUCT_FRAME_COMMAND, getStatusBarProductFrameArea, renderStatusBarProductFrame } from '../../../src/playable/rendering-product-integration/renderStatusBarProductFrame.ts';
import { SBARHEIGHT, SCREENHEIGHT, SCREENWIDTH } from '../../../src/render/projection.ts';
import type { RenderStatusBarProductFrameOptions } from '../../../src/playable/rendering-product-integration/renderStatusBarProductFrame.ts';

const EXPECTED_FRAMEBUFFER_SHA256 = 'b3fe54b22122e202a49d199436e173f0e7d0cf127fbf7a030f544d2858725352';
const EXPECTED_SOURCE_SHA256 = '2bd14f84b968f583c220e5804fe6d618ab3796635b1fea30de1248413328040b';
const FRAMEBUFFER_BYTE_LENGTH = SCREENWIDTH * SCREENHEIGHT;
const STATUS_BAR_FRAME_BYTE_LENGTH = SCREENWIDTH * SBARHEIGHT;

interface AuditCommandContracts {
  readonly target: AuditTargetCommandContract;
}

interface AuditManifest {
  readonly commandContracts: AuditCommandContracts;
  readonly explicitNullSurfaces: readonly AuditNullSurface[];
  readonly schemaVersion: number;
}

interface AuditNullSurface {
  readonly path: string | null;
  readonly reason: string;
  readonly surface: string;
}

interface AuditTargetCommandContract {
  readonly entryFile: string;
  readonly runtimeCommand: string;
}

describe('renderStatusBarProductFrame', () => {
  test('locks the exact Bun runtime command contract', () => {
    expect(RENDER_STATUS_BAR_PRODUCT_FRAME_COMMAND).toEqual({
      entryFile: 'doom.ts',
      runtime: 'bun',
      subcommand: 'run',
      value: 'bun run doom.ts',
    });
  });

  test('links the 01-012 missing live rendering audit surface', async () => {
    const manifest = parseAuditManifest(await Bun.file('plan_fps/manifests/01-012-audit-missing-live-rendering.json').text());

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.commandContracts.target).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: RENDER_STATUS_BAR_PRODUCT_FRAME_COMMAND.value,
    });
    expect(manifest.explicitNullSurfaces).toContainEqual({
      path: null,
      reason: 'No status-bar renderer invocation path is exposed by the 01-012 read scope.',
      surface: 'status-bar-renderer-invocation',
    });
  });

  test('locks the implementation source hash', async () => {
    await expect(computeSha256HexDigest('src/playable/rendering-product-integration/renderStatusBarProductFrame.ts')).resolves.toBe(EXPECTED_SOURCE_SHA256);
  });

  test('copies the exact status-bar frame into the bottom product area', async () => {
    const framebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);
    const statusBarFrame = new Uint8Array(STATUS_BAR_FRAME_BYTE_LENGTH);
    framebuffer.fill(7);

    for (let byteIndex = 0; byteIndex < statusBarFrame.length; byteIndex += 1) {
      statusBarFrame[byteIndex] = (byteIndex * 17 + 3) & 0xff;
    }

    const result = renderStatusBarProductFrame({
      command: RENDER_STATUS_BAR_PRODUCT_FRAME_COMMAND.value,
      framebuffer,
      statusBarFrame,
    });

    expect(result.command).toBe(RENDER_STATUS_BAR_PRODUCT_FRAME_COMMAND.value);
    expect(result.framebuffer).toBe(framebuffer);
    expect(result.framebufferLength).toBe(FRAMEBUFFER_BYTE_LENGTH);
    expect(result.statusBarArea).toEqual({
      height: SBARHEIGHT,
      startOffset: SCREENWIDTH * (SCREENHEIGHT - SBARHEIGHT),
      top: SCREENHEIGHT - SBARHEIGHT,
      width: SCREENWIDTH,
    });
    expect(result.statusBarFrameLength).toBe(STATUS_BAR_FRAME_BYTE_LENGTH);
    expect(framebuffer[result.statusBarArea.startOffset - 1]).toBe(7);
    expect(framebuffer[result.statusBarArea.startOffset]).toBe(statusBarFrame[0]);
    expect(framebuffer[FRAMEBUFFER_BYTE_LENGTH - 1]).toBe(statusBarFrame[STATUS_BAR_FRAME_BYTE_LENGTH - 1]);
    await expect(computeByteSha256HexDigest(framebuffer)).resolves.toBe(EXPECTED_FRAMEBUFFER_SHA256);
  });

  test('rejects invalid input before mutating replay-visible pixels', () => {
    const framebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);
    const invalidStatusBarFrame = new Uint8Array(STATUS_BAR_FRAME_BYTE_LENGTH - 1);
    framebuffer.fill(9);
    invalidStatusBarFrame.fill(5);

    expect(() =>
      renderStatusBarProductFrame({
        command: RENDER_STATUS_BAR_PRODUCT_FRAME_COMMAND.value,
        framebuffer,
        statusBarFrame: invalidStatusBarFrame,
      }),
    ).toThrow(`statusBarFrame must be exactly ${STATUS_BAR_FRAME_BYTE_LENGTH} bytes`);
    expect(framebuffer.every((value) => value === 9)).toBe(true);
  });

  test('rejects mismatched framebuffer length before mutating replay-visible pixels', () => {
    const undersizedFramebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH - 1);
    const oversizedFramebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH + 1);
    const statusBarFrame = new Uint8Array(STATUS_BAR_FRAME_BYTE_LENGTH);
    undersizedFramebuffer.fill(13);
    oversizedFramebuffer.fill(17);
    statusBarFrame.fill(29);

    expect(() =>
      renderStatusBarProductFrame({
        command: RENDER_STATUS_BAR_PRODUCT_FRAME_COMMAND.value,
        framebuffer: undersizedFramebuffer,
        statusBarFrame,
      }),
    ).toThrow(`framebuffer must be exactly ${FRAMEBUFFER_BYTE_LENGTH} bytes`);
    expect(undersizedFramebuffer.every((value) => value === 13)).toBe(true);

    expect(() =>
      renderStatusBarProductFrame({
        command: RENDER_STATUS_BAR_PRODUCT_FRAME_COMMAND.value,
        framebuffer: oversizedFramebuffer,
        statusBarFrame,
      }),
    ).toThrow(`framebuffer must be exactly ${FRAMEBUFFER_BYTE_LENGTH} bytes`);
    expect(oversizedFramebuffer.every((value) => value === 17)).toBe(true);
  });

  test('rejects the wrong command before mutating replay-visible pixels', () => {
    const options = createRenderOptions();

    expect(() => renderStatusBarProductFrame({ ...options, command: 'bun run src/main.ts' })).toThrow(`render-status-bar-product-frame requires runtime command: ${RENDER_STATUS_BAR_PRODUCT_FRAME_COMMAND.value}`);
    expect(options.framebuffer.every((value) => value === 11)).toBe(true);
  });

  test('returns the exact status-bar product frame area', () => {
    expect(getStatusBarProductFrameArea()).toEqual({
      height: 32,
      startOffset: 53_760,
      top: 168,
      width: 320,
    });
  });
});

async function computeByteSha256HexDigest(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return formatBytesAsHex(new Uint8Array(digest));
}

async function computeSha256HexDigest(path: string): Promise<string> {
  return computeByteSha256HexDigest(new Uint8Array(await Bun.file(path).arrayBuffer()));
}

function createRenderOptions(): RenderStatusBarProductFrameOptions {
  const framebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);
  const statusBarFrame = new Uint8Array(STATUS_BAR_FRAME_BYTE_LENGTH);
  framebuffer.fill(11);
  statusBarFrame.fill(23);

  return {
    command: RENDER_STATUS_BAR_PRODUCT_FRAME_COMMAND.value,
    framebuffer,
    statusBarFrame,
  };
}

function formatBytesAsHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isAuditManifest(value: unknown): value is AuditManifest {
  if (!isRecord(value)) {
    return false;
  }

  const commandContracts = value.commandContracts;
  const explicitNullSurfaces = value.explicitNullSurfaces;
  const schemaVersion = value.schemaVersion;

  if (!isRecord(commandContracts) || !Array.isArray(explicitNullSurfaces) || schemaVersion !== 1) {
    return false;
  }

  return isAuditTargetCommandContract(commandContracts.target) && explicitNullSurfaces.every(isAuditNullSurface);
}

function isAuditNullSurface(value: unknown): value is AuditNullSurface {
  if (!isRecord(value)) {
    return false;
  }

  return (typeof value.path === 'string' || value.path === null) && typeof value.reason === 'string' && typeof value.surface === 'string';
}

function isAuditTargetCommandContract(value: unknown): value is AuditTargetCommandContract {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.entryFile === 'string' && typeof value.runtimeCommand === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseAuditManifest(text: string): AuditManifest {
  const value: unknown = JSON.parse(text);

  if (!isAuditManifest(value)) {
    throw new Error('01-012 audit manifest schema did not match expected shape');
  }

  return value;
}
