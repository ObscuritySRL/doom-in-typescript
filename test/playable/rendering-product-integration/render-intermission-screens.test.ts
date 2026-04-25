import { describe, expect, test } from 'bun:test';

import { RENDER_INTERMISSION_SCREENS_COMMAND_CONTRACT, renderIntermissionScreens, type IntermissionPatchLayer, type RenderIntermissionScreensOptions } from '../../../src/playable/rendering-product-integration/renderIntermissionScreens.ts';
import { SCREENHEIGHT, SCREENWIDTH } from '../../../src/render/projection.ts';

const FRAMEBUFFER_BYTE_LENGTH = SCREENWIDTH * SCREENHEIGHT;

describe('renderIntermissionScreens', () => {
  test('locks the exact Bun command contract and missing-rendering audit schema', async () => {
    const manifest = await Bun.file('plan_fps/manifests/01-012-audit-missing-live-rendering.json').json();

    expect(RENDER_INTERMISSION_SCREENS_COMMAND_CONTRACT).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    });
    expect(Object.isFrozen(RENDER_INTERMISSION_SCREENS_COMMAND_CONTRACT)).toBe(true);
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

  test('renders entering-screen evidence with empty layers list and matches background', () => {
    const backgroundPixels = createBackgroundPixels();
    const framebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);

    const evidence = renderIntermissionScreens({
      framebuffer,
      resources: {
        backgroundPixels,
        layers: [],
        screenKind: 'entering',
        sourceName: 'WIMAP1',
      },
      runtimeCommand: 'bun run doom.ts',
      transition: {
        completedMap: 'E1M1',
        enteringMap: 'E1M2',
        totalTics: 0,
      },
    });

    expect(evidence.drawnLayerPixelCount).toBe(0);
    expect(evidence.layerCount).toBe(0);
    expect(evidence.screenKind).toBe('entering');
    expect(evidence.transitionKind).toBe('finished-to-entering');
    expect(evidence.totalTics).toBe(0);
    expect(hashBytes(framebuffer)).toBe(hashBytes(backgroundPixels));
  });

  test('skips transparent layer pixels without writing to the framebuffer', () => {
    const backgroundPixels = createBackgroundPixels();
    const framebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);
    const transparentLayer: IntermissionPatchLayer = {
      height: 2,
      pixels: new Uint8Array([255, 255, 255, 255]),
      transparentPaletteIndex: 255,
      width: 2,
      x: 0,
      y: 0,
    };

    const evidence = renderIntermissionScreens({
      framebuffer,
      resources: { backgroundPixels, layers: [transparentLayer], screenKind: 'finished', sourceName: 'WIMAP0' },
      runtimeCommand: 'bun run doom.ts',
      transition: { completedMap: 'E1M1', enteringMap: 'E1M2', totalTics: 1 },
    });

    expect(evidence.drawnLayerPixelCount).toBe(0);
    expect(framebuffer[0]).toBe(backgroundPixels[0]);
    expect(framebuffer[1]).toBe(backgroundPixels[1]);
    expect(framebuffer[SCREENWIDTH]).toBe(backgroundPixels[SCREENWIDTH]);
    expect(framebuffer[SCREENWIDTH + 1]).toBe(backgroundPixels[SCREENWIDTH + 1]);
    expect(hashBytes(framebuffer)).toBe(hashBytes(backgroundPixels));
  });

  test('clips layer pixels that fall outside the screen edges without writing', () => {
    const backgroundPixels = createBackgroundPixels();
    const framebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);
    const offScreenLayer: IntermissionPatchLayer = {
      height: 4,
      pixels: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
      transparentPaletteIndex: 0,
      width: 4,
      x: SCREENWIDTH - 2,
      y: SCREENHEIGHT - 2,
    };

    const evidence = renderIntermissionScreens({
      framebuffer,
      resources: { backgroundPixels, layers: [offScreenLayer], screenKind: 'finished', sourceName: 'WIMAP0' },
      runtimeCommand: 'bun run doom.ts',
      transition: { completedMap: 'E1M1', enteringMap: 'E1M2', totalTics: 1 },
    });

    expect(evidence.drawnLayerPixelCount).toBe(4);
    expect(framebuffer[(SCREENHEIGHT - 2) * SCREENWIDTH + (SCREENWIDTH - 2)]).toBe(1);
    expect(framebuffer[(SCREENHEIGHT - 2) * SCREENWIDTH + (SCREENWIDTH - 1)]).toBe(2);
    expect(framebuffer[(SCREENHEIGHT - 1) * SCREENWIDTH + (SCREENWIDTH - 2)]).toBe(5);
    expect(framebuffer[(SCREENHEIGHT - 1) * SCREENWIDTH + (SCREENWIDTH - 1)]).toBe(6);
  });

  test('clips layer pixels that fall above and to the left of the screen', () => {
    const backgroundPixels = createBackgroundPixels();
    const framebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);
    const offScreenLayer: IntermissionPatchLayer = {
      height: 3,
      pixels: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      transparentPaletteIndex: 0,
      width: 3,
      x: -2,
      y: -2,
    };

    const evidence = renderIntermissionScreens({
      framebuffer,
      resources: { backgroundPixels, layers: [offScreenLayer], screenKind: 'finished', sourceName: 'WIMAP0' },
      runtimeCommand: 'bun run doom.ts',
      transition: { completedMap: 'E1M1', enteringMap: 'E1M2', totalTics: 1 },
    });

    expect(evidence.drawnLayerPixelCount).toBe(1);
    expect(framebuffer[0]).toBe(9);
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

  test.each<{ readonly framebufferLength: number }>([
    { framebufferLength: 0 },
    { framebufferLength: FRAMEBUFFER_BYTE_LENGTH - 1 },
    { framebufferLength: FRAMEBUFFER_BYTE_LENGTH + 1 },
  ])('rejects framebuffers whose length is $framebufferLength', ({ framebufferLength }) => {
    const backgroundPixels = createBackgroundPixels();
    expect(() =>
      renderIntermissionScreens({
        framebuffer: new Uint8Array(framebufferLength),
        resources: { backgroundPixels, screenKind: 'finished', sourceName: 'WIMAP0' },
        runtimeCommand: 'bun run doom.ts',
        transition: { completedMap: 'E1M1', enteringMap: 'E1M2', totalTics: 0 },
      }),
    ).toThrow('Intermission framebuffer must be 320x200.');
  });

  test.each<{ readonly backgroundLength: number }>([{ backgroundLength: 0 }, { backgroundLength: FRAMEBUFFER_BYTE_LENGTH - 1 }, { backgroundLength: FRAMEBUFFER_BYTE_LENGTH + 1 }])('rejects backgrounds whose length is $backgroundLength', ({
    backgroundLength,
  }) => {
    const framebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);
    expect(() =>
      renderIntermissionScreens({
        framebuffer,
        resources: { backgroundPixels: new Uint8Array(backgroundLength), screenKind: 'finished', sourceName: 'WIMAP0' },
        runtimeCommand: 'bun run doom.ts',
        transition: { completedMap: 'E1M1', enteringMap: 'E1M2', totalTics: 0 },
      }),
    ).toThrow('Intermission background must be 320x200.');
  });

  test('rejects an unknown screen kind', () => {
    const backgroundPixels = createBackgroundPixels();
    const framebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);
    expect(() =>
      renderIntermissionScreens({
        framebuffer,
        resources: { backgroundPixels, screenKind: 'unknown' as RenderIntermissionScreensOptions['resources']['screenKind'], sourceName: 'WIMAP0' },
        runtimeCommand: 'bun run doom.ts',
        transition: { completedMap: 'E1M1', enteringMap: 'E1M2', totalTics: 0 },
      }),
    ).toThrow('Intermission screen kind must be entering, finished, or stats.');
  });

  test('rejects an empty source name', () => {
    const backgroundPixels = createBackgroundPixels();
    const framebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);
    expect(() =>
      renderIntermissionScreens({
        framebuffer,
        resources: { backgroundPixels, screenKind: 'finished', sourceName: '' },
        runtimeCommand: 'bun run doom.ts',
        transition: { completedMap: 'E1M1', enteringMap: 'E1M2', totalTics: 0 },
      }),
    ).toThrow('Intermission source name is required.');
  });

  test('rejects an empty completed map', () => {
    const backgroundPixels = createBackgroundPixels();
    const framebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);
    expect(() =>
      renderIntermissionScreens({
        framebuffer,
        resources: { backgroundPixels, screenKind: 'finished', sourceName: 'WIMAP0' },
        runtimeCommand: 'bun run doom.ts',
        transition: { completedMap: '', enteringMap: 'E1M2', totalTics: 0 },
      }),
    ).toThrow('Intermission completed map is required.');
  });

  test('rejects an empty entering map when present', () => {
    const backgroundPixels = createBackgroundPixels();
    const framebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);
    expect(() =>
      renderIntermissionScreens({
        framebuffer,
        resources: { backgroundPixels, screenKind: 'finished', sourceName: 'WIMAP0' },
        runtimeCommand: 'bun run doom.ts',
        transition: { completedMap: 'E1M1', enteringMap: '', totalTics: 0 },
      }),
    ).toThrow('Intermission entering map must be non-empty when present.');
  });

  test.each<{ readonly totalTics: number }>([{ totalTics: -1 }, { totalTics: 1.5 }, { totalTics: Number.NaN }])('rejects total tics $totalTics', ({ totalTics }) => {
    const backgroundPixels = createBackgroundPixels();
    const framebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);
    expect(() =>
      renderIntermissionScreens({
        framebuffer,
        resources: { backgroundPixels, screenKind: 'finished', sourceName: 'WIMAP0' },
        runtimeCommand: 'bun run doom.ts',
        transition: { completedMap: 'E1M1', enteringMap: 'E1M2', totalTics },
      }),
    ).toThrow('Intermission total tics must be a non-negative integer.');
  });

  test.each<{ readonly height: number }>([{ height: 0 }, { height: -1 }, { height: 1.5 }, { height: Number.NaN }])('rejects layers with height $height', ({ height }) => {
    const backgroundPixels = createBackgroundPixels();
    const framebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);
    expect(() =>
      renderIntermissionScreens({
        framebuffer,
        resources: {
          backgroundPixels,
          layers: [{ height, pixels: new Uint8Array(0), transparentPaletteIndex: 255, width: 1, x: 0, y: 0 }],
          screenKind: 'finished',
          sourceName: 'WIMAP0',
        },
        runtimeCommand: 'bun run doom.ts',
        transition: { completedMap: 'E1M1', enteringMap: 'E1M2', totalTics: 0 },
      }),
    ).toThrow('Intermission layer 0 height must be a positive integer.');
  });

  test.each<{ readonly width: number }>([{ width: 0 }, { width: -1 }, { width: 1.5 }, { width: Number.NaN }])('rejects layers with width $width', ({ width }) => {
    const backgroundPixels = createBackgroundPixels();
    const framebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);
    expect(() =>
      renderIntermissionScreens({
        framebuffer,
        resources: {
          backgroundPixels,
          layers: [{ height: 1, pixels: new Uint8Array(0), transparentPaletteIndex: 255, width, x: 0, y: 0 }],
          screenKind: 'finished',
          sourceName: 'WIMAP0',
        },
        runtimeCommand: 'bun run doom.ts',
        transition: { completedMap: 'E1M1', enteringMap: 'E1M2', totalTics: 0 },
      }),
    ).toThrow('Intermission layer 0 width must be a positive integer.');
  });

  test.each<{ readonly transparentPaletteIndex: number }>([
    { transparentPaletteIndex: -1 },
    { transparentPaletteIndex: 256 },
    { transparentPaletteIndex: 1.5 },
    { transparentPaletteIndex: Number.NaN },
  ])('rejects layers with transparent palette index $transparentPaletteIndex', ({ transparentPaletteIndex }) => {
    const backgroundPixels = createBackgroundPixels();
    const framebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);
    expect(() =>
      renderIntermissionScreens({
        framebuffer,
        resources: {
          backgroundPixels,
          layers: [{ height: 1, pixels: new Uint8Array(1), transparentPaletteIndex, width: 1, x: 0, y: 0 }],
          screenKind: 'finished',
          sourceName: 'WIMAP0',
        },
        runtimeCommand: 'bun run doom.ts',
        transition: { completedMap: 'E1M1', enteringMap: 'E1M2', totalTics: 0 },
      }),
    ).toThrow('Intermission layer 0 transparent palette index must be 0..255.');
  });

  test.each<{ readonly axis: 'x' | 'y'; readonly value: number }>([
    { axis: 'x', value: 1.5 },
    { axis: 'x', value: Number.NaN },
    { axis: 'y', value: 1.5 },
    { axis: 'y', value: Number.NaN },
  ])('rejects layers with non-integer $axis value $value', ({ axis, value }) => {
    const backgroundPixels = createBackgroundPixels();
    const framebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);
    const layer: IntermissionPatchLayer = {
      height: 1,
      pixels: new Uint8Array(1),
      transparentPaletteIndex: 255,
      width: 1,
      x: axis === 'x' ? value : 0,
      y: axis === 'y' ? value : 0,
    };

    expect(() =>
      renderIntermissionScreens({
        framebuffer,
        resources: { backgroundPixels, layers: [layer], screenKind: 'finished', sourceName: 'WIMAP0' },
        runtimeCommand: 'bun run doom.ts',
        transition: { completedMap: 'E1M1', enteringMap: 'E1M2', totalTics: 0 },
      }),
    ).toThrow(`Intermission layer 0 ${axis} must be an integer.`);
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
