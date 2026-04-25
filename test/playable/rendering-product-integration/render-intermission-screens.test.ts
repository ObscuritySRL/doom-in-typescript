import { describe, expect, test } from 'bun:test';

import { RENDER_INTERMISSION_SCREENS_COMMAND_CONTRACT, renderIntermissionScreens, type IntermissionPatchLayer } from '../../../src/playable/rendering-product-integration/renderIntermissionScreens.ts';
import { SCREENHEIGHT, SCREENWIDTH } from '../../../src/render/projection.ts';

const FRAMEBUFFER_BYTE_LENGTH = SCREENWIDTH * SCREENHEIGHT;

describe('renderIntermissionScreens', () => {
  test('locks the exact Bun command contract and missing-rendering audit schema', async () => {
    const manifest = await Bun.file('plan_fps/manifests/01-012-audit-missing-live-rendering.json').json();

    expect(RENDER_INTERMISSION_SCREENS_COMMAND_CONTRACT).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    });
    expect(manifest.commandContracts.target).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    });
    expect(manifest.explicitNullSurfaces.some((surface: { readonly surface: string }) => surface.surface === 'live-framebuffer-surface')).toBe(true);
    expect(manifest.schemaVersion).toBe(1);
  });

  test('renders a finished-map intermission background with deterministic patch layers', () => {
    const backgroundPixels = createBackgroundPixels();
    const framebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);
    const layer = createPatchLayer();

    const evidence = renderIntermissionScreens({
      framebuffer,
      resources: {
        backgroundPixels,
        layers: [layer],
        screenKind: 'finished',
        sourceName: 'WIMAP0',
      },
      runtimeCommand: 'bun run doom.ts',
      transition: {
        completedMap: 'E1M1',
        enteringMap: 'E1M2',
        totalTics: 3_500,
      },
    });

    expect(evidence).toEqual({
      backgroundByteLength: FRAMEBUFFER_BYTE_LENGTH,
      completedMap: 'E1M1',
      drawnLayerPixelCount: 9,
      enteringMap: 'E1M2',
      framebufferChecksum: 3_888_271_315,
      layerCount: 1,
      runtimeCommand: 'bun run doom.ts',
      screenHeight: 200,
      screenKind: 'finished',
      screenWidth: 320,
      sourceName: 'WIMAP0',
      totalTics: 3_500,
      transitionKind: 'finished-to-entering',
    });
    expect(framebuffer[9 * SCREENWIDTH + 7]).toBe(backgroundPixels[9 * SCREENWIDTH + 7]);
    expect(framebuffer[9 * SCREENWIDTH + 8]).toBe(31);
    expect(framebuffer[10 * SCREENWIDTH + 8]).toBe(42);
    expect(framebuffer[11 * SCREENWIDTH + 10]).toBe(54);
    expect(hashBytes(framebuffer)).toBe('407f74eca6f8b92bbea9c62263dbaff7798bd45c320cc4df405fb0b61904d4c0');
  });

  test('returns episode-complete transition evidence when no entering map remains', () => {
    const backgroundPixels = createBackgroundPixels();
    const framebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);
    const evidence = renderIntermissionScreens({
      framebuffer,
      resources: {
        backgroundPixels,
        screenKind: 'stats',
        sourceName: 'WIMAP0',
      },
      runtimeCommand: 'bun run doom.ts',
      transition: {
        completedMap: 'E1M8',
        enteringMap: null,
        totalTics: 12_345,
      },
    });

    expect(evidence.drawnLayerPixelCount).toBe(0);
    expect(evidence.enteringMap).toBeNull();
    expect(evidence.screenKind).toBe('stats');
    expect(evidence.transitionKind).toBe('episode-complete');
    expect(hashBytes(framebuffer)).toBe(hashBytes(backgroundPixels));
  });

  test('rejects wrong runtime commands before mutating the framebuffer', () => {
    const backgroundPixels = createBackgroundPixels();
    const framebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);
    framebuffer.fill(77);

    expect(() =>
      renderIntermissionScreens({
        framebuffer,
        resources: {
          backgroundPixels,
          screenKind: 'entering',
          sourceName: 'WIMAP0',
        },
        runtimeCommand: 'bun run src/main.ts',
        transition: {
          completedMap: 'E1M1',
          enteringMap: 'E1M2',
          totalTics: 0,
        },
      }),
    ).toThrow('Intermission screens require bun run doom.ts.');
    expect(framebuffer.every((paletteIndex) => paletteIndex === 77)).toBe(true);
  });

  test('rejects invalid layer buffers before mutating the framebuffer', () => {
    const backgroundPixels = createBackgroundPixels();
    const framebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);
    framebuffer.fill(88);

    expect(() =>
      renderIntermissionScreens({
        framebuffer,
        resources: {
          backgroundPixels,
          layers: [
            {
              height: 2,
              pixels: new Uint8Array(3),
              transparentPaletteIndex: 255,
              width: 2,
              x: 0,
              y: 0,
            },
          ],
          screenKind: 'finished',
          sourceName: 'WIMAP0',
        },
        runtimeCommand: 'bun run doom.ts',
        transition: {
          completedMap: 'E1M1',
          enteringMap: 'E1M2',
          totalTics: 0,
        },
      }),
    ).toThrow('Intermission layer 0 pixel buffer must match width * height.');
    expect(framebuffer.every((paletteIndex) => paletteIndex === 88)).toBe(true);
  });
});

function createBackgroundPixels(): Uint8Array<ArrayBuffer> {
  const backgroundPixels = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);

  for (let pixelIndex = 0; pixelIndex < backgroundPixels.length; pixelIndex += 1) {
    const columnIndex = pixelIndex % SCREENWIDTH;
    const rowIndex = Math.floor(pixelIndex / SCREENWIDTH);
    backgroundPixels[pixelIndex] = (columnIndex * 5 + rowIndex * 11 + pixelIndex) & 0xff;
  }

  return backgroundPixels;
}

function createPatchLayer(): IntermissionPatchLayer {
  return {
    height: 3,
    pixels: new Uint8Array([255, 31, 32, 255, 41, 42, 255, 44, 51, 52, 53, 54]),
    transparentPaletteIndex: 255,
    width: 4,
    x: 7,
    y: 9,
  };
}

function hashBytes(bytes: Uint8Array): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(bytes);
  return hasher.digest('hex');
}
