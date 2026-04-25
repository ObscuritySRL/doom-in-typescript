import { describe, expect, test } from 'bun:test';

import { RENDER_AUTOMAP_OVERLAY_AND_FULL_MODE_COMMAND_CONTRACT, renderAutomapOverlayAndFullMode } from '../../../src/playable/rendering-product-integration/renderAutomapOverlayAndFullMode.ts';
import { DetailMode, SCREENHEIGHT, SCREENWIDTH } from '../../../src/render/projection.ts';

const AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-012-audit-missing-live-rendering.json';
const EXPECTED_FULL_FRAMEBUFFER_CHECKSUM = 762_377_189;
const EXPECTED_FULL_FRAMEBUFFER_SHA256 = 'b9ee93bde164ad96c9bc7a0632df9c0113e1d4fdfc3c971104d57f15fc37810d';
const EXPECTED_OVERLAY_FRAMEBUFFER_CHECKSUM = 3_890_817_733;
const EXPECTED_OVERLAY_FRAMEBUFFER_SHA256 = '9201be8e679cdc4a8276b49f1369b3d4421ff16079dd453971e22dc7566a665b';
const EXPECTED_SOURCE_SHA256 = '00cd8fb0d216ccca9264d9fd73ee57ddfd6c79974008e237dd31e9a57c9dfb8b';
const SOURCE_PATH = 'src/playable/rendering-product-integration/renderAutomapOverlayAndFullMode.ts';
const WORLD_BOUNDS = Object.freeze({
  maxX: 10,
  maxY: 10,
  minX: 0,
  minY: 0,
});

describe('renderAutomapOverlayAndFullMode', () => {
  test('locks the Bun command contract and missing-rendering audit schema', async () => {
    const auditManifestText = await Bun.file(AUDIT_MANIFEST_PATH).text();

    expect(RENDER_AUTOMAP_OVERLAY_AND_FULL_MODE_COMMAND_CONTRACT).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    });
    expect(auditManifestText).toContain('"schemaVersion": 1');
    expect(auditManifestText).toContain('"runtimeCommand": "bun run doom.ts"');
    expect(auditManifestText).toContain('"surface": "automap-renderer-implementation"');
  });

  test('locks the implementation source hash', async () => {
    expect(await sha256FromBytes(await Bun.file(SOURCE_PATH).arrayBuffer())).toBe(EXPECTED_SOURCE_SHA256);
  });

  test('renders clipped automap overlay inside the computed viewport', async () => {
    const framebuffer = new Uint8Array(SCREENWIDTH * SCREENHEIGHT);
    framebuffer.fill(3);

    const result = renderAutomapOverlayAndFullMode({
      backgroundPaletteIndex: 0,
      command: 'bun run doom.ts',
      detailMode: DetailMode.high,
      framebuffer,
      lines: [
        {
          colorIndex: 42,
          endX: 20,
          endY: 5,
          startX: -10,
          startY: 5,
        },
      ],
      mode: 'overlay',
      setBlocks: 8,
      worldBounds: WORLD_BOUNDS,
    });

    expect(result).toEqual({
      backgroundPaletteIndex: null,
      changedPixelCount: 256,
      clippedLineCount: 1,
      command: 'bun run doom.ts',
      detailMode: DetailMode.high,
      drawnPixelCount: 256,
      framebufferChecksum: EXPECTED_OVERLAY_FRAMEBUFFER_CHECKSUM,
      mode: 'overlay',
      targetHeight: 128,
      targetWidth: 256,
      targetX: 32,
      targetY: 20,
    });
    expect(framebuffer[0]).toBe(3);
    expect(framebuffer[84 * SCREENWIDTH + 32]).toBe(42);
    expect(framebuffer[84 * SCREENWIDTH + 287]).toBe(42);
    expect(await sha256FromBytes(framebuffer)).toBe(EXPECTED_OVERLAY_FRAMEBUFFER_SHA256);
  });

  test('renders full automap mode over the full framebuffer', async () => {
    const framebuffer = new Uint8Array(SCREENWIDTH * SCREENHEIGHT);
    framebuffer.fill(7);

    const result = renderAutomapOverlayAndFullMode({
      backgroundPaletteIndex: 0,
      command: 'bun run doom.ts',
      detailMode: DetailMode.high,
      framebuffer,
      lines: [
        {
          colorIndex: 91,
          endX: 10,
          endY: 10,
          startX: 0,
          startY: 0,
        },
      ],
      mode: 'full',
      setBlocks: 11,
      worldBounds: WORLD_BOUNDS,
    });

    expect(result).toEqual({
      backgroundPaletteIndex: 0,
      changedPixelCount: 64_000,
      clippedLineCount: 0,
      command: 'bun run doom.ts',
      detailMode: DetailMode.high,
      drawnPixelCount: 320,
      framebufferChecksum: EXPECTED_FULL_FRAMEBUFFER_CHECKSUM,
      mode: 'full',
      targetHeight: 200,
      targetWidth: 320,
      targetX: 0,
      targetY: 0,
    });
    expect(framebuffer[0]).toBe(0);
    expect(framebuffer[319]).toBe(91);
    expect(framebuffer[199 * SCREENWIDTH]).toBe(91);
    expect(await sha256FromBytes(framebuffer)).toBe(EXPECTED_FULL_FRAMEBUFFER_SHA256);
  });

  test('rejects the wrong command before mutating the framebuffer', () => {
    const framebuffer = new Uint8Array(SCREENWIDTH * SCREENHEIGHT);
    framebuffer.fill(9);

    expect(() =>
      renderAutomapOverlayAndFullMode({
        backgroundPaletteIndex: 0,
        command: 'bun run src/main.ts',
        detailMode: DetailMode.high,
        framebuffer,
        lines: [
          {
            colorIndex: 42,
            endX: 10,
            endY: 10,
            startX: 0,
            startY: 0,
          },
        ],
        mode: 'full',
        setBlocks: 11,
        worldBounds: WORLD_BOUNDS,
      }),
    ).toThrow('Automap rendering requires command "bun run doom.ts".');
    expect(framebuffer.every((paletteIndex) => paletteIndex === 9)).toBe(true);
  });

  test('rejects invalid line palette indexes before clearing full mode', () => {
    const framebuffer = new Uint8Array(SCREENWIDTH * SCREENHEIGHT);
    framebuffer.fill(11);

    expect(() =>
      renderAutomapOverlayAndFullMode({
        backgroundPaletteIndex: 0,
        command: 'bun run doom.ts',
        detailMode: DetailMode.high,
        framebuffer,
        lines: [
          {
            colorIndex: 256,
            endX: 10,
            endY: 10,
            startX: 0,
            startY: 0,
          },
        ],
        mode: 'full',
        setBlocks: 11,
        worldBounds: WORLD_BOUNDS,
      }),
    ).toThrow('Automap line palette index must be an integer from 0 to 255.');
    expect(framebuffer.every((paletteIndex) => paletteIndex === 11)).toBe(true);
  });
});

async function sha256FromBytes(bytes: ArrayBuffer | Uint8Array<ArrayBuffer>): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  let hash = '';

  for (const byte of new Uint8Array(hashBuffer)) {
    hash += byte.toString(16).padStart(2, '0');
  }

  return hash;
}
