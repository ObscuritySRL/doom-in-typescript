import { describe, expect, test } from 'bun:test';

import { DetailMode, SCREENHEIGHT, SCREENWIDTH, computeViewport } from '../../../src/render/projection.ts';
import {
  RENDER_VIEWPORT_BORDERS_AUDIT_MANIFEST_PATH,
  RENDER_VIEWPORT_BORDERS_COMMAND_CONTRACT,
  VIEWPORT_BORDER_DEFAULT_PALETTE_INDEX,
  renderViewportBorders,
} from '../../../src/playable/rendering-product-integration/renderViewportBorders.ts';

const EXPECTED_SOURCE_SHA256 = 'c92bffe92eebb8ba4b38c059044948f34075cb4607ab55a98a307a475673289f';
const SOURCE_PATH = 'src/playable/rendering-product-integration/renderViewportBorders.ts';

interface AuditManifest {
  readonly commandContracts: {
    readonly target: {
      readonly entryFile: string;
      readonly runtimeCommand: string;
    };
  };
  readonly explicitNullSurfaces: readonly AuditNullSurface[];
  readonly schemaVersion: number;
}

interface AuditNullSurface {
  readonly path: string | null;
  readonly reason: string;
  readonly surface: string;
}

describe('renderViewportBorders', () => {
  test('locks the Bun runtime command contract', () => {
    expect(RENDER_VIEWPORT_BORDERS_COMMAND_CONTRACT).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    });
    expect(VIEWPORT_BORDER_DEFAULT_PALETTE_INDEX).toBe(0x70);
  });

  test('links the missing viewport-border renderer audit surface', async () => {
    const auditManifest: AuditManifest = await Bun.file(RENDER_VIEWPORT_BORDERS_AUDIT_MANIFEST_PATH).json();

    expect(auditManifest.schemaVersion).toBe(1);
    expect(auditManifest.commandContracts.target).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: RENDER_VIEWPORT_BORDERS_COMMAND_CONTRACT.runtimeCommand,
    });
    expect(auditManifest.explicitNullSurfaces).toContainEqual({
      path: null,
      reason: 'No viewport border renderer path is exposed by the 01-012 read scope.',
      surface: 'viewport-border-renderer',
    });
  });

  test('locks the formatted implementation source hash', async () => {
    expect(await sha256File(SOURCE_PATH)).toBe(EXPECTED_SOURCE_SHA256);
  });

  test('fills only deterministic border pixels around a centered viewport', () => {
    const framebuffer = new Uint8Array(SCREENWIDTH * SCREENHEIGHT);
    framebuffer.fill(0x22);

    const evidence = renderViewportBorders({
      borderPaletteIndex: 0x45,
      detailMode: DetailMode.high,
      framebuffer,
      runtimeCommand: RENDER_VIEWPORT_BORDERS_COMMAND_CONTRACT.runtimeCommand,
      setBlocks: 9,
    });

    expect(evidence.borderPaletteIndex).toBe(0x45);
    expect(evidence.borderPixelCount).toBe(12_288);
    expect(evidence.borderRegion).toEqual({
      bottomExclusive: 156,
      left: 16,
      rightExclusive: 304,
      top: 12,
    });
    expect(evidence.commandContract).toBe(RENDER_VIEWPORT_BORDERS_COMMAND_CONTRACT);
    expect(evidence.detailMode).toBe(DetailMode.high);
    expect(evidence.framebuffer).toBe(framebuffer);
    expect(evidence.framebufferLength).toBe(SCREENWIDTH * SCREENHEIGHT);
    expect(evidence.runtimeCommand).toBe('bun run doom.ts');
    expect(evidence.setBlocks).toBe(9);
    expect(evidence.viewport).toEqual(computeViewport(9, DetailMode.high));
    expect(countPaletteIndex(framebuffer, 0x45)).toBe(12_288);
    expect(framebuffer[0]).toBe(0x45);
    expect(framebuffer[12 * SCREENWIDTH + 15]).toBe(0x45);
    expect(framebuffer[12 * SCREENWIDTH + 16]).toBe(0x22);
    expect(framebuffer[155 * SCREENWIDTH + 303]).toBe(0x22);
    expect(framebuffer[156 * SCREENWIDTH + 303]).toBe(0x45);
    expect(framebuffer[168 * SCREENWIDTH]).toBe(0x22);
  });

  test('keeps a full-width status-bar viewport borderless', () => {
    const framebuffer = new Uint8Array(SCREENWIDTH * SCREENHEIGHT);
    framebuffer.fill(0x33);

    const evidence = renderViewportBorders({
      detailMode: DetailMode.high,
      framebuffer,
      runtimeCommand: RENDER_VIEWPORT_BORDERS_COMMAND_CONTRACT.runtimeCommand,
      setBlocks: 10,
    });

    expect(evidence.borderPixelCount).toBe(0);
    expect(evidence.borderRegion).toEqual({
      bottomExclusive: 168,
      left: 0,
      rightExclusive: 320,
      top: 0,
    });
    expect(countPaletteIndex(framebuffer, VIEWPORT_BORDER_DEFAULT_PALETTE_INDEX)).toBe(0);
    expect(framebuffer[0]).toBe(0x33);
    expect(framebuffer[167 * SCREENWIDTH + 319]).toBe(0x33);
  });

  test('rejects invalid input before mutating framebuffer', () => {
    const framebuffer = new Uint8Array(SCREENWIDTH * SCREENHEIGHT);
    framebuffer.fill(0x22);

    expect(() =>
      renderViewportBorders({
        detailMode: DetailMode.high,
        framebuffer,
        runtimeCommand: 'bun run src/main.ts',
        setBlocks: 9,
      }),
    ).toThrow('render viewport borders requires bun run doom.ts');
    expect(countPaletteIndex(framebuffer, 0x22)).toBe(SCREENWIDTH * SCREENHEIGHT);

    expect(() =>
      renderViewportBorders({
        borderPaletteIndex: 0x100,
        detailMode: DetailMode.high,
        framebuffer,
        runtimeCommand: RENDER_VIEWPORT_BORDERS_COMMAND_CONTRACT.runtimeCommand,
        setBlocks: 9,
      }),
    ).toThrow('render viewport borders requires an 8-bit palette index');

    expect(() =>
      renderViewportBorders({
        detailMode: DetailMode.high,
        framebuffer: new Uint8Array(SCREENWIDTH * SCREENHEIGHT - 1),
        runtimeCommand: RENDER_VIEWPORT_BORDERS_COMMAND_CONTRACT.runtimeCommand,
        setBlocks: 9,
      }),
    ).toThrow('render viewport borders requires a 320x200 framebuffer');
  });
});

function countPaletteIndex(framebuffer: Uint8Array, paletteIndex: number): number {
  let matchingPixelCount = 0;

  for (const framebufferPixel of framebuffer) {
    if (framebufferPixel === paletteIndex) {
      matchingPixelCount += 1;
    }
  }

  return matchingPixelCount;
}

async function sha256File(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(await Bun.file(path).text());
  return hasher.digest('hex');
}
