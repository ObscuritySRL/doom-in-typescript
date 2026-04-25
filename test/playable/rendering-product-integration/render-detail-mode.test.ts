import { describe, expect, test } from 'bun:test';

import { RENDER_DETAIL_MODE_MISSING_LIVE_RENDERING_MANIFEST_PATH, RENDER_DETAIL_MODE_RUNTIME_COMMAND, renderDetailMode } from '../../../src/playable/rendering-product-integration/renderDetailMode.ts';
import { SCREENHEIGHT, SCREENWIDTH } from '../../../src/render/projection.ts';
import type { DetailMode } from '../../../src/render/projection.ts';

const FULL_FRAMEBUFFER_LENGTH = SCREENWIDTH * SCREENHEIGHT;
const HIGH_DETAIL_SHIFT: DetailMode = 0;
const LOW_DETAIL_SHIFT: DetailMode = 1;

describe('renderDetailMode', () => {
  test('locks the Bun runtime command contract and missing-rendering audit linkage', async () => {
    const manifestData: unknown = await Bun.file(RENDER_DETAIL_MODE_MISSING_LIVE_RENDERING_MANIFEST_PATH).json();

    expect(isRecord(manifestData)).toBe(true);

    if (!isRecord(manifestData)) {
      throw new Error('missing-rendering manifest must be an object');
    }

    const commandContracts = manifestData.commandContracts;
    expect(isRecord(commandContracts)).toBe(true);

    if (!isRecord(commandContracts)) {
      throw new Error('missing-rendering commandContracts must be an object');
    }

    const targetContract = commandContracts.target;
    expect(isRecord(targetContract)).toBe(true);

    if (!isRecord(targetContract)) {
      throw new Error('missing-rendering target command contract must be an object');
    }

    const explicitNullSurfaces = manifestData.explicitNullSurfaces;
    expect(Array.isArray(explicitNullSurfaces)).toBe(true);

    if (!Array.isArray(explicitNullSurfaces)) {
      throw new Error('missing-rendering explicitNullSurfaces must be an array');
    }

    expect(manifestData.schemaVersion).toBe(1);
    expect(targetContract.runtimeCommand).toBe(RENDER_DETAIL_MODE_RUNTIME_COMMAND);
    expect(
      explicitNullSurfaces.some((explicitNullSurface) => {
        return isRecord(explicitNullSurface) && explicitNullSurface.surface === 'live-framebuffer-surface';
      }),
    ).toBe(true);
  });

  test('locks the render-detail-mode source hash', async () => {
    const sourceText = await Bun.file('src/playable/rendering-product-integration/renderDetailMode.ts').text();

    expect(await sha256Hex(sourceText)).toBe('f524e5eca211166f560b6292a2a7973cbaef810a44f8665ca645ab20a03dd764');
  });

  test('duplicates low-detail samples across the visible viewport', async () => {
    const framebuffer = createIndexedFramebuffer();
    const evidence = renderDetailMode({
      command: RENDER_DETAIL_MODE_RUNTIME_COMMAND,
      detailShift: LOW_DETAIL_SHIFT,
      framebuffer,
      setBlocks: 9,
    });

    expect(evidence).toEqual({
      changedPixelCount: 41_328,
      command: RENDER_DETAIL_MODE_RUNTIME_COMMAND,
      detailShift: LOW_DETAIL_SHIFT,
      duplicatedColumnCount: 144,
      framebufferChecksum: 2_536_183_109,
      framebufferLength: FULL_FRAMEBUFFER_LENGTH,
      sampleColumnCount: 144,
      scaledViewWidth: 288,
      setBlocks: 9,
      viewHeight: 144,
      viewWindowX: 16,
      viewWindowY: 12,
    });
    expect(framebuffer[12 * SCREENWIDTH + 16]).toBe(116);
    expect(framebuffer[12 * SCREENWIDTH + 17]).toBe(116);
    expect(framebuffer[12 * SCREENWIDTH + 18]).toBe(121);
    expect(framebuffer[12 * SCREENWIDTH + 19]).toBe(121);
    expect(framebuffer[11 * SCREENWIDTH + 16]).toBe(113);
    expect(await sha256Hex(framebuffer)).toBe('afe1d080d8d253378fa03b973a77615df2479ec101f7d8280b938a5f1dfe5416');
  });

  test('preserves the framebuffer in high-detail mode', async () => {
    const framebuffer = createIndexedFramebuffer();
    const originalFramebufferHash = await sha256Hex(framebuffer);
    const evidence = renderDetailMode({
      command: RENDER_DETAIL_MODE_RUNTIME_COMMAND,
      detailShift: HIGH_DETAIL_SHIFT,
      framebuffer,
      setBlocks: 11,
    });

    expect(evidence).toEqual({
      changedPixelCount: 0,
      command: RENDER_DETAIL_MODE_RUNTIME_COMMAND,
      detailShift: HIGH_DETAIL_SHIFT,
      duplicatedColumnCount: 0,
      framebufferChecksum: 559_152_325,
      framebufferLength: FULL_FRAMEBUFFER_LENGTH,
      sampleColumnCount: 320,
      scaledViewWidth: 320,
      setBlocks: 11,
      viewHeight: 200,
      viewWindowX: 0,
      viewWindowY: 0,
    });
    expect(await sha256Hex(framebuffer)).toBe(originalFramebufferHash);
  });

  test('rejects invalid inputs before mutation', () => {
    const framebuffer = createIndexedFramebuffer();
    const originalFramebuffer = framebuffer.slice();

    expect(() => {
      renderDetailMode({
        command: 'bun run src/main.ts',
        detailShift: LOW_DETAIL_SHIFT,
        framebuffer,
        setBlocks: 9,
      });
    }).toThrow('render-detail-mode requires command bun run doom.ts');
    expect(framebuffer).toEqual(originalFramebuffer);

    expect(() => {
      renderDetailMode({
        command: RENDER_DETAIL_MODE_RUNTIME_COMMAND,
        detailShift: LOW_DETAIL_SHIFT,
        framebuffer: new Uint8Array(FULL_FRAMEBUFFER_LENGTH - 1),
        setBlocks: 9,
      });
    }).toThrow(`render-detail-mode requires ${FULL_FRAMEBUFFER_LENGTH} framebuffer bytes`);
  });
});

function createIndexedFramebuffer(): Uint8Array<ArrayBuffer> {
  const framebuffer = new Uint8Array(FULL_FRAMEBUFFER_LENGTH);

  for (let rowIndex = 0; rowIndex < SCREENHEIGHT; rowIndex += 1) {
    const framebufferRowStart = rowIndex * SCREENWIDTH;

    for (let columnIndex = 0; columnIndex < SCREENWIDTH; columnIndex += 1) {
      framebuffer[framebufferRowStart + columnIndex] = (rowIndex * 3 + columnIndex * 5) % 256;
    }
  }

  return framebuffer;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function sha256Hex(source: string | Uint8Array<ArrayBuffer>): Promise<string> {
  const sourceBytes = typeof source === 'string' ? new TextEncoder().encode(source) : source;
  const digestBuffer = await crypto.subtle.digest('SHA-256', sourceBytes);

  return Array.from(new Uint8Array(digestBuffer), (digestByte) => digestByte.toString(16).padStart(2, '0')).join('');
}
